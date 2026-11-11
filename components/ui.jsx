'use client';

// ============== عناصر التصميم المشتركة — أسلوب "أركيد ملوّن" ==============
// خلفية تدرج بنفسجي/أزرق، بطاقات بيضاء بارزة، بلاطات حروف، وأزرار ممتلئة ثلاثية الأبعاد.

import React from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

// ألوان اللاعبين: فاتح (للخلفيات)، غامق (للظل)، وحبر (للنص على الأبيض)
export const PLAYER_COLORS = { 1: '#ffb020', 2: '#22d3ee' };
export const PLAYER_DEEP = { 1: '#b86b00', 2: '#0e7490' };
export const PLAYER_INK = { 1: '#b45309', 2: '#0e7490' };
export const PLAYER_ON = { 1: '#4a2400', 2: '#083344' };

// -------- الخلفية --------
const FLOATIES = [
  { ch: 'ك', top: '8%', left: '6%', size: 64, r: '-12deg', d: '0s' },
  { ch: 'ل', top: '18%', left: '82%', size: 52, r: '10deg', d: '1.2s' },
  { ch: 'م', top: '62%', left: '4%', size: 58, r: '8deg', d: '2.1s' },
  { ch: 'ة', top: '74%', left: '84%', size: 70, r: '-8deg', d: '0.6s' },
  { ch: 'ع', top: '40%', left: '90%', size: 40, r: '14deg', d: '3s' },
];

export function ArcadeBg({ letters = true }) {
  return (
    <div className="arcade-bg" aria-hidden="true">
      {letters && FLOATIES.map((f, i) => (
        <span key={i} className="floaty" style={{ top: f.top, left: f.left, fontSize: f.size, '--r': f.r, animationDelay: f.d }}>{f.ch}</span>
      ))}
    </div>
  );
}

export function Screen({ children, className = '', center = true, wide = false, letters = true }) {
  return (
    <div className={`relative min-h-dvh safe-screen overflow-x-hidden text-parchment ${center ? 'flex items-center' : ''}`}>
      <ArcadeBg letters={letters} />
      <div className={`relative w-full mx-auto px-4 ${wide ? 'max-w-2xl' : 'max-w-md'} ${className}`}>
        {children}
      </div>
    </div>
  );
}

export function BackButton({ onClick, children = 'رجوع' }) {
  return (
    <button onClick={onClick}
      className="mb-4 inline-flex items-center gap-1.5 rounded-full px-4 min-h-[40px] text-sm font-display font-bold text-white bg-white/15 hover:bg-white/25 active:scale-95 transition-all">
      <ArrowRight className="w-4 h-4" /> {children}
    </button>
  );
}

// -------- البطاقة البيضاء --------
export function Card({ children, className = '', style }) {
  return (
    <div className={`wood-card rounded-3xl ${className}`} style={style}>
      {children}
    </div>
  );
}

export function Title({ children, sub, color = '#4c1d95' }) {
  return (
    <div className="mb-5">
      <h2 className="font-display font-black" style={{ fontSize: 'clamp(1.7rem, 7vw, 2.1rem)', color, lineHeight: 1.2 }}>
        {children}
      </h2>
      {sub && <p className="text-muted text-sm mt-1">{sub}</p>}
    </div>
  );
}

export function Label({ children, aside }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <span className="font-display font-bold text-[0.85rem] text-muted">{children}</span>
      {aside}
    </div>
  );
}

// -------- الأزرار --------
const BTN = {
  gold:  { color: '#4a2400', background: '#ffb020', boxShadow: '0 6px 0 #b86b00', border: '2px solid #ffc95c' },
  teal:  { color: '#083344', background: '#22d3ee', boxShadow: '0 6px 0 #0e7490', border: '2px solid #67e8f9' },
  green: { color: '#ffffff', background: '#16a34a', boxShadow: '0 6px 0 #166534', border: '2px solid #4ade80' },
  red:   { color: '#ffffff', background: '#ff4d6d', boxShadow: '0 6px 0 #b3123a', border: '2px solid #ff7d93' },
  grape: { color: '#ffffff', background: '#7c3aed', boxShadow: '0 6px 0 #4c1d95', border: '2px solid #a78bfa' },
  wood:  { color: '#5b21b6', background: '#ffffff', boxShadow: '0 6px 0 #c4b5fd', border: '2px solid #ede9fe' },
};

