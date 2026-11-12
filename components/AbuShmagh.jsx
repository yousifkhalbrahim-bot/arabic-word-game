'use client';

// ============== أبو شماغ ==============
// <AbuShmagh mood="win" say="كفو!" /> — الشخصية بحركاتها (الحركات في globals.css تحت .abu)
// <AbuToast /> — يطلع فوق الشاشة لما أي مكان ينادي abuSay(...)
import React, { useEffect, useId, useRef, useState } from 'react';
import { MOOD_OF } from '@/lib/abu';

const OUT = '#3a2131';
const SKIN = '#f2d1a6';

export function AbuShmagh({ mood = 'idle', say = '', size = 120, className = '', bubbleSide = 'top' }) {
  const pid = `smg${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <div className={`abu st-${mood} relative inline-block ${className}`} style={{ width: size, height: size * 1.07 }}>
      {say && (
        <div className={`abu-bubble ${bubbleSide === 'side' ? 'abu-bubble-side' : ''}`}>{say}</div>
      )}
      <svg viewBox="0 0 120 128" width={size} height={size * 1.07} aria-label="أبو شماغ" role="img" style={{ overflow: 'visible' }}>
        <defs>
          <pattern id={pid} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="7" height="7" fill="#fff" /><rect width="3.5" height="3.5" fill="#e0384f" /><rect x="3.5" y="3.5" width="3.5" height="3.5" fill="#e0384f" />
          </pattern>
        </defs>
        <ellipse cx="60" cy="121" rx="32" ry="5.5" fill="#000" opacity=".18" />
        <g className="abu-spark" fill="#ffcf3f" stroke={OUT} strokeWidth="1.6" strokeLinejoin="round">
          <path d="M8 40 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" /><path d="M108 30 l2.4 5.6 5.6 2.4 -5.6 2.4 -2.4 5.6 -2.4 -5.6 -5.6 -2.4 5.6 -2.4z" /><path d="M104 92 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2z" />
        </g>
        <g className="abu-dots" fill="#fff"><circle cx="96" cy="34" r="2.8" /><circle cx="103" cy="24" r="3.8" /><circle cx="112" cy="12" r="5" /></g>
        <g className="abu-whole">
          <rect x="44" y="100" width="11" height="18" rx="5.5" fill={SKIN} stroke={OUT} strokeWidth="3.6" />
          <rect x="65" y="100" width="11" height="18" rx="5.5" fill={SKIN} stroke={OUT} strokeWidth="3.6" />
          <g className="abu-armL"><path d="M31 82 Q20 88 22 97" fill="none" stroke={OUT} strokeWidth="10.6" strokeLinecap="round" /><path d="M31 82 Q20 88 22 97" fill="none" stroke={SKIN} strokeWidth="7" strokeLinecap="round" /></g>
          <path d="M60 30 C84 30 90 52 90 76 C90 99 80 108 60 108 C40 108 30 99 30 76 C30 52 36 30 60 30Z" fill={SKIN} stroke={OUT} strokeWidth="3.6" strokeLinejoin="round" />
          {/* الوجوه */}
          <g className="abu-face f-hi">
            <ellipse cx="38" cy="85" rx="5" ry="3" fill="#ff8fa3" opacity=".55" /><ellipse cx="82" cy="85" rx="5" ry="3" fill="#ff8fa3" opacity=".55" />
            <ellipse cx="47" cy="76" rx="6.8" ry="8.4" fill={OUT} /><circle cx="49.2" cy="72.8" r="3" fill="#fff" /><circle cx="45" cy="79" r="1.3" fill="#fff" />
            <ellipse cx="73" cy="76" rx="6.8" ry="8.4" fill={OUT} /><circle cx="75.2" cy="72.8" r="3" fill="#fff" /><circle cx="71" cy="79" r="1.3" fill="#fff" />
            <path d="M53 87 Q60 98 67 87 Z" fill={OUT} /><path d="M56 92 Q60 95 64 92 Q60 90 56 92Z" fill="#ff6b8a" />
          </g>
          <g className="abu-face f-win">
            <ellipse cx="38" cy="85" rx="5" ry="3" fill="#ff8fa3" opacity=".7" /><ellipse cx="82" cy="85" rx="5" ry="3" fill="#ff8fa3" opacity=".7" />
            <path d="M41 78 Q47 69 53 78 M67 78 Q73 69 79 78" fill="none" stroke={OUT} strokeWidth="3.4" strokeLinecap="round" />
            <path d="M48 85 Q60 104 72 85 Z" fill={OUT} /><path d="M53 94 Q60 99 67 94 Q60 90 53 94Z" fill="#ff6b8a" />
          </g>
          <g className="abu-face f-sad">
            <ellipse cx="47" cy="77" rx="6.8" ry="8.4" fill={OUT} /><circle cx="49.2" cy="73.8" r="3" fill="#fff" />
            <ellipse cx="73" cy="77" rx="6.8" ry="8.4" fill={OUT} /><circle cx="75.2" cy="73.8" r="3" fill="#fff" />
            <path d="M40 66 L52 69 M80 66 L68 69" stroke={OUT} strokeWidth="2.6" strokeLinecap="round" />
            <path d="M53 94 Q60 87 67 94" fill="none" stroke={OUT} strokeWidth="3.2" strokeLinecap="round" />
          </g>
          <g className="abu-face f-think">
            <ellipse cx="47" cy="76" rx="6.8" ry="8.4" fill={OUT} /><circle cx="50.2" cy="72" r="3" fill="#fff" />
            <ellipse cx="73" cy="76" rx="6.8" ry="8.4" fill={OUT} /><circle cx="76.2" cy="72" r="3" fill="#fff" />
            <path d="M54 92 Q62 89 67 91" fill="none" stroke={OUT} strokeWidth="3.2" strokeLinecap="round" />
          </g>
          <path className="abu-tear" d="M80 84 q4 7 0 11 q-4 -4 0 -11" fill="#5ec8f2" stroke={OUT} strokeWidth="1.6" />
          {/* الشماغ */}
          <path className="abu-shmagh" d="M60 22 C82 22 94 40 96 64 L102 96 Q92 86 88 70 Q86 54 60 50 Q34 54 32 70 Q28 86 18 96 L24 64 C26 40 38 22 60 22Z" fill={`url(#${pid})`} stroke={OUT} strokeWidth="3.6" strokeLinejoin="round" />
          {/* اليد اليمين قدّام الشماغ عشان تبين وهي ترمي */}
          <g className="abu-armR"><path d="M89 82 Q100 88 98 97" fill="none" stroke={OUT} strokeWidth="10.6" strokeLinecap="round" /><path d="M89 82 Q100 88 98 97" fill="none" stroke={SKIN} strokeWidth="7" strokeLinecap="round" /></g>
          {/* العقال (ينرمي على الشاشة وقت الفوز) */}
          <g className="abu-agal">
            <ellipse cx="60" cy="40" rx="31" ry="9" fill="none" stroke={OUT} strokeWidth="6.5" />
            <ellipse cx="60" cy="40" rx="31" ry="9" fill="none" stroke="#2a2a2a" strokeWidth="3.5" />
            <ellipse cx="60" cy="38.4" rx="29" ry="7.6" fill="none" stroke="#5a5a5a" strokeWidth="1" opacity=".6" />
          </g>
        </g>
      </svg>
    </div>
  );
}

// -------- يطلع فوق الشاشة لما ينادونه --------
const SHOW_MS = 2600;
export function AbuToast() {
  const [cur, setCur] = useState(null);
  const n = useRef(0);
  useEffect(() => {
    let t;
    const on = (e) => {
      const d = e.detail || {};
      n.current += 1;
      setCur({ ...d, mood: d.mood || MOOD_OF[d.kind] || 'hi', key: n.current });
      clearTimeout(t);
      t = setTimeout(() => setCur(null), d.mood === 'win' || MOOD_OF[d.kind] === 'win' ? 2500 : SHOW_MS);
    };
    window.addEventListener('abu:say', on);
    return () => { window.removeEventListener('abu:say', on); clearTimeout(t); };
  }, []);
  if (!cur) return null;
  return (
    <div className="fixed left-0 right-0 z-[55] flex justify-center pointer-events-none" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 56px)' }}>
      <div key={cur.key} className="abu-toast flex items-end gap-1" dir="rtl">
        <AbuShmagh mood={cur.mood} size={74} />
        <div className="abu-say-card">{cur.text}{cur.sub && <div className="abu-say-sub">{cur.sub}</div>}</div>
      </div>
    </div>
  );
}
