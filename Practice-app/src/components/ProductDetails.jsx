import { useState,useEffect, useRef } from "react";
import { motion } from 'framer-motion';

export default function ProductDetails({ data }) {
  if (!data) return null;

  const [alternatives, setAlternatives] = useState([]);
  const [loadingAlt, setLoadingAlt] = useState(false);
  const [errorAlt, setErrorAlt] = useState(false);
  const lastFetchedProduct = useRef(null);

  // tolerate multiple possible key names from backend
  const ecoScore = data["eco-score"] ?? data.eco_score ?? data.ecoscore_value ?? "N/A";
  const ecoGrade = data["eco-grade"] ?? data.eco_grade ?? data.ecoscore_grade ?? "N/A";
  const imageUrl = data.image_url ?? data.image_front_small_url ?? data.image_front_url ?? "";
  const barcode = data.barcode ?? data.code ?? data.barcode_value ?? "N/A";
  const carbon = data.carbon_emission_kg ?? data.carbon_emission ?? 0;

  useEffect(() => {
    if (data?.product_name && lastFetchedProduct.current !== data.product_name) {
      fetchAlternatives(data.product_name);
      lastFetchedProduct.current = data.product_name;
    }
  }, [data]);

  async function fetchAlternatives(productName){
    console.log("fetchAlternatives called with", productName);
    try{
      setLoadingAlt(true);
      setErrorAlt("");

      const response = await fetch("https://eco-dex.onrender.com/api/suggest_alternatives", {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
        },
        body: JSON.stringify({ product_name: productName }),
      });
      if (!response.ok) throw new Error("Request failed ! ");

      const resData = await response.json();
      setAlternatives(resData.suggestions || []);
    }
    catch (e){
      console.error(e);
      setErrorAlt("Failed to fetch AI powered suggestions");
    }
    finally{
      setLoadingAlt(false);
    }
  }



  return (
    <motion.div
      className="w-full bg-zinc-900 text-white rounded-lg shadow-md border border-green-800/60 p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="flex flex-col md:flex-row gap-6">
        <motion.div
          className="flex-shrink-0"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {imageUrl ? (
            <motion.img
              src={imageUrl}
              alt={data.product_name ?? "Product image"}
              className="w-36 h-36 object-contain rounded-md border border-green-800/60"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            />
          ) : (
            <motion.div
              className="w-36 h-36 rounded-md bg-zinc-800 flex items-center justify-center text-sm text-gray-400 border border-green-800/60"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              No Image
            </motion.div>
          )}
        </motion.div>

        <div className="flex-1">
          <motion.h2
            className="text-xl font-semibold mb-1 text-green-400"
            initial={{ x: -10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            {data.product_name ?? "Unknown product"}
          </motion.h2>
          <motion.p
            className="text-sm text-gray-400 mb-3"
            initial={{ x: -10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            Brand: {data.brands ?? "Unknown"}
          </motion.p>

          <motion.div
            className="grid grid-cols-2 gap-2 text-sm"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: 0.1,
                  delayChildren: 0.6
                }
              }
            }}
          >
            {[
              { label: "Barcode", value: barcode },
              { label: "Nutri-Score", value: data.nutriscore ?? data.nutriscore_grade ?? "N/A" },
              { label: "Eco Grade", value: ecoGrade },
              { label: "Eco Score", value: ecoScore },
              { label: "Carbon (kg)", value: Number(carbon).toFixed(2) },
              { label: "Recyclable", value: data.recyclable ? "Yes ♻️" : "No" },
              { label: "Packaging", value: data.packaging ?? "Unknown", span: true },
              { label: "Overall Sustainability Score", value: data.overall_sustainability_score ?? "N/A", span: true }
            ].map((item, index) => (
              <motion.div
                key={index}
                className={item.span ? "col-span-2" : ""}
                variants={{
                  hidden: { opacity: 0, scale: 0.9 },
                  visible: { opacity: 1, scale: 1 }
                }}
              >
                <div className="text-xs text-gray-500">{item.label}</div>
                <div className="font-medium text-green-300">{item.value}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      <motion.div
        className="mt-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.2 }}
      >
        <h3 className="text-lg font-semibold mb-3 text-green-400"> Alternatives</h3>
        {loadingAlt && <p className="text-gray-400">Loading suggestions...</p>}
        {errorAlt && <p className="text-red-400">{errorAlt}</p>}
        {!loadingAlt && !errorAlt && alternatives.length > 0 && (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: 0.2,
                  delayChildren: 1.4
                }
              }
            }}
          >
            {alternatives.map((alt, index) => (
              <motion.div
                key={index}
                className="bg-zinc-800 p-4 rounded-md border border-green-800/60"
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0 }
                }}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.3 }}
              >
                {alt.image && (
                  <img
                    src={alt.image}
                    alt={alt.name}
                    className="w-full h-24 object-cover rounded mb-2"
                  />
                )}
                <h4 className="font-semibold text-green-300">{alt.name}</h4>
                <p className="text-sm text-gray-300">{alt.reason}</p>
                <p className="text-xs text-gray-400">Brand: {alt.brand}</p>
              </motion.div>
            ))}
          </motion.div>
        )}
        {!loadingAlt && !errorAlt && alternatives.length === 0 && (
          <p className="text-gray-400">No suggestions available.</p>
        )}
      </motion.div>
    </motion.div>
  );
}
