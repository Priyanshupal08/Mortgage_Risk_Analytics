import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { useAppStore } from '../store';
import { toast } from 'react-toastify';
import GlobalMap from '../components/admin/GlobalMap';
import TerminalWidget from '../components/admin/TerminalWidget';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [health, setHealth] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [particles, setParticles] = useState([]);

  const { theme, setTheme } = useAppStore();
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchGlobalData();
    const interval = setInterval(fetchHealthOnly, 5000);

    // Initialize background floating wealth orbs
    const pCount = 15;
    const initialParticles = [];
    for (let i = 0; i < pCount; i++) {
      initialParticles.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        speed: Math.random() * 0.4 + 0.1,
        opacity: Math.random() * 0.4 + 0.1
      });
    }
    setParticles(initialParticles);

    return () => clearInterval(interval);
  }, []);

  const fetchGlobalData = async () => {
    try {
      const [uRes, hRes, aRes] = await Promise.all([
        api.users(),
        api.health(),
        api.audit({ limit: 30 })
      ]);
      setUsers(Array.isArray(uRes) ? uRes : []);
      setHealth(hRes);
      setAuditLogs(aRes?.entries || []);
    } catch (err) {
      console.error("Sovereign Command Fetch Error", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHealthOnly = async () => {
    try {
      const hRes = await api.health();
      setHealth(hRes);
      const aRes = await api.audit({ limit: 30 });
      if (aRes?.entries) setAuditLogs(aRes.entries);
    } catch (err) { }
  };

  const handleSelectUser = async (user) => {
    setSelectedUser(user);
    setUserStats(null);
    try {
      if (user?.id) {
        const stats = await api.userStats(user.id);
        setUserStats(stats);
      }
    } catch (err) {
      console.error("Failed to fetch user stats", err);
    }
  };

  const handleToggleStatus = async (userId) => {
    try {
      await api.toggleStatus(userId);
      fetchGlobalData();
      toast.success("User access protocol updated");
    } catch (err) {
      toast.error("Failed to toggle user status");
    }
  };

  const handleTerminate = async (userId) => {
    if (!window.confirm("Force terminate all active cryptographic sessions for this user?")) return;
    try {
      await api.terminateUser(userId);
      toast.success("Cryptographic sessions terminated");
    } catch (err) {
      toast.error("Session termination failed");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("PERMANENTLY REVOKE AND PURGE THIS DOSSIER? This action is irreversible.")) return;
    try {
      await api.deleteUser(userId);
      toast.success("Dossier purged and blacklisted permanently");
      setSelectedUser(null);
      fetchGlobalData();
    } catch (err) {
      toast.error(err.message || "Purge failed");
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (nextTheme === 'dark') {
      toast('✦ Sovereign Obsidian Vault enabled', { className: 'wealth-toast-dark' });
    } else {
      toast('✧ Sovereign Ceramic Alabaster enabled', { className: 'wealth-toast-light' });
    }
  };

  const filteredUsers = (users || []).filter(u => {
    if (!u) return false;
    const searchTerm = (search || '').toLowerCase();
    const username = (u.username || '').toLowerCase();
    const fullName = (u.full_name || '').toLowerCase();
    return username.includes(searchTerm) || fullName.includes(searchTerm);
  });

  return (
    <div className={`god-mode-page ${theme}`}>
      {/* ── Theme Toggle FAB ────────────────────────────────────────── */}
      <button 
        className={`theme-toggle-fab ${theme}`} 
        onClick={toggleTheme}
        aria-label="Toggle Sovereign Theme"
      >
        <div className="toggle-sun">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <div className="toggle-moon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        </div>
      </button>

      {/* ── Ambient Aurora Background ────────────────────────────── */}
      <div className="bg-particles">
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
      </div>

      {/* ── Top Sovereign Header ────────────────────────────────────── */}
      <div className="god-header">
        <div className="god-logo">
          <div className="god-logo-icon">
            <svg viewBox="0 0 100 100" className="interactive-logo-svg">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--royal-gold)" strokeWidth="4" strokeDasharray="16 8" className="logo-ring-outer" />
              <circle cx="50" cy="50" r="28" fill="none" stroke="var(--emerald-wealth)" strokeWidth="6" strokeDasharray="24 12" className="logo-ring-inner" />
              <circle cx="50" cy="50" r="14" fill="url(#core-grad)" className="logo-core" />
              <circle cx="50" cy="50" r="4" fill="#fff" className="logo-core-glow" />
              <defs>
                <linearGradient id="core-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--royal-gold)" />
                  <stop offset="100%" stopColor="#E5C17D" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1>SOVEREIGN <span className="text-gold-prime">COMMAND</span></h1>
        </div>

        <div className="system-heartbeat">
          <div className="hb-item">
            <label>CORE LATENCY</label>
            <span className="value text-gold-prime">08ms</span>
          </div>
          <div className="hb-item">
            <label>NEURAL LOAD</label>
            <span className="value text-emerald-prime">4.2%</span>
          </div>
          <div className="hb-item">
            <label>SYS UPTIME</label>
            <span className="value text-royal-gold">
              {Math.floor((health?.uptime_seconds || 0) / 3600)}h {Math.floor(((health?.uptime_seconds || 0) % 3600) / 60)}m
            </span>
          </div>
        </div>
      </div>

      <div className="god-grid-v2">
        {/* ── Left Column: System Pulse & Global Overwatch ──────────── */}
        <div className="god-col">
          <div className="god-card-v2 pulse-card">
            <div className="card-glitch-header">SYSTEM STABILITY</div>
            <div className="stability-meter">
              <div className="gauge-container">
                <svg viewBox="0 0 100 100" className="gauge-svg">
                  <defs>
                    <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="var(--royal-gold)" />
                      <stop offset="100%" stopColor="var(--emerald-wealth)" />
                    </linearGradient>
                  </defs>
                  <circle cx="50" cy="50" r="45" className="gauge-bg" />
                  <circle cx="50" cy="50" r="45" className="gauge-fill" style={{ strokeDashoffset: 10 }} />
                </svg>
                <div className="gauge-text">99.9%</div>
              </div>
              <div className="stability-details">
                <div className="s-row"><span>MEMORY</span> <span className="text-gold-prime">{health?.memory_usage_mb || 0} MB</span></div>
                <div className="s-row"><span>NODES</span> <span className="text-emerald-prime">04 ACTIVE</span></div>
              </div>
            </div>
          </div>

          <div className="god-card-v2 map-card">
            <div className="card-glitch-header">GLOBAL OVERWATCH</div>
            <GlobalMap />
          </div>

          <TerminalWidget logs={auditLogs.slice(0, 10)} />
        </div>

        {/* ── Center Column: User Nexus Control ─────────────────────── */}
        <div className="god-col center-col">
          <div className="god-card-v2 matrix-card-v2">
            <div className="card-glitch-header">USER NEXUS MATRIX</div>
            <div className="matrix-search-v2">
              <span className="search-icon">✧</span>
              <input
                type="text"
                placeholder="Search user signature..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="matrix-list-v2">
              {filteredUsers.length > 0 ? (
                filteredUsers.map(u => (
                  <div
                    key={u.id}
                    className={`matrix-item-v2 ${selectedUser?.id === u.id ? 'active' : ''} ${!u.is_active ? 'locked' : ''}`}
                    onClick={() => handleSelectUser(u)}
                  >
                    <div className="u-avatar-mini">
                      <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name || u.username)}&background=C5A059&color=000000&bold=true`} alt="" />
                    </div>
                    <div className="u-data">
                      <span className="u-name">{u.full_name || u.username}</span>
                      <span className="u-role">UUID: {String(u.id).substring(0, 8)}</span>
                    </div>
                    <div className={`u-status-tag ${u.is_active ? 'online' : 'offline'}`}>
                      {u.is_active ? 'ACTIVE' : 'LOCKED'}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ink-muted)', fontSize: '13px' }}>
                  No signatures found.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right Column: Protocol Intervention ───────────────────── */}
        <div className="god-col">
          {selectedUser ? (
            <div className="god-card-v2 intervention-card-v2">
              <div className="card-glitch-header">PROTOCOL: {(selectedUser.username || 'UNKNOWN').toUpperCase()}</div>

              <div className="selected-user-header">
                <div className="u-big-avatar">
                  <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUser.full_name || selectedUser.username)}&background=C5A059&color=000000&bold=true`} alt="" />
                </div>
                <div className="u-prime-data">
                  <h3>{selectedUser.full_name || selectedUser.username}</h3>
                  <p className="text-emerald-prime" style={{ fontWeight: 700, fontSize: '13px' }}>ACCESS: {(selectedUser.role || 'user').toUpperCase()}</p>
                  <p className="text-muted-prime" style={{ fontSize: '11.5px', opacity: 0.85 }}>{selectedUser.email || 'NO_EMAIL_PROVIDED'}</p>
                </div>
              </div>

              <div className="intervention-controls-v2">
                <button
                  className={`control-btn ${selectedUser.is_active ? 'lock-btn' : 'unlock-btn'}`}
                  onClick={() => handleToggleStatus(selectedUser.id)}
                >
                  {selectedUser.is_active ? 'REVOKE ACCESS' : 'GRANT ACCESS'}
                </button>
                <button className="control-btn term-btn" onClick={() => handleTerminate(selectedUser.id)}>
                  DROP SESSION
                </button>
                <button className="control-btn delete-btn" onClick={() => handleDeleteUser(selectedUser.id)}>
                  PERMANENT PURGE
                </button>
              </div>

              <div className="deep-analytics-grid">
                <div className="analytic-box">
                  <label>APPROVALS</label>
                  <div className="val text-gold-prime">{userStats?.approvalRate != null ? userStats.approvalRate.toFixed(0) : 0}%</div>
                </div>
                <div className="analytic-box">
                  <label>AVG RISK</label>
                  <div className="val text-emerald-prime">{userStats?.avgRisk != null ? userStats.avgRisk.toFixed(0) : 0}%</div>
                </div>
                <div className="analytic-box">
                  <label>AVG LOAN</label>
                  <div className="val text-royal-gold">{userStats?.avgLoan != null ? (userStats.avgLoan / 1000).toFixed(1) : '0'}K</div>
                </div>
                <div className="analytic-box">
                  <label>CREDIT</label>
                  <div className="val text-royal-gold">{userStats?.avgCredit || '0'}</div>
                </div>
              </div>

              <div className="system-logs-mini">
                <div className="log-row"><span>REGISTERED</span> <span>{new Date(selectedUser.created_at).toLocaleDateString()}</span></div>
                <div className="log-row"><span>LAST LOGIN</span> <span>{selectedUser.last_login ? new Date(selectedUser.last_login).toLocaleTimeString() : 'NEVER'}</span></div>
                <div className="log-row"><span>SEC_PROTO</span> <span className="text-gold-prime">OAUTH2_JWT</span></div>
              </div>
            </div>
          ) : (
            <div className="awaiting-target">
              <div className="radar-circle">
                <div className="radar-sweep" />
              </div>
              <p>SCANNING FOR TARGET</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
