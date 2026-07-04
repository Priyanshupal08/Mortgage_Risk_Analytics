import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import SceneBackground from '../3d/SceneBackground';
import Dock from './Dock';

export default function SpatialLayout() {
  const location = useLocation();

  return (
    <div className="spatial-root">
      {/* Animated Particle Canvas Background */}
      <SceneBackground />

      {/* Top Status Bar */}
      <div className="hud-statusbar">
        <div className="hud-brand">
          <div className="hud-brand-dot" />
          <div>
            <div className="hud-brand-name">Mortgage AI</div>
            <div className="hud-brand-sub">Command Center</div>
          </div>
        </div>
        <div className="hud-system-status">
          <div className="hud-status-dot" />
          <span className="hud-status-text">All Systems Online</span>
        </div>
      </div>

      {/* Scrollable Page Content */}
      <div className="hud-page-area">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Floating Bottom Dock */}
      <Dock />
    </div>
  );
}
