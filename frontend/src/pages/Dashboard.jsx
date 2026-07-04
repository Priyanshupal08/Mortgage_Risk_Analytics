import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import { useAppStore } from '../store';
import GaugeChart from '../components/GaugeChart';
import './Dashboard.css';

/* ═════════════════════════════════════════════════════════════════════════
   Utility Components & Wealth Micro-Visualizations
═════════════════════════════════════════════════════════════════════════ */

function Counter({ to = 0, prefix = '', suffix = '', decimals = 0, ms = 1400 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!to) return;
    let raf, start;
    const run = ts => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / ms, 1);
      const e = 1 - Math.pow(1 - p, 5); // Quintic ease out
      setN(+(to * e).toFixed(decimals));
      if (p < 1) raf = requestAnimationFrame(run);
    };
    raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [to, ms, decimals]);
  return <>{prefix}{decimals ? n.toFixed(decimals) : Math.floor(n).toLocaleString()}{suffix}</>;
}

/* Wealth Sparkline with Soft Champagne Gradient Area */
function WealthSparkline({ data = [], color = '#C5A059', h = 48, w = 140 }) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 8) - 4;
    return `${x},${y}`;
  }).join(' ');
  const area = `M 0,${h} L ${pts.split(' ').map(p=>p).join(' L ')} L ${w},${h} Z`;
  const gradId = `ws-${color.replace('#','')}`;
  return (
    <svg width={w} height={h} style={{ display:'block', overflow:'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Last Point Elegant Dot */}
      {data.length > 0 && (
        <circle
          cx={w}
          cy={h - ((data[data.length-1] - min) / range) * (h - 8) - 4}
          r="4" fill={color} stroke="#FFFFFF" strokeWidth="2"
          style={{ boxSizing:'content-box', filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}
        />
      )}
    </svg>
  );
}

/* Elegant Ceramic Progress Ring */
function CeramicRing({ pct = 0, color = '#108954', size = 72, stroke = 6, label }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const off = circ - (pct / 100) * circ;
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ overflow:'visible' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
          style={{ transform:'rotate(-90deg)', transformOrigin:'center', transition:'stroke-dashoffset 1.4s cubic-bezier(.22,1,.36,1)' }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontSize:16, fontWeight:700, color, fontFamily:'var(--ff-display)', lineHeight:1 }}>{Math.round(pct)}</span>
        {label && <span style={{ fontSize:8, color:'var(--ink-sec)', fontFamily:'var(--ff-mono)', letterSpacing:'0.1em', marginTop:2 }}>{label}</span>}
      </div>
    </div>
  );
}

