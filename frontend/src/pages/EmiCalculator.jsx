import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import './EmiCalculator.css';

/* ─── Amortization Engine ───────────────────────────────── */
function computeAmortization(principal, annualRate, years) {
  const n = years * 12;
  const r = annualRate / 100 / 12;
  if (r === 0) return { emi: principal / n, totalInterest: 0, totalPayment: principal, schedule: [] };

  const emi = principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  const schedule = [];
  let balance = principal;
  let totalInterest = 0;

  for (let month = 1; month <= n; month++) {
    const interest = balance * r;
    const principalPart = emi - interest;
    balance = Math.max(0, balance - principalPart);
    totalInterest += interest;
    schedule.push({ month, emi, interest, principal: principalPart, balance });
  }

  return { emi, totalInterest, totalPayment: emi * n, schedule };
}

/* ─── Donut Ring ─────────────────────────────────────────── */
function PaymentDonut({ principal, interest, size = 180 }) {
  const total = principal + interest;
  const pPct = total ? principal / total : 0.5;
  const r = (size - 24) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', filter: 'drop-shadow(0 8px 16px rgba(197,160,89,0.15))' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(17,24,39,0.05)" strokeWidth={18} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--emerald-wealth)" strokeWidth={18}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pPct)}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s var(--ease-wealth)' }} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--royal-gold)" strokeWidth={18}
        strokeDasharray={circ} strokeDashoffset={circ * pPct}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s var(--ease-wealth)' }} />
    </svg>
  );
}

