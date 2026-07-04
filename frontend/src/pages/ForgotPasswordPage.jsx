import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { api } from '../api';
import './LoginPage.css';

export default function ForgotPasswordPage() {
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    new_password: '',
    confirm_password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { username, full_name, new_password, confirm_password } = formData;

    if (!username || !full_name || !new_password) {
      toast.warning('Please fill in all fields');
      return;
    }

    if (new_password !== confirm_password) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await api.resetPassword({
        username,
        full_name,
        new_password
      });
      toast.success('Password reset successfully! Please log in with your new password.');
      navigate('/login');
    } catch (error) {
      console.error('Reset error:', error);
      toast.error(error.message || 'Verification failed. Please check your username and full name.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
            </svg>
          </div>
          <h1 className="login-title">Reset Password</h1>
          <p className="login-subtitle">Enter your details to verify your identity</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} autoComplete="off">
          <div className="login-field">
            <label htmlFor="username">Username</label>
            <div className="login-input-wrap">
              <div className="login-input-icon">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
              </div>
              <input 
                id="username"
                type="text" 
                className="login-input" 
                placeholder="Enter your username" 
                value={formData.username}
                onChange={handleChange}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="full_name">Full Name</label>
            <div className="login-input-wrap">
              <div className="login-input-icon">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm5 3h1m-1 1h1m-1 1h1m1-4h1m-1 1h1m-1 1h1m-1 1h1"></path>
                </svg>
              </div>
              <input 
                id="full_name"
                type="text" 
                className="login-input" 
                placeholder="Enter your full name" 
                value={formData.full_name}
                onChange={handleChange}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="new_password">New Password</label>
            <div className="login-input-wrap">
              <div className="login-input-icon">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                </svg>
              </div>
              <input 
                id="new_password"
                type="password" 
                className="login-input" 
                placeholder="Create new password" 
                value={formData.new_password}
                onChange={handleChange}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="confirm_password">Confirm Password</label>
            <div className="login-input-wrap">
              <div className="login-input-icon">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                </svg>
              </div>
              <input 
                id="confirm_password"
                type="password" 
                className="login-input" 
                placeholder="Confirm new password" 
                value={formData.confirm_password}
                onChange={handleChange}
                autoComplete="new-password"
              />
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>Remembered your password? <Link to="/login" className="login-footer-link">Back to Login</Link></p>
        </div>
      </div>
    </div>
  );
}
