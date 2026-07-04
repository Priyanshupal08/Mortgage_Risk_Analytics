import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AlabasterAmbientBackground from '../3d/SceneBackground';
import FloatingAlabasterPillar from './MeridianSidebar';

export default function MeridianLayout() {
  const location = useLocation();
  return (
    <div style={{ display:'flex', width:'100vw', height:'100vh', overflow:'hidden', position:'relative' }}>
      <AlabasterAmbientBackground />
      <FloatingAlabasterPillar />
      <main style={{
        flex: 1,
        overflow: 'auto',
        position: 'relative',
        zIndex: 10,
        padding: '24px 36px 36px 12px',
      }}>
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
    </div>
  );
}
