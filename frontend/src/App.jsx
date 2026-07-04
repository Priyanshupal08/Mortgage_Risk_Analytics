import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAppStore } from './store';
import { api } from './api';
import SpatialLayout from './components/layout/SpatialLayout';
import MeridianLayout from './components/layout/MeridianLayout';
import Dashboard from './pages/Dashboard';
import PredictPage from './pages/PredictPage';
import AnalyticsPage from './pages/AnalyticsPage';
import HistoryPage from './pages/HistoryPage';
import EmiCalculator from './pages/EmiCalculator';
import EligibilityCheck from './pages/EligibilityCheck';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './pages/AdminDashboard';
import AdminCenter from './pages/AdminCenter';

function ProtectedRoute({ children }) {
  const token = useAppStore((state) => state.token);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AdminRoute({ children }) {
  const user = useAppStore((state) => state.user);
  const token = useAppStore((state) => state.token);
  if (!token || user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function PublicRoute({ children }) {
  const token = useAppStore((state) => state.token);
  if (token) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function DashboardRouter() {
  const user = useAppStore((state) => state.user);
  if (user?.role === 'admin') {
    return <AdminDashboard />;
  }
  return <Dashboard />;
}

function App() {
  const theme = useAppStore((state) => state.theme);
  const token = useAppStore((state) => state.token);
  const logout = useAppStore((state) => state.logout);
  const login = useAppStore((state) => state.login);
  const [isValidating, setIsValidating] = useState(!!token);

  // Validate stored token on app startup
  useEffect(() => {
    if (!token) {
      setIsValidating(false);
      return;
    }

    api.me()
      .then((userData) => {
        // Token is valid — refresh user data from server
        if (userData) {
          login(userData, token);
        }
      })
      .catch(() => {
        // Token is invalid/expired — force logout
        logout();
      })
      .finally(() => {
        setIsValidating(false);
      });
  }, []); // Only run once on mount

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    } else {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    }
  }, [theme]);

  // Show nothing while validating token to prevent flash of wrong page
  if (isValidating) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: theme === 'dark' ? '#0a0e17' : '#f5f7fa',
        color: theme === 'dark' ? '#e0e6ed' : '#333'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, 
            border: '3px solid rgba(0, 242, 255, 0.2)',
            borderTop: '3px solid #00F2FF',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
            boxShadow: '0 0 15px rgba(0, 242, 255, 0.2)'
          }} />
          <p style={{ fontSize: 14, opacity: 0.7 }}>Verifying session...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <>
      <ToastContainer position="top-right" autoClose={3000} theme={theme === 'dark' ? 'dark' : 'light'} />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
          
          <Route path="/" element={<ProtectedRoute><MeridianLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardRouter />} />
            <Route path="predict" element={<PredictPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="emi" element={<EmiCalculator />} />
            <Route path="eligibility" element={<EligibilityCheck />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="admin" element={<AdminRoute><AdminCenter /></AdminRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
