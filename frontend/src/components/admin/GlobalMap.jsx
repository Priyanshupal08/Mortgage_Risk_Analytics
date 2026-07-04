import React from 'react';

const GlobalMap = () => {
  return (
    <div className="global-map-container">
      <svg viewBox="0 0 800 400" className="world-map-svg">
        <path
          className="map-path"
          d="M117,114.5c2.3,1.3,4.6,2.6,6.9,3.9c1,3.4-0.1,6.8,0.7,10.2c4.1,2.5,8.8,1.2,13.2,2c4.2,4,4.2,10.4,1.8,15.2c1.7,3.6,5.3,5.6,8.8,7c4.6-0.3,9.4,0.1,13.5,2.4c1.9,4.4,0,9.9,3.5,13.6c4.6,1.4,9,0.7,13.3-1c3.1-4,7-7.2,11.2-9.7c5.1-0.9,10.2,0.1,15.3,1c3.2,4,1,9.4,3.2,13.7c4,1.1,8.4-1.2,12-3.1c4.6,3.6,8,8.5,12.8,11.6c4.4-1.5,9.4-0.1,14.1-0.1c4.8,2,9.3,5,12.7,9c3.3-1.6,5.8-4.8,9.7-5.1c3.1,4.4,7.6,7.5,12.2,10.2c5.1,1.1,10.6,0.3,15.6,1.4c3.9,4.2,7.4,8.9,11,13.4c4.6-0.3,9.4-0.5,14,0c4,2.3,9.2,2.8,12.5,5.8c4.6,0,9.4-0.4,14-1.2c2.7,4.3,6.3,8.1,10,11.5c4.7,0.4,9.5,1,14.2,1.8c3,3.9,5.7,8.2,9.2,11.7c4.8,0.2,9.8-0.7,14.5,0.7c3.3,3.8,7,7.2,11.3,9.9c4.8,0,9.6,0,14.4,0c2.8,3.7,6.3,6.8,9.7,10c4.9,0.2,9.8-0.6,14.7,0c2.7,3.9,6.1,7.3,9.8,10.4c5,0.4,10-0.4,14.9,0c2.6,3.6,5.7,6.8,9,9.8c5.4,1,11,0.6,16.4,1c3.3,3,7,5.4,10.9,7.6c3.1-0.7,6.2,0,9.4,0c4.2,2.4,8.4,4.7,12.6,7.1"
          fill="none"
          stroke="rgba(0, 242, 255, 0.1)"
          strokeWidth="1"
        />
        {/* Simplified dots representing major regions */}
        {[
          { x: 150, y: 120, label: 'NA', ping: true },
          { x: 220, y: 160, label: 'SA', ping: false },
          { x: 400, y: 110, label: 'EU', ping: true },
          { x: 420, y: 200, label: 'AF', ping: false },
          { x: 550, y: 130, label: 'AS', ping: true },
          { x: 620, y: 250, label: 'OC', ping: false },
          { x: 520, y: 155, label: 'IN', ping: true, color: 'var(--gold)' },
        ].map((loc, i) => (
          <g key={i}>
            <circle cx={loc.x} cy={loc.y} r="2" fill={loc.color || "rgba(0, 242, 255, 0.5)"} />
            {loc.ping && (
              <circle cx={loc.x} cy={loc.y} r="2" className="map-ping">
                <animate attributeName="r" from="2" to="15" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.8" to="0" dur="2s" repeatCount="indefinite" />
              </circle>
            )}
          </g>
        ))}
      </svg>
      <div className="map-overlay-text">LIVE GLOBAL OVERWATCH</div>
    </div>
  );
};

export default GlobalMap;
