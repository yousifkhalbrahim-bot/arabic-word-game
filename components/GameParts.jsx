'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Flag, Trophy, Sparkles, Target } from 'lucide-react';
import { ArcadeBg, Card, Label, WordChip, EndingBadge, LetterTiles, PLAYER_COLORS, PLAYER_DEEP, PLAYER_INK, PLAYER_ON } from '@/components/ui';

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

// ============== ساعة لاعب (مضغوطة) ==============
export function ChessClock({ name, isMe, player, time, active, words }) {
  const low = time <= 10;
  const bg = PLAYER_COLORS[player], deep = PLAYER_DEEP[player], on = PLAYER_ON[player];
  return (
    <div className={`relative rounded-2xl px-2.5 py-1.5 text-center transition-all duration-300 ${active ? '' : 'glass'}`}
      style={active ? { background: low ? '#ff4d6d' : bg, boxShadow: `0 5px 0 ${low ? '#b3123a' : deep}`, border: '2px solid rgba(255,255,255,0.4)' } : { opacity: 0.75 }}>
      <div className="flex items-center justify-center gap-1 font-display font-black text-[0.85rem] truncate"
        style={{ color: active ? (low ? '#fff' : on) : 'rgba(255,255,255,0.85)' }}>
        <span className="truncate">{name}</span>
        {isMe && <span className="text-[0.65rem] opacity-80 shrink-0">· أنت</span>}
      </div>
      <div className={`font-mono-ar font-black ${active && low ? 'animate-pulse' : ''}`}
        style={{ fontSize: 'clamp(1.6rem, 8vw, 2.2rem)', lineHeight: 1.1, color: active ? '#fff' : 'rgba(255,255,255,0.6)', textShadow: active ? `0 2px 0 ${low ? '#b3123a' : deep}` : 'none' }}>
        {formatTime(time)}
      </div>
      <div className="kb-hide text-[0.65rem] font-display font-bold" style={{ color: active ? (low ? '#fff' : on) : 'rgba(255,255,255,0.65)' }}>
        <bdi>{words}</bdi> كلمة
      </div>
    </div>
  );
}

// ============== شريط الدور (دائماً ظاهر) ==============
function TurnBanner({ state, myRole, activeRole, turnLeft, turnTotal }) {
  const pending = !!state.pendingWord;
  const secs = Math.max(0, Math.ceil(turnLeft));
  const pct = Math.max(0, Math.min(100, (turnLeft / turnTotal) * 100));
  const urgent = !pending && secs <= 5;
  const nameOf = (r) => state.players[r]?.name || '';

  let bg, deep, fg, title, sub;
  if (pending) {
    const judge = state.pendingWord.by === 1 ? 2 : 1;
    bg = '#ffffff'; deep = '#c4b5fd'; fg = '#4c1d95';
    title = '⏸ الوقت متوقف';
    sub = myRole && judge === myRole ? 'قرّر: تقبل الكلمة؟' : `${nameOf(judge)} يقرر على الكلمة`;
  } else {
    const mine = myRole != null && activeRole === myRole;
    bg = urgent ? '#ff4d6d' : PLAYER_COLORS[activeRole];
    deep = urgent ? '#b3123a' : PLAYER_DEEP[activeRole];
    fg = urgent ? '#ffffff' : PLAYER_ON[activeRole];
    title = mine ? '✍️ دورك! اكتب كلمتك' : myRole == null ? `دور ${nameOf(activeRole)}` : `⏳ دور ${nameOf(activeRole)}`;
    sub = mine ? (urgent ? 'بسرعة! الوقت يخلص' : 'اكتب وأرسل قبل ما يخلص الوقت')
      : myRole == null ? 'أعطه الجوال' : 'جهّز كلمتك… تقدر تكتبها الحين';
  }

  return (
    <div key={`${activeRole}-${pending}`} className="slide-in rounded-2xl px-3 py-2 flex items-center gap-3"
      style={{ background: bg, boxShadow: `0 5px 0 ${deep}`, border: '2px solid rgba(255,255,255,0.45)', color: fg }}>
      <div className="flex-1 min-w-0">
        <div className="font-display font-black text-[1.15rem] leading-tight truncate">{title}</div>
        <div className="kb-hide font-display font-bold text-[0.75rem] opacity-85 truncate">{sub}</div>
        {!pending && (
          <div className="h-2 mt-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.15)' }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: urgent ? '#fff' : 'rgba(255,255,255,0.95)', transition: 'width 0.1s linear' }} />
          </div>
        )}
      </div>
      {!pending && (
        <div className={`shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center justify-center ${urgent ? 'animate-pulse' : ''}`}
          style={{ background: 'rgba(255,255,255,0.3)' }}>
          <span className="font-mono-ar font-black text-2xl leading-none"><bdi>{secs}</bdi></span>
          <span className="text-[0.6rem] font-black opacity-80">ثانية</span>
        </div>
      )}
    </div>
  );
}

