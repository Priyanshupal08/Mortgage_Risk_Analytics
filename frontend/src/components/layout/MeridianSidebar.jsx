import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAppStore } from '../../store';
import {
  LayoutDashboard, ShieldAlert, BarChart3, History,
  Calculator, CheckCircle2, User, LogOut, Landmark
} from 'lucide-react';
import './MeridianSidebar.css';

const navItems = [
  { path:'/dashboard',   label:'Capital Allocation', icon:LayoutDashboard, tag:'PRIMARY' },
  { path:'/predict',     label:'Risk Underwriter',   icon:ShieldAlert,     tag:'AI' },
  { path:'/analytics',   label:'Wealth Analytics',   icon:BarChart3,       tag:'' },
  { path:'/history',     label:'Audit Ledger',       icon:History,         tag:'' },
  { path:'/emi',         label:'Amortization',       icon:Calculator,      tag:'' },
  { path:'/eligibility', label:'Client Verification',icon:CheckCircle2,    tag:'' },
];

export default function FloatingAlabasterPillar() {
  const user = useAppStore(s => s.user);
  const avatar = (user?.full_name || user?.username || 'A')[0].toUpperCase();
  const [hoveredTip, setHoveredTip] = useState(null);

  return (
    <aside className="pillar-capsule">
      {/* Top Gold Crest Logo */}
      <div className="pillar-logo-box">
        <div className="pillar-crest">
          <Landmark size={24} strokeWidth={1.8} />
          <div className="pillar-crest-ring" />
        </div>
      </div>

      {/* Navigation Track */}
      <nav className="pillar-track">
        {navItems.map(({ path, label, icon: Icon, tag }) => (
          <div key={path} className="pillar-tab-wrapper"
            onMouseEnter={() => setHoveredTip(path)}
            onMouseLeave={() => setHoveredTip(null)}
          >
            <NavLink to={path} className={({ isActive }) => `pillar-tab${isActive ? ' pillar-active' : ''}`}>
              <Icon size={21} strokeWidth={1.8} />
            </NavLink>

            {/* Floating Luxury Tooltip */}
            <div className={`pillar-tooltip ${hoveredTip === path ? 'show' : ''}`}>
              <span className="pillar-tip-label">{label}</span>
              {tag && <span className="pillar-tip-tag">{tag}</span>}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Profile Medallion & Eject */}
      <div className="pillar-bottom">
        {/* User Profile Tab */}
        <div className="pillar-tab-wrapper"
          onMouseEnter={() => setHoveredTip('/profile')}
          onMouseLeave={() => setHoveredTip(null)}
        >
          <Link to="/profile" className="pillar-tab pillar-profile-tab">
            <div className="pillar-avatar">{avatar}</div>
            <div className="pillar-status-dot" />
          </Link>
          <div className={`pillar-tooltip ${hoveredTip === '/profile' ? 'show' : ''}`}>
            <span className="pillar-tip-label">{user?.full_name || user?.username}</span>
            <span className="pillar-tip-tag" style={{background:'rgba(16,137,84,0.1)', color:'var(--emerald-wealth)', borderColor:'var(--emerald-wealth-g)'}}>
              {user?.role === 'admin' ? 'EXECUTIVE' : 'ASSOCIATE'}
            </span>
          </div>
        </div>

        {/* Logout */}
        <div className="pillar-tab-wrapper"
          onMouseEnter={() => setHoveredTip('logout')}
          onMouseLeave={() => setHoveredTip(null)}
        >
          <button className="pillar-tab pillar-logout" onClick={() => useAppStore.getState().logout()}>
            <LogOut size={20} strokeWidth={1.8} />
          </button>
          <div className={`pillar-tooltip ${hoveredTip === 'logout' ? 'show' : ''}`}>
            <span className="pillar-tip-label" style={{color:'var(--crimson-risk)'}}>Terminate Session</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
