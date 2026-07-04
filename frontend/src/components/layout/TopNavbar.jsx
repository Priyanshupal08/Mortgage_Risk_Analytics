import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAppStore } from '../../store';
import './TopNavbar.css';

export default function TopNavbar() {
  const location = useLocation();
  const user = useAppStore((state) => state.user);
  const { toggleSidebar } = useAppStore();

  const getPageTitle = () => {
    switch(location.pathname) {
      case '/dashboard': return 'Dashboard';
      case '/predict': return 'Risk Prediction';
      case '/analytics': return 'Analytics';
      case '/history': return 'History';
      case '/profile': return 'My Profile';
      default: return 'Mortgage Risk Analytics';
    }
  };

  return (
    <header className="top-navbar">
      <div className="navbar-left">
        <button className="mobile-toggle" onClick={toggleSidebar}>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="page-title">{getPageTitle()}</h1>
      </div>
      <div className="navbar-right">
        <div className="system-status">
          <span className="status-indicator"></span>
          <span className="status-text mono">SYSTEM ONLINE</span>
        </div>
        <div className="user-nav-container">
          <div className="user-details-brief">
            <span className="user-name">{user?.full_name || user?.username}</span>
            <span className="user-role-brief">
              {user?.role === 'admin' ? 'Admin' : 
               user?.role === 'underwriter' ? 'Underwriter' : 
               'User'}
            </span>
          </div>
          <Link to="/profile" className="user-profile-link">
            <div className="avatar">
              {(user?.full_name?.charAt(0) || user?.username?.charAt(0) || 'U').toUpperCase()}
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
