'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Flag, Trophy, Sparkles, Target } from 'lucide-react';
import { Card, Label, WordChip, EndingBadge, PLAYER_COLORS } from '@/components/ui';

export const formatTime = (seconds) => {
  const s = Math.max(0, seconds);
  if (s <= 10) {
    const secs = Math.floor(s);
    const tenths = Math.floor((s % 1) * 10);
    return `${secs}.${tenths}`;
  }
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const wordStr = (w) => (typeof w === 'string' ? w : w?.w ?? '');

// ============== ساعة لاعب ==============
export function ChessClock({ name, isMe, color, time, active, words, turnLeft, turnTotal }) {
  const low = time <= 10;
  const pct = Math.max(0, Math.min(100, (turnLeft / turnTotal) * 100));
  return (
    <div className={`wood-card relative rounded-3xl px-3 pt-3 pb-2 transition-all duration-300 ${active ? 'clock-active' : 'opacity-55'}`}
      style={active ? { '--c': `${color}aa`, borderColor: `${color}aa` } : undefined}>
      <div className="flex items-center justify-between gap-1 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${active ? 'animate-pulse' : ''}`} style={{ background: active ? color : '#5b4632' }} />
          <span className="font-display font-bold truncate text-[0.95rem]">{name}</span>
          {isMe && <span className="text-[0.65rem] shrink-0 font-bold" style={{ color }}>أنت</span>}
        </div>
        <span className="text-[0.7rem] text-muted shrink-0"><bdi>{words}</bdi> كلمة</span>
      </div>
      <div className={`font-mono-ar font-bold text-center ${active && low ? 'animate-pulse' : ''}`}
        style={{ fontSize: 'clamp(2.1rem, 11vw, 3.3rem)', lineHeight: 1.15, color: active ? (low ? '#fca5a5' : color) : '#8a7560' }}>
        {formatTime(time)}
      </div>
      <div className="h-1.5 mt-2 rounded-full bg-black/40 overflow-hidden">
        {active && (
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: turnLeft <= 3 ? '#f87171' : color, transition: 'width 0.1s linear' }} />
        )}
      </div>
      <div className="text-[0.65rem] text-center mt-1 h-4 text-muted font-display">
        {active ? <>باقي على الدور <bdi className="font-mono-ar">{Math.ceil(turnLeft)}</bdi> ث</> : ''}
      </div>
    </div>
  );
}

// ============== الكلمات المستخدمة ==============
export function UsedWords({ words }) {
  if (!words.length) return null;
  return (
    <Card className="p-4">
      <Label aside={<span className="text-xs text-dim"><bdi>{words.length}</bdi></span>}>الكلمات المستخدمة</Label>
      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
        {words.map((w, i) => (
          <WordChip key={words.length - i} color={PLAYER_COLORS[w.player]} fresh={i === 0}>{w.word}</WordChip>
        ))}
      </div>
    </Card>
  );
}