// ============== الكلمات المستخدمة ==============
export function UsedWords({ words }) {
  if (!words.length) {
    return <div className="kb-hide text-center text-white/55 font-display font-bold text-sm pt-3">ما فيه كلمات بعد — أول كلمة عليكم 🏁</div>;
  }
  return (
    <div className="kb-hide pt-1">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="font-display font-bold text-sm text-white/85">الكلمات المستخدمة</span>
        <span className="font-display font-bold text-xs text-white/70 bg-white/15 rounded-full px-2 py-0.5"><bdi>{words.length}</bdi></span>
      </div>
      <div className="flex flex-wrap gap-2 pb-1">
        {words.map((w, i) => (
          <WordChip key={words.length - i} player={w.player} fresh={i === 0}>{w.word}</WordChip>
        ))}
      </div>
    </div>
  );
}

// ============== طاولة ساعة الشطرنج (أونلاين + جهاز واحد + الكمبيوتر) ==============
// شاشة ثابتة بطول الجوال: شريط الدور + الساعات + النهاية + الإدخال دايماً ظاهرين،
// والكلمات المستخدمة تتمرر تحت (وتختفي لما الكيبورد مفتوح).
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
    <div className="app-fixed flex flex-col" style={{ color: '#fff' }}>
      <ArcadeBg letters={false} />

      <div className="shrink-0 flex items-center justify-between gap-2 px-3 pt-2 pb-2">
        <div className="flex items-center gap-2 text-xs font-display font-bold text-white/90 bg-white/15 rounded-full px-3 py-1.5 min-w-0">{topInfo}</div>
        <button onClick={resign}
          className="btn-3d shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-display font-black text-white"
          style={{ background: '#ff4d6d', boxShadow: confirm ? '0 2px 0 #b3123a' : '0 4px 0 #b3123a', transform: confirm ? 'translateY(2px)' : undefined }}>
          <Flag className="w-3 h-3" strokeWidth={3} /> {confirm ? 'متأكد؟ اضغط ثانية' : 'استسلام'}
        </button>
      </div>

      <div className="shrink-0 px-3 space-y-2.5">
        <TurnBanner state={state} myRole={myRole} activeRole={activeRole ?? state.currentTurn}
          turnLeft={turnTimeLeft} turnTotal={turnSkipSecs} />

        <div className="flex items-center gap-2.5">
          <div className="flex-1 min-w-0">
            <ChessClock name={state.players[order[0]]?.name} isMe={myRole === order[0]} player={order[0]}
              time={displayTimes[order[0]]} active={activeRole === order[0]} words={wordCounts[order[0]]} />
          </div>
          <div className="shrink-0 text-center">
            <div className="kb-hide text-[0.6rem] font-display font-bold text-white/80 mb-0.5">تنتهي بـ</div>
            <LetterTiles text={state.settings.ending} size={34} />
          </div>
          <div className="flex-1 min-w-0">
            <ChessClock name={state.players[order[1]]?.name} isMe={myRole === order[1]} player={order[1]}
              time={displayTimes[order[1]]} active={activeRole === order[1]} words={wordCounts[order[1]]} />
          </div>
        </div>

        {children}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-3 pt-3 pb-3">
        <UsedWords words={state.usedWords || []} />
      </div>
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
export function Confetti({ count = 70 }) {
  const pieces = useMemo(() => {
    const colors = ['#ffb020', '#22d3ee', '#ff4d6d', '#a3e635', '#ffffff', '#f472b6'];
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
          style={{ left: `${p.left}%`, background: p.color, borderRadius: p.round ? '50%' : 2, width: p.round ? 10 : 8, height: p.round ? 10 : 15, '--dx': p.dx, '--rot': p.rot, '--dur': p.dur, '--delay': p.delay }} />
      ))}
    </div>
  );
}

