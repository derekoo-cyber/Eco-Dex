from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import requests, os, json
load_dotenv()

from google import genai

app = Flask(__name__)
CORS(app)

CARBON_API_KEY = "Y5vaoL3kvreOztvbA6V0fw"
CARBON_API_URL = "https://www.carboninterface.com/api/v1/estimates"
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
client = genai.Client(api_key=GOOGLE_API_KEY)


# ✅ Helper to always ensure JSON parsing even if headers missing
def get_json_request():
    try:
        if request.is_json:
            return request.get_json()
        else:
            return json.loads(request.data.decode('utf-8'))
    except Exception:
        return {}


@app.route('/api/barcode', methods=['POST', 'OPTIONS'])
def barcode():
    data = request.get_json()
    barcode_value = data.get('barcode')
    api_url = f"https://world.openfoodfacts.org/api/v0/product/{barcode_value}.json"
    try:
        response=requests.get(api_url)
        if response.status_code != 200:
            return jsonify({"error":"Failed to reach OpenFoodFacts"}),500
        
        product_data = response.json()
        
        #First trys to find it in OpenFOodFacts API

        if product_data.get("status")==1:
            product = product_data["product"]

            ecoscore_value = product.get("ecoscore_value", 0) or 0
            packaging = product.get("packaging", "Unknown")
            recyclable = "recyclable" in (packaging or "").lower()

            headers = {
                "Authorization":f"Bearer {CARBON_API_KEY}",
                "Content-Type":"application/json"
            }

            payload = {
                "type": "electricity",
                "electricity_unit":"kwh",
                "electricity_value": 5,
                "country":"us"
            }
            carbon_response = requests.post(CARBON_API_URL, headers=headers, json=payload)
            carbon_emission_kg = 0

            if carbon_response.status_code == 201:
                carbon_data = carbon_response.json()
                carbon_emission_kg = (
                    carbon_data.get("data", {}).get("attributes", {}).get("carbon_mt", 0)*1000 #calculation for carbon emission
                )

            #Sustainality score 0-100
            eco_component = (ecoscore_value or 0)*0.6
            packaging_component = (20 if recyclable else 10)
            carbon_component = max(0, 20 - (carbon_emission_kg / 10))

            total_sustainability_score = round(eco_component + packaging_component + carbon_component, 2)

            sustainability_data = {
                "barcode": barcode_value,
                "product_name": product.get("product_name","Unknown"),
                "brands":product.get("brands","Unknown"),
                "nutriscore":product.get("nutriscore_grade","N/A"),
                "recyclable": "recyclable" in (product.get("packaging", "") or "").lower(),
                "image_url": product.get("image_front_small_url"),
                "eco-score":product.get("ecoscore_value"),
                "eco-grade":product.get("ecoscore_grade","N/A"),
                "packaging": product.get("packaging", "Unknown"),
                "label":product.get("label","None"),
                "carbon_emission_kg":carbon_emission_kg,
                "overall_sustainability_score":total_sustainability_score,
                }
            return jsonify(sustainability_data)
        else:
            return jsonify({"Error":"Product not found"}), 404
        
    except Exception as e:
        print(f"Suggest alternatives error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
@app.route("/api/suggest_alternatives", methods= ["POST","OPTIONS"])
def suggest_alternatives():
    if request.method == 'OPTIONS':
        return '', 204
    data = request.get_json()
    product_name = data.get("product_name","")
    
    if not product_name:
        return jsonify({"error": "product_name required"}), 400
    
    prompt = (f"You are a sustainable product recommender. Given the product '{product_name}', "
        "list 3 alternative eco-friendly products. For each: include name, short reason, brand, and image URL. "
        "Return as a JSON array of objects.")
    try:
        response = client.models.generate_content(model='models/gemini-2.5-flash-lite', contents=[prompt])
        # Handle different response structures
        if hasattr(response, 'text'):
            text = response.text
        elif hasattr(response, 'candidates') and response.candidates:
            text = response.candidates[0].content.parts[0].text
        else:
            text = "Failed to get response text"
        text = text or ""
        # Clean AI response (remove markdown code blocks if present)
        text = text.strip()
        if text.startswith("```json"):
            text = text[len("```json"):].strip()
        if text.endswith("```"):
            text = text[:-len("```")].strip()
        try:
            suggestions = json.loads(text)
        except Exception:
            print(f"Failed to parse AI response as JSON: {text}")
            suggestions = []
        print(json.dumps({"suggestions": suggestions}, indent=4))
        return jsonify({"suggestions": suggestions})
    except Exception as e:
        print(f"AI API error: {e}")
        suggestions = {"suggestions": []}
        print(json.dumps(suggestions, indent=4))
        return jsonify(suggestions)


if __name__ == '__main__':
    app.run(debug=True)

