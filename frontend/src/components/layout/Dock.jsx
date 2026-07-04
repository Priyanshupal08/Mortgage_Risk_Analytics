import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppStore } from '../../store';
import { Home, Activity, PieChart, Clock, Calculator, ShieldCheck, User } from 'lucide-react';
import './Dock.css';

const dockItems = [
  { id: 'dashboard', label: 'Core', path: '/dashboard', icon: Home },
  { id: 'predict', label: 'Scanner', path: '/predict', icon: Activity },
  { id: 'analytics', label: 'Metrics', path: '/analytics', icon: PieChart },
  { id: 'history', label: 'Archive', path: '/history', icon: Clock },
  { id: 'emi', label: 'Compute', path: '/emi', icon: Calculator },
  { id: 'eligibility', label: 'Verify', path: '/eligibility', icon: ShieldCheck },
  { id: 'profile', label: 'Agent', path: '/profile', icon: User },
];

export default function Dock() {
  return (
    <div className="dock-container">
      <motion.div 
        className="dock"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 0.5 }}
      >
        {dockItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) => `dock-item ${isActive ? 'active' : ''}`}
            >
              <div className="dock-icon-wrapper">
                <Icon size={22} strokeWidth={1.5} />
              </div>
              <span className="dock-tooltip">{item.label}</span>
            </NavLink>
          );
        })}
        <div className="dock-divider" />
        <button 
          className="dock-item danger" 
          onClick={() => useAppStore.getState().logout()}
        >
          <div className="dock-icon-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
          <span className="dock-tooltip">Eject</span>
        </button>
      </motion.div>
    </div>
  );
}