/* ─── Year-by-Year Bar Chart ─────────────────────────────── */
function YearlyChart({ schedule, years }) {
  const yearlyData = [];
  for (let y = 1; y <= years; y++) {
    const monthsInYear = schedule.filter(s => Math.ceil(s.month / 12) === y);
    const interest = monthsInYear.reduce((a, s) => a + s.interest, 0);
    const principal = monthsInYear.reduce((a, s) => a + s.principal, 0);
    yearlyData.push({ year: y, interest, principal });
  }

  const maxVal = Math.max(...yearlyData.map(d => d.interest + d.principal), 1);

  return (
    <div className="emi-chart">
      <div className="emi-chart-bars">
        {yearlyData.map(d => (
          <div key={d.year} className="emi-bar-group" title={`Year ${d.year}: Principal $${Math.round(d.principal).toLocaleString()}, Interest $${Math.round(d.interest).toLocaleString()}`}>
            <div className="emi-bar-stack" style={{ height: `${((d.interest + d.principal) / maxVal) * 100}%` }}>
              <div className="emi-bar-interest" style={{ height: `${(d.interest / (d.interest + d.principal)) * 100}%` }} />
              <div className="emi-bar-principal" style={{ height: `${(d.principal / (d.interest + d.principal)) * 100}%` }} />
            </div>
            <span className="emi-bar-label">Y{d.year}</span>
          </div>
        ))}
      </div>
      <div className="emi-chart-legend">
        <span><span className="emi-legend-dot" style={{ background: 'var(--emerald-wealth)' }} /> Principal Tranche</span>
        <span><span className="emi-legend-dot" style={{ background: 'var(--royal-gold)' }} /> Accumulated Interest</span>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────── */
export default function EmiCalculator() {
  const [loanAmount, setLoanAmount] = useState(250000);
  const [interestRate, setInterestRate] = useState(6.5);
  const [loanTerm, setLoanTerm] = useState(30);
  const user = useAppStore(s => s.user);

  const result = useMemo(() => computeAmortization(loanAmount, interestRate, loanTerm), [loanAmount, interestRate, loanTerm]);
  const fmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

  const now = new Date();

  return (
    <div className="emi-page wealth-predict">
      
      {/* ── Page Header / Editorial Wealth Bar ─────────────────────────────── */}
      <div className="wealth-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="wealth-crumbs">
            <span className="crumb-brand">AETHER PRIVATE WEALTH</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">AMORTIZATION TELEMETRY</span>
          </div>
          <h1 className="wealth-title" style={{ marginBottom: 8 }}>Amortization &amp; Facility Calculator</h1>
          <p className="emi-sub">Interactive mortgage payment modeling with dynamic schedule breakdown</p>
        </div>
        <div className="wealth-top-actions">
          {user?.role === 'admin' && <div className="swiss-shield-tag">⛨ EXECUTIVE PRIVILEGE</div>}
          <div className="wealth-timebox">
            <span className="timebox-h">{now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
            <span className="timebox-d">{now.toLocaleDateString([],{month: 'short', day: 'numeric', year: 'numeric'})}</span>
          </div>
          <div className="swiss-pill swiss-ok">
            <span className="swiss-dot" style={{background:'var(--emerald-wealth)'}} />
            ENGINE SYNCHRONIZED
          </div>
        </div>
      </div>

      <div className="emi-main-grid">
        {/* Input Panel */}
        <div className="emi-input-card">
          <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:'linear-gradient(90deg, var(--royal-gold), #E5C17D)' }} />
          <div className="emi-slider-group">
            <div className="emi-slider-header">
              <span className="emi-slider-label">Facility Principal</span>
              <span className="emi-slider-val">{fmt(loanAmount)}</span>
            </div>
            <input type="range" min={10000} max={1000000} step={5000} value={loanAmount}
              onChange={e => setLoanAmount(+e.target.value)} className="emi-slider" />
            <div className="emi-slider-range"><span>$10K</span><span>$1M</span></div>
          </div>

          <div className="emi-slider-group">
            <div className="emi-slider-header">
              <span className="emi-slider-label">Annual Interest Rate</span>
              <span className="emi-slider-val">{interestRate.toFixed(1)}%</span>
            </div>
            <input type="range" min={0.5} max={15} step={0.1} value={interestRate}
              onChange={e => setInterestRate(+e.target.value)} className="emi-slider" />
            <div className="emi-slider-range"><span>0.5%</span><span>15%</span></div>
          </div>

          <div className="emi-slider-group">
            <div className="emi-slider-header">
              <span className="emi-slider-label">Amortization Term</span>
              <span className="emi-slider-val">{loanTerm} years</span>
            </div>
            <input type="range" min={1} max={40} step={1} value={loanTerm}
              onChange={e => setLoanTerm(+e.target.value)} className="emi-slider" />
            <div className="emi-slider-range"><span>1 yr</span><span>40 yrs</span></div>
          </div>

          {/* Payment Donut */}
          <div className="emi-donut-section">
            <PaymentDonut principal={loanAmount} interest={result.totalInterest} />
            <div className="emi-donut-info">
              <div className="emi-donut-row"><span className="emi-legend-dot" style={{ background: 'var(--emerald-wealth)' }} /><span>Principal:</span><span className="mono">{fmt(loanAmount)}</span></div>
              <div className="emi-donut-row"><span className="emi-legend-dot" style={{ background: 'var(--royal-gold)' }} /><span>Total Interest:</span><span className="mono">{fmt(result.totalInterest)}</span></div>
              <div className="emi-donut-row total"><span /><span>Total Obligation:</span><span className="mono">{fmt(result.totalPayment)}</span></div>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="emi-results-card">
          <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:'linear-gradient(90deg, var(--emerald-wealth), #22C55E)' }} />
          <div className="emi-big-emi">
            <div className="emi-big-label">Monthly Installment (EMI)</div>
            <div className="emi-big-value">{fmt(result.emi)}</div>
            <div className="emi-big-sub">per month for {loanTerm} years ({loanTerm * 12} scheduled disbursements)</div>
          </div>

          <div className="emi-stat-grid">
            <div className="emi-stat">
              <div className="emi-stat-val" style={{ color: 'var(--emerald-wealth)' }}>{fmt(loanAmount)}</div>
              <div className="emi-stat-label">Principal</div>
            </div>
            <div className="emi-stat">
              <div className="emi-stat-val" style={{ color: 'var(--royal-gold)' }}>{fmt(result.totalInterest)}</div>
              <div className="emi-stat-label">Total Interest</div>
            </div>
            <div className="emi-stat">
              <div className="emi-stat-val" style={{ color: 'var(--sapphire-blue)' }}>{fmt(result.totalPayment)}</div>
              <div className="emi-stat-label">Total Payment</div>
            </div>
            <div className="emi-stat">
              <div className="emi-stat-val" style={{ color: 'var(--crimson-risk)' }}>{((result.totalInterest / loanAmount) * 100).toFixed(1)}%</div>
              <div className="emi-stat-label">Interest Ratio</div>
            </div>
          </div>

          {/* Yearly chart */}
          {loanTerm <= 40 && <YearlyChart schedule={result.schedule} years={loanTerm} />}
        </div>
      </div>

      <div className="emi-disclaimer">
        <span style={{ fontSize: 18, marginRight: 8 }}>⚖️</span>
        <strong>Fiduciary Notice:</strong> This amortization engine provides mathematical modeling for private wealth planning purposes. Actual disbursement terms, escrow requirements, and facility covenants may vary based on prevailing market conditions and institutional underwriting guidelines.
      </div>
    </div>
  );
}
