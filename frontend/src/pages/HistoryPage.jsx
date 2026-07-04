import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { api } from '../api';
import { useAppStore } from '../store';
import { toast } from 'react-toastify';
import './HistoryPage.css';

/* ─── Smart Summarizer (Client-side rule engine) ──────── */
function generateSummary(history) {
  if (!history || history.length < 2) return null;
  const total = history.length;
  const approved = history.filter(h => h.decision?.toLowerCase() === 'approve').length;
  const rejected = history.filter(h => h.decision?.toLowerCase() === 'reject').length;
  const rate = (approved / total) * 100;

  const half = Math.floor(total / 2);
  const recentHalf = history.slice(0, half);
  const olderHalf  = history.slice(half);
  const recentRate = recentHalf.filter(h => h.decision?.toLowerCase() === 'approve').length / Math.max(recentHalf.length, 1) * 100;
  const olderRate  = olderHalf.filter(h => h.decision?.toLowerCase() === 'approve').length / Math.max(olderHalf.length, 1) * 100;
  const delta = recentRate - olderRate;

  let trend;
  if (Math.abs(delta) < 5) trend = 'stable';
  else if (delta > 0)      trend = 'improving';
  else                     trend = 'declining';

  const avgDefaultRisk = history.reduce((a, h) => a + (h.default_probability || 0) * 100, 0) / total;

  const latest = history[0];
  const previous = history[1];
  let notableChange = 'No significant change detected between the most recent applications.';
  if (latest && previous) {
    const riskDiff = ((latest.default_probability || 0) - (previous.default_probability || 0)) * 100;
    if (Math.abs(riskDiff) > 10) {
      notableChange = `The most recent application showed a ${Math.abs(riskDiff).toFixed(1)}% ${riskDiff > 0 ? 'increase' : 'decrease'} in default risk compared to the prior submission.`;
    } else if (latest.decision !== previous.decision) {
      notableChange = `The most recent decision changed from ${previous.decision} to ${latest.decision}, suggesting a shift in applicant profile.`;
    }
  }

  return {
    trend,
    rate: rate.toFixed(1),
    total,
    approved,
    rejected,
    avgDefaultRisk: avgDefaultRisk.toFixed(1),
    sentence1: `The portfolio of ${total} application${total !== 1 ? 's' : ''} shows a ${trend} risk profile with an overall approval rate of ${rate.toFixed(1)}% and average default risk of ${avgDefaultRisk.toFixed(1)}%.`,
    sentence2: notableChange,
    delta: delta.toFixed(1),
  };
}

