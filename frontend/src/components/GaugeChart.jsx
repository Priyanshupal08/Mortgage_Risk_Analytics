import React, { useEffect, useRef, useState } from 'react';

const GaugeChart = ({
  value = 0,
  min = 0,
  max = 100,
  size = 200,
  strokeWidth = 20,
  showValue = true,
  label,
  suffix = '%'
}) => {
  const [animatedValue, setAnimatedValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef(null);

  // Intersection Observer for animation trigger
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Animate the value
  useEffect(() => {
    if (!isVisible) return;

    const duration = 1500;
    const startTime = Date.now();
    const startValue = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (value - startValue) * easeOut;

      setAnimatedValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, isVisible]);

  // Calculate color based on value percentage
  const percentage = ((value - min) / (max - min)) * 100;
  const getColor = (pct) => {
    if (pct <= 33) return 'var(--emerald-wealth)'; // Green - Low risk
    if (pct <= 66) return 'var(--royal-gold)'; // Amber - Medium risk
    return 'var(--crimson-risk)'; // Red - High risk
  };

  const color = getColor(percentage);

  // SVG calculations
  const radius = (size - strokeWidth) / 2 - 12;
  const center = size / 2;
  
  // 0 is Right, 90 is Bottom, 180 is Left, 270 is Top
  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians)
    };
  };

  const startAngle = 150;
  const sweepAngle = 240;
  
  // Arc length for dash-array
  const circumference = 2 * Math.PI * radius;
  const arcLength = (sweepAngle / 360) * circumference;
  const currentOffset = arcLength - (animatedValue / max) * arcLength;

  const describeArc = (x, y, r, start, sweep) => {
    const startPt = polarToCartesian(x, y, r, start);
    const endPt = polarToCartesian(x, y, r, start + sweep);
    const largeArcFlag = sweep <= 180 ? '0' : '1';
    return [
      'M', startPt.x, startPt.y,
      'A', r, r, 0, largeArcFlag, 1, endPt.x, endPt.y
    ].join(' ');
  };

  const gradientId = `gaugeGradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div
      ref={containerRef}
      className="gauge-container"
      style={{ width: size, height: size, position: 'relative', margin: '0 auto' }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--emerald-wealth)" />
            <stop offset="50%" stopColor="var(--royal-gold)" />
            <stop offset="100%" stopColor="var(--crimson-risk)" />
          </linearGradient>
          <filter id={`glow-${gradientId}`}>
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background track */}
        <path
          d={describeArc(center, center, radius, startAngle, sweepAngle)}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Value arc - animated using dashoffset for perfect curvature */}
        <path
          d={describeArc(center, center, radius, startAngle, sweepAngle)}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={currentOffset}
          filter={`url(#glow-${gradientId})`}
          style={{ transition: 'none' }}
        />

        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const angle = startAngle + (sweepAngle * (tick / 100));
          const tickInner = polarToCartesian(center, center, radius - strokeWidth / 2, angle);
          const tickOuter = polarToCartesian(center, center, radius - strokeWidth / 2 - 6, angle);
          const labelPos = polarToCartesian(center, center, radius - strokeWidth - 14, angle);

          return (
            <g key={tick}>
              <line
                x1={tickInner.x} y1={tickInner.y}
                x2={tickOuter.x} y2={tickOuter.y}
                stroke="var(--ink-muted)"
                strokeWidth={1}
              />
              <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="var(--ink-muted)"
                fontSize={size * 0.045}
                fontWeight="700"
                fontFamily="var(--ff-mono)"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* Needle */}
        {isVisible && (
          <g transform={`rotate(${startAngle + (sweepAngle * (animatedValue / max))}, ${center}, ${center})`}>
            <line
              x1={center} y1={center}
              x2={center + radius - 4} y2={center}
              stroke={color}
              strokeWidth={3}
              strokeLinecap="round"
              filter={`url(#glow-${gradientId})`}
            />
            <circle cx={center} cy={center} r={6} fill={color} stroke="var(--ceramic-white)" strokeWidth={1.5} />
            <circle cx={center} cy={center} r={2} fill="white" />
          </g>
        )}
      </svg>

      {/* Center value */}
      {showValue && (
        <div className="gauge-value" style={{ 
          position: 'absolute',
          top: '70%',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          width: '100%',
          pointerEvents: 'none'
        }}>
          <span style={{ 
            fontSize: size * 0.16, 
            fontWeight: '800', 
            color: 'var(--ink-dark)', 
            lineHeight: 1,
            fontFamily: 'var(--ff-display)'
          }}>
            {Math.round(animatedValue)}{suffix}
          </span>
          {label && (
            <span style={{ 
              fontSize: size * 0.06, 
              color: 'var(--ink-sec)', 
              marginTop: '6px', 
              textTransform: 'uppercase', 
              letterSpacing: '0.12em',
              fontWeight: '700',
              fontFamily: 'var(--ff-mono)'
            }}>
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default GaugeChart;
