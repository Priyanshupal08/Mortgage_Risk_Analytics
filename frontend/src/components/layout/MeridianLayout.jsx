import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AlabasterAmbientBackground from '../3d/SceneBackground';
import FloatingAlabasterPillar from './MeridianSidebar';
import Dock from './Dock';
import './MeridianLayout.css';

export default function MeridianLayout() {
  const location = useLocation();
  return (
    <div className="meridian-layout-root">
      <AlabasterAmbientBackground />
      <FloatingAlabasterPillar />
      <main className="meridian-main">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, scale: 0.98, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -12 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <Dock />
    </div>
  );
}