/* ─── Mini Risk Distribution ───────────────────────────── */
function RiskDistribution({ history }) {
  const buckets = useMemo(() => {
    const low  = history.filter(h => h.risk_level === 'LOW').length;
    const med  = history.filter(h => h.risk_level === 'MEDIUM').length;
    const high = history.filter(h => h.risk_level === 'HIGH').length;
    const total = history.length || 1;
    return [
      { label: 'Low',    count: low,  pct: (low  / total * 100).toFixed(0), color: 'var(--emerald-wealth)' },
      { label: 'Medium', count: med,  pct: (med  / total * 100).toFixed(0), color: 'var(--royal-gold)' },
      { label: 'High',   count: high, pct: (high / total * 100).toFixed(0), color: 'var(--crimson-risk)' },
    ];
  }, [history]);

  return (
    <div className="hp-dist">
      {buckets.map(b => (
        <div key={b.label} className="hp-dist-row">
          <span className="hp-dist-label">{b.label}</span>
          <div className="hp-dist-track">
            <div className="hp-dist-fill" style={{ width: `${b.pct}%`, background: b.color }} />
          </div>
          <span className="hp-dist-val" style={{ color: b.color }}>{b.count}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Approval Timeline sparkline ───────────────────────── */
function ApprovalTimeline({ history }) {
  const points = useMemo(() => {
    const chunks = [];
    const chunkSize = Math.max(1, Math.ceil(history.length / 10));
    for (let i = 0; i < history.length; i += chunkSize) {
      const slice = history.slice(i, i + chunkSize);
      const rate = slice.filter(h => h.decision?.toLowerCase() === 'approve').length / slice.length * 100;
      chunks.push(rate);
    }
    return chunks;
  }, [history]);

  if (points.length < 2) return null;

  const W = 280, H = 70;
  const pts = points.map((v, i) => {
    const x = (i / (points.length - 1)) * W;
    const y = H - (v / 100) * H;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="hp-timeline-wrap">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="hpGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--emerald-wealth)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--emerald-wealth)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M0,${H} ${pts.split(' ').map(p => `L${p}`).join(' ')} L${W},${H} Z`} fill="url(#hpGrad)" />
        <polyline points={pts} fill="none" stroke="var(--emerald-wealth)" strokeWidth="2.5" strokeLinecap="round" />
        {points.map((v, i) => {
          const x = (i / (points.length - 1)) * W;
          const y = H - (v / 100) * H;
          return <circle key={i} cx={x} cy={y} r="3.5" fill="var(--emerald-wealth)" style={{ filter: 'drop-shadow(0 2px 4px rgba(16,137,84,0.4))' }} />;
        })}
      </svg>
    </div>
  );
}

/* ─── Summary Card ──────────────────────────────────────── */
function SummaryCard({ summary }) {
  if (!summary) return null;
  const trendIcon  = summary.trend === 'improving' ? '📈' : summary.trend === 'declining' ? '📉' : '📊';
  const trendColor = summary.trend === 'improving' ? 'var(--emerald-wealth)' : summary.trend === 'declining' ? 'var(--crimson-risk)' : 'var(--royal-gold)';

  return (
    <div className="hp-summary-card">
      <div className="hp-summary-header">
        <div className="hp-summary-icon">🤖</div>
        <div>
          <div className="hp-summary-title">AI Portfolio Summary</div>
          <span className="hp-summary-badge" style={{ color: trendColor, background: summary.trend === 'improving' ? 'rgba(16,137,84,0.1)' : summary.trend === 'declining' ? 'rgba(185,28,28,0.1)' : 'rgba(197,160,89,0.1)', border: `1px solid ${trendColor}` }}>
            {trendIcon} {summary.trend.charAt(0).toUpperCase() + summary.trend.slice(1)} Profile
          </span>
        </div>
      </div>
      <p className="hp-summary-text">{summary.sentence1}</p>
      <p className="hp-summary-text hp-summary-text2">{summary.sentence2}</p>
      <div className="hp-summary-disclaimer">
        ⚖️ AI-assisted assessment. Final decisions require human underwriter approval.
      </div>
    </div>
  );
}

/* ─── Decision Badge ──────────────────────────────────── */
function DecisionBadge({ decision }) {
  const d = (decision || '').toLowerCase();
  const map = {
    approve:     { label: '✓ Approve',     color: 'var(--emerald-wealth)', bg: 'rgba(16,137,84,0.1)',  border: 'rgba(16,137,84,0.3)'  },
    reject:      { label: '✗ Reject',      color: 'var(--crimson-risk)',   bg: 'rgba(185,28,28,0.1)',  border: 'rgba(185,28,28,0.3)'  },
    conditional: { label: '~ Conditional', color: 'var(--royal-gold)',     bg: 'rgba(197,160,89,0.1)', border: 'rgba(197,160,89,0.3)' },
  };
  const c = map[d] || map.conditional;
  return (
    <span style={{ display: 'inline-block', padding: '4px 14px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 800, fontFamily: 'var(--ff-mono)', letterSpacing: '0.08em', color: c.color, background: c.bg, border: `1px solid ${c.border}`, boxShadow: 'var(--ceramic-shadow)' }}>
      {c.label}
    </span>
  );
}

function RiskPill({ level }) {
  const map = {
    LOW:    { color: 'var(--emerald-wealth)', bg: 'rgba(16,137,84,0.1)',  border: 'rgba(16,137,84,0.3)'  },
    MEDIUM: { color: 'var(--royal-gold)',     bg: 'rgba(197,160,89,0.1)', border: 'rgba(197,160,89,0.3)' },
    HIGH:   { color: 'var(--crimson-risk)',   bg: 'rgba(185,28,28,0.1)',  border: 'rgba(185,28,28,0.3)'  },
  };
  const c = map[level?.toUpperCase()] || map.MEDIUM;
  return (
    <span style={{ display: 'inline-block', padding: '4px 14px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 800, fontFamily: 'var(--ff-mono)', letterSpacing: '0.08em', color: c.color, background: c.bg, border: `1px solid ${c.border}`, boxShadow: 'var(--ceramic-shadow)' }}>
      {level || 'MEDIUM'}
    </span>
  );
}

/* ─── Confirm Modal ──────────────────────────────────────── */
function ConfirmModal({ open, onConfirm, onCancel, title, message, confirmLabel = 'Confirm', danger = false }) {
  if (!open) return null;
  return (
    <div className="hp-modal-overlay" onClick={onCancel}>
      <div className="hp-modal" onClick={e => e.stopPropagation()}>
        <div className="hp-modal-icon">{danger ? '🗑️' : '⚠️'}</div>
        <h3 className="hp-modal-title">{title}</h3>
        <p className="hp-modal-message">{message}</p>
        <div className="hp-modal-actions">
          <button className="hp-modal-cancel" onClick={onCancel}>Cancel</button>
          <button className={`hp-modal-confirm ${danger ? 'danger' : ''}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────── */
export default function HistoryPage() {
  const [history, setHistory]       = useState([]);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('all');
  const [selected, setSelected]     = useState(new Set());
  const [modal, setModal]           = useState(null);
  const [deleting, setDeleting]     = useState(false);

  const user    = useAppStore(state => state.user);
  const isAdmin = user?.role === 'admin';

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.history(50),
      api.dashboardStats()
    ]).then(([historyRes, statsRes]) => {
      setHistory(historyRes || []);
      setStats(statsRes);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const summary = useMemo(() => generateSummary(history), [history]);

  const filtered = useMemo(() => {
    if (filter === 'all') return history;
    return history.filter(h => h.decision?.toLowerCase() === filter || h.risk_level?.toLowerCase() === filter);
  }, [history, filter]);

  const kpis = useMemo(() => {
    if (stats) return stats;
    const total    = history.length;
    const approved = history.filter(h => h.decision?.toLowerCase() === 'approve').length;
    const high     = history.filter(h => h.risk_level === 'HIGH').length;
    const avgCredit = total ? Math.round(history.reduce((a, h) => a + (h.credit_score || 0), 0) / total) : 0;
    return { total, approved, high, avgCredit, rate: total ? ((approved / total) * 100).toFixed(1) : 0 };
  }, [history, stats]);

  const toggleRow = (id) => setSelected(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const toggleAll = () => {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(r => r.id)));
    }
  };

  const allSelected = filtered.length > 0 && selected.size === filtered.length;
  const someSelected = selected.size > 0;

  const handleConfirm = async () => {
    if (!modal) return;
    setDeleting(true);
    try {
      if (modal.type === 'clear') {
        await api.clearHistory();
        setHistory([]);
        setSelected(new Set());
        toast.success('All history cleared successfully');
      } else if (modal.type === 'bulk') {
        const ids = [...selected];
        await api.bulkDeleteHistory(ids);
        setHistory(prev => prev.filter(h => !selected.has(h.id)));
        setSelected(new Set());
        toast.success(`${ids.length} record${ids.length > 1 ? 's' : ''} deleted`);
      } else if (modal.type === 'single') {
        await api.deleteDecision(modal.id);
        setHistory(prev => prev.filter(h => h.id !== modal.id));
        setSelected(prev => { const s = new Set(prev); s.delete(modal.id); return s; });
        toast.success('Record deleted');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to delete records');
    } finally {
      setDeleting(false);
      setModal(null);
    }
  };

  const modalConfig = useMemo(() => {
    if (!modal) return {};
    if (modal.type === 'clear') return {
      title: isAdmin ? 'Clear All History' : 'Clear My History',
      message: isAdmin
        ? `This will permanently delete ALL ${history.length} prediction records from the database. This cannot be undone.`
        : `This will permanently delete all ${history.length} of your prediction records. You cannot undo this action.`,
      confirmLabel: '🗑️ Clear All',
      danger: true,
    };
    if (modal.type === 'bulk') return {
      title: `Delete ${selected.size} Selected`,
      message: `Permanently delete ${selected.size} selected record${selected.size > 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: `Delete ${selected.size}`,
      danger: true,
    };
    if (modal.type === 'single') return {
      title: 'Delete Record',
      message: 'Are you sure you want to delete this record? This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    };
    return {};
  }, [modal, selected, history, isAdmin]);

  const now = new Date();

  return (
    <div className="hp-page wealth-predict">
      <ConfirmModal
        open={!!modal}
        onConfirm={handleConfirm}
        onCancel={() => !deleting && setModal(null)}
        {...modalConfig}
      />

      {/* ── Page Header / Editorial Wealth Bar ─────────────────────────────── */}
      <div className="wealth-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="wealth-crumbs">
            <span className="crumb-brand">AETHER PRIVATE WEALTH</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">APPLICATION AUDIT TRAIL</span>
          </div>
          <h1 className="wealth-title" style={{ marginBottom: 8 }}>Application History &amp; Audit Log</h1>
          <p className="hp-page-sub">Full audit trail of all processed applications with real-time analytics</p>
        </div>
        <div className="wealth-top-actions">
          {user?.role === 'admin' && <div className="swiss-shield-tag">⛨ EXECUTIVE PRIVILEGE</div>}
          <div className="wealth-timebox">
            <span className="timebox-h">{now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
            <span className="timebox-d">{now.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})}</span>
          </div>
          {!loading && history.length > 0 && (
            <button
              id="clear-history-btn"
              className="hp-clear-all-btn"
              onClick={() => setModal({ type: 'clear' })}
              title={isAdmin ? 'Clear all history (Admin)' : 'Clear my prediction history'}
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {isAdmin ? 'Clear All History' : 'Clear My History'}
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Strip ────────────────────────────────────── */}
      <div className="hp-kpi-strip">
        {[
          { label: 'Total Applications', value: kpis.total,                                      color: 'var(--sapphire-blue)' },
          { label: 'Approval Rate',      value: `${Number(kpis.approvalRate || kpis.rate).toFixed(1)}%`, color: 'var(--emerald-wealth)' },
          { label: 'High Risk',          value: kpis.high || kpis.rejected,                      color: 'var(--crimson-risk)' },
          { label: 'Avg Credit Score',   value: kpis.avgCredit,                                  color: 'var(--royal-gold)' },
        ].map(k => (
          <div key={k.label} className="hp-kpi-card">
            <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background: k.color }} />
            <div className="hp-kpi-val" style={{ color: k.color }}>{loading ? '—' : k.value}</div>
            <div className="hp-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Analytics Row ─────────────────────────────────── */}
      <div className="hp-analytics-row">
        <div className="hp-analytics-card" style={{ position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:'var(--emerald-wealth)' }} />
          <div className="hp-analytics-title">Risk Distribution</div>
          {loading ? <div className="hp-skeleton" style={{ height: 80 }} /> : <RiskDistribution history={history} />}
        </div>
        <div className="hp-analytics-card" style={{ position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:'var(--sapphire-blue)' }} />
          <div className="hp-analytics-title">Approval Rate Trend</div>
          {loading ? <div className="hp-skeleton" style={{ height: 80 }} /> : <ApprovalTimeline history={history} />}
          <div className="hp-spark-caption">Approval rate across recent batches</div>
        </div>
        <SummaryCard summary={summary} />
      </div>

      {/* ── Table ─────────────────────────────────────────── */}
      <div className="hp-table-card">
        <div className="hp-table-header">
          <div className="hp-table-header-left">
            <h2 className="hp-table-title">All Applications</h2>
            {someSelected && (
              <div className="hp-selection-bar">
                <span className="hp-sel-count">{selected.size} selected</span>
                <button
                  id="delete-selected-btn"
                  className="hp-delete-selected-btn"
                  onClick={() => setModal({ type: 'bulk' })}
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="13" height="13">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Selected
                </button>
                <button className="hp-deselect-btn" onClick={() => setSelected(new Set())}>✕ Deselect</button>
              </div>
            )}
          </div>
          <div className="hp-filter-tabs">
            {['all', 'approve', 'reject', 'high'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`hp-filter-tab ${filter === f ? 'active' : ''}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="hp-table-wrap">
          <table className="hp-table">
            <thead>
              <tr>
                <th style={{ width: 40, paddingRight: 0 }}>
                  <input
                    type="checkbox"
                    className="hp-checkbox"
                    id="select-all-checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    title="Select all visible rows"
                  />
                </th>
                <th>#</th>
                <th>Timestamp</th>
                <th className="align-right">Loan Amount</th>
                <th className="align-center">Credit Score</th>
                <th className="align-center">Risk Level</th>
                <th className="align-right">Default Risk</th>
                <th className="align-center">Decision</th>
                <th className="align-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j}><div className="hp-skeleton" style={{ height: 14, borderRadius: 4 }} /></td>
                      ))}
                    </tr>
                  ))
                : filtered.length === 0
                  ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', color: 'var(--ink-sec)', padding: '64px 0' }}>
                        <div style={{ fontSize: 36, marginBottom: 16 }}>📭</div>
                        <div style={{ fontFamily: 'var(--ff-display)', fontSize: 20, fontWeight: 700, color: 'var(--ink-dark)', marginBottom: 8 }}>No Audit Records Found</div>
                        <div style={{ fontSize: 13, color: 'var(--ink-sec)' }}>
                          {history.length === 0 ? 'Execute an underwriting prediction to populate the audit ledger.' : 'No records match the active tranche filter.'}
                        </div>
                      </td>
                    </tr>
                  )
                  : filtered.map((row, i) => {
                    const isChecked = selected.has(row.id);
                    return (
                      <tr
                        key={row.id ?? i}
                        className={`hp-row${isChecked ? ' hp-row-selected' : ''}`}
                      >
                        <td style={{ paddingRight: 0 }}>
                          <input
                            type="checkbox"
                            className="hp-checkbox"
                            checked={isChecked}
                            onChange={() => toggleRow(row.id)}
                          />
                        </td>
                        <td className="hp-id">{history.length - history.indexOf(row)}</td>
                        <td className="hp-time">
                          <div style={{ color: 'var(--ink-dark)', fontWeight: 600 }}>{new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-sec)' }}>{new Date(row.timestamp).toLocaleDateString()}</div>
                        </td>
                        <td className="align-right mono hp-loan">${(row.loan_amount || 0).toLocaleString()}</td>
                        <td className="align-center">
                          <span className={`hp-credit ${row.credit_score >= 700 ? 'credit-good' : row.credit_score >= 600 ? 'credit-fair' : 'credit-poor'}`}>
                            {row.credit_score || 'N/A'}
                          </span>
                        </td>
                        <td className="align-center"><RiskPill level={row.risk_level} /></td>
                        <td className="align-right">
                          <div className="hp-risk-bar-wrap">
                            <div className="hp-risk-bar-track">
                              <div className="hp-risk-bar-fill" style={{
                                width: `${(row.default_probability || 0) * 100}%`,
                                background: (row.default_probability || 0) > 0.5 ? 'var(--crimson-risk)' : (row.default_probability || 0) > 0.3 ? 'var(--royal-gold)' : 'var(--emerald-wealth)'
                              }} />
                            </div>
                            <span className="hp-risk-pct" style={{ color: (row.default_probability || 0) > 0.5 ? 'var(--crimson-risk)' : (row.default_probability || 0) > 0.3 ? 'var(--royal-gold)' : 'var(--emerald-wealth)' }}>
                              {((row.default_probability || 0) * 100).toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="align-center"><DecisionBadge decision={row.decision} /></td>
                        <td className="align-center">
                          <button
                            className="hp-delete-btn"
                            onClick={() => setModal({ type: 'single', id: row.id })}
                            title="Delete this record"
                          >
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Audit Disclaimer ─────────────────────────────── */}
      <div className="hp-audit-note">
        <span style={{ fontSize: 20 }}>🔒</span>
        <span>
          Cryptographic audit log of processed credit facilities. You can purge your local records at any time.
          {isAdmin && ' As executive admin, you hold global ledger management authority.'} All automated assessments require final human underwriter sign-off.
        </span>
      </div>
    </div>
  );
}
