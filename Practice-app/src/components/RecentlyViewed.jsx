import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function RecentlyViewed() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("recentProducts");
      setItems(saved ? JSON.parse(saved) : []);
    } catch {
      setItems([]);
    }
  }, []);

  const onSelect = (item) => {
    // Save selected item for home page to load
    localStorage.setItem("selectedProduct", JSON.stringify(item));
    navigate("/");
  };
  if (!items.length) {
    return (
      <div className="min-h-screen bg-black text-green-400 p-6">
        <Card className="bg-zinc-950 border border-green-800/60 text-green-300 shadow-lg shadow-green-900/30">
          <CardHeader>
            <CardTitle className="text-green-400 font-semibold tracking-wide">Recently Viewed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-gray-500 py-8 italic">
              No recent products yet. Scan something to get started.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-green-400 p-6">
      <Card className="bg-zinc-950 border border-green-800/60 text-green-300 shadow-lg shadow-green-900/30">
      <CardHeader>
        <CardTitle className="text-green-400 font-semibold tracking-wide">Recently Viewed</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64 rounded-md border border-green-800/40">
          <motion.div
            className="flex flex-col gap-3 p-3"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: 0.1
                }
              }
            }}
          >
            {items.map((item, i) => (
              <motion.div
                key={i}
                className="flex justify-between items-center p-3 bg-zinc-900 rounded-lg border border-green-700/40 hover:border-green-500 transition-all"
                variants={{
                  hidden: { opacity: 0, x: -10 },
                  visible: { opacity: 1, x: 0 }
                }}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                <div>
                  <p className="font-medium text-green-400 truncate w-40">
                    {item.product_name || "Unknown Product"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {item.brands || "No Brand Info"}
                  </p>
                </div>
                <Button
                  onClick={() => onSelect(item)}
                  variant="outline"
                  className="border-green-600 text-green-300 hover:bg-green-700/20 hover:text-green-100 transition-all"
                >
                  View
                </Button>
              </motion.div>
            ))}
          </motion.div>
        </ScrollArea>
      </CardContent>
    </Card>
    </div>
  );
}

export default RecentlyViewed;
