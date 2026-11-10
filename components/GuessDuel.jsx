'use client';

// ============== خمّن الكلمة — تحدي أونلاين ==============
// الاثنين يخمّنون نفس الكلمة. تشوف تقدّم خصمك بالألوان بس (بدون حروفه).
// اللي يحلها بمحاولات أقل يفوز، ولو تعادلوا فالأسرع.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, Flag } from 'lucide-react';
import { ArcadeBg, Num, PLAYER_COLORS, PLAYER_ON, PLAYER_DEEP } from '@/components/ui';
import { GuessBoard, GuessKeyboard, MiniBoard, buildRows, usePhysicalKeys, LETTER_SET, FLIP_MS, PRAISE } from '@/components/GuessGame';
import { LENGTHS, normalizeGuess, evaluateGuess, mergeKeyStates, KNOWN } from '@/lib/guess';
import { playAccept, playReject, playStreak } from '@/lib/sounds';

const solvedAt = (guesses) => {
  const i = (guesses || []).findIndex(g => g.result.every(r => r === 'correct'));
  return i < 0 ? 0 : i + 1;
};

// يقرر النتيجة بعد كل تخمين — يرجع الحالة مع status/winner إذا انحسمت
export function settleGuessDuel(state) {
  const tries = LENGTHS[state.settings.len].tries;
  const info = (r) => {
    const g = state[`guesses_p${r}`] || [];
    const n = solvedAt(g);
    return { solved: n > 0, n: n || g.length, used: g.length, done: n > 0 || g.length >= tries, ts: g.length ? g[g.length - 1].ts : 0 };
  };
  const a = info(1), b = info(2);
  let winner = null;
  // حسم مبكر: واحد حلها، والثاني استهلك نفس العدد أو أكثر بدون ما يحلها
  if (a.solved && !b.solved && (b.done || b.used >= a.n)) winner = 1;
  else if (b.solved && !a.solved && (a.done || a.used >= b.n)) winner = 2;
  else if (a.done && b.done) {
    if (a.solved && b.solved) winner = a.n < b.n ? 1 : b.n < a.n ? 2 : (a.ts <= b.ts ? 1 : 2);
    else winner = a.solved ? 1 : b.solved ? 2 : 0;
  }
  return winner === null ? state : { ...state, status: 'finished', winner };
}

