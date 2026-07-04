import React, { useEffect, useState } from 'react';
import './RiskGauge.css';

export default function RiskGauge({ score, maxScore = 100, label = 'Risk Score' }) {
  const [displayScore, setDisplayScore] = useState(0);
  
  useEffect(() => {
    // Animate the numerical value count-up
    let start = 0;
    const end = Math.round(score);
    if (start === end) return;

    let totalDuration = 1000;
    let increment = end / (totalDuration / 16);
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayScore(end);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [score]);

  // Dimensions
  const size = 160;
  const strokeWidth = 12;
  const center = size / 2;
  const radius = 60; // Fixed radius for stability
  const circumference = Math.PI * radius;
  
  // Progress calculation for dashoffset
  const percentage = Math.min(Math.max(score / maxScore, 0), 1);
  const strokeDashoffset = circumference - (percentage * circumference);

  const getRiskColor = (s) => {
    if (s > 75) return 'var(--danger)';
    if (s > 40) return 'var(--warning)';
    return 'var(--success)';
  };

  const color = getRiskColor(score);
  
  // Fixed semi-circle path (Top Dome)
  const arcPath = `M ${center - radius} ${center + 20} A ${radius} ${radius} 0 0 1 ${center + radius} ${center + 20}`;

  const gradientId = `gauge-grad-${Math.round(Math.random() * 1000)}`;

  return (
    <div className="risk-gauge-wrapper">
      <div className="risk-gauge-container">
        <svg viewBox={`0 0 ${size} ${size}`} className="risk-gauge-svg">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} stopOpacity="0.8" />
              <stop offset="50%" stopColor={color} />
              <stop offset="100%" stopColor={color} stopOpacity="0.8" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Track */}
          <path
            d={arcPath}
            fill="none"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Progress Bar */}
          <path
            d={arcPath}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            filter="url(#glow)"
            className="risk-gauge-progress-arc"
          />
          
          {/* Center Content */}
          <text 
            x={center} 
            y={center + 15} 
            textAnchor="middle" 
            className="risk-score-text mono"
            fill={color}
            style={{ fontWeight: 800, fontSize: '38px', filter: 'drop-shadow(0 0 12px rgba(0,0,0,0.6))' }}
          >
            {displayScore}
          </text>
          <text 
            x={center} 
            y={center + 40} 
            textAnchor="middle" 
            className="risk-label-text"
            fill="rgba(255, 255, 255, 0.4)"
            style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2.5px', fontWeight: 800 }}
          >
            {label}
          </text>
        </svg>
      </div>
    </div>
  );
}
