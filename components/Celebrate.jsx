'use client';

// ============== «وسام جديد!» و«مستوى جديد!» ==============
// بطاقة صغيرة تنزل من فوق أول ما تحصّل وسام أو تطلع مستوى. ما توقف اللعب، وتختفي بروحها.
// تشتغل على حدثين: wg:points (نقاط من لعب) و wg:stats (إحصائيات انحفظت بعد جولة).
import React, { useEffect, useRef, useState } from 'react';
import BadgeArt from '@/components/BadgeArt';
import { cachedPoints } from '@/lib/points';
import { levelFor } from '@/lib/levels';
import { readProgress, computeBadges } from '@/lib/badges';
import { playStreak } from '@/lib/sounds';
import { haptic } from '@/lib/native';

const SEEN_LEVEL = 'wg:seen-level';
const SEEN_BADGES = 'wg:seen-badges';
const DELAY_MS = 1500;   // بعد احتفال الفوز
const SHOW_MS = 3400;

const readNum = (k) => { try { return parseInt(localStorage.getItem(k) || '', 10); } catch { return NaN; } };
const readList = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch {} };

const earnedIds = () => computeBadges(readProgress()).filter(b => b.earned).map(b => b.id);

export default function Celebrate() {
  const [queue, setQueue] = useState([]);
  const timers = useRef([]);

  useEffect(() => {
    // أول مرة: نعتبر كل اللي عنده الحين «شافه» عشان ما نطلّع له سيل بطاقات
    if (readList(SEEN_BADGES) === null) write(SEEN_BADGES, earnedIds());
    if (Number.isNaN(readNum(SEEN_LEVEL))) write(SEEN_LEVEL, String(levelFor(cachedPoints()?.points || 0).n));

    const later = (fn) => { const t = setTimeout(fn, DELAY_MS); timers.current.push(t); };

    const checkBadges = () => {
      const seen = new Set(readList(SEEN_BADGES) || []);
      const all = computeBadges(readProgress());
      const fresh = all.filter(b => b.earned && !seen.has(b.id));
      if (!fresh.length) return [];
      write(SEEN_BADGES, [...seen, ...fresh.map(b => b.id)]);
      return fresh.map(b => ({ kind: 'badge', key: b.id, badge: b }));
    };

    const onPoints = (e) => {
      const n = levelFor(e.detail?.points || 0).n;
      const seen = readNum(SEEN_LEVEL);
      if (!e.detail?.award) {
        // تحديث من السيرفر: نحدّث المرجع بدون احتفال
        if (Number.isNaN(seen) || n > seen) write(SEEN_LEVEL, String(n));
        return;
      }
      later(() => {
        const items = checkBadges();
        if (!Number.isNaN(seen) && n > seen) items.push({ kind: 'level', key: `lv${n}`, level: n });
        if (n > (Number.isNaN(seen) ? 0 : seen)) write(SEEN_LEVEL, String(n));
        if (items.length) setQueue(q => [...q, ...items]);
      });
    };
    const onStats = () => later(() => {
      const items = checkBadges();
      if (items.length) setQueue(q => [...q, ...items]);
    });

    window.addEventListener('wg:points', onPoints);
    window.addEventListener('wg:stats', onStats);
    return () => {
      window.removeEventListener('wg:points', onPoints);
      window.removeEventListener('wg:stats', onStats);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const cur = queue[0];

  // كل بطاقة: صوت + اهتزاز، وتختفي بعد شوي
  useEffect(() => {
    if (!cur) return;
    playStreak();
    haptic('success');
    const t = setTimeout(() => setQueue(q => q.slice(1)), SHOW_MS);
    return () => clearTimeout(t);
  }, [cur]);

  if (!cur) return null;

  return (
    <div className="fixed left-0 right-0 z-[60] flex justify-center px-4 pointer-events-none" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}>
      <button key={cur.key} onClick={() => setQueue(q => q.slice(1))}
        className="celebrate-drop pointer-events-auto w-full max-w-sm flex items-center gap-3 rounded-3xl bg-[var(--card)] px-3 py-2.5 text-right"
        style={{ boxShadow: '0 6px 0 var(--edge), 0 18px 30px -12px rgba(20,5,60,0.7)', border: '2px solid var(--line)' }}>
        {cur.kind === 'badge' ? (
          <BadgeArt {...cur.badge.art} className="w-[54px] h-[60px] shrink-0 word-pop" />
        ) : (
          <span className="w-[54px] h-[54px] shrink-0 rounded-2xl flex items-center justify-center font-display font-black text-[1.7rem] word-pop"
            style={{ background: 'linear-gradient(160deg, #c4b5fd, #7c3aed)', color: '#fff', boxShadow: '0 4px 0 #4c1d95', border: '3px solid rgba(255,255,255,0.7)' }}>
            <bdi className="font-mono-ar">{cur.level}</bdi>
          </span>
        )}
        <span className="flex-1 min-w-0">
          <span className="block font-display font-black text-[1.05rem] text-[var(--ink)]">
            {cur.kind === 'badge' ? '🎉 وسام جديد!' : '⬆️ مستوى جديد!'}
          </span>
          <span className="block font-display font-bold text-[0.85rem] text-[var(--muted-c)] truncate">
            {cur.kind === 'badge' ? cur.badge.name : <>وصلت مستوى <bdi className="font-mono-ar">{cur.level}</bdi> — كمّل!</>}
          </span>
        </span>
      </button>
    </div>
  );
}
