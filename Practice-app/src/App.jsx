import Component from "./components/Component.jsx";
import NavBar from "./components/NavBar.jsx";
import RecentlyViewed from "./components/RecentlyViewed.jsx";
import 'bootstrap/dist/css/bootstrap.min.css';
import ProductDetails from "./components/ProductDetails.jsx";
import { motion } from 'framer-motion';
import { Routes, Route } from 'react-router-dom';

// ...

function App() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <NavBar />
      </motion.div>
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <Routes>
          <Route path="/" element={<Component />} />
          <Route path="/recent" element={<RecentlyViewed />} />
        </Routes>
      </motion.div>
    </motion.div>
  );
}

export default App