// ============== رأس شاشة النتيجة + لوحة النقاط ==============
// sides: [{ name, player, score, tag }] — الأول يظهر يمين
export function ResultHeader({ isDraw, winnerName, winnerPlayer, subtitle, sides, unit }) {
  const best = Math.max(...sides.map(s => (typeof s.score === 'number' ? s.score : -Infinity)));
  const wColor = isDraw ? '#ffffff' : PLAYER_COLORS[winnerPlayer];
  return (
    <div className="text-center">
      <div className="mx-auto mb-2 w-16 h-16 rounded-2xl flex items-center justify-center bounce-gentle rotate-[-6deg]"
        style={{ background: isDraw ? '#fff' : wColor, boxShadow: `0 6px 0 ${isDraw ? '#c4b5fd' : PLAYER_DEEP[winnerPlayer]}`, border: '3px solid rgba(255,255,255,0.6)' }}>
        {isDraw
          ? <Sparkles className="w-8 h-8 text-[#7c3aed]" strokeWidth={2.6} />
          : <Trophy className="w-8 h-8" style={{ color: PLAYER_ON[winnerPlayer] }} strokeWidth={2.6} />}
      </div>
      <p className="text-white/80 text-sm font-display font-bold">{isDraw ? 'النتيجة' : 'الفائز'}</p>
      <h1 className="font-display font-black truncate text-white" style={{ fontSize: 'clamp(2.4rem, 12vw, 3.3rem)', lineHeight: 1.2, textShadow: '0 4px 0 rgba(46,16,101,0.45)' }}>
        {isDraw ? 'تعادل!' : winnerName}
      </h1>
      <p className="text-white/85 font-display font-bold mb-4">{subtitle}</p>

      <Card className="px-4 py-3 mb-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {sides.map((s, i) => {
            const lost = s.dim ?? (!isDraw && s.score < best);
            return (
              <React.Fragment key={i}>
                {i === 1 && <span className="font-display font-black text-[#c4b5fd] text-xl px-1">VS</span>}
                <div className="min-w-0">
                  <div className="font-display font-black truncate text-sm" style={{ color: PLAYER_INK[s.player] }}>
                    {s.name}{s.tag && <span className="text-[0.65rem] text-muted font-bold mr-1">{s.tag}</span>}
                  </div>
                  <div className="font-display font-black leading-none mt-1"
                    style={{ fontSize: '2.6rem', color: lost ? '#d4ccf0' : PLAYER_COLORS[s.player], textShadow: lost ? 'none' : `0 3px 0 ${PLAYER_DEEP[s.player]}` }}>
                    <bdi>{s.score}</bdi>
                  </div>
                  <div className="text-[0.72rem] text-muted font-bold mt-1">{unit}</div>
                </div>
              </React.Fragment>
            );
          })}
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
    <div className="mb-5 space-y-3 text-right slide-in">
      <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 text-sm glass rounded-2xl px-3 py-2.5 font-display font-bold">
        <Target className="w-4 h-4 text-white/80" strokeWidth={2.6} />
        <span className="text-white/85">أطول كلمة</span>
        <WordChip player={longestBy}>{longest}</WordChip>
        <span className="text-white/70 text-xs">— {nameOf(longestBy)}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[myRole, oppRole].map(r => {
          const list = lists[r];
          const penalty = isRace ? (roomState.penalties?.[r] ?? 0) : 0;
          return (
            <Card key={r} className="p-3 min-w-0">
              <div className="flex items-center justify-between gap-1 text-xs mb-2 font-display font-bold">
                <span className="font-black truncate" style={{ color: PLAYER_INK[r] }}>{nameOf(r)}</span>
                <span className="text-muted shrink-0">
                  <bdi>{list.length}</bdi> كلمة
                  {penalty > 0 && <span className="text-[#e11d48]"> · خصم <bdi>{penalty}</bdi></span>}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto no-scrollbar pb-1">
                {list.map((w, i) => <WordChip key={i} player={r}>{w}</WordChip>)}
                {!list.length && <span className="text-xs text-dim">لا شيء</span>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// للتوافق مع أي استخدام قديم
export { Label };
