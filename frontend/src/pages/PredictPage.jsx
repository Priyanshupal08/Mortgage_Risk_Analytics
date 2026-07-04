import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import Card from '../components/ui/Card';
import AlertBanner from '../components/ui/AlertBanner';
import StepForm from '../components/layout/StepForm';
import RiskGauge from '../components/data/RiskGauge';
import ProbBar from '../components/data/ProbBar';
import { api } from '../api';
import { useAppStore } from '../store';
import './PredictPage.css';

export default function PredictPage() {
  const { currentPrediction, isPredicting, predictionError, setPredictionState, clearPrediction, user } = useAppStore();

  useEffect(() => {
    clearPrediction();
  }, [clearPrediction]);

  const handlePredict = async (data) => {
    setPredictionState({ isPredicting: true, predictionError: null });
    try {
      const result = await api.predict(data);
      setPredictionState({ currentPrediction: result, isPredicting: false });
    } catch (err) {
      setPredictionState({ predictionError: err.message, isPredicting: false });
    }
  };

  const now = new Date();

  return (
    <div className="wealth-predict">

      {/* ── Page Header / Editorial Wealth Bar ─────────────────────────────── */}
      <div className="wealth-header">
        <div>
          <div className="wealth-crumbs">
            <span className="crumb-brand">AETHER PRIVATE WEALTH</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">RISK UNDERWRITER</span>
          </div>
          <h1 className="wealth-title">AI Underwriting Dossier</h1>
        </div>
        <div className="wealth-top-actions">
          {user?.role === 'admin' && <div className="swiss-shield-tag">⛨ EXECUTIVE PRIVILEGE</div>}
          <div className="wealth-timebox">
            <span className="timebox-h">{now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
            <span className="timebox-d">{now.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})}</span>
          </div>
          <div className="swiss-pill swiss-ok">
            <span className="swiss-dot" style={{background:'var(--emerald-wealth)'}} />
            ENSEMBLE ONLINE
          </div>
        </div>
      </div>

      {/* ── Main Layout Grid ────────────────────────────────────────────────── */}
      <div className="predict-grid">
        
        {/* Left Column: Applicant Telemetry Form */}
        <motion.div className="predict-left" initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:0.45}}>
          <Card className="ceramic-card form-card">
            <div className="form-card-ribbon gold-ribbon" />
            <div className="card-header">
              <h2>Applicant Telemetry</h2>
              <p className="text-secondary">Enter client financial dossier parameters to execute the AI risk ensemble.</p>
            </div>
            
            {predictionError && (
              <div className="mb-md">
                <AlertBanner type="error" title="Underwriting Exception" message={predictionError} />
              </div>
            )}
            
            <div className="form-wrapper">
              <StepForm 
                onSubmit={handlePredict} 
                isPredicting={isPredicting} 
                onStepChange={(step) => {
                  if (step === 1) clearPrediction();
                }}
              />
            </div>
          </Card>
        </motion.div>

        {/* Right Column: AI Analysis & Decision */}
        <motion.div className="predict-right" initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:0.45, delay:0.1}}>
          <Card className="ceramic-card result-card">
            <div className="form-card-ribbon emerald-ribbon" />
            <div className="card-header">
              <h2>Ensemble Analysis Result</h2>
              <p className="text-secondary">Real-time algorithmic risk evaluation &amp; facility decision</p>
            </div>
            
            {!currentPrediction && !isPredicting && (
              <div className="empty-result">
                <div className="empty-crest-ring">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--royal-gold)" strokeWidth="1.8">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <div className="empty-text-box">
                  <h4 className="empty-title">Awaiting Client Telemetry</h4>
                  <p className="empty-sub">Complete the 3-step financial dossier on the left to initialize the multi-model AI underwriting pipeline.</p>
                </div>
              </div>
            )}

            {isPredicting && (
              <div className="predicting-state">
                <div className="scanning-crest">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--royal-gold)" strokeWidth="1.8">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                  <div className="scanning-ring" />
                </div>
                <div className="scanner-bar-container">
                  <div className="scanner-bar" />
                </div>
                <p className="mono animate-pulse c-gold" style={{fontWeight:700, fontSize:14, letterSpacing:'0.08em'}}>Executing Multi-Model Risk Ensemble...</p>
              </div>
            )}

            {currentPrediction && !isPredicting && (
              <div className="prediction-results slide-up">
                <div className="result-badge-container">
                  <span className={`wealth-decision-badge ${currentPrediction.decision?.toLowerCase() || 'review'}`}>
                    <span className="wdb-dot" />
                    {currentPrediction.decision || 'REVIEW'}
                  </span>
                </div>
                
                <div className="gauge-section">
                  <RiskGauge score={currentPrediction.visual_score || (currentPrediction.default_probability || 0) * 100} />
                </div>
                
                <div className="probs-section">
                  <ProbBar probability={currentPrediction.approval_probability || 0} label="Underwriting Approval Confidence" />
                </div>
                
                <div className="factors-section">
                  <h4 className="factors-title">UNDERWRITING KEY FACTORS</h4>
                  <ul className="factors-list">
                    {(currentPrediction.plain_english || currentPrediction.top_factors || []).map((f, i) => (
                      <li key={i} className="factor-item">
                        <span className="factor-dot"></span>
                        {typeof f === 'string' ? f : (f.label || f.feature)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
