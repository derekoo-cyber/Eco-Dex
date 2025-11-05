import { useState, useRef, useEffect } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
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
  const videoRef = useRef(null);
  const [scanActive, setScanActive] = useState(false);
  const processingRef = useRef(false);
  const lastDetectedCode = useRef(null);
  const [productData, setProductData] = useState(null);
  const [error, setError] = useState("");
  const [cameraPermission, setCameraPermission] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanningStatus, setScanningStatus] = useState('idle');
  const [scanTimeoutId, setScanTimeoutId] = useState(null);
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
    if (!scanActive) return;

    const startScanning = async () => {
      setScanningStatus('starting-camera');

      // Check permissions first
      const hasPermission = await checkCameraPermissions();
      if (!hasPermission) return;

      try {
        const reader = new BrowserMultiFormatReader();
        console.log('Starting ZXing reader...');

        await reader.decodeFromVideoDevice(null, videoRef.current, (res, err) => {
          if (err) {
            // NotFoundException is normal when no barcode is visible, ignore
            if (!err.name.includes("NotFoundException")) {
              // Real errors like camera disconnection
              console.error('ZXing scan error:', err);
              setError(`Scan error: ${err.message}`);
              setScanningStatus('error');
              stopCamera();
              setScanActive(false);
            }
            return;
          }

          if (res) {
            const code = res.getText();

            // Prevent duplicate detections for the same barcode in session
            if (lastDetectedCode.current === code || processingRef.current) return;

            lastDetectedCode.current = code;
            processingRef.current = true;
            console.log('Barcode detected:', code);
            setScanningStatus('detected');
            if (scanTimeoutId) clearTimeout(scanTimeoutId);
            setScanTimeoutId(null);

            setResult(code);
            stopCamera();
            setScanActive(false);
            handleScan(code).finally(() => {
              processingRef.current = false;
            });
          } else {
            // Still scanning, update status if not already set
            if (scanningStatus !== 'scanning') {
              setScanningStatus('scanning');
              setCameraActive(true);
            }
          }
        });

        console.log('ZXing reader started successfully');

        // Set timeout for scanning (30 seconds)
        const timeoutId = setTimeout(() => {
          console.log('Scan timeout reached');
          setScanningStatus('timeout');
          setError('Scan timeout - no barcode detected within 30 seconds');
          stopScan();
        }, 30000);
        setScanTimeoutId(timeoutId);

      } catch (e) {
        console.error("Camera start error:", e);
        if (e.message.includes("NotFoundException")) {
          // No barcode found, treat as timeout
          setScanningStatus('timeout');
          setError('No barcode detected. Please try again.');
        } else {
          setError(`Failed to start camera: ${e.message}`);
          setScanningStatus('error');
        }
        stopCamera();
        setScanActive(false);
      }
    };

    startScanning();

    return () => {
      if (scanTimeoutId) {
        clearTimeout(scanTimeoutId);
        setScanTimeoutId(null);
      }
      stopCamera();
      setScanningStatus('idle');
    };
  }, [scanActive]);

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const stopScan = () => {
    console.log('Stopping scan manually');
    if (scanTimeoutId) {
      clearTimeout(scanTimeoutId);
      setScanTimeoutId(null);
    }
    stopCamera();
    setScanActive(false);
    setScanningStatus('idle');
  };

  const checkCameraPermissions = async () => {
    setScanningStatus('checking-permissions');
    setError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera not supported on this device');
      setScanningStatus('error');
      return false;
    }

    let permissionGranted = false;

    try {
      // Try modern permissions API first
      const result = await navigator.permissions.query({ name: 'camera' });
      console.log('Camera permission status:', result.state);
      setCameraPermission(result.state);

      if (result.state === 'denied') {
        setError('Camera permission denied. Please allow camera access and try again.');
        setScanningStatus('error');
        return false;
      }

      if (result.state === 'granted') {
        return true;
      }

      // If status is 'prompt', try to request permission by calling getUserMedia
      console.log('Permission status is prompt, requesting camera access...');
    } catch (e) {
      console.log('Permissions API not supported, falling back to getUserMedia');
    }

    // Try to get camera access (either because permissions API returned 'prompt' or it's not supported)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop()); // Stop test stream
      setCameraPermission('granted');
      console.log('Camera access granted successfully');
      return true;
    } catch (requestError) {
      console.error('Camera access request failed:', requestError);
      setCameraPermission('denied');
      setError(`Camera access failed: ${requestError.message}. Please allow camera access and try again.`);
      setScanningStatus('error');
      return false;
    }
  };

  const handleScan = async (barcode) => {
    if (!barcode) return;
    if (productData && productData.barcode === barcode) {
      console.log("Already scanned this barcode, skipping API call");
      return;
    }
    setError("");
    try {
      // Minimal logging
      const res = await fetch("https://eco-dex-backend.onrender.com/api/barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("API error response:", errorText);
        setError(`API Error: ${res.status} ${res.statusText}`);
        return;
      }

      const data = await res.json();

      if (data.error || data.Error) {
        setError(data.error || data.Error);
        return;
      }

      if (!data.product_name && !data.brands) {
        setError("Product not found in database");
        return;
      }

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
                  <video ref={videoRef} className="w-full h-80 bg-black object-cover" autoPlay />
                  <div className={`absolute inset-0 border-2 animate-pulse rounded-lg pointer-events-none ${
                    scanningStatus === 'scanning' ? 'border-green-400/40' :
                    scanningStatus === 'checking-permissions' ? 'border-yellow-400/40' :
                    scanningStatus === 'starting-camera' ? 'border-blue-400/40' :
                    scanningStatus === 'detected' ? 'border-green-600/60' :
                    scanningStatus === 'error' ? 'border-red-400/40' :
                    'border-gray-400/40'
                  }`} />
                </div>

                {/* Status Indicators */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    {cameraPermission === 'granted' ? (
                      <span className="text-green-400">✓ Camera permission granted</span>
                    ) : cameraPermission === 'denied' ? (
                      <span className="text-red-400">✗ Camera permission denied</span>
                    ) : cameraPermission === 'prompt' ? (
                      <span className="text-yellow-400">⚠ Camera permission required</span>
                    ) : null}
                  </div>

                  <div className="text-sm text-gray-300">
                    Status: {
                      scanningStatus === 'checking-permissions' ? 'Checking camera permissions...' :
                      scanningStatus === 'starting-camera' ? 'Starting camera...' :
                      scanningStatus === 'scanning' ? 'Scanning for barcodes...' :
                      scanningStatus === 'detected' ? 'Barcode detected!' :
                      scanningStatus === 'timeout' ? 'Scan timeout' :
                      scanningStatus === 'error' ? 'Scan error' :
                      'Idle'
                    }
                  </div>
                </div>

                {/* Stop Scan Button */}
                <Button
                  onClick={stopScan}
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
