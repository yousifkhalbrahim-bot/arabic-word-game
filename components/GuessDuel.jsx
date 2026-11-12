'use client';

// ============== خمّن الكلمة — تحدي أونلاين ==============
// الاثنين يخمّنون نفس الكلمة. تشوف تقدّم خصمك بالألوان بس (بدون حروفه).
// اللي يحلها بمحاولات أقل يفوز، ولو تعادلوا فالأسرع.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, Flag } from 'lucide-react';
import { ArcadeBg, Num, PLAYER_COLORS, PLAYER_ON, PLAYER_DEEP } from '@/components/ui';
import { GuessBoard, GuessKeyboard, MiniBoard, buildRows, usePhysicalKeys, LETTER_SET, FLIP_MS, PRAISE, WinBurst } from '@/components/GuessGame';
import { LENGTHS, bankFor, normalizeGuess, evaluateGuess, mergeKeyStates, KNOWN } from '@/lib/guess';
import { playAccept, playReject, playStreak, playKey, playReveal, playWin, playLose } from '@/lib/sounds';
import { now } from '@/lib/clock';

const solvedAt = (guesses) => {
  const i = (guesses || []).findIndex(g => g.result.every(r => r === 'correct'));
  return i < 0 ? 0 : i + 1;
};

// مدة التحدي (ثواني) — الغرف القديمة بدون مدة تاخذ الافتراضي
export const DUEL_SECONDS = { 3: 180, 4: 180, 5: 240 };
export const duelDuration = (state) => state.settings?.duration || DUEL_SECONDS[state.settings?.len] || 180;

// أفضل تقدّم: عدد الحروف الخضراء ثم البرتقالية في أحسن محاولة
const bestProgress = (guesses) => (guesses || []).reduce((best, g) => {
  const c = g.result.filter(r => r === 'correct').length;
  const p = g.result.filter(r => r === 'present').length;
  const score = c * 10 + p;
  return Math.max(best, score);
}, -1);

// يقرر النتيجة بعد كل تخمين — يرجع الحالة مع status/winner إذا انحسمت
// timeUp: انتهى الوقت → لازم يتحسم الحين
// "أنت تختار الكلمة": واحد يكتب الكلمة والثاني يخمّن
function settleCustom(state, timeUp) {
  const tries = LENGTHS[state.settings.len].tries;
  const setter = state.setter;
  const guesser = setter === 1 ? 2 : 1;
  const g = state[`guesses_p${guesser}`] || [];
  if (solvedAt(g)) return { ...state, status: 'finished', winner: guesser };
  if (g.length >= tries || timeUp) return { ...state, status: 'finished', winner: setter, ...(timeUp ? { timeUp: true } : {}) };
  return state;
}

export function settleGuessDuel(state, timeUp = false) {
  if (state.settings?.custom) return settleCustom(state, timeUp);
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
  if (winner === null && timeUp) {
    if (a.solved && b.solved) winner = a.n < b.n ? 1 : b.n < a.n ? 2 : (a.ts <= b.ts ? 1 : 2);
    else if (a.solved || b.solved) winner = a.solved ? 1 : 2;
    else {
      const pa = bestProgress(state.guesses_p1), pb = bestProgress(state.guesses_p2);
      winner = pa > pb ? 1 : pb > pa ? 2 : 0;
    }
    return { ...state, status: 'finished', winner, timeUp: true };
  }
  return winner === null ? state : { ...state, status: 'finished', winner };
}

// ============== المباراة: 10 جولات ==============
// كل جولة تنحسم بنفس القواعد، والفائز ياخذ نقطة. تبدأ الجولة الجاية تلقائي.
// المباراة تخلص بعد 10 جولات، أو أول ما يصير الفرق أكبر من الجولات الباقية.
export const MATCH_ROUNDS = 10;
export const newMatch = () => ({ total: MATCH_ROUNDS, round: 1, score: { 1: 0, 2: 0 }, last: null, over: false });
// استراحة بين جولتين (الجولة خلصت والمباراة لا)
export const isRoundBreak = (s) => !!(s && s.mode === 'guess' && s.match && !s.match.over && s.status === 'finished');

