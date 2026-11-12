'use client';

// ============== رسومات الأوسمة ==============
// كل وسام: إطار ملوّن بظل (مثل مربعات الحروف) + رسمة بيضاء + رقم صغير تحت (اختياري).
// المقفول يطلع رمادي وعليه قفل.
import React, { useId } from 'react';

// [فاتح، أساسي، غامق للظل]
const PAL = {
  green:  ['#4ade80', '#16a34a', '#0f5132'],
  orange: ['#ffc24d', '#ff7a1a', '#a3410a'],
  red:    ['#ff7a93', '#e11d48', '#881337'],
  blue:   ['#5eead4', '#0ea5e9', '#0c4a6e'],
  purple: ['#c4b5fd', '#7c3aed', '#3b0f7a'],
  gold:   ['#fff07a', '#f5a400', '#8a4b00'],
  gray:   ['#e2e8f0', '#b8c1d1', '#8792a8'],
};

function sealPoints(cx, cy, r1, r2, n) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n - Math.PI / 2, r = i % 2 ? r2 : r1;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}
const SEAL = sealPoints(50, 48, 42, 35, 12);

const Shape = ({ shape }) => {
  switch (shape) {
    case 'circle': return <circle cx="50" cy="48" r="40" />;
    case 'shield': return <path d="M50 6 L87 17 Q89 18 89 21 V48 C89 72 72 90 50 99 C28 90 11 72 11 48 V21 Q11 18 13 17 Z" />;
    case 'hex': return <path d="M50 5 Q53 5 56 7 L85 24 Q89 26 89 31 V65 Q89 70 85 72 L56 89 Q53 91 50 91 Q47 91 44 89 L15 72 Q11 70 11 65 V31 Q11 26 15 24 L44 7 Q47 5 50 5 Z" />;
    case 'squircle': return <rect x="11" y="9" width="78" height="78" rx="24" />;
    case 'seal': return <polygon points={SEAL} strokeLinejoin="round" strokeWidth="5" />;
    default: return null;
  }
};

const Glyph = ({ glyph, p }) => {
  switch (glyph) {
    case 'check': return (
      <>
        <rect x="30" y="27" width="40" height="40" rx="10" fill="#fff" />
        <rect x="30" y="27" width="40" height="40" rx="10" fill="none" stroke={p[2]} strokeOpacity=".18" strokeWidth="2" />
        <path d="M39 47 L47 55 L62 39" fill="none" stroke={p[1]} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </>
    );
    case 'flame': return (
      <>
        <path d="M50 18 C59 31 70 38 68 55 C67 68 59 76 50 76 C40 76 32 68 32 58 C32 48 38 43 43 37 C44 46 47 50 51 50 C48 40 47 29 50 18 Z" fill="#fff" />
        <path d="M50 46 C55 53 59 57 58 64 C57 70 54 73 50 73 C46 73 42 70 42 65 C42 60 46 57 48 53 C49 57 50 58 52 58 C51 54 50 50 50 46 Z" fill={p[0]} />
      </>
    );
    case 'bolt': return (
      <>
        <path d="M55 15 L31 52 H47 L42 80 L69 40 H53 Z" fill="#fff" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
        <path d="M53 26 L40 47 H50 L48 62 L61 43 H51 Z" fill={p[0]} opacity=".9" />
      </>
    );
    case 'target': return (
      <>
        <circle cx="50" cy="49" r="25" fill="#fff" />
        <circle cx="50" cy="49" r="17" fill={p[1]} />
        <circle cx="50" cy="49" r="10" fill="#fff" />
        <circle cx="50" cy="49" r="4.5" fill={p[1]} />
        <path d="M50 49 L73 26" stroke={p[2]} strokeWidth="4" strokeLinecap="round" />
        <path d="M68 22 L78 21 L77 31 Z" fill={p[2]} stroke={p[2]} strokeWidth="2" strokeLinejoin="round" />
      </>
    );
    case 'five': return (
      <>
        <path d="M33 34 L38 22 L45 30 L50 18 L55 30 L62 22 L67 34 Z" fill="#fde047" stroke="#fde047" strokeWidth="2.5" strokeLinejoin="round" />
        {[0, 1, 2, 3, 4].map(i => <rect key={i} x={21 + i * 12} y={i % 2 ? 45 : 41} width="10" height="12" rx="3" fill="#fff" />)}
        <rect x="27" y="61" width="46" height="5" rx="2.5" fill="#fff" opacity=".45" />
      </>
    );
    case 'crownClock': return (
      <>
        <path d="M33 30 L38 16 L45 24 L50 13 L55 24 L62 16 L67 30 Z" fill="#fff" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="50" cy="54" r="20" fill="#fff" />
        <circle cx="50" cy="54" r="15" fill="none" stroke={p[1]} strokeWidth="2.5" strokeDasharray="2 5.85" />
        <path d="M50 54 V44 M50 54 L57 58" stroke={p[2]} strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="50" cy="54" r="2.5" fill={p[2]} />
      </>
    );
    default: return null;
  }
};

export default function BadgeArt({ shape, glyph, color, tag, ribbon, on = true, className = '', style }) {
  const p = PAL[on ? color : 'gray'];
  const gid = `bg${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg viewBox="0 0 100 110" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p[0]} /><stop offset=".55" stopColor={p[1]} />
        </linearGradient>
      </defs>
      {ribbon && (
        <>
          <path d="M30 70 L22 104 L33 98 L39 108 L46 78 Z" fill={p[2]} />
          <path d="M70 70 L78 104 L67 98 L61 108 L54 78 Z" fill={p[2]} />
          <path d="M32 72 L26 99 L34 95 L39 102 L44 80 Z" fill={p[1]} />
          <path d="M68 72 L74 99 L66 95 L61 102 L56 80 Z" fill={p[1]} />
        </>
      )}
      <g fill={p[2]} stroke={p[2]} transform="translate(0 6)"><Shape shape={shape} /></g>
      <g fill={`url(#${gid})`} stroke={`url(#${gid})`}><Shape shape={shape} /></g>
      <g fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="3" transform="translate(50 48) scale(.84) translate(-50 -48)"><Shape shape={shape} /></g>
      <g opacity={on ? 1 : 0.75}><Glyph glyph={glyph} p={p} /></g>
      {tag && (
        <g transform="translate(50 88)">
          <rect x="-15" y="-9" width="30" height="18" rx="9" fill="#fff" stroke={p[2]} strokeWidth="2.5" />
          <text y="5.5" textAnchor="middle" fontFamily="ThmanyahSans, sans-serif" fontWeight="900" fontSize="13" fill={p[2]}>{tag}</text>
        </g>
      )}
      {!on && (
        <g transform="translate(78 16)">
          <circle r="12" fill="#fff" stroke="#c9d1df" strokeWidth="2.5" />
          <rect x="-5.5" y="-2" width="11" height="9" rx="2" fill="#8792a8" />
          <path d="M-3.2 -2 V-5 A3.2 3.2 0 0 1 3.2 -5 V-2" fill="none" stroke="#8792a8" strokeWidth="2.2" />
        </g>
      )}
    </svg>
  );
}