export default function GuessDuel({ roomState, myRole, connected, onSubmitGuess, onResign }) {
  const oppRole = myRole === 1 ? 2 : 1;
  const len = roomState.settings.len;
  const tries = LENGTHS[len].tries;
  const answer = roomState.answer;
  const myGuesses = roomState[`guesses_p${myRole}`] || [];
  const oppGuesses = roomState[`guesses_p${oppRole}`] || [];
  const oppName = roomState.players[oppRole]?.name || 'الخصم';

  const [current, setCurrent] = useState('');
  const [revealing, setRevealing] = useState(-1);
  const [shakeRow, setShakeRow] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmUnknown, setConfirmUnknown] = useState('');
  const [confirmResign, setConfirmResign] = useState(false);
  const toastTimer = useRef(null);
  const resignTimer = useRef(null);
  const prevLen = useRef(myGuesses.length);
  const prevOppLen = useRef(oppGuesses.length);

  const mySolved = solvedAt(myGuesses) > 0;
  const myDone = mySolved || myGuesses.length >= tries;
  const oppSolved = solvedAt(oppGuesses);
  const busy = revealing >= 0;

  const keyStates = useMemo(() => {
    let k = {};
    for (const g of myGuesses) k = mergeKeyStates(k, g.word, g.result);
    return k;
  }, [myGuesses]);

  const flash = useCallback((text, ms = 1400) => {
    clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);
  useEffect(() => () => { clearTimeout(toastTimer.current); clearTimeout(resignTimer.current); }, []);

  // حركة قلب الصف لما ينضاف تخميني
  useEffect(() => {
    if (myGuesses.length > prevLen.current) {
      const idx = myGuesses.length - 1;
      setRevealing(idx);
      const t = setTimeout(() => {
        setRevealing(-1);
        const won = myGuesses[idx].result.every(r => r === 'correct');
        if (won) { playStreak(); flash(PRAISE[idx] || 'حليتها!', 1800); }
        else playAccept();
      }, FLIP_MS * len + 250);
      prevLen.current = myGuesses.length;
      return () => clearTimeout(t);
    }
    prevLen.current = myGuesses.length;
  }, [myGuesses, len, flash]);

  // تنبيه لما الخصم يحلها
  useEffect(() => {
    if (oppGuesses.length > prevOppLen.current && solvedAt(oppGuesses) === oppGuesses.length) {
      flash(`${oppName} حلّها! ⚡`, 2000);
    }
    prevOppLen.current = oppGuesses.length;
  }, [oppGuesses, oppName, flash]);

  const submit = useCallback(() => {
    if (busy || myDone || roomState.status !== 'playing') return;
    const word = normalizeGuess(current);
    if ([...word].length !== len) {
      playReject();
      setShakeRow(true); setTimeout(() => setShakeRow(false), 450);
      flash(`الكلمة لازم تكون ${len} أحرف`);
      return;
    }
    if (!KNOWN[len].has(word) && confirmUnknown !== word) {
      setConfirmUnknown(word);
      setShakeRow(true); setTimeout(() => setShakeRow(false), 450);
      flash('مو في قاموسنا 🤔 — اضغط ✓ مرة ثانية للتأكيد', 2200);
      return;
    }
    setCurrent('');
    setConfirmUnknown('');
    onSubmitGuess(word, evaluateGuess(word, answer));
  }, [busy, myDone, roomState.status, current, len, confirmUnknown, answer, onSubmitGuess, flash]);

  const typeKey = useCallback((k) => {
    if (busy || myDone) return;
    if (k === 'ENTER') return submit();
    if (k === 'BACK') { setCurrent(c => [...c].slice(0, -1).join('')); return; }
    const ch = normalizeGuess(k);
    if (!LETTER_SET.has(ch)) return;
    setCurrent(c => ([...c].length < len ? c + ch : c));
  }, [busy, myDone, submit, len]);

  usePhysicalKeys(roomState.status === 'playing', typeKey);

  const resign = () => {
    if (!confirmResign) {
      setConfirmResign(true);
      clearTimeout(resignTimer.current);
      resignTimer.current = setTimeout(() => setConfirmResign(false), 2500);
      return;
    }
    setConfirmResign(false);
    onResign();
  };

  const rows = buildRows(myGuesses, current, tries, !myDone);
  const oppStatus = oppSolved ? <>حلّها من <Num>{oppSolved}</Num> ✓</>
    : oppGuesses.length >= tries ? 'خلصت محاولاته'
    : <>يخمّن… <Num>{oppGuesses.length}</Num> من <Num>{tries}</Num></>;

  return (
    <div className="app-fixed flex flex-col" style={{ color: '#fff', userSelect: 'none' }}>
      <ArcadeBg letters={false} />

      {/* العنوان */}
      <div className="shrink-0 flex items-center justify-between px-3 pt-2 pb-1">
        <button onClick={resign} aria-label="استسلام"
          className="h-8 rounded-full flex items-center justify-center gap-1 px-2.5 font-display font-black text-xs transition-all active:scale-90"
          style={{ background: confirmResign ? '#ff4d6d' : 'rgba(255,255,255,0.16)' }}>
          {confirmResign ? <><Flag className="w-3.5 h-3.5" /> متأكد؟</> : <ArrowLeft className="w-4 h-4" strokeWidth={2.8} />}
        </button>
        <div className="flex items-center gap-1.5 font-display font-black rounded-full px-3 py-1 bg-white/15" style={{ fontSize: '0.85rem' }}>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-[#4ade80]' : 'bg-[#ff4d6d] animate-pulse'}`} />
          تحدي · خمّن الكلمة
        </div>
        <div style={{ width: 32 }} />
      </div>

      {/* تقدّم الخصم */}
      <div className="shrink-0 px-3 pt-1">
        <div className="glass rounded-2xl px-3 py-2 flex items-center gap-3">
          <MiniBoard guesses={oppGuesses} len={len} tries={tries} size={9} />
          <div className="flex-1 min-w-0">
            <div className="font-display font-black truncate" style={{ color: PLAYER_COLORS[oppRole] }}>{oppName}</div>
            <div className="text-xs font-display font-bold text-white/80">{oppStatus}</div>
          </div>
          <div className="text-center rounded-xl px-2.5 py-1" style={{ background: PLAYER_COLORS[myRole], color: PLAYER_ON[myRole], boxShadow: `0 3px 0 ${PLAYER_DEEP[myRole]}` }}>
            <div className="text-[0.6rem] font-black">أنت</div>
            <div className="font-display font-black leading-none text-sm"><Num>{myGuesses.length}</Num> من <Num>{tries}</Num></div>
          </div>
        </div>
      </div>

      {/* لوحتي */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 relative">
        <GuessBoard rows={rows} len={len} revealing={revealing} shakeRow={shakeRow} compact />
        {toast && (
          <div className="absolute top-1 left-1/2 -translate-x-1/2 slide-in font-display font-black rounded-full px-4 py-1.5 text-[#2e1065] bg-white whitespace-nowrap z-10"
            style={{ boxShadow: '0 4px 0 #c4b5fd', fontSize: '0.9rem' }}>
            {toast}
          </div>
        )}
        {myDone && !busy && roomState.status === 'playing' && (
          <div className="mt-3 rounded-full bg-white/15 px-4 py-1.5 font-display font-bold text-sm slide-in">
            {mySolved ? 'حليتها! ' : 'خلصت محاولاتك — '}بانتظار {oppName}
            <span className="dot-wave"><span>.</span><span>.</span><span>.</span></span>
          </div>
        )}
      </div>

      <GuessKeyboard keyStates={keyStates} onKey={typeKey} disabled={myDone} />
    </div>
  );
}