export function scoreRound(s) {
  if (!s.match || s.status !== 'finished') return s;
  const m = s.match, w = s.winner;
  const score = { 1: m.score[1] + (w === 1 ? 1 : 0), 2: m.score[2] + (w === 2 ? 1 : 0) };
  const left = m.total - m.round;
  const over = left <= 0 || Math.abs(score[1] - score[2]) > left;
  const match = { ...m, score, last: w, over };
  if (!over) return { ...s, match };
  const mw = score[1] > score[2] ? 1 : score[2] > score[1] ? 2 : 0;
  // في نهاية المباراة winner = فائز المباراة (والجولة الأخيرة محفوظة في roundWinner)
  return { ...s, match: { ...match, winner: mw }, winner: mw, roundWinner: w };
}

// يحسم الجولة + يحسب نقطتها في المباراة
export function settleRound(state, timeUp = false) {
  const s = settleGuessDuel(state, timeUp);
  return s.status === 'finished' && state.status !== 'finished' ? scoreRound(s) : s;
}

const BREAK_SECONDS = 4;

export default function GuessDuel({ roomState, myRole, connected, onSubmitGuess, onResign, onTimeUp, onNextRound }) {
  const oppRole = myRole === 1 ? 2 : 1;
  const len = roomState.settings.len;
  const tries = LENGTHS[len].tries;
  const answer = roomState.answer;
  const myGuesses = roomState[`guesses_p${myRole}`] || [];
  const oppGuesses = roomState[`guesses_p${oppRole}`] || [];
  const oppName = roomState.players[oppRole]?.name || 'الخصم';

  const [current, setCurrent] = useState('');
  const [revealing, setRevealing] = useState(-1);
  const [winRow, setWinRow] = useState(-1);
  const [burst, setBurst] = useState(null);
  const [shakeRow, setShakeRow] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmUnknown, setConfirmUnknown] = useState('');
  const [confirmResign, setConfirmResign] = useState(false);
  const toastTimer = useRef(null);
  const resignTimer = useRef(null);
  const prevLen = useRef(myGuesses.length);
  const revealTimer = useRef(null);
  const guessesRef = useRef(myGuesses);
  guessesRef.current = myGuesses;
  const timeUpTried = useRef(0);
  const [nowTs, setNowTs] = useState(() => now());
  useEffect(() => {
    const iv = setInterval(() => setNowTs(now()), 250);
    return () => clearInterval(iv);
  }, []);
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

  // حركة قلب الصف لما ينضاف تخميني.
  // مهم: المؤقت محفوظ في ref ويعتمد على "عدد" التخمينات فقط — تأكيد السيرفر
  // يرجّع نسخة جديدة من نفس القائمة، وقبل كان يلغي المؤقت فتعلق اللعبة.
  useEffect(() => {
    const n = myGuesses.length;
    if (n > prevLen.current) {
      const idx = n - 1;
      setRevealing(idx);
      if (guessesRef.current[idx]) playReveal(guessesRef.current[idx].result, FLIP_MS);
      clearTimeout(revealTimer.current);
      revealTimer.current = setTimeout(() => {
        setRevealing(-1);
        const g = guessesRef.current[idx];
        if (g && g.result.every(r => r === 'correct')) {
          playWin(); setWinRow(idx); setBurst(PRAISE[idx] || 'حليتها!');
          setTimeout(() => setBurst(null), 1900);
        } else if (g && idx + 1 >= tries) playLose();
        else playAccept();
      }, FLIP_MS * len + 250);
    } else if (n < prevLen.current) {
      clearTimeout(revealTimer.current);
      setRevealing(-1);
    }
    prevLen.current = n;
  }, [myGuesses.length, len, flash, tries]);
  useEffect(() => () => clearTimeout(revealTimer.current), []);

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
    if (!KNOWN[len].has(word) && word !== normalizeGuess(answer) && confirmUnknown !== word) {
      setConfirmUnknown(word);
      setShakeRow(true); setTimeout(() => setShakeRow(false), 450);
      flash('مو في قاموسنا 🤔 — اضغط تأكيد مرة ثانية', 2200);
      return;
    }
    setCurrent('');
    setConfirmUnknown('');
    onSubmitGuess(word, evaluateGuess(word, answer));
  }, [busy, myDone, roomState.status, current, len, confirmUnknown, answer, onSubmitGuess, flash]);

  const bank = useMemo(() => bankFor(len, answer), [len, answer]);

  const typeKey = useCallback((k) => {
    if (myDone || roomState.status !== 'playing') return;
    if (k === 'ENTER') return submit();
    if (k === 'BACK') { setCurrent(c => [...c].slice(0, -1).join('')); return; }
    const ch = normalizeGuess(k);
    if (!LETTER_SET.has(ch)) return;
    if (bank && !bank.has(ch)) { flash('🔒 هذا الحرف مو في الكلمة'); return; }
    playKey();
    setCurrent(c => ([...c].length < len ? c + ch : c));
  }, [myDone, roomState.status, submit, len, bank]);

  usePhysicalKeys(roomState.status === 'playing' && !(roomState.settings?.custom && roomState.setter === myRole), typeKey);

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

  const total = duelDuration(roomState);
  const started = roomState.turnStartedAt || nowTs;
  const timeLeft = Math.max(0, total - (nowTs - started) / 1000);
  const urgent = timeLeft <= 30;
  const mm = Math.floor(timeLeft / 60), ss = Math.floor(timeLeft % 60);
  const clock = `${mm}:${String(ss).padStart(2, '0')}`;

  useEffect(() => {
    if (roomState.status !== 'playing' || timeLeft > 0 || !onTimeUp) return;
    const t = Date.now();
    if (t - timeUpTried.current < 1500) return;
    timeUpTried.current = t;
    onTimeUp();
  }, [timeLeft, roomState.status, onTimeUp]);

  const custom = !!roomState.settings?.custom;
  const iAmSetter = custom && roomState.setter === myRole;
  const rows = iAmSetter
    ? buildRows(oppGuesses, '', tries, false)
    : buildRows(myGuesses, current, tries, !myDone);
  const oppStatus = oppSolved ? <>حلّها من <Num>{oppSolved}</Num> ✓</>
    : oppGuesses.length >= tries ? 'خلصت محاولاته'
    : <>يخمّن… <Num>{oppGuesses.length}</Num> من <Num>{tries}</Num></>;

  return (
    <div className="app-fixed flex flex-col" style={{ color: '#fff', userSelect: 'none' }}>
      <ArcadeBg letters={false} />

      {/* العنوان */}
      <div className="shrink-0 flex items-center justify-between px-3 pt-2 pb-1">
        <button onClick={resign} aria-label="استسلام"
          className="h-10 rounded-full flex items-center justify-center gap-1 px-3 font-display font-black text-xs transition-all active:scale-90"
          style={{ background: confirmResign ? '#ff4d6d' : 'rgba(255,255,255,0.16)' }}>
          <Flag className="w-3.5 h-3.5" /> {confirmResign ? 'متأكد؟' : 'استسلام'}
        </button>
        <div className="flex items-center gap-1.5 font-display font-black rounded-full px-3 py-1 bg-white/15" style={{ fontSize: '0.85rem' }}>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-[#4ade80]' : 'bg-[#ff4d6d] animate-pulse'}`} />
          {roomState.match ? <>الجولة <Num>{roomState.match.round}</Num>/<Num>{roomState.match.total}</Num></> : 'تحدي · خمّن الكلمة'}
        </div>
        {roomState.match ? (
          <div className="h-10 flex items-center gap-1 rounded-full px-2.5 font-display font-black text-sm" style={{ background: 'rgba(255,255,255,0.16)' }} aria-label="النتيجة">
            <span style={{ color: PLAYER_COLORS[myRole] }}><Num>{roomState.match.score[myRole]}</Num></span>
            <span className="opacity-60">-</span>
            <span style={{ color: PLAYER_COLORS[oppRole] }}><Num>{roomState.match.score[oppRole]}</Num></span>
          </div>
        ) : <div style={{ width: 32 }} />}
      </div>

      {/* شريط الحالة: الاثنين يلعبون بنفس الوقت + الوقت المتبقي */}
      <div className="shrink-0 px-3 pt-1">
        <div className="slide-in rounded-2xl px-3 py-2 flex items-center gap-3"
          style={iAmSetter ? { background: 'var(--card)', color: 'var(--ink-2)', boxShadow: '0 5px 0 var(--edge)', border: '2px solid rgba(255,255,255,0.6)' } : myDone
            ? { background: 'var(--card)', color: 'var(--ink-2)', boxShadow: '0 5px 0 var(--edge)', border: '2px solid rgba(255,255,255,0.6)' }
            : urgent
              ? { background: '#ff4d6d', color: '#ffffff', boxShadow: '0 5px 0 #b3123a', border: '2px solid rgba(255,255,255,0.45)' }
              : { background: '#22c55e', color: '#ffffff', boxShadow: '0 5px 0 #15803d', border: '2px solid rgba(255,255,255,0.45)' }}>
          <div className="flex-1 min-w-0">
            <div className="font-display font-black text-[1.1rem] leading-tight truncate">
              {iAmSetter ? <>🎯 {oppName} يخمّن كلمتك</> : myDone ? (mySolved ? '✅ حليتها!' : '😅 خلصت محاولاتك') : urgent ? '⏰ بسرعة! الوقت يخلص' : custom ? <>🎯 خمّن كلمة {oppName}!</> : oppSolved ? '⚡ خصمك حلّها!' : '🎯 خمّن الكلمة!'}
            </div>
            <div className="font-display font-bold text-[0.75rem] opacity-90 truncate">
              {iAmSetter ? <>كلمتك: <b>{answer}</b> · باقي له <bdi>{Math.max(0, tries - oppGuesses.length)}</bdi> محاولات</>
                : custom ? 'هو اختار لك الكلمة — حلّها قبل ما يخلص الوقت!'
                : myDone ? <>بانتظار {oppName}<span className="dot-wave"><span>.</span><span>.</span><span>.</span></span></>
                : oppSolved ? <>{oppName} حلّها من <bdi>{oppSolved}</bdi> — باقي لك <bdi>{Math.max(0, oppSolved - myGuesses.length)}</bdi> للتعادل!</>
                : 'الاثنين يلعبون بنفس الوقت — ما فيه أدوار'}
            </div>
            <div className="h-2 mt-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.15)' }}>
              <div className="h-full rounded-full" style={{ width: `${(timeLeft / total) * 100}%`, background: myDone ? '#a78bfa' : 'rgba(255,255,255,0.95)', transition: 'width 0.25s linear' }} />
            </div>
          </div>
          <div className={`shrink-0 rounded-2xl px-2.5 py-1 text-center ${urgent && !myDone ? 'animate-pulse' : ''}`}
            style={{ background: myDone ? 'var(--soft)' : 'rgba(255,255,255,0.28)' }}>
            <div className="font-mono-ar font-black text-[1.45rem] leading-none"><bdi>{clock}</bdi></div>
            <div className="text-[0.6rem] font-black opacity-80">الوقت</div>
          </div>
        </div>
      </div>

      {/* تلميح اللي اختار الكلمة */}
      {custom && roomState.clue && (
        <div className="shrink-0 px-3 pt-3">
          <div className="slide-in rounded-2xl px-3 py-2 flex items-center gap-2 font-display font-black"
            style={{ background: '#fde047', color: '#713f12', boxShadow: '0 4px 0 #ca8a04' }}>
            <span className="text-lg">💡</span>
            <span className="text-[0.75rem] opacity-80 shrink-0">{iAmSetter ? 'تلميحك:' : `تلميح من ${oppName}:`}</span>
            <span className="truncate">{roomState.clue}</span>
          </div>
        </div>
      )}

      {/* تقدّم الخصم */}
      {!custom && <div className="shrink-0 px-3 pt-3">
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
      </div>}

      {/* لوحتي */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 relative">
        <GuessBoard rows={rows} len={len} revealing={iAmSetter ? -1 : revealing} shakeRow={shakeRow} compact winRow={iAmSetter ? -1 : winRow} />
        {burst && <WinBurst text={burst} />}
        {toast && (
          <div className="absolute top-1 left-1/2 -translate-x-1/2 slide-in font-display font-black rounded-full px-4 py-1.5 text-[var(--ink)] bg-[var(--card)] max-w-[calc(100%-24px)] text-center z-10"
            style={{ boxShadow: '0 4px 0 var(--edge)', fontSize: '0.9rem' }}>
            {toast}
          </div>
        )}
        {false && (
          <div className="mt-3 rounded-full bg-white/15 px-4 py-1.5 font-display font-bold text-sm slide-in">
            {mySolved ? 'حليتها! ' : 'خلصت محاولاتك — '}بانتظار {oppName}
            <span className="dot-wave"><span>.</span><span>.</span><span>.</span></span>
          </div>
        )}
      </div>

      {isRoundBreak(roomState) && (
        <RoundBreak roomState={roomState} myRole={myRole} oppName={oppName} onNextRound={onNextRound} />
      )}

      {iAmSetter ? (
        <div className="shrink-0 px-4 pb-4 pt-2 text-center font-display font-bold text-white/85 text-sm">
          👀 تتفرج على {oppName} وهو يخمّن… تشوف حروفه أول بأول
        </div>
      ) : (
        <GuessKeyboard keyStates={keyStates} onKey={typeKey} disabled={myDone} allowed={bank} />
      )}
    </div>
  );
}

// ============== بين الجولات ==============
// نتيجة الجولة + النتيجة الكلية + عدّاد، وبعدها تبدأ الجولة الجاية تلقائي.
function RoundBreak({ roomState, myRole, oppName, onNextRound }) {
  const m = roomState.match;
  const oppRole = myRole === 1 ? 2 : 1;
  const [left, setLeft] = useState(BREAK_SECONDS);
  const fired = useRef(false);
  useEffect(() => {
    const iv = setInterval(() => setLeft(l => l - 1), 1000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    if (left > 0 || fired.current || !onNextRound) return;
    fired.current = true;
    onNextRound();
  }, [left, onNextRound]);
  const w = m.last;
  const title = w === 0 ? '🤝 تعادل في هالجولة' : w === myRole ? '🏆 الجولة لك!' : 'الجولة لـ ' + oppName;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-[#1e0b4b]/60 fade-in">
      <div className="w-full max-w-sm rounded-3xl p-5 text-center slide-in" style={{ background: 'var(--card)', color: 'var(--ink)', boxShadow: '0 6px 0 var(--edge)' }}>
        <div className="font-display font-black text-2xl" style={{ color: w === myRole ? '#16a34a' : w === 0 ? 'var(--ink-2)' : PLAYER_COLORS[oppRole] }}>{title}</div>
        <div className="text-sm font-display font-bold mt-1" style={{ color: 'var(--muted-c)' }}>الكلمة كانت <b style={{ color: 'var(--ink)' }}>{roomState.answer}</b></div>
        <div className="flex items-center justify-center gap-5 my-4">
          <div>
            <div className="font-display font-black text-[2.6rem] leading-none" style={{ color: PLAYER_COLORS[myRole] }}><Num>{m.score[myRole]}</Num></div>
            <div className="text-xs font-display font-bold mt-1" style={{ color: 'var(--muted-c)' }}>أنت</div>
          </div>
          <div className="font-display font-black text-xl opacity-40">-</div>
          <div>
            <div className="font-display font-black text-[2.6rem] leading-none" style={{ color: PLAYER_COLORS[oppRole] }}><Num>{m.score[oppRole]}</Num></div>
            <div className="text-xs font-display font-bold mt-1 truncate max-w-[7rem]" style={{ color: 'var(--muted-c)' }}>{oppName}</div>
          </div>
        </div>
        <div className="rounded-2xl py-2 font-display font-black" style={{ background: 'var(--soft)', color: 'var(--ink-2)' }}>
          الجولة <Num>{m.round + 1}</Num> من <Num>{m.total}</Num> تبدأ بعد <Num>{Math.max(0, left)}</Num>…
        </div>
      </div>
    </div>
  );
}
