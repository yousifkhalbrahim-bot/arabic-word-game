'use client';

// ============== أبو شماغ ==============
// <AbuShmagh mood="win" say="كفو!" /> — الشخصية بحركاتها (الحركات في globals.css تحت .abu)
// <AbuToast /> — يطلع فوق الشاشة لما أي مكان ينادي abuSay(...)
import React, { useEffect, useId, useRef, useState } from 'react';
import { MOOD_OF } from '@/lib/abu';
import { useOutfit } from '@/lib/wardrobe';

const OUT = '#3a2131';
const SKIN = '#f2d1a6';
// حبات المسبحة (دائرة تحت يده اليمين)
const BEADS = Array.from({ length: 11 }, (_, i) => {
  const a = (i / 11) * Math.PI * 2 + Math.PI / 2;
  return [+(101 + Math.cos(a) * 5.5).toFixed(1), +(107 + Math.sin(a) * 8).toFixed(1)];
});

export function AbuShmagh({ mood = 'idle', say = '', sub = '', size = 120, className = '', bubbleSide = 'top', outfit }) {
  const pid = `smg${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const mine = useOutfit();
  const wear = outfit || mine;
  const has = (k) => wear.includes(k);
  return (
    <div className={`abu st-${mood} relative inline-block ${className}`} style={{ width: size, height: size * 1.07 }}>
      {say && (
        <div className={`abu-bubble ${bubbleSide === 'side' ? 'abu-bubble-side' : bubbleSide === 'up-left' ? 'abu-bubble-upleft' : ''}`}>{say}{sub && <div className="abu-say-sub">{sub}</div>}</div>
      )}
      <svg viewBox="0 0 120 128" width={size} height={size * 1.07} aria-label="أبو شماغ" role="img" style={{ overflow: 'visible' }}>
        <defs>
          {has('white') ? (
            <pattern id={pid} width="8" height="8" patternUnits="userSpaceOnUse">
              <rect width="8" height="8" fill="#fff" /><path d="M0 7.5H8" stroke="#e7e3f2" strokeWidth="1" />
            </pattern>
          ) : (
            <pattern id={pid} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="7" height="7" fill="#fff" /><rect width="3.5" height="3.5" fill="#e0384f" /><rect x="3.5" y="3.5" width="3.5" height="3.5" fill="#e0384f" />
            </pattern>
          )}
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
          {/* ===== الخزانة: جسم ووجه ===== */}
          {has('bisht') && <g className="abu-bisht">
            <g stroke={OUT} strokeWidth="3.2" strokeLinejoin="round">
              <path d="M31 80 C24 92 22 104 25 114 L49 114 Q46 102 45 92 Q41 85 31 80Z" fill="#2a1d1a" />
              <path d="M89 80 C96 92 98 104 95 114 L71 114 Q74 102 75 92 Q79 85 89 80Z" fill="#2a1d1a" />
            </g>
            <path d="M33 82 Q41 86 45 93 Q46 103 48 112 M87 82 Q79 86 75 93 Q74 103 72 112" fill="none" stroke="#e8b84a" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M45 97 l2 2 M46 103 l2 2 M75 97 l-2 2 M74 103 l-2 2" stroke="#e8b84a" strokeWidth="1.6" strokeLinecap="round" />
          </g>}
          {has('stache') && <path className="abu-stache" d="M60 87 C56 80 46 79 40 85 C45 84 49 89 60 89 C71 89 75 84 80 85 C74 79 64 80 60 87Z" fill={OUT} />}
          {has('shades') && <g className="abu-shades">
            <g stroke={OUT} strokeWidth="2.6" strokeLinejoin="round">
              <path d="M36 67 H57 Q58 84 46.5 85 Q35 84 36 67Z" fill="#17151f" /><path d="M63 67 H84 Q85 84 73.5 85 Q62 84 63 67Z" fill="#17151f" />
              <path d="M57 70 Q60 67 63 70 M36 68 L31 66 M84 68 L89 66" fill="none" />
            </g>
            <path d="M40 71 L45 71 M67 71 L72 71" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".7" />
          </g>}
          {/* العقال من ورا — يغطيه الراس */}
          <g className="abu-agal-back"><path d="M27 40 Q60 25 93 40" fill="none" stroke={OUT} strokeWidth="8" strokeLinecap="round" /><path d="M27 40 Q60 25 93 40" fill="none" stroke="#26262b" strokeWidth="5" strokeLinecap="round" /></g>
          {/* الشماغ */}
          <path className="abu-shmagh" d="M60 22 C82 22 94 40 96 64 L102 96 Q92 86 88 70 Q86 54 60 50 Q34 54 32 70 Q28 86 18 96 L24 64 C26 40 38 22 60 22Z" fill={`url(#${pid})`} stroke={OUT} strokeWidth="3.6" strokeLinejoin="round" />
          {has('crown') && <g className="abu-crown">
            <path d="M43 27 L40 9 L51 18 L60 5 L69 18 L80 9 L77 27 Z" fill="#ffcf3f" stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
            <circle cx="60" cy="19" r="2.6" fill="#e0384f" stroke={OUT} strokeWidth="1.4" /><circle cx="48" cy="22" r="1.8" fill="#3aa0ff" /><circle cx="72" cy="22" r="1.8" fill="#3aa0ff" />
          </g>}
          {/* الفنجال يتحرك مع اليد اليسار (نفس حدود اليد عشان يلف معها) */}
          {has('finjan') && <g className="abu-armL">
            <path d="M31 82 Q20 88 22 97" fill="none" stroke="none" />
            <path d="M11 92 H31 L28.5 103 Q21 108 13.5 103 Z" fill="#fff" stroke={OUT} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M12.5 96.5 H29.5" stroke="#22a36b" strokeWidth="2.4" />
            <path d="M17 88 q-2 -3 1 -5 M23 88 q-2 -3 1 -5" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".85" />
          </g>}
          {/* اليد اليمين قدّام الشماغ عشان تبين وهي ترمي */}
          <g className="abu-armR"><path d="M89 82 Q100 88 98 97" fill="none" stroke={OUT} strokeWidth="10.6" strokeLinecap="round" /><path d="M89 82 Q100 88 98 97" fill="none" stroke={SKIN} strokeWidth="7" strokeLinecap="round" />
            {has('beads') && <g className="abu-beads">
              {BEADS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.2" fill="#d98b2b" stroke={OUT} strokeWidth="1" />)}
              <path d="M101 115 L99 122 M101 115 L103 122" stroke="#d98b2b" strokeWidth="2" strokeLinecap="round" />
            </g>}
          </g>
          {/* العقال الطاير: دائرة كاملة (يطلع بس وقت الرمية) */}
          <g className="abu-agal-ring">
            <ellipse cx="60" cy="40" rx="33" ry="10" fill="none" stroke={OUT} strokeWidth="8" /><ellipse cx="60" cy="40" rx="33" ry="10" fill="none" stroke="#26262b" strokeWidth="5" />
            <ellipse cx="60" cy="46" rx="33" ry="10" fill="none" stroke={OUT} strokeWidth="8" /><ellipse cx="60" cy="46" rx="33" ry="10" fill="none" stroke="#26262b" strokeWidth="5" />
            <ellipse cx="60" cy="41.5" rx="27" ry="6.5" fill="none" stroke="#8a8a92" strokeWidth="1.2" opacity=".8" />
          </g>
          {/* العقال وهو لابسه (نص دائرة قدّام) */}
          <g className="abu-agal">
            <path d="M27 40 Q60 55 93 40" fill="none" stroke={OUT} strokeWidth="8" strokeLinecap="round" /><path d="M27 40 Q60 55 93 40" fill="none" stroke="#26262b" strokeWidth="5" strokeLinecap="round" />
            <path d="M28 45 Q60 60 92 45" fill="none" stroke={OUT} strokeWidth="8" strokeLinecap="round" /><path d="M28 45 Q60 60 92 45" fill="none" stroke="#26262b" strokeWidth="5" strokeLinecap="round" />
            <path d="M34 41.5 Q60 52 86 41.5" fill="none" stroke="#8a8a92" strokeWidth="1.2" strokeLinecap="round" opacity=".8" />
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
      if (window.__abuCorners > 0) return;
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

// -------- واقف في زاوية الشاشة وقت اللعب، والكلام فوق راسه --------
export function AbuCorner({ size = 54, hidden = false, className = '', style }) {
  const [cur, setCur] = useState(null);
  const n = useRef(0);
  useEffect(() => {
    window.__abuCorners = (window.__abuCorners || 0) + 1;
    let t;
    const on = (e) => {
      const d = e.detail || {};
      n.current += 1;
      setCur({ ...d, mood: d.mood || MOOD_OF[d.kind] || 'hi', key: n.current });
      clearTimeout(t);
      t = setTimeout(() => setCur(null), d.sub ? 3600 : SHOW_MS);
    };
    window.addEventListener('abu:say', on);
    return () => { window.__abuCorners -= 1; window.removeEventListener('abu:say', on); clearTimeout(t); };
  }, []);
  if (hidden) return null;
  return (
    <div className={`pointer-events-none ${className}`} style={style}>
      <AbuShmagh key={cur?.key || 0} mood={cur ? cur.mood : 'idle'} say={cur?.text} sub={cur?.sub} size={size} bubbleSide="up-left" />
    </div>
  );
}