export function Btn({ variant = 'gold', size = 'lg', icon: Icon, busy, children, className = '', disabled, ...rest }) {
  const pad = size === 'lg' ? 'py-3.5 px-5 text-[1.1rem] rounded-2xl' : size === 'md' ? 'py-2.5 px-4 text-base rounded-2xl' : 'py-2 px-3 text-sm rounded-xl';
  return (
    <button {...rest} disabled={disabled || busy}
      className={`btn-3d w-full font-display font-black flex items-center justify-center gap-2 ${pad} ${className}`}
      style={BTN[variant]}>
      {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : Icon ? <Icon className={size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} strokeWidth={2.6} /> : null}
      {children}
    </button>
  );
}

// زر صغير خفيف (داخل البطاقات البيضاء)
export function GhostBtn({ children, className = '', ...rest }) {
  return (
    <button {...rest} className={`inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-display font-bold text-[#5b21b6] bg-[#f5f3ff] border-2 border-[#ede9fe] hover:bg-[#ede9fe] active:scale-95 transition-all ${className}`}>
      {children}
    </button>
  );
}

// -------- خيار قابل للاختيار --------
export function Choice({ selected, onClick, accent = '#ffb020', children, className = '' }) {
  const deep = accent === '#22d3ee' ? '#0e7490' : '#b86b00';
  const ink = accent === '#22d3ee' ? '#083344' : '#4a2400';
  return (
    <button onClick={onClick}
      className={`choice-tile rounded-2xl text-center transition-all ${className}`}
      data-selected={selected ? 'true' : undefined}
      style={selected ? { background: accent, borderColor: accent, color: ink, boxShadow: `0 5px 0 ${deep}` } : undefined}>
      {children}
    </button>
  );
}

// -------- حقل إدخال --------
export const inputClass = 'w-full rounded-2xl px-4 py-3.5 bg-[#f5f3ff] border-[3px] border-[#ede9fe] text-[#2e1065] placeholder:text-[#b9a8f0] font-display focus:outline-none focus:border-[#a78bfa] focus:bg-white transition-all';

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <div className="rounded-2xl px-4 py-3 text-center text-sm font-display font-bold text-white bg-[#ff4d6d] slide-in" style={{ boxShadow: '0 4px 0 #b3123a' }}>
      {children}
    </div>
  );
}

// -------- بلاطات حروف النهاية --------
export function LetterTiles({ text, size = 64, className = '' }) {
  const letters = [...(text || '')];
  return (
    <div className={`flex justify-center gap-2 ${className}`} dir="rtl">
      {letters.map((l, i) => (
        <div key={`${l}-${i}`} className="letter-tile word-pop rounded-2xl flex items-center justify-center font-display font-black"
          style={{ width: size, height: size + 4, fontSize: size * 0.58, lineHeight: 1, paddingBottom: size * 0.08, animationDelay: `${i * 60}ms` }}>
          {l}
        </div>
      ))}
    </div>
  );
}

export function EndingBadge({ ending, label = 'اكتب كلمة تنتهي بـ', size = 'lg' }) {
  return (
    <div className="text-center">
      <div className="font-display font-bold text-white/90 text-sm mb-2">{label}</div>
      <LetterTiles text={ending} size={size === 'lg' ? 60 : 44} />
    </div>
  );
}

// كلمة ملوّنة
export function WordChip({ children, player, color, fresh }) {
  const p = player || (color === PLAYER_COLORS[2] ? 2 : 1);
  return (
    <span className={`px-3 py-1 rounded-xl font-display font-bold text-[0.95rem] leading-tight ${fresh ? 'word-pop' : ''}`}
      style={{ background: PLAYER_COLORS[p], color: PLAYER_ON[p], boxShadow: `0 3px 0 ${PLAYER_DEEP[p]}` }}>
      {children}
    </span>
  );
}

// رقم بدون لخبطة اتجاه
export function Num({ children }) {
  return <bdi className="font-mono-ar">{children}</bdi>;
}
