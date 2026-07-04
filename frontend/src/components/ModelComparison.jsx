import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { getModelComparison, compareAllModels, switchModel } from '../utils/api';
import GaugeChart from './GaugeChart';

const DEFAULT_APPLICANT = {
  credit_score: 650,
  annual_income: 50000,
  loan_amount: 15000,
  loan_term: 36,
  dti_ratio: 0.3,
  employment_years: 3,
  num_credit_lines: 3,
  num_derogatory_marks: 0,
  credit_utilization: 0.3,
  payment_history_score: 0.9,
  home_ownership: 1,
  purpose_encoded: 0,
  num_late_payments: 0,
  savings_balance: 5000,
  monthly_expenses: 2000
};

const ModelComparison = () => {
  const [comparison, setComparison] = useState(null);
  const [applicant, setApplicant] = useState(DEFAULT_APPLICANT);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      loadComparison();
      initialized.current = true;
    }
  }, []);

  const loadComparison = async () => {
    setMetricsLoading(true);
    try {
      const data = await getModelComparison();
      setComparison(data);
    } catch (error) {
      console.error('Failed to load comparison:', error);
      toast.error('Failed to load model comparison metrics');
    } finally {
      setMetricsLoading(false);
    }
  };

  const handleApplicantChange = (field, value) => {
    setApplicant(prev => ({ ...prev, [field]: value }));
  };

  const runComparison = async () => {
    setLoading(true);
    try {
      const data = await compareAllModels(applicant);
      setResults(data);
      toast.success('All models scored this applicant');
    } catch (error) {
      console.error('Comparison failed:', error);
      toast.error('Failed to run model comparison');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchModel = async (modelName) => {
    try {
      await switchModel(modelName);
      toast.success(`${modelName} is now the active model`);
      loadComparison();
    } catch (error) {
      console.error('Failed to switch model:', error);
      toast.error('Failed to switch active model');
    }
  };

  const formatPercent = (val) => ((val || 0) * 100).toFixed(1);
  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val || 0);

  const getDecisionBadge = (decision) => {
    const d = (decision || '').toLowerCase();
    const map = {
      approved:    { label: '✓ Approved',    color: 'var(--emerald-wealth)', bg: 'rgba(16,137,84,0.1)',  border: 'rgba(16,137,84,0.3)'  },
      rejected:    { label: '✗ Rejected',    color: 'var(--crimson-risk)',   bg: 'rgba(185,28,28,0.1)',  border: 'rgba(185,28,28,0.3)'  },
      conditional: { label: '~ Conditional', color: 'var(--royal-gold)',     bg: 'rgba(197,160,89,0.1)', border: 'rgba(197,160,89,0.3)' }
    };
    const c = map[d] || map.conditional;
    return (
      <span style={{ display: 'inline-block', padding: '4px 14px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 800, fontFamily: 'var(--ff-mono)', letterSpacing: '0.08em', color: c.color, background: c.bg, border: `1px solid ${c.border}`, boxShadow: 'var(--ceramic-shadow)' }}>
        {c.label}
      </span>
    );
  };

  const getRiskBadge = (risk) => {
    const r = (risk || '').toLowerCase();
    const map = {
      low:      { color: 'var(--emerald-wealth)', bg: 'rgba(16,137,84,0.1)' },
      medium:   { color: 'var(--royal-gold)',     bg: 'rgba(197,160,89,0.1)' },
      high:     { color: 'var(--crimson-risk)',   bg: 'rgba(185,28,28,0.1)' },
      critical: { color: '#991B1B',               bg: 'rgba(153,27,27,0.1)' }
    };
    const c = map[r] || map.medium;
    return (
      <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 800, fontFamily: 'var(--ff-mono)', letterSpacing: '0.08em', color: c.color, background: c.bg }}>
        {(risk || 'MEDIUM').toUpperCase()}
      </span>
    );
  };

  const metrics = comparison?.metrics || {};
  const winner = comparison?.winner;

  if (metricsLoading) {
    return (
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto" style={{ marginTop: 12 }}>
      {comparison?.is_mock && (
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
            <div style={{ fontWeight: 700, fontFamily: 'var(--ff-display)', fontSize: 16, color: 'var(--ink-dark)' }}>Live Model Registry Unavailable — Showing Baseline Metrics</div>
            <div style={{ fontSize: 13, color: 'var(--ink-sec)', fontWeight: 500 }}>No comparison report found in /models directory. Run training pipeline to generate real metrics.</div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-10 space-y-4">
        <div className="inline-flex items-center gap-2 text-slate-400 text-sm mb-2" style={{ color: 'var(--ink-sec)', fontWeight: 600 }}>
          <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--royal-gold)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span style={{ fontFamily: 'var(--ff-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 12 }}>Multi-Model Ensemble Analysis</span>
        </div>
        <h2 style={{ fontFamily: 'var(--ff-display)', fontSize: 32, fontWeight: 800, color: 'var(--ink-dark)' }}>Model Comparison &amp; Benchmarks</h2>
        <p style={{ color: 'var(--ink-sec)', maxWidth: 640, margin: '0 auto', fontSize: 14, lineHeight: 1.6 }}>
          Compare Logistic Regression, XGBoost, and LightGBM performance metrics.
          Score any applicant through all three models simultaneously.
        </p>
      </div>

      {/* Model Metrics Table */}
      <div className="ceramic-card" style={{ background: 'var(--ceramic-white)', border: '1px solid var(--ceramic-border)', borderRadius: 24, padding: '32px 36px', marginBottom: 36, boxShadow: 'var(--ceramic-shadow)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:'linear-gradient(90deg, var(--royal-gold), #E5C17D)' }} />
        <h2 style={{ fontFamily: 'var(--ff-display)', fontSize: 20, fontWeight: 700, color: 'var(--ink-dark)', marginBottom: 24 }}>Training Metrics &amp; Champion Selection</h2>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(17,24,39,0.06)', background: 'var(--alabaster-bg)' }}>
                <th style={{ padding: '16px 20px', fontFamily: 'var(--ff-mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--ink-sec)', textAlign: 'left' }}>Model</th>
                <th style={{ padding: '16px 20px', fontFamily: 'var(--ff-mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--ink-sec)', textAlign: 'right' }}>AUC</th>
                <th style={{ padding: '16px 20px', fontFamily: 'var(--ff-mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--ink-sec)', textAlign: 'right' }}>F1</th>
                <th style={{ padding: '16px 20px', fontFamily: 'var(--ff-mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--ink-sec)', textAlign: 'right' }}>Precision</th>
                <th style={{ padding: '16px 20px', fontFamily: 'var(--ff-mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--ink-sec)', textAlign: 'right' }}>Recall</th>
                <th style={{ padding: '16px 20px', fontFamily: 'var(--ff-mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--ink-sec)', textAlign: 'right' }}>Train Time</th>
                <th style={{ padding: '16px 20px', fontFamily: 'var(--ff-mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--ink-sec)', textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(metrics).map(([name, m]) => {
                const isWinner = name === winner;
                return (
                  <tr key={name} style={{ borderBottom: '1px solid rgba(17,24,39,0.04)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--alabaster-bg)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '18px 20px', fontWeight: 700, color: isWinner ? 'var(--royal-gold)' : 'var(--ink-dark)', fontSize: 14.5 }}>
                      {name} {isWinner && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 800, padding: '2px 8px', background: 'rgba(197,160,89,0.12)', border: '1px solid rgba(197,160,89,0.3)', borderRadius: 6, color: 'var(--royal-gold)' }}>CHAMPION</span>}
                    </td>
                    <td style={{ padding: '18px 20px', textAlign: 'right', fontFamily: 'var(--ff-mono)', fontWeight: 600, color: 'var(--ink-dark)' }}>{(m.roc_auc || 0).toFixed(4)}</td>
                    <td style={{ padding: '18px 20px', textAlign: 'right', fontFamily: 'var(--ff-mono)', fontWeight: 600, color: 'var(--ink-dark)' }}>{(m.f1 || 0).toFixed(4)}</td>
                    <td style={{ padding: '18px 20px', textAlign: 'right', fontFamily: 'var(--ff-mono)', fontWeight: 600, color: 'var(--ink-dark)' }}>{(m.precision || 0).toFixed(4)}</td>
                    <td style={{ padding: '18px 20px', textAlign: 'right', fontFamily: 'var(--ff-mono)', fontWeight: 600, color: 'var(--ink-dark)' }}>{(m.recall || 0).toFixed(4)}</td>
                    <td style={{ padding: '18px 20px', textAlign: 'right', fontFamily: 'var(--ff-mono)', fontWeight: 500, color: 'var(--ink-sec)' }}>{m.train_time_s}s</td>
                    <td style={{ padding: '18px 20px', textAlign: 'right' }}>
                      {isWinner ? (
                        <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'rgba(16,137,84,0.1)', color: 'var(--emerald-wealth)', border: '1px solid rgba(16,137,84,0.3)' }}>Active</span>
                      ) : (
                        <button
                          onClick={() => handleSwitchModel(name.toLowerCase().replace(' ', ''))}
                          style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid rgba(17,24,39,0.15)', background: 'transparent', color: 'var(--ink-sec)', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--royal-gold)'; e.currentTarget.style.color = 'var(--royal-gold)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(17,24,39,0.15)'; e.currentTarget.style.color = 'var(--ink-sec)'; }}
                        >
                          Set Active
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Applicant Scorer */}
      <div className="ceramic-card" style={{ background: 'var(--ceramic-white)', border: '1px solid var(--ceramic-border)', borderRadius: 24, padding: '32px 36px', marginBottom: 36, boxShadow: 'var(--ceramic-shadow)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:'linear-gradient(90deg, var(--emerald-wealth), #22C55E)' }} />
        <h2 style={{ fontFamily: 'var(--ff-display)', fontSize: 20, fontWeight: 700, color: 'var(--ink-dark)', marginBottom: 8 }}>Live Applicant Scorer</h2>
        <p style={{ color: 'var(--ink-sec)', fontSize: 14, marginBottom: 28 }}>Adjust applicant parameters and evaluate through all 3 ensemble models simultaneously</p>

        {/* Input Sliders */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '32px' }}>
          <div className="space-y-2">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-main)' }}>Credit Score</span>
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 14, fontWeight: 700, color: 'var(--royal-gold)' }}>{applicant.credit_score}</span>
            </div>
            <input type="range" min="300" max="850" value={applicant.credit_score}
              onChange={(e) => handleApplicantChange('credit_score', parseInt(e.target.value))}
              style={{ width: '100%', height: 8, borderRadius: 999, background: 'rgba(17,24,39,0.06)', accentColor: 'var(--royal-gold)', cursor: 'pointer' }}
            />
          </div>

          <div className="space-y-2">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-main)' }}>Annual Income</span>
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 14, fontWeight: 700, color: 'var(--royal-gold)' }}>{formatCurrency(applicant.annual_income)}</span>
            </div>
            <input type="range" min="20000" max="500000" step="1000" value={applicant.annual_income}
              onChange={(e) => handleApplicantChange('annual_income', parseInt(e.target.value))}
              style={{ width: '100%', height: 8, borderRadius: 999, background: 'rgba(17,24,39,0.06)', accentColor: 'var(--royal-gold)', cursor: 'pointer' }}
            />
          </div>

          <div className="space-y-2">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-main)' }}>Loan Amount</span>
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 14, fontWeight: 700, color: 'var(--royal-gold)' }}>{formatCurrency(applicant.loan_amount)}</span>
            </div>
            <input type="range" min="1000" max="1000000" step="1000" value={applicant.loan_amount}
              onChange={(e) => handleApplicantChange('loan_amount', parseInt(e.target.value))}
              style={{ width: '100%', height: 8, borderRadius: 999, background: 'rgba(17,24,39,0.06)', accentColor: 'var(--royal-gold)', cursor: 'pointer' }}
            />
          </div>

          <div className="space-y-2">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-main)' }}>Loan Term</span>
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 14, fontWeight: 700, color: 'var(--royal-gold)' }}>{applicant.loan_term} months</span>
            </div>
            <input type="range" min="12" max="360" step="12" value={applicant.loan_term}
              onChange={(e) => handleApplicantChange('loan_term', parseInt(e.target.value))}
              style={{ width: '100%', height: 8, borderRadius: 999, background: 'rgba(17,24,39,0.06)', accentColor: 'var(--royal-gold)', cursor: 'pointer' }}
            />
          </div>

          <div className="space-y-2">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-main)' }}>DTI Ratio</span>
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 14, fontWeight: 700, color: 'var(--royal-gold)' }}>{(applicant.dti_ratio * 100).toFixed(0)}%</span>
            </div>
            <input type="range" min="0" max="100" step="1" value={applicant.dti_ratio * 100}
              onChange={(e) => handleApplicantChange('dti_ratio', parseInt(e.target.value) / 100)}
              style={{ width: '100%', height: 8, borderRadius: 999, background: 'rgba(17,24,39,0.06)', accentColor: 'var(--royal-gold)', cursor: 'pointer' }}
            />
          </div>

          <div className="space-y-2">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-main)' }}>Employment Years</span>
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 14, fontWeight: 700, color: 'var(--royal-gold)' }}>{applicant.employment_years} yrs</span>
            </div>
            <input type="range" min="0" max="40" value={applicant.employment_years}
              onChange={(e) => handleApplicantChange('employment_years', parseFloat(e.target.value))}
              style={{ width: '100%', height: 8, borderRadius: 999, background: 'rgba(17,24,39,0.06)', accentColor: 'var(--royal-gold)', cursor: 'pointer' }}
            />
          </div>

          <div className="space-y-2">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-main)' }}>Credit Utilization</span>
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 14, fontWeight: 700, color: 'var(--royal-gold)' }}>{(applicant.credit_utilization * 100).toFixed(0)}%</span>
            </div>
            <input type="range" min="0" max="100" step="1" value={applicant.credit_utilization * 100}
              onChange={(e) => handleApplicantChange('credit_utilization', parseInt(e.target.value) / 100)}
              style={{ width: '100%', height: 8, borderRadius: 999, background: 'rgba(17,24,39,0.06)', accentColor: 'var(--royal-gold)', cursor: 'pointer' }}
            />
          </div>

          <div className="space-y-2">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-main)' }}>Payment History</span>
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 14, fontWeight: 700, color: 'var(--royal-gold)' }}>{(applicant.payment_history_score * 100).toFixed(0)}%</span>
            </div>
            <input type="range" min="0" max="100" step="1" value={applicant.payment_history_score * 100}
              onChange={(e) => handleApplicantChange('payment_history_score', parseInt(e.target.value) / 100)}
              style={{ width: '100%', height: 8, borderRadius: 999, background: 'rgba(17,24,39,0.06)', accentColor: 'var(--royal-gold)', cursor: 'pointer' }}
            />
          </div>

          <div className="space-y-2">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-main)' }}>Late Payments (12mo)</span>
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 14, fontWeight: 700, color: 'var(--royal-gold)' }}>{applicant.num_late_payments}</span>
            </div>
            <input type="range" min="0" max="10" value={applicant.num_late_payments}
              onChange={(e) => handleApplicantChange('num_late_payments', parseInt(e.target.value))}
              style={{ width: '100%', height: 8, borderRadius: 999, background: 'rgba(17,24,39,0.06)', accentColor: 'var(--royal-gold)', cursor: 'pointer' }}
            />
          </div>
        </div>

        <button
          onClick={runComparison}
          disabled={loading}
          style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--royal-gold)', color: '#FFFFFF', fontFamily: 'var(--ff-body)', fontSize: '15px', fontWeight: 700, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.25s', boxShadow: '0 8px 24px rgba(197,160,89,0.3)' }}
          onMouseEnter={e => !loading && (e.currentTarget.style.background = '#B08E4E')}
          onMouseLeave={e => !loading && (e.currentTarget.style.background = 'var(--royal-gold)')}
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24" style={{ color: '#FFFFFF' }}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Executing Multi-Model Evaluation...
            </span>
          ) : 'Evaluate Applicant Through All Models'}
        </button>
      </div>

      {/* Results Section */}
      {results && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', marginTop: '36px' }}>
          
          {/* Consensus Banner */}
          <div className="ceramic-card" style={{
            background: 'var(--ceramic-white)',
            border: `1px solid ${results.consensus.all_agree ? 'rgba(16,137,84,0.3)' : 'rgba(197,160,89,0.3)'}`,
            borderRadius: '24px',
            padding: '28px 36px',
            boxShadow: 'var(--ceramic-shadow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ padding: '16px', borderRadius: '18px', background: results.consensus.all_agree ? 'rgba(16,137,84,0.1)' : 'rgba(197,160,89,0.1)' }}>
                <svg className="w-8 h-8" style={{ color: results.consensus.all_agree ? 'var(--emerald-wealth)' : 'var(--royal-gold)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={results.consensus.all_agree ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" : "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"} />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-sec)', fontWeight: 700, marginBottom: '4px' }}>
                  {results.consensus.all_agree ? 'Ensemble Consensus Achieved' : 'Ensemble Divergence Detected'}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ink-dark)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span>Consensus Decision:</span>
                  {getDecisionBadge(results.consensus.final_decision)}
                  <span style={{ fontSize: '15px', color: 'var(--ink-sec)', fontWeight: 600 }}>({formatPercent(results.consensus.avg_probability)}% approval confidence)</span>
                </div>
              </div>
            </div>
            
            <div style={{ textAlign: 'right', minWidth: '140px' }}>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-sec)', fontWeight: 700, marginBottom: '6px' }}>Models Approved</div>
              <div style={{ fontSize: '32px', fontWeight: 800, fontFamily: 'var(--ff-mono)', color: 'var(--royal-gold)', lineHeight: 1 }}>
                {results.consensus.disagreement_count} <span style={{ fontSize: '22px', color: 'var(--ink-muted)', fontWeight: 600 }}>/ 3</span>
              </div>
            </div>
          </div>

          {/* Model Results Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '28px' }}>
            {Object.entries(results.models).map(([modelName, modelResult]) => {
              const modelDisplayName = modelName.charAt(0).toUpperCase() + modelName.slice(1);
              const isThisWinner = modelName === winner;
              return (
                <div key={modelName} className="ceramic-card" style={{
                  background: 'var(--ceramic-white)',
                  border: `1px solid ${isThisWinner ? 'var(--royal-gold)' : 'var(--ceramic-border)'}`,
                  borderRadius: '24px',
                  padding: '28px',
                  boxShadow: isThisWinner ? '0 12px 32px rgba(197,160,89,0.25)' : 'var(--ceramic-shadow)',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  {isThisWinner && (
                    <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--royal-gold)', color: '#FFFFFF', fontSize: '11px', fontWeight: 800, padding: '4px 16px', borderBottomLeftRadius: '14px', letterSpacing: '0.1em' }}>
                      CHAMPION
                    </div>
                  )}
                  
                  <div>
                    <h3 style={{ fontFamily: 'var(--ff-display)', fontSize: '20px', fontWeight: 700, color: 'var(--ink-dark)', marginBottom: '24px' }}>{modelDisplayName}</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(17,24,39,0.04)' }}>
                        <span style={{ fontSize: '13.5px', color: 'var(--ink-sec)', fontWeight: 600 }}>Decision</span>
                        {getDecisionBadge(modelResult.decision)}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(17,24,39,0.04)' }}>
                        <span style={{ fontSize: '13.5px', color: 'var(--ink-sec)', fontWeight: 600 }}>Approval Prob</span>
                        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: '15px', fontWeight: 700, color: 'var(--ink-dark)' }}>{(modelResult.approval_probability * 100).toFixed(1)}%</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(17,24,39,0.04)' }}>
                        <span style={{ fontSize: '13.5px', color: 'var(--ink-sec)', fontWeight: 600 }}>Risk Level</span>
                        {getRiskBadge(modelResult.risk_level)}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(17,24,39,0.04)' }}>
                        <span style={{ fontSize: '13.5px', color: 'var(--ink-sec)', fontWeight: 600 }}>Default Prob</span>
                        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: '15px', fontWeight: 700, color: 'var(--ink-dark)' }}>{(modelResult.default_probability * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid rgba(17,24,39,0.06)', display: 'flex', justifyContent: 'center' }}>
                    <GaugeChart
                      value={modelResult.approval_probability * 100}
                      max={100}
                      size={140}
                      strokeWidth={10}
                      showValue={true}
                      label="Approval"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelComparison;