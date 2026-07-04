import React from 'react';

export default function AlabasterAmbientBackground() {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:0, background:'var(--alabaster-bg)', overflow:'hidden', pointerEvents:'none', transition:'background 0.5s var(--ease-wealth)' }}>

      {/* Royal Champagne Gold Ambient Flare — top left */}
      <div style={{
        position:'absolute', width:900, height:900, borderRadius:'50%',
        background:'radial-gradient(circle at 35% 35%, var(--royal-gold-g) 0%, rgba(197,160,89,0.03) 40%, transparent 70%)',
        top:-250, left:-200, filter:'blur(60px)',
        animation:'float-ambient 32s ease-in-out infinite',
        transition:'background 0.5s var(--ease-wealth)'
      }}/>

      {/* Lush Wealth Emerald Flare — bottom right */}
      <div style={{
        position:'absolute', width:800, height:800, borderRadius:'50%',
        background:'radial-gradient(circle at 65% 65%, var(--emerald-wealth-g) 0%, rgba(16,137,84,0.02) 40%, transparent 70%)',
        bottom:-200, right:-150, filter:'blur(70px)',
        animation:'float-ambient 38s ease-in-out infinite reverse',
        transition:'background 0.5s var(--ease-wealth)'
      }}/>

      {/* Subtle Sapphire Trust Glow — center right */}
      <div style={{
        position:'absolute', width:600, height:600, borderRadius:'50%',
        background:'radial-gradient(circle, var(--sapphire-blue-g) 0%, transparent 70%)',
        top:'20%', right:'20%', filter:'blur(80px)',
        animation:'float-ambient 44s ease-in-out infinite',
        transition:'background 0.5s var(--ease-wealth)'
      }}/>

      {/* Fine Alabaster / Obsidian Watermark Grid Overlay */}
      <div style={{
        position:'absolute', inset:0,
        backgroundImage:`
          linear-gradient(var(--border) 1px, transparent 1px),
          linear-gradient(90deg, var(--border) 1px, transparent 1px)
        `,
        backgroundSize:'48px 48px',
        maskImage:'radial-gradient(ellipse 90% 90% at 50% 50%, rgba(0,0,0,0.5) 10%, transparent 90%)',
        WebkitMaskImage:'radial-gradient(ellipse 90% 90% at 50% 50%, rgba(0,0,0,0.5) 10%, transparent 90%)',
        transition:'background-image 0.5s var(--ease-wealth)'
      }}/>

      {/* Top Luxury Accent Ribbon */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, height:3,
        background:'linear-gradient(90deg, transparent 0%, rgba(197,160,89,0.8) 25%, rgba(16,137,84,0.8) 50%, rgba(30,58,138,0.8) 75%, transparent 100%)',
        opacity:0.85,
        boxShadow:'0 0 16px rgba(197,160,89,0.4)'
      }}/>
    </div>
  );
}