// ============== طاولة ساعة الشطرنج (أونلاين + جهاز واحد) ==============
export function ChessTable({ state, order, myRole, activeRole, displayTimes, turnTimeLeft, turnSkipSecs, wordCounts, topInfo, onResign, children }) {
  const [confirm, setConfirm] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const resign = () => {
    if (!confirm) {
      setConfirm(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setConfirm(false), 2500);
      return;
    }
    clearTimeout(timer.current);
    setConfirm(false);
    onResign();
  };

  return (
    <div className="space-y-3 pb-4">
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2 text-xs text-muted min-w-0">{topInfo}</div>
        <button onClick={resign}
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-display font-bold border transition-all active:scale-95 ${confirm ? 'bg-rose-500/25 border-rose-400/60 text-rose-100' : 'bg-rose-500/10 border-rose-400/25 text-rose-300'}`}>
          <Flag className="w-3 h-3" /> {confirm ? 'متأكد؟ اضغط مرة ثانية' : 'استسلام'}
        </button>
      </div>

      <div className="text-center">
        <EndingBadge ending={state.settings.ending} label="اكتب كلمة تنتهي بـ" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {order.map(r => (
          <ChessClock key={r}
            name={state.players[r]?.name}
            isMe={myRole === r}
            color={PLAYER_COLORS[r]}
            time={displayTimes[r]}
            active={activeRole === r}
            words={wordCounts[r]}
            turnLeft={turnTimeLeft}
            turnTotal={turnSkipSecs}
          />
        ))}
      </div>

      {children}

      <UsedWords words={state.usedWords || []} />
    </div>
  );
}

// "خالد يفكر..." مع نقاط متحركة
export function Thinking({ children }) {
  return (
    <span className="font-display">
      {children}
      <span className="dot-wave"><span>.</span><span>.</span><span>.</span></span>
    </span>
  );
}

// ============== احتفال ==============
export function Confetti({ count = 60 }) {
  const pieces = useMemo(() => {
    const colors = ['#fbbf24', '#2dd4bf', '#f472b6', '#a78bfa', '#fde68a', '#34d399'];
    return Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100,
      dx: `${(Math.random() - 0.5) * 30}vw`,
      rot: `${Math.random() * 720 - 360}deg`,
      dur: `${2.4 + Math.random() * 1.8}s`,
      delay: `${Math.random() * 0.7}s`,
      color: colors[i % colors.length],
      round: i % 3 === 0,
    }));
  }, [count]);
  return (
    <div aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} className="confetti-piece"
          style={{ left: `${p.left}%`, background: p.color, borderRadius: p.round ? '50%' : 2, width: p.round ? 9 : 8, height: p.round ? 9 : 14, '--dx': p.dx, '--rot': p.rot, '--dur': p.dur, '--delay': p.delay }} />
      ))}
    </div>
  );
}

// ============== رأس شاشة النتيجة + لوحة النقاط ==============
// sides: [{ name, color, score, tag }] — الأول يظهر يمين
export function ResultHeader({ isDraw, winnerName, winnerColor, subtitle, sides, unit }) {
  const color = isDraw ? '#e7dccb' : winnerColor;
  const best = Math.max(...sides.map(s => s.score));
  return (
    <div className="text-center">
      <div className="mx-auto mb-2 w-16 h-16 rounded-full flex items-center justify-center bounce-gentle"
        style={{ background: `radial-gradient(circle at 50% 35%, ${color}40, ${color}12 70%)`, border: `1.5px solid ${color}66`, boxShadow: `0 0 40px -6px ${color}88` }}>
        {isDraw ? <Sparkles className="w-8 h-8" style={{ color }} /> : <Trophy className="w-8 h-8" style={{ color }} />}
      </div>
      <p className="text-muted text-sm font-display">{isDraw ? 'النتيجة' : 'الفائز'}</p>
      <h1 className="font-display font-bold title-emboss truncate" style={{ fontSize: 'clamp(2.3rem, 11vw, 3.2rem)', color, lineHeight: 1.2 }}>
        {isDraw ? 'تعادل' : winnerName}
      </h1>
      <p className="text-muted mb-4">{subtitle}</p>

      <Card className="px-4 py-3 mb-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {sides.map((s, i) => (
            <React.Fragment key={i}>
              {i === 1 && <span className="font-display text-dim text-xl px-1">–</span>}
              <div className="min-w-0">
                <div className="font-display font-bold truncate text-sm" style={{ color: s.color }}>
                  {s.name}{s.tag && <span className="text-[0.65rem] text-muted font-normal mr-1">{s.tag}</span>}
                </div>
                <div className="font-display font-black leading-none mt-1"
                  style={{ fontSize: '2.4rem', color: !isDraw && s.score < best ? '#7a644c' : s.color }}>
                  <bdi>{s.score}</bdi>
                </div>
                <div className="text-[0.7rem] text-dim mt-1">{unit}</div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============== ملخص المباراة ==============
export function MatchSummary({ roomState, myRole }) {
  const oppRole = myRole === 1 ? 2 : 1;
  const isRace = roomState.mode === 'race';
  const listFor = (r) => isRace
    ? (roomState[`words_p${r}`] || []).map(wordStr)
    : (roomState.usedWords || []).filter(w => w.player === r).map(w => w.word).reverse();
  const nameOf = (r) => roomState.players[r]?.name || '';
  const lists = { [myRole]: listFor(myRole), [oppRole]: listFor(oppRole) };
  const all = [...lists[myRole], ...lists[oppRole]];
  if (!all.length) return null;

  const longest = all.reduce((a, b) => (b.length > a.length ? b : a), '');
  const longestBy = lists[myRole].includes(longest) ? myRole : oppRole;

  return (
    <div className="mb-4 space-y-3 text-right slide-in">
      <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 text-sm wood-card rounded-2xl px-3 py-2.5">
        <Target className="w-4 h-4 text-muted" />
        <span className="text-muted">أطول كلمة</span>
        <span className="font-display font-bold text-base" style={{ color: PLAYER_COLORS[longestBy] }}>{longest}</span>
        <span className="text-dim text-xs">— {nameOf(longestBy)}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[myRole, oppRole].map(r => {
          const color = PLAYER_COLORS[r];
          const list = lists[r];
          const penalty = isRace ? (roomState.penalties?.[r] ?? 0) : 0;
          return (
            <Card key={r} className="p-3 min-w-0">
              <div className="flex items-center justify-between gap-1 text-xs mb-2">
                <span className="font-display font-bold truncate" style={{ color }}>{nameOf(r)}</span>
                <span className="text-dim shrink-0">
                  <bdi>{list.length}</bdi> كلمة
                  {penalty > 0 && <> · خصم <bdi>{penalty}</bdi></>}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {list.map((w, i) => <WordChip key={i} color={color}>{w}</WordChip>)}
                {!list.length && <span className="text-xs text-dim">لا شيء</span>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
