import { useState, useRef, useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import ProductDetails from "./ProductDetails";

import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { motion } from 'framer-motion';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

function Component() {
  const [result, setResult] = useState("");
  const [scanActive, setScanActive] = useState(false);
  const processingRef = useRef(false);
  const lastDetectedCode = useRef(null);
  const [productData, setProductData] = useState(null);
  const [error, setError] = useState("");
  const scannerRef = useRef(null);
  const [scanHistory, setScanHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("scanHistory");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [recentProducts, setRecentProducts] = useState(() => {
    try {
      const saved = localStorage.getItem("recentProducts");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (scanActive) {
      // Initialize scanner
      scannerRef.current = new Html5QrcodeScanner(
        "reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          // Remove supportedScanTypes to allow all barcode types
        },
        false
      );

      scannerRef.current.render(
        (decodedText) => {
          console.log('🎉 Barcode detected:', decodedText);

          // Prevent duplicate detections
          if (lastDetectedCode.current === decodedText || processingRef.current) {
            console.log('Duplicate or processing, skipping');
            return;
          }

          lastDetectedCode.current = decodedText;
          processingRef.current = true;

          setResult(decodedText);
          setScanActive(false);

          // Stop scanner
          if (scannerRef.current) {
            scannerRef.current.clear();
          }

          handleScan(decodedText).finally(() => {
            processingRef.current = false;
          });
        },
        (error) => {
          // Ignore scan errors, they're normal
          console.log('Scan error (normal):', error);
        }
      );
    } else {
      // Stop scanner when not active
      if (scannerRef.current) {
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    };
  }, [scanActive]);

  const handleScan = async (barcode) => {
    if (!barcode) return;
    if (productData && productData.barcode === barcode) {
      console.log("Already scanned this barcode, skipping API call");
      return;
    }
    setError("");
    console.log("Making API call for barcode:", barcode);
    try {
      // Use proxy for development to avoid CORS issues
      const apiUrl = import.meta.env.DEV
        ? "/api/barcode"
        : "https://eco-dex.onrender.com/api/barcode";

      console.log("API URL:", apiUrl);
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode }),
      });

      console.log("API response status:", res.status);
      if (!res.ok) {
        const errorText = await res.text();
        console.error("API error response:", errorText);
        setError(`API Error: ${res.status} ${res.statusText}`);
        return;
      }

      const data = await res.json();
      console.log("API response data:", data);

      if (data.error || data.Error) {
        console.error("API returned error:", data.error || data.Error);
        setError(data.error || data.Error);
        return;
      }

      if (!data.product_name && !data.brands) {
        console.log("Product not found - no product_name or brands in response");
        setError("Product not found in database");
        return;
      }

      console.log("Setting product data:", data);
      data.barcode = data.barcode ?? barcode;
      setProductData(data);

      // Add to scan history
      setScanHistory((prev) => {
        const newHistory = [...prev, {
          timestamp: Date.now(),
          barcode: data.barcode,
          product_name: data.product_name || "Unknown Product",
          overall_sustainability_score: data.overall_sustainability_score
        }];
        localStorage.setItem("scanHistory", JSON.stringify(newHistory));
        return newHistory;
      });

      setRecentProducts((prev) => {
        const updated = [data, ...prev.filter((p) => p.barcode !== data.barcode)];
        const sliced = updated.slice(0, 6);
        localStorage.setItem("recentProducts", JSON.stringify(sliced));
        return sliced;
      });
    } catch (err) {
      console.error("handleScan error:", err);
      setError(`Network error: ${err.message}`);
    }
  };

  // Check for selected product from Recent Scans page
  useEffect(() => {
    const selected = localStorage.getItem("selectedProduct");
    if (selected) {
      try {
        const product = JSON.parse(selected);
        setProductData(product);
        setResult(product.barcode ?? "");
      } catch (e) {
        console.error("Error parsing selected product:", e);
      }
      localStorage.removeItem("selectedProduct");
    }
  }, []);

  const handleSelectRecent = (item) => {
    setProductData(item);
    setResult(item.barcode ?? "");
  };

  // Analytics computation
  const totalScans = scanHistory.length;
  const recentScansByDate = scanHistory.reduce((acc, scan) => {
    const date = new Date(scan.timestamp).toDateString();
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});
  const uniqueProducts = scanHistory.reduce((acc, scan) => {
    acc[scan.barcode] = scan;
    return acc;
  }, {});
  const sortedProducts = Object.values(uniqueProducts).sort((a, b) => b.overall_sustainability_score - a.overall_sustainability_score);
  const highestScoreProduct = sortedProducts[0] || null;

  return (
    <div className="min-h-screen bg-black text-green-400 flex flex-col p-6 gap-6">
      {/* Scanner Section */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left: Scanner */}
        <Card className="md:w-1/2 bg-zinc-950 border border-green-800/60 text-green-300 shadow-lg shadow-green-900/30">
          <CardHeader>
            <CardTitle className="text-green-400 font-semibold tracking-wide">
              Barcode Scanner
            </CardTitle>
          </CardHeader>

          <CardContent>
            {!scanActive && (
              <>
                <Button
                  onClick={() => {
                    setResult("");
                    setProductData(null);
                    setError("");
                    lastDetectedCode.current = null;
                    processingRef.current = false;
                    setScanActive(true);
                  }}
                  className="w-full bg-emerald-500 text-black font-semibold py-2 rounded-lg hover:scale-[1.02] hover:shadow-[0_0_20px_#10B981] transition-all duration-300">
                  Start Scan
                </Button>
              </>
            )}

            {scanActive && (
              <>
                <div className="relative mt-4 border border-green-700/40 rounded-lg overflow-hidden">
                  <div id="reader" className="w-full" style={{ minHeight: '320px' }}></div>
                </div>

                <div className="mt-4 text-sm text-gray-300">
                  Status: Scanning for barcodes... Point your camera at a barcode.
                </div>

                {/* Stop Scan Button */}
                <Button
                  onClick={() => setScanActive(false)}
                  className="w-full mt-4 bg-red-600 hover:bg-red-500 text-white font-semibold transition-all duration-200 active:scale-95"
                >
                  Stop Scan
                </Button>
              </>
            )}

            <div className="mt-5">
              <p className="text-sm text-gray-400">Scanned code:</p>
              <div className="font-mono mt-1 text-green-300 bg-zinc-900 border border-green-700/40 p-3 rounded-lg min-h-[60px]">
                {result || <span className="text-gray-600 italic">No barcode detected yet</span>}
                {error && <div className="text-red-500 text-xs mt-2">{error}</div>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Product Details */}
        <div className="md:w-1/2 flex flex-col gap-4">
          <Card className="bg-zinc-950 border border-green-800/60 text-green-300 shadow-lg shadow-green-900/30">
            <CardHeader>
              <CardTitle className="text-green-400 font-semibold tracking-wide">
                Product Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {productData ? (
                <ProductDetails data={productData} />
              ) : (
                <div className="text-center text-gray-500 py-10 italic">
                  Product details will appear here after scanning
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    


      {/* Analytics Section */}
      <motion.div
        className="flex flex-col gap-6"
        variants={{
          hidden: { opacity: 0, y: 20 },
          visible: { opacity: 1, y: 0 }
        }}
        transition={{ duration: 0.6, delay: 0.6 }}
      >
        <Card className="bg-zinc-950 border border-green-800/60 text-green-300 shadow-lg shadow-green-900/30">
          <CardHeader>
            <CardTitle className="text-green-400 font-semibold tracking-wide">
              User Usage Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-lg font-semibold text-green-400">Total Scans: <span className="text-white">{totalScans}</span></p>
              </div>
              <div>
                <p className="text-md font-semibold text-green-400">Scans Over Time:</p>
                {Object.keys(recentScansByDate).length > 0 ? (
                  <div className="mt-2 h-64">
                    <Line
                      data={{
                        labels: Object.keys(recentScansByDate).sort((a, b) => new Date(a) - new Date(b)),
                        datasets: [{
                          label: 'Scans',
                          data: Object.keys(recentScansByDate).sort((a, b) => new Date(a) - new Date(b)).map(date => recentScansByDate[date]),
                          borderColor: '#10B981',
                          backgroundColor: 'rgba(16, 185, 129, 0.2)',
                          borderWidth: 3,
                          tension: 0.1,
                          pointRadius: 4,
                          pointBackgroundColor: '#10B981',
                          pointBorderColor: '#ffffff',
                          pointHoverRadius: 6
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: { color: '#D1D5DB' },
                            grid: {
                              color: '#374151'
                            }
                          },
                          x: {
                            ticks: { color: '#D1D5DB' },
                            grid: {
                              color: '#374151'
                            }
                          }
                        },
                        plugins: {
                          legend: {
                            labels: { color: '#D1D5DB' }
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-center text-gray-500 italic py-10">
                    No scans yet
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border border-green-800/60 text-green-300 shadow-lg shadow-green-900/30">
          <CardHeader>
            <CardTitle className="text-green-400 font-semibold tracking-wide">
              Scanned Products Range (By Sustainability Score)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {highestScoreProduct && (
              <div className="mb-4 p-3 bg-green-900/20 border border-green-700 rounded-lg">
                <p className="text-green-400 font-semibold">✨ Most Sustainable Product:</p>
                <p className="text-white">{highestScoreProduct.product_name} (Score: {highestScoreProduct.overall_sustainability_score})</p>
              </div>
            )}
            {sortedProducts.length > 0 ? (
              <div className="h-64">
                <Bar
                  data={{
                    labels: sortedProducts.slice(0, 10).map(p => p.product_name.length > 20 ? p.product_name.slice(0, 20) + '...' : p.product_name),
                    datasets: [{
                      label: 'Sustainability Score',
                      data: sortedProducts.slice(0, 10).map(p => p.overall_sustainability_score),
                      backgroundColor: sortedProducts.slice(0, 10).map((p, i) => p.barcode === highestScoreProduct?.barcode ? '#10B981' : 'rgba(16, 185, 129, 0.5)'),
                      borderColor: '#10B981',
                      borderWidth: 1
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { color: '#D1D5DB' }
                      },
                      x: {
                        ticks: { color: '#D1D5DB', font: { size: 10 } }
                      }
                    },
                    plugins: {
                      legend: {
                        labels: { color: '#D1D5DB' }
                      },
                      tooltip: {
                        callbacks: {
                          title: function(context) {
                            return sortedProducts.slice(0, 10)[context[0].dataIndex].product_name;
                          }
                        }
                      }
                    }
                  }}
                />
              </div>
            ) : (
              <div className="text-center text-gray-500 italic py-10">
                No products scanned yet
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>


    </div>
  );
}

export default Component;
