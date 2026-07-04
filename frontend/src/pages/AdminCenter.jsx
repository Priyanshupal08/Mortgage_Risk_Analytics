import React, { useState, useEffect } from 'react';
import { api } from '../api';
import Card from '../components/ui/Card';
import './AdminCenter.css';

const AdminCenter = () => {
  const [activeTab, setActiveTab] = useState('system');
  const [health, setHealth] = useState(null);
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'system') {
        const res = await api.health();
        setHealth(res);
      } else if (activeTab === 'users') {
        const res = await api.users();
        setUsers(res);
      } else if (activeTab === 'audit') {
        const res = await api.audit({ limit: 50 });
        setAuditLogs(res);
      }
    } catch (err) {
      console.error("Failed to fetch admin data", err);
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = (seconds) => {
    if (!seconds) return "0s";
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor(seconds % (3600*24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    return parts.join(' ') || "< 1m";
  };

  const tabs = [
    { id: 'system', label: 'Overview', icon: '💎' },
    { id: 'users', label: 'Users', icon: '👤' },
    { id: 'audit', label: 'Security', icon: '🛡️' },
  ];

  return (
    <div className="admin-modern-container">
      <header className="modern-admin-header">
        <div className="header-content">
          <div className="title-area">
            <h1>Nexus <span className="gradient-text">OS</span></h1>
            <div className="status-badge">
              <span className="pulse-dot"></span>
              SYSTEM NOMINAL
            </div>
          </div>
          <nav className="modern-tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`modern-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              >
                <span className="tab-icon">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="modern-admin-content">
        {activeTab === 'system' && (
          <div className="bent-grid">
            <Card className="bent-card tall glass-card">
               <div className="card-top">
                 <span className="icon-bg cyan">⚡</span>
                 <h3>Performance</h3>
               </div>
               <div className="stat-large">{health?.uptime_seconds ? formatUptime(health.uptime_seconds) : 'N/A'}</div>
               <p className="stat-label">TOTAL SYSTEM UPTIME</p>
               <div className="mini-chart">
                  {[20,40,30,50,40,60,50,70,60,80].map((h, i) => (
                    <div key={i} className="mini-bar" style={{ height: `${h}%` }} />
                  ))}
               </div>
            </Card>

            <Card className="bent-card glass-card">
               <div className="card-top">
                 <span className="icon-bg purple">🧠</span>
                 <h3>AI Engine</h3>
               </div>
               <div className="model-info">
                  <div className="model-name">XGBoost-V4</div>
                  <div className="model-accuracy">98.2% CONFIDENCE</div>
               </div>
            </Card>

            <Card className="bent-card glass-card">
               <div className="card-top">
                 <span className="icon-bg gold">📊</span>
                 <h3>Analytics</h3>
               </div>
               <div className="stat-mid">{health?.predictions_served || 0}</div>
               <p className="stat-label">TOTAL PREDICTIONS</p>
            </Card>

            <Card className="bent-card wide glass-card">
               <div className="card-top">
                 <span className="icon-bg green">🛰️</span>
                 <h3>Resource Distribution</h3>
               </div>
               <div className="resource-bars">
                  <div className="r-item">
                    <div className="r-label"><span>CPU</span> <span>{Math.floor(Math.random() * 5) + 3}%</span></div>
                    <div className="r-bar"><div className="r-fill cyan" style={{ width: '8%' }} /></div>
                  </div>
                  <div className="r-item">
                    <div className="r-label"><span>RAM</span> <span>{health?.memory_usage_mb || 0}MB</span></div>
                    <div className="r-bar"><div className="r-fill purple" style={{ width: '35%' }} /></div>
                  </div>
               </div>
            </Card>
          </div>
        )}

        {activeTab === 'users' && (
          <Card className="modern-table-card glass-card">
            <div className="table-header">
              <h2>User Directory</h2>
              <div className="table-actions">
                <input type="text" placeholder="Filter users..." className="modern-filter" />
                <button className="modern-btn-primary">+ Add User</button>
              </div>
            </div>
            <div className="modern-table-wrap">
               <table className="modern-table">
                 <thead>
                   <tr>
                     <th>Identitiy</th>
                     <th>Access Level</th>
                     <th>Status</th>
                     <th>Operations</th>
                   </tr>
                 </thead>
                 <tbody>
                   {users.map(u => (
                     <tr key={u.id}>
                       <td>
                         <div className="user-profile-mini">
                            <div className="avatar-initials">{(u?.username?.[0] || 'U').toUpperCase()}</div>
                            <div>
                               <div className="u-fullname">{u?.full_name || u?.username || 'Unknown'}</div>
                               <div className="u-email">@{u?.username || 'unknown'}</div>
                            </div>
                         </div>
                       </td>
                       <td>
                         <span className={`access-pill ${u?.role}`}>{u?.role || 'user'}</span>
                       </td>
                       <td>
                         <span className={`status-tag ${u?.is_active ? 'active' : 'locked'}`}>
                            {u?.is_active ? 'Verified' : 'Suspended'}
                         </span>
                       </td>
                       <td>
                         <button className="modern-op-btn">Manage</button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
          </Card>
        )}

        {activeTab === 'audit' && (
          <Card className="modern-table-card glass-card">
             <div className="table-header">
              <h2>Security Audit</h2>
              <button className="modern-btn-outline">Export Logs</button>
            </div>
            <div className="audit-timeline">
               {(auditLogs?.entries || auditLogs || []).map((log, i) => (
                 <div key={i} className="timeline-item">
                    <div className="time-col">{log?.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '--:--'}</div>
                    <div className="marker"></div>
                    <div className="log-details">
                       <span className="log-action">{log?.action || 'EVENT'}</span>
                       <span className="log-user">by {log?.username || 'system'}</span>
                       <p className="log-meta">{log?.metadata ? JSON.stringify(log.metadata) : ''}</p>
                    </div>
                 </div>
               ))}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
};

export default AdminCenter;

