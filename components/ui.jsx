'use client';

// ============== عناصر التصميم المشتركة ==============
// نفس روح القائمة الرئيسية: مكتبة دافئة بالليل — خلفية رفوف مضبّبة،
// بطاقات خشب داكن بحافة ذهبية، وأزرار بارزة ثلاثية الأبعاد.

import React from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';

export const PLAYER_COLORS = { 1: '#fbbf24', 2: '#2dd4bf' };

// -------- الخلفية + الإطار --------
export function Screen({ children, glow, className = '', center = true, wide = false }) {
  return (
    <div className={`relative min-h-dvh safe-screen overflow-x-hidden text-parchment ${center ? 'flex items-center' : ''}`}>
      <div className="library-bg" aria-hidden="true" />
      {glow && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
          style={{ background: `radial-gradient(ellipse 80% 45% at 50% 0%, ${glow}33 0%, transparent 70%)` }} />
      )}
      <div className={`relative w-full mx-auto px-4 ${wide ? 'max-w-2xl' : 'max-w-md'} ${className}`}>
        {children}
      </div>
    </div>
  );
}

export function BackButton({ onClick, children = 'رجوع' }) {
  return (
    <button onClick={onClick}
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-parchment transition-colors py-1">
      <ArrowLeft className="w-4 h-4" /> {children}
    </button>
  );
}

// -------- البطاقة --------
export function Card({ children, className = '', accent, style }) {
  return (
    <div className={`wood-card rounded-3xl ${className}`}
      style={{ ...(accent ? { borderColor: `${accent}55`, boxShadow: `0 0 0 1px ${accent}22, 0 18px 40px -18px ${accent}55, inset 0 1px 0 rgba(255,240,210,0.06)` } : {}), ...style }}>
      {children}
    </div>
  );
}

export function Title({ children, sub, color = '#f7d060' }) {
  return (
    <div className="mb-5">
      <h2 className="font-display font-bold title-emboss" style={{ fontSize: 'clamp(1.7rem, 7vw, 2.1rem)', color, lineHeight: 1.2 }}>
        {children}
      </h2>
      {sub && <p className="text-muted text-sm mt-1">{sub}</p>}
    </div>
  );
}

export function Label({ children, aside }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <span className="font-display font-bold text-[0.8rem] text-muted tracking-wide">{children}</span>
      {aside}
    </div>
  );
}

// -------- الأزرار --------
const BTN = {
  gold: { color: '#1a0800', background: 'linear-gradient(180deg, #ffd060 0%, #e8940a 55%, #c87000 100%)', boxShadow: '0 5px 0 #7a4000, 0 8px 18px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.35)', border: '1px solid #b06000' },
  teal: { color: '#001a18', background: 'linear-gradient(180deg, #5ef0d8 0%, #0fb89a 55%, #0a9078 100%)', boxShadow: '0 5px 0 #065040, 0 8px 18px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.3)', border: '1px solid #0a8068' },
  green: { color: '#001a0c', background: 'linear-gradient(180deg, #6ee7a8 0%, #22b46a 55%, #138a4e 100%)', boxShadow: '0 5px 0 #0a4d2b, 0 8px 18px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.3)', border: '1px solid #11804a' },
  red: { color: '#2a0505', background: 'linear-gradient(180deg, #fca5a5 0%, #ef5f5f 55%, #c93636 100%)', boxShadow: '0 5px 0 #6e1717, 0 8px 18px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.3)', border: '1px solid #b52b2b' },
  wood: { color: '#e8c9a0', background: 'linear-gradient(180deg, #3a2312 0%, #24150a 100%)', boxShadow: '0 4px 0 #0e0804, 0 7px 14px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07)', border: '1px solid rgba(255,220,170,0.14)' },
};

export function Btn({ variant = 'gold', size = 'lg', icon: Icon, busy, children, className = '', disabled, ...rest }) {
  const pad = size === 'lg' ? 'py-3.5 px-5 text-[1.05rem] rounded-2xl' : size === 'md' ? 'py-2.5 px-4 text-[0.95rem] rounded-xl' : 'py-2 px-3 text-sm rounded-xl';
  return (
    <button {...rest} disabled={disabled || busy}
      className={`btn-3d w-full font-display font-bold flex items-center justify-center gap-2 ${pad} ${className}`}
      style={BTN[variant]}>
      {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : Icon ? <Icon className={size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} /> : null}
      {children}
    </button>
  );
}

// زر نصي خفيف
export function GhostBtn({ children, className = '', ...rest }) {
  return (
    <button {...rest} className={`inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm text-muted bg-white/[0.04] border border-[rgba(255,220,170,0.12)] hover:text-parchment hover:bg-white/[0.08] active:scale-95 transition-all ${className}`}>
      {children}
    </button>
  );
}

// -------- خيار قابل للاختيار --------
export function Choice({ selected, onClick, accent = '#fbbf24', children, className = '' }) {
  return (
    <button onClick={onClick}
      className={`choice-tile rounded-2xl text-center transition-all active:scale-[0.97] ${className}`}
      data-selected={selected ? 'true' : undefined}
      style={selected ? { borderColor: `${accent}aa`, background: `linear-gradient(180deg, ${accent}26, ${accent}0d)`, color: '#fff3dc', boxShadow: `0 0 0 1px ${accent}55, 0 6px 18px -8px ${accent}88` } : undefined}>
      {children}
    </button>
  );
}

// -------- حقل إدخال --------
export const inputClass = 'w-full rounded-2xl px-4 py-3.5 bg-black/30 border border-[rgba(255,220,170,0.14)] text-parchment placeholder:text-dim focus:outline-none focus:border-amber-400/60 focus:bg-black/40 transition-all';

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <div className="rounded-2xl px-4 py-3 text-center text-sm text-rose-200 bg-rose-500/10 border border-rose-400/30 slide-in">
      {children}
    </div>
  );
}

// -------- بطاقة النهاية المطلوبة (البطل في ساعة الشطرنج) --------
export function EndingBadge({ ending, size = 'lg', label = 'النهاية' }) {
  const big = size === 'lg';
  return (
    <div className="ending-badge inline-flex flex-col items-center justify-center rounded-2xl"
      style={{ padding: big ? '6px 20px 10px' : '2px 12px 6px' }}>
      <span className="text-[0.65rem] font-display font-bold tracking-wider" style={{ color: 'rgba(251,191,36,0.65)' }}>{label}</span>
      <span className="font-display font-black" style={{ fontSize: big ? '2.4rem' : '1.4rem', lineHeight: 1.25, color: '#fcd34d', textShadow: '0 0 18px rgba(251,191,36,0.55)' }}>
        {ending}
      </span>
    </div>
  );
}

// كلمة صغيرة ملوّنة (قوائم الكلمات)
export function WordChip({ children, color, fresh }) {
  return (
    <span className={`px-2.5 py-1 rounded-lg font-display text-[0.95rem] leading-tight ${fresh ? 'word-pop' : ''}`}
      style={{ background: `${color}17`, color, border: `1px solid ${color}38` }}>
      {children}
    </span>
  );
}

// رقم مع وحدة عربية بدون لخبطة اتجاه
export function Num({ children }) {
  return <bdi className="font-mono-ar">{children}</bdi>;
}
