import React from 'react';
import Card from '../components/ui/Card';
import '../components/analytics.css';
import ModelComparison from '../components/ModelComparison';
import { getModelComparison } from '../utils/api';
import MonteCarlo3D from '../components/MonteCarlo3D';
import FairnessMetrics from '../components/FairnessMetrics';
import ErrorBoundary from '../components/ErrorBoundary';
import { useAppStore } from '../store';

export default function AnalyticsPage() {
  const [isMock, setIsMock] = React.useState(false);
  const user = useAppStore(s => s.user);

  React.useEffect(() => {
    getModelComparison()
      .then(data => {
        if (data && data.is_mock) setIsMock(true);
      })
      .catch(err => console.error("Banner check failed", err));
  }, []);

  const now = new Date();

  return (
    <div className="analytics-page wealth-predict">
      
      {/* ── Page Header / Editorial Wealth Bar ─────────────────────────────── */}
      <div className="wealth-header" style={{ marginBottom: 28 }}>
        <div>
          <div className="wealth-crumbs">
            <span className="crumb-brand">AETHER PRIVATE WEALTH</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">WEALTH ANALYTICS</span>
          </div>
          <h1 className="wealth-title">Model Analytics &amp; Metrics</h1>
        </div>
        <div className="wealth-top-actions">
          {user?.role === 'admin' && <div className="swiss-shield-tag">⛨ EXECUTIVE PRIVILEGE</div>}
          <div className="wealth-timebox">
            <span className="timebox-h">{now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
            <span className="timebox-d">{now.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})}</span>
          </div>
          <div className="swiss-pill swiss-ok">
            <span className="swiss-dot" style={{background:'var(--emerald-wealth)'}} />
            TELEMETRY OPTIMAL
          </div>
        </div>
      </div>

      {isMock && (
        <div style={{
          background: 'rgba(197, 160, 89, 0.08)',
          border: '1px solid rgba(197, 160, 89, 0.3)',
          color: 'var(--royal-gold)',
          padding: '16px 24px',
          borderRadius: '18px',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          fontSize: '14px',
          fontWeight: '600',
          boxShadow: 'var(--ceramic-shadow)'
        }}>
          <span style={{ fontSize: '22px' }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, fontFamily: 'var(--ff-display)', fontSize: 16, color: 'var(--ink-dark)' }}>Live Model Unavailable — Showing Demo Data</div>
            <div style={{ fontSize: 13, color: 'var(--ink-sec)', fontWeight: 500 }}>No active model telemetry detected in the backend registry. Displaying simulated baseline metrics.</div>
          </div>
        </div>
      )}

      {/* ── Top Overview Cards ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '28px' }}>
        <Card className="ceramic-card" style={{ position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:'linear-gradient(90deg, var(--royal-gold), #E5C17D)' }} />
          <h3 style={{ marginBottom: '24px' }}>Ensemble Performance</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(17,24,39,0.06)'}}>
              <span className="text-secondary" style={{ fontWeight: 600 }}>Accuracy</span>
              <span className="mono text-success" style={{ fontWeight: 800, fontSize: 16 }}>94.2%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(17,24,39,0.06)'}}>
              <span className="text-secondary" style={{ fontWeight: 600 }}>AUC-ROC</span>
              <span className="mono text-gold" style={{ fontWeight: 800, fontSize: 16 }}>0.96</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(17,24,39,0.06)'}}>
              <span className="text-secondary" style={{ fontWeight: 600 }}>Precision</span>
              <span className="mono text-success" style={{ fontWeight: 800, fontSize: 16 }}>92.8%</span>
            </div>
          </div>
        </Card>

        <Card className="ceramic-card" style={{ position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:'linear-gradient(90deg, var(--emerald-wealth), #22C55E)' }} />
          <h3 style={{ marginBottom: '24px' }}>Feature Importance</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ width: '110px', fontSize: '13px', fontWeight: 600 }} className="text-secondary">Credit Score</span>
              <div style={{ flex: 1, height: '8px', background: 'rgba(17,24,39,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ width: '85%', height: '100%', background: 'var(--royal-gold)', borderRadius: '999px', boxShadow: '0 0 8px rgba(197,160,89,0.4)' }} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ width: '110px', fontSize: '13px', fontWeight: 600 }} className="text-secondary">DTI Ratio</span>
              <div style={{ flex: 1, height: '8px', background: 'rgba(17,24,39,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ width: '70%', height: '100%', background: 'var(--royal-gold)', borderRadius: '999px', boxShadow: '0 0 8px rgba(197,160,89,0.4)' }} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ width: '110px', fontSize: '13px', fontWeight: 600 }} className="text-secondary">Loan Amount</span>
              <div style={{ flex: 1, height: '8px', background: 'rgba(17,24,39,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ width: '45%', height: '100%', background: 'var(--royal-gold)', borderRadius: '999px', boxShadow: '0 0 8px rgba(197,160,89,0.4)' }} />
              </div>
            </div>
          </div>
        </Card>
      </div>
      
      <div style={{ marginTop: '28px' }}>
        <ErrorBoundary>
          <ModelComparison />
        </ErrorBoundary>
      </div>

      <div style={{ marginTop: '28px' }}>
        <ErrorBoundary>
          <FairnessMetrics />
        </ErrorBoundary>
      </div>

      <div style={{ marginTop: '28px' }}>
        <ErrorBoundary>
          <MonteCarlo3D />
        </ErrorBoundary>
      </div>
    </div>
  );
}