/* Wealth Underwriting Badge */
function WealthBadge({ decision }) {
  const d = (decision||'').toLowerCase();
  const cfg = d === 'approve'
    ? { cls:'wb-ok',   label:'APPROVED',   dot:'var(--emerald-wealth)' }
    : d === 'reject'
    ? { cls:'wb-err',  label:'REJECTED',   dot:'var(--crimson-risk)' }
    : { cls:'wb-warn', label:'CONDITIONAL',dot:'var(--royal-gold)' };
  return (
    <span className={`wealth-badge ${cfg.cls}`}>
      <span className="wb-dot" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

/* Risk Pill */
function RiskPill({ val }) {
  const p = Math.round((val||0)*100);
  const cls = p < 30 ? 'rp-low' : p < 65 ? 'rp-mid' : 'rp-high';
  return <span className={`risk-pill ${cls}`}>{p}%</span>;
}

/* Credit Tier Chip */
function CreditChip({ cs }) {
  const cls = cs >= 750 ? 'cc-exc' : cs >= 700 ? 'cc-good' : cs >= 650 ? 'cc-fair' : 'cc-poor';
  const lbl = cs >= 750 ? 'PRIME PLUS' : cs >= 700 ? 'PRIME' : cs >= 650 ? 'ALMOST PRIME' : 'SUBPRIME';
  return (
    <span className={`credit-chip ${cls}`}>
      <span className="cc-num">{cs}</span>
      <span className="cc-lbl">{lbl}</span>
    </span>
  );
}

/* Anomaly AI Engine */
function detectAnomalies(hist) {
  if (!hist?.length || hist.length < 3) return [];
  const out = [];
  const half = Math.floor(hist.length / 2);
  const rRate = hist.slice(0,half).filter(h=>h.decision?.toLowerCase()==='approve').length / Math.max(half,1) * 100;
  const oRate = hist.slice(half).filter(h=>h.decision?.toLowerCase()==='approve').length / Math.max(hist.length-half,1) * 100;
  const delta = rRate - oRate;
  if (Math.abs(delta) > 25)
    out.push({ sev: Math.abs(delta)>40?'CRITICAL':'WARNING', title: delta>0?'Approval Velocity Surge':'Approval Rate Contraction', msg: `${Math.abs(delta).toFixed(0)}% variance between recent underwriting cohorts and historical baselines`, metric: `Δ${delta>0?'+':''}${delta.toFixed(0)}%` });
  const hrPct = hist.filter(h=>(h.default_probability||0)>0.5).length/hist.length*100;
  if (hrPct > 40)
    out.push({ sev: hrPct>60?'CRITICAL':'WARNING', title:'Subprime Risk Concentration', msg:`${hrPct.toFixed(0)}% of pipeline volume exceeds the 50% default probability risk threshold`, metric:`${hrPct.toFixed(0)}%` });
  let streak = 1;
  for (let i=1;i<Math.min(hist.length,10);i++) { if(hist[i].decision===hist[0].decision) streak++; else break; }
  if (streak >= 5)
    out.push({ sev: streak>=8?'CRITICAL':'INFO', title:'Sequential Underwriting Pattern', msg:`Last ${streak} consecutive applications received "${hist[0].decision}" — analyzing for systemic underwriting bias`, metric:`${streak}×` });
  return out;
}

/* ═════════════════════════════════════════════════════════════════════════
   Main Dashboard Component
═════════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const user = useAppStore(s => s.user);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeRow, setActiveRow] = useState(null);

  useEffect(() => {
    Promise.all([api.dashboardStats(), api.history(25)])
      .then(([s, h]) => { setStats(s); setHistory(h); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const anomalies = useMemo(() => detectAnomalies(history), [history]);

  /* Sparkline data calculations */
  const sparkApproval = useMemo(() => {
    if (!history.length) return [];
    const chunks = 8;
    const size = Math.ceil(history.length / chunks);
    return Array.from({length:chunks}, (_,i) => {
      const sl = history.slice(i*size,(i+1)*size);
      if (!sl.length) return 0;
      return sl.filter(h=>h.decision?.toLowerCase()==='approve').length/sl.length*100;
    });
  }, [history]);

  const sparkRisk = useMemo(() => {
    if (!history.length) return [];
    const chunks = 8;
    const size = Math.ceil(history.length / chunks);
    return Array.from({length:chunks}, (_,i) => {
      const sl = history.slice(i*size,(i+1)*size);
      if (!sl.length) return 0;
      return sl.reduce((a,h)=>a+(h.default_probability||0)*100,0)/sl.length;
    });
  }, [history]);

  const avgCredit = Math.round(history.reduce((a,h)=>a+(h.credit_score||0),0)/Math.max(history.length,1));
  const riskColor = !stats ? 'var(--royal-gold)' : stats.avgRisk < 30 ? 'var(--emerald-wealth)' : stats.avgRisk < 65 ? 'var(--royal-gold)' : 'var(--crimson-risk)';
  const now = new Date();

  return (
    <div className="wealth-db">

      {/* ── Page Header / Editorial Wealth Bar ─────────────────────────────── */}
      <div className="wealth-header">
        <div>
          <div className="wealth-crumbs">
            <span className="crumb-brand">AETHER PRIVATE WEALTH</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">PORTFOLIO RISK</span>
          </div>
          <h1 className="wealth-title">Risk &amp; Capital Allocation</h1>
        </div>
        <div className="wealth-top-actions">
          {user?.role === 'admin' && <div className="swiss-shield-tag">⛨ EXECUTIVE PRIVILEGE</div>}
          <div className="wealth-timebox">
            <span className="timebox-h">{now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
            <span className="timebox-d">{now.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})}</span>
          </div>
          <div className={`swiss-pill ${anomalies.some(a=>a.sev==='CRITICAL')?'swiss-crit':'swiss-ok'}`}>
            <span className="swiss-dot" />
            {anomalies.some(a=>a.sev==='CRITICAL') ? 'PORTFOLIO ALERT' : 'PORTFOLIO OPTIMAL'}
          </div>
        </div>
      </div>

      {error && (
        <div className="wealth-err">
          <span style={{color:'var(--crimson-risk)'}}>⚠</span> {error}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          HERO BENTO GRID ("The Alabaster Vault")
      ═════════════════════════════════════════════════════════════════════ */}
      <div className="bento-vault">

        {/* Bento 1: Total Capital Deployment / Pipeline (HERO SPAN 2) */}
        <motion.div className="ceramic-card vault-card vault-span-2" initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:0.45,delay:0}}>
          <div className="vault-top-ribbon" />
          <div className="vault-top">
            <span className="vault-lbl">TOTAL CAPITAL DEPLOYMENT PIPELINE</span>
            <span className="vault-tag gold-tag">ACTIVE TRANCHE</span>
          </div>
          <div className="vault-num-box">
            <div className="vault-num c-dark">
              {loading ? <div className="skel" style={{height:72,width:180,borderRadius:12}}/> : <Counter to={stats?.total||0}/>}
            </div>
            <div className="vault-sub-bar">
              <div className="vault-sub-stat">
                <span className="vss-val c-emerald">{loading?'—':stats?.approved||0}</span>
                <span className="vss-lbl">APPROVED</span>
              </div>
              <div className="vault-sep"/>
              <div className="vault-sub-stat">
                <span className="vss-val c-crimson">{loading?'—':stats?.rejected||0}</span>
                <span className="vss-lbl">REJECTED</span>
              </div>
              <div className="vault-sep"/>
              <div className="vault-sub-stat">
                <span className="vss-val c-gold">{loading?'—':(stats?.total||0)-(stats?.approved||0)-(stats?.rejected||0)}</span>
                <span className="vss-lbl">CONDITIONAL</span>
              </div>
            </div>
          </div>
          <div className="vault-spark-box">
            <WealthSparkline data={sparkApproval} color="var(--royal-gold)" h={48} w={180} />
          </div>
        </motion.div>

        {/* Bento 2: Underwriting Approval Velocity */}
        <motion.div className="ceramic-card vault-card" initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:0.45,delay:0.08}}>
          <div className="vault-top">
            <span className="vault-lbl">APPROVAL VELOCITY</span>
            <span className="vault-tag emerald-tag">UNDERWRITING</span>
          </div>
          <div className="vault-mid-flex">
            <div>
              <div className="vault-num c-emerald">
                {loading ? <div className="skel" style={{height:46,width:110,borderRadius:8}}/> : <Counter to={stats?.approvalRate||0} suffix="%" decimals={1}/>}
              </div>
              <div className="vault-sub-text">of pipeline volume</div>
            </div>
            <CeramicRing pct={stats?.approvalRate||0} color="var(--emerald-wealth)" size={72} stroke={6} label="RATE" />
          </div>
          <div className="vault-spark-box">
            <WealthSparkline data={sparkApproval} color="var(--emerald-wealth)" h={36} w={120} />
          </div>
        </motion.div>

        {/* Bento 3: Average Exposure per Node */}
        <motion.div className="ceramic-card vault-card" initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:0.45,delay:0.14}}>
          <div className="vault-top">
            <span className="vault-lbl">CAPITAL LIQUIDITY</span>
            <span className="vault-tag gold-tag">MEAN EXPOSURE</span>
          </div>
          <div className="vault-mid-flex">
            <div>
              <div className="vault-num c-gold">
                {loading ? <div className="skel" style={{height:46,width:130,borderRadius:8}}/> : <Counter to={stats?.avgLoan||0} prefix="$"/>}
              </div>
              <div className="vault-sub-text">per facility allocation</div>
            </div>
            <div className="vault-icon-crest" style={{background:'rgba(197,160,89,0.1)',borderColor:'rgba(197,160,89,0.3)',color:'var(--royal-gold)'}}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
          </div>
          <div className="vault-foot-status">
            <span className="vfs-dot" style={{background:'var(--emerald-wealth)'}}/>
            <span className="vfs-text">RESERVES OPTIMAL</span>
          </div>
        </motion.div>

        {/* Bento 4: Portfolio Value at Risk (VaR) */}
        <motion.div className="ceramic-card vault-card" initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:0.45,delay:0.2}}>
          <div className="vault-top">
            <span className="vault-lbl">PORTFOLIO VaR</span>
            <span className="vault-tag crimson-tag">DEFAULT RISK</span>
          </div>
          <div className="vault-mid-flex">
            <div>
              <div className="vault-num" style={{color:riskColor}}>
                {loading ? <div className="skel" style={{height:46,width:90,borderRadius:8}}/> : <Counter to={stats?.avgRisk||0} suffix="%" decimals={1}/>}
              </div>
              <div className="vault-sub-text">weighted risk index</div>
            </div>
            <CeramicRing pct={stats?.avgRisk||0} color={riskColor} size={72} stroke={6} label="VaR" />
          </div>
          <div className="vault-spark-box">
            <WealthSparkline data={sparkRisk} color={riskColor} h={36} w={120} />
          </div>
        </motion.div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          MAIN CONTENT GRID (Underwriting Ledger + Right Matrix)
      ═════════════════════════════════════════════════════════════════════ */}
      <div className="wealth-main">

        {/* ── Underwriting Audit Ledger ───────────────────────────────────── */}
        <motion.div className="ceramic-card ledger-card" initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:0.45,delay:0.26}}>
          <div className="lc-header">
            <div>
              <h2 className="lc-title">Underwriting Audit Ledger</h2>
              <p className="lc-sub">Real-time credit facility evaluation pipeline ({history.length} active dossiers)</p>
            </div>
            <div className="swiss-beacon-pill">
              <span className="sb-pulse-dot" />
              <span className="sb-text">LIVE AUDIT</span>
            </div>
          </div>

          <div style={{overflowX:'auto'}}>
            <table className="audit-table">
              <thead>
                <tr>
                  <th>TIMESTAMP</th>
                  <th>FACILITY REQUIRED</th>
                  <th>CREDIT RATING</th>
                  <th>DEFAULT PROBABILITY</th>
                  <th>UNDERWRITING DECISION</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({length:8}).map((_,i)=>(
                      <tr key={i} className="at-row skel-row">
                        {[100,90,110,90,100].map((w,j)=>(
                          <td key={j}><div className="skel" style={{height:14,width:w}}/></td>
                        ))}
                      </tr>
                    ))
                  : history.length === 0
                    ? <tr><td colSpan={5}><div className="empty-audit">Ledger void. Awaiting initial applicant telemetry...</div></td></tr>
                    : history.map((row,i)=>(
                        <motion.tr key={i} className={`at-row${activeRow===i?' at-row-active':''}`}
                          initial={{opacity:0,x:-12}} animate={{opacity:1,x:0}}
                          transition={{duration:0.3, delay:i*0.03}}
                          onMouseEnter={()=>setActiveRow(i)} onMouseLeave={()=>setActiveRow(null)}
                        >
                          <td>
                            <span className="at-time">{new Date(row.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                            <span className="at-date">{new Date(row.timestamp).toLocaleDateString([],{month:'short',day:'numeric'})}</span>
                          </td>
                          <td>
                            <span className="at-loan">${(row.loan_amount||0).toLocaleString()}</span>
                          </td>
                          <td><CreditChip cs={row.credit_score}/></td>
                          <td><RiskPill val={row.default_probability}/></td>
                          <td><WealthBadge decision={row.decision}/></td>
                        </motion.tr>
                      ))
                }
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* ── Right Column Matrix ──────────────────────────────────────────── */}
        <div className="wealth-right">

          {/* Portfolio Donut Matrix */}
          <motion.div className="ceramic-card matrix-card" initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:0.45,delay:0.32}}>
            <h3 className="matrix-title">Risk Telemetry</h3>
            <p className="matrix-sub" style={{marginBottom:16}}>Holographic portfolio balance</p>
            {loading
              ? <div className="skel" style={{height:180,borderRadius:90,width:180,margin:'0 auto'}}/>
              : <GaugeChart value={stats?.avgRisk||0} size={180} label="Value at Risk" suffix="%"/>
            }
            <div className="telemetry-list">
              {[
                {lbl:'SUBPRIME EXPOSURE', pct: history.length ? Math.round(history.filter(h=>(h.default_probability||0)*100>50).length/history.length*100) : 0, c:'var(--crimson-risk)'},
                {lbl:'PRIME TRANCHES',    pct: history.length ? Math.round(history.filter(h=>(h.default_probability||0)*100<25).length/history.length*100) : 0, c:'var(--emerald-wealth)'},
                {lbl:'MEAN FICO SCORE',   pct: null, raw: loading?'—':avgCredit, c:'var(--sapphire-blue)'},
              ].map(({lbl,pct,raw,c})=>(
                <div key={lbl} className="tl-row">
                  <span className="tl-label">{lbl}</span>
                  <div className="tl-right">
                    {pct !== null && <div className="tl-bar-track"><div className="tl-bar-fill" style={{width:`${pct}%`,background:c}}/></div>}
                    <span className="tl-val" style={{color:c}}>{raw !== undefined ? raw : `${pct}%`}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Credit Tier Alabaster Mosaic */}
          <motion.div className="ceramic-card matrix-card" initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:0.45,delay:0.38}}>
            <h3 className="matrix-title" style={{marginBottom:16}}>Credit Tranche Mosaic</h3>
            <div className="tranche-grid">
              {[
                {lbl:'PRIME PLUS (750+)', count: history.filter(h=>h.credit_score>=750).length, c:'var(--emerald-wealth)'},
                {lbl:'PRIME (700–749)', count: history.filter(h=>h.credit_score>=700&&h.credit_score<750).length, c:'var(--sapphire-blue)'},
                {lbl:'ALMOST PRIME (650–699)', count: history.filter(h=>h.credit_score>=650&&h.credit_score<700).length, c:'var(--royal-gold)'},
                {lbl:'SUBPRIME (<650)', count: history.filter(h=>h.credit_score<650).length, c:'var(--crimson-risk)'},
              ].map(({lbl,count,c})=>(
                <div key={lbl} className="tg-cell" style={{'--tg-c':c}}>
                  <div className="tg-count" style={{color:c}}>{loading?'—':count}</div>
                  <div className="tg-lbl">{lbl}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          ALGORITHMIC BIAS & ANOMALY EXECUTIVE REPORT
      ═════════════════════════════════════════════════════════════════════ */}
      {!loading && (
        <motion.div className="ceramic-card executive-card" initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:0.45,delay:0.44}}>
          <div className="ec-header">
            <div>
              <h2 className="ec-title">Algorithmic Bias &amp; Anomaly Executive Report</h2>
              <p className="ec-sub">Automated audit for pipeline deviations, underwriting drift, and decision clustering</p>
            </div>
            <div className="ec-status-pill" style={{ background: anomalies.length===0 ? 'rgba(16,137,84,0.1)' : 'rgba(197,160,89,0.1)', borderColor: anomalies.length===0 ? 'rgba(16,137,84,0.3)' : 'rgba(197,160,89,0.3)', color: anomalies.length===0 ? 'var(--emerald-wealth)' : 'var(--royal-gold)' }}>
              {anomalies.length === 0 ? '✓ TELEMETRY HARMONIC' : `${anomalies.length} DEVIATION${anomalies.length>1?'S':''} DETECTED`}
            </div>
          </div>

          {anomalies.length === 0 ? (
            <div className="ec-clean-box">
              <div className="ec-clean-ring">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="var(--emerald-wealth)" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
              <div>
                <div style={{fontWeight:700, color:'var(--emerald-wealth)', fontSize:15, marginBottom:2, fontFamily:'var(--ff-display)'}}>PIPELINE HARMONIC &amp; STABLE</div>
                <div style={{fontSize:12.5, color:'var(--ink-sec)'}}>Zero algorithmic drift or subprime clustering detected across current underwriting cohorts.</div>
              </div>
            </div>
          ) : (
            <div className="ec-grid">
              {anomalies.map((a,i)=>(
                <div key={i} className={`ec-item ec-${a.sev.toLowerCase()}`}>
                  <div className="eci-top">
                    <span className={`eci-sev sev-${a.sev.toLowerCase()}`}>{a.sev}</span>
                    <span className="eci-metric">{a.metric}</span>
                  </div>
                  <div className="eci-title">{a.title}</div>
                  <div className="eci-msg">{a.msg}</div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
