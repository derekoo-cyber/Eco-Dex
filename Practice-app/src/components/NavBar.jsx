import '../navbar.css';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';

function NavBar() {
  const location = useLocation();
  return (
    <nav className="navbar-container">
      <div className="navbar-inner">
        <div className="navbar-flex">
          {/* Logo */}
          <motion.div
            className="navbar-logo"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Eco-Dex
          </motion.div>

          {/* Centered Menu */}
          <motion.div
            className="navbar-menu"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: 0.1,
                  delay: 0.3
                }
              }
            }}
          >
            <motion.div
              variants={{
                hidden: { y: -10, opacity: 0 },
                visible: { y: 0, opacity: 1 }
              }}
              whileHover={{ scale: 1.05, color: "#10B981" }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Link
                to="/"
                className={`navbar-link ${location.pathname === '/' ? 'active' : ''}`}
              >
                Home
              </Link>
            </motion.div>
            <motion.div
              variants={{
                hidden: { y: -10, opacity: 0 },
                visible: { y: 0, opacity: 1 }
              }}
              whileHover={{ scale: 1.05, color: "#10B981" }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Link
                to="/recent"
                className={`navbar-link ${location.pathname === '/recent' ? 'active' : ''}`}
              >
                Recent Scans
              </Link>
            </motion.div>
          </motion.div>

          {/* Mobile Menu */}
          <motion.div
            className="navbar-mobile"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            <button className="navbar-mobile-btn">
              <svg
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                ></path>
              </svg>
            </button>
          </motion.div>
        </div>
      </div>
    </nav>
  );
}

export default NavBar;
