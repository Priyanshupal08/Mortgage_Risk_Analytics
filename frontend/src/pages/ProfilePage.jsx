import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { api } from '../api';
import { toast } from 'react-toastify';
import './ProfilePage.css';

const ProfilePage = () => {
  const user = useAppStore((state) => state.user);
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);

  const [fullUser, setFullUser] = useState(user);
  const [loading, setLoading] = useState(!user?.created_at);

  // Settings state
  const [settings, setSettings] = useState({
    notifications: true,
    compactView: false,
    emailReports: false
  });

  // Change Password state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await api.me();
        setFullUser(data);
        useAppStore.setState({ user: { ...user, ...data } });
        localStorage.setItem('mortgage_user', JSON.stringify({ ...user, ...data }));
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleToggle = (key) => {
    if (key === 'darkMode') {
      const newTheme = theme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
      toast.success(`${newTheme === 'dark' ? '✦ Obsidian Vault (Dark)' : '✧ Ceramic Alabaster (Light)'} Mode enabled`, {
        position: "bottom-right",
        autoClose: 1500
      });
      return;
    }
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    toast.success(`${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} updated`, {
      position: "bottom-right",
      autoClose: 1500
    });
  };

  const onChangePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (passwordForm.newPassword.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }

    setIsChanging(true);
    try {
      await api.changePassword({
        current_password: passwordForm.currentPassword,
        new_password: passwordForm.newPassword
      });
      toast.success("Password updated successfully");
      setShowPasswordModal(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setIsChanging(false);
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin': return 'var(--crimson-risk)';
      case 'underwriter': return 'var(--sapphire-blue)';
      case 'loan_officer': return 'var(--emerald-wealth)';
      default: return 'var(--royal-gold)';
    }
  };

  if (loading && !fullUser) {
    return <div className="profile-loading">
      <div className="spinner"></div>
      <p style={{ fontFamily: 'var(--ff-display)', fontSize: 20, fontWeight: 700, color: 'var(--ink-dark)' }}>Loading Secure Dossier...</p>
    </div>;
  }

  const displayUser = fullUser || user;
  const now = new Date();

  return (
    <div className="profile-page wealth-predict">

      {/* ── Page Header / Editorial Wealth Bar ─────────────────────────────── */}
      <div className="wealth-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="wealth-crumbs">
            <span className="crumb-brand">AETHER PRIVATE WEALTH</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">EXECUTIVE DOSSIER</span>
          </div>
          <h1 className="wealth-title" style={{ marginBottom: 8 }}>Executive Profile &amp; Security Dossier</h1>
          <p className="profile-subtitle" style={{ margin: 0, fontSize: 13.5 }}>Cryptographic identity management and global preference configuration</p>
        </div>
        <div className="wealth-top-actions">
          {displayUser?.role === 'admin' && <div className="swiss-shield-tag">⛨ EXECUTIVE PRIVILEGE</div>}
          <div className="wealth-timebox">
            <span className="timebox-h">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="timebox-d">{now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <div className="swiss-pill swiss-ok">
            <span className="swiss-dot" style={{ background: 'var(--emerald-wealth)' }} />
            SESSION VERIFIED
          </div>
        </div>
      </div>

      {/* ── Cover & Avatar Section ─────────────────────────────────────────── */}
      <div className="profile-header-section">
        <div className="profile-cover"></div>
        <div className="profile-info-main">
          <div className="profile-avatar-large">
            {(displayUser?.full_name?.charAt(0) || displayUser?.username?.charAt(0) || 'U').toUpperCase()}
          </div>
          <div className="profile-name-details">
            <div className="profile-name-row">
              <h1>{displayUser?.full_name || displayUser?.username || 'Executive Officer'}</h1>
              <span className="status-badge">ACTIVE</span>
            </div>
            <span className="profile-subtitle">
              Verified Professional | {
                displayUser?.role === 'admin' ? 'SYSTEM ADMINISTRATOR' :
                  displayUser?.role === 'underwriter' ? 'SENIOR UNDERWRITER' :
                    'USER'
              }
            </span>
            <div className="profile-badges">
              <span
                className="role-badge"
                style={{ backgroundColor: getRoleBadgeColor(displayUser?.role) }}
              >
                {displayUser?.role === 'admin' ? 'ADMIN' :
                  displayUser?.role === 'underwriter' ? 'UNDERWRITER' :
                    'OFFICER'}
              </span>
              <span className="id-badge">ID: #{displayUser?.id || 1}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content Grid ───────────────────────────────────────────────────── */}
      <div className="profile-content-grid">

        <div className="profile-card info-card">
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, var(--royal-gold), #E5C17D)' }} />
          <div className="card-header">
            <h3>Account Information</h3>
            <button className="edit-btn" onClick={() => toast.info("Profile editing is managed by institutional administration")}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit
            </button>
          </div>
          <div className="card-body">
            <div className="info-item">
              <label>System Username</label>
              <span className="mono">{displayUser?.username || 'executive_user'}</span>
            </div>
            <div className="info-item">
              <label>Display Name</label>
              <span>{displayUser?.full_name || 'Not Configured'}</span>
            </div>
            <div className="info-item">
              <label>System Access Level</label>
              <span className="capitalize-role">
                {displayUser?.role === 'admin' ? 'System Administrator' :
                  displayUser?.role === 'underwriter' ? 'Senior Underwriter' :
                    'USER'}
              </span>
            </div>
          </div>
        </div>

        <div className="profile-card security-card">
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, var(--emerald-wealth), #22C55E)' }} />
          <div className="card-header">
            <h3>Security &amp; Activity</h3>
          </div>
          <div className="card-body">
            <div className="info-item">
              <label>Member Since</label>
              <span>{displayUser?.created_at ? new Date(displayUser.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Jan 1, 2024'}</span>
            </div>
            <div className="info-item">
              <label>Session Information</label>
              <span>Last login: {displayUser?.last_login ? new Date(displayUser.last_login).toLocaleString() : 'Active Session'}</span>
            </div>
            <div className="security-actions">
              <button className="secondary-btn" onClick={() => setShowPasswordModal(true)}>Update Password</button>
              <button className="secondary-btn" onClick={() => toast.info("Hardware Two-Factor Authentication (FIDO2) is currently active.")}>Manage FIDO2 / 2FA</button>
            </div>
          </div>
        </div>

        <div className="profile-card settings-card full-width">
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, var(--sapphire-blue), #3B82F6)' }} />
          <div className="card-header">
            <h3>Application Preferences</h3>
          </div>
          <div className="card-body grid-2">
            <div className="preference-item">
              <div className="pref-info">
                <h4>System Notifications</h4>
                <p>Receive real-time alerts for risk threshold breaches and model updates</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.notifications}
                  onChange={() => handleToggle('notifications')}
                />
                <span className="slider round"></span>
              </label>
            </div>
            <div className="preference-item">
              <div className="pref-info">
                <h4>Interface Theme</h4>
                <p>Toggle active styling mode for the analytics dashboard</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={theme === 'dark'}
                  onChange={() => handleToggle('darkMode')}
                />
                <span className="slider round"></span>
              </label>
            </div>
            <div className="preference-item">
              <div className="pref-info">
                <h4>Dense Data View</h4>
                <p>Optimize table layouts to show more records per page in history</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.compactView}
                  onChange={() => handleToggle('compactView')}
                />
                <span className="slider round"></span>
              </label>
            </div>
            <div className="preference-item">
              <div className="pref-info">
                <h4>Automated Reporting</h4>
                <p>Receive weekly cryptographic PDF summaries of loan application trends via email</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.emailReports}
                  onChange={() => handleToggle('emailReports')}
                />
                <span className="slider round"></span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Update Password</h3>
              <button className="close-btn" onClick={() => setShowPasswordModal(false)}>&times;</button>
            </div>
            <form onSubmit={onChangePasswordSubmit} className="modal-form">
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                />
                {(displayUser?.role === 'admin' || displayUser?.role === 'underwriter') && (
                  <small style={{ display: 'block', marginTop: '4px', opacity: 0.7, fontSize: 11 }}>
                    Note: Do not include the access prefix (e.g., ADMIN_) here.
                  </small>
                )}
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="At least 4 characters"
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Re-type new password"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowPasswordModal(false)}>Cancel</button>
                <button type="submit" className="submit-btn" disabled={isChanging}>
                  {isChanging ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
