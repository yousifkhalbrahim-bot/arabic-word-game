'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Trophy, RotateCcw, Play, Plus, Check, X, Flag, Zap, Flame,
  Hourglass, BookOpen, Sparkles, Users, Copy, ArrowLeft, Wifi, WifiOff,
  Loader2, Smartphone, UserPlus, LogIn, Snowflake, Share2, Link2, Target, ChevronLeft,
} from 'lucide-react';
import {
  supabase, getRoom, saveRoom, deleteRoom, getMyRole, setMyRole, clearMyRole,
  roomJoin, roomLeave, roomCas, roomRematch, raceSubmit, raceSkip, raceFreeze, raceFinish, raceResign,
  isNewerState, getCurrentRoom, setCurrentRoom, getSavedName, saveName,
} from '@/lib/supabase';
import { NORMALIZED_DICT, normalize, normalizeStrict, lookupWord } from '@/lib/dictionary';
import { now, syncClock } from '@/lib/clock';
import { useVisualViewport } from '@/lib/useViewport';
import { demoRoom } from '@/lib/demo';
import { checkRaceWord, shuffledEndingQueue, endingAt, raceScore } from '@/lib/rules';
import SoloGame from '@/components/SoloGame';
import GuessGame from '@/components/GuessGame';
import {
  ArcadeBg, Screen, BackButton, Card, Title, Label, Btn, GhostBtn, Choice, ErrorNote, inputClass, LetterTiles,
  PLAYER_COLORS, PLAYER_DEEP, PLAYER_INK, PLAYER_ON,
} from '@/components/ui';
import { ChessTable, MatchSummary, ResultHeader, Confetti, Thinking } from '@/components/GameParts';
import { playAccept, playReject, playSkip, playTick, playGameOver, playWordAppear, playFreeze } from '@/lib/sounds';

// ============== الثوابت ==============
const TIME_CONTROLS = [
  { id: 'bullet', name: 'بوليت', icon: Zap, minutes: 1, desc: 'دقيقة' },
  { id: 'blitz', name: 'بليتز', icon: Flame, minutes: 5, desc: '٥ دقائق' },
  { id: 'rapid', name: 'رابيد', icon: Hourglass, minutes: 10, desc: '١٠ دقائق' },
];

const ENDING_PRESETS = [
  { value: 'ام', example: 'حمام، كلام' },
  { value: 'ان', example: 'زمان، مكان' },
  { value: 'ار', example: 'نهار، قطار' },
  { value: 'ال', example: 'جمال، خيال' },
  { value: 'ير', example: 'كبير، أمير' },
  { value: 'ون', example: 'قانون، عيون' },
  { value: 'ين', example: 'أمين، عين' },
  { value: 'وم', example: 'يوم، علوم' },
  { value: 'اب', example: 'كتاب، باب' },
  { value: 'اح', example: 'صباح، نجاح' },
  { value: 'يل', example: 'جميل، دليل' },
  { value: 'يد', example: 'جديد، سعيد' },
  { value: 'يم', example: 'كريم، تعليم' },
  { value: 'ود', example: 'موجود، حدود' },
  { value: 'اد', example: 'بلاد، اقتصاد' },
];

const TURN_SKIP_SECONDS = 10;

const generateRoomCode = () =>
  Math.floor(1000 + Math.random() * 9000).toString();


const createInitialState = (code, hostName, settings) => {
  const seconds = settings.timeControl.minutes * 60;
  return {
    code,
    status: 'waiting',
    players: {
      1: { name: hostName, joined: true },
      2: { name: '', joined: false },
    },
    settings: {
      timeControlId: settings.timeControl.id,
      initialSeconds: seconds,
      ending: settings.ending,
      turnSkipSeconds: settings.turnSkipSeconds ?? 10,
    },
    timeRemaining: { 1: seconds, 2: seconds },
    currentTurn: 1,
    turnStartedAt: Date.now(),
    pendingWord: null,
    usedWords: [],
    customDict: [],
    winner: null,
    gameNumber: 1,
  };
};

const generateEndingQueue = () => shuffledEndingQueue(ENDING_PRESETS.map(p => p.value));

const wordStr = (w) => (typeof w === 'string' ? w : w?.w ?? '');
const wordTs  = (w) => (typeof w === 'string' ? null : w?.ts ?? null);

const createRaceState = (code, hostName, settings) => ({
  code,
  mode: 'race',
  status: 'waiting',
  players: { 1: { name: hostName, joined: true }, 2: { name: '', joined: false } },
  settings: { duration: settings.duration },
  words_p1: [],
  words_p2: [],
  endingQueue: generateEndingQueue(),
  currentEndingIndex: 0,
  gameStartedAt: null,
  winner: null,
  gameNumber: 1,
  penalties: { 1: 0, 2: 0 },
  frozenUntil: { 1: null, 2: null },
});

function RoomInfo({ state }) {
  const isRace = state.mode === 'race';
  const rows = [
    ['المضيف', <span key="h" className="font-black" style={{ color: PLAYER_INK[1] }}>{state.players[1]?.name}</span>],
    ['نوع اللعبة', isRace ? '⚡ سباق الكلمات' : '⏱ ساعة الشطرنج'],
    ...(isRace
      ? [['المدة', <span key="d"><bdi className="font-mono-ar">{state.settings.duration}</bdi> ثانية</span>]]
      : [
          ['السرعة', TIME_CONTROLS.find(t => t.id === state.settings.timeControlId)?.name],
          ['وقت الدور', <span key="t"><bdi className="font-mono-ar">{state.settings.turnSkipSeconds ?? 10}</bdi> ثانية</span>],
          ['النهاية', <span key="e" className="font-black text-2xl leading-none text-[#7c3aed]">{state.settings.ending}</span>],
        ]),
  ];
  return (
    <div className="info-list rounded-2xl divide-y-2 divide-[#ede9fe] text-right">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between px-4 py-2.5 text-sm">
          <span className="text-muted">{k}</span>
          <span className="font-display font-bold text-parchment">{v}</span>
        </div>
      ))}
    </div>
  );
}

// ============== مكون سباق الكلمات ==============
const RACE_REASONS = {
  used: 'كلمة مستخدمة',
  frozen: 'أنت مجمّد',
  time_up: 'انتهى الوقت',
  not_playing: 'انتهت الجولة',
  no_points: 'نقاطك ما تكفي',
  opp_frozen: 'الخصم مجمّد أصلاً',
};

export function RaceGame({ roomState, setRoomState, applyServerState, myRole, roomCode }) {
  const apply = applyServerState || setRoomState;
  const [input, setInput] = useState('');
  const [displayNow, setDisplayNow] = useState(() => now());
  const [localFeedback, setLocalFeedback] = useState(null);
  const [floaters, setFloaters] = useState([]);
  const [confirmResign, setConfirmResign] = useState(false);

  const oppRole = myRole === 1 ? 2 : 1;
  const myWordKey = `words_p${myRole}`;
  const oppWordKey = `words_p${oppRole}`;

  const feedbackTimer = useRef(null);
  const confirmTimer = useRef(null);
  const lastTickRef = useRef(null);
  const inputRef = useRef(null);
  const finishTriedRef = useRef(0);
  // كل طلبات السيرفر تمشي بالترتيب حتى ما يسبق طلبٌ طلباً قبله
  const queueRef = useRef(Promise.resolve());

  const duration = roomState.settings?.duration ?? 60;
  const endingQueue = roomState.endingQueue || [];
  const currentEndingIndex = roomState.currentEndingIndex ?? 0;
  const currentEnding = endingAt(endingQueue, currentEndingIndex);
  const isPlaying = roomState.status === 'playing';

  const myName = roomState.players[myRole]?.name || '';
  const oppName = roomState.players[oppRole]?.name || 'الخصم';
  const myColor = PLAYER_COLORS[myRole];
  const oppColor = PLAYER_COLORS[oppRole];

  useEffect(() => {
    const iv = setInterval(() => setDisplayNow(now()), 100);
    return () => clearInterval(iv);
  }, []);

  const elapsed = (displayNow - roomState.gameStartedAt) / 1000;
  const timeLeft = Math.max(0, duration - elapsed);
  const timeColor = timeLeft <= 10 ? '#ff4d6d' : timeLeft <= 20 ? '#ffb020' : '#22c55e';

  const myFrozenUntil = roomState.frozenUntil?.[myRole] ?? null;
  const isFrozen = !!(myFrozenUntil && displayNow < myFrozenUntil);
  const freezeSecsLeft = isFrozen ? Math.ceil((myFrozenUntil - displayNow) / 1000) : 0;
  const oppFrozenUntil = roomState.frozenUntil?.[oppRole] ?? null;
  const isOppFrozen = !!(oppFrozenUntil && displayNow < oppFrozenUntil);

  useEffect(() => {
    const secs = Math.ceil(timeLeft);
    if (secs <= 5 && secs > 0 && secs !== lastTickRef.current && isPlaying) {
      lastTickRef.current = secs;
      playTick();
    }
    if (secs > 5) lastTickRef.current = null;
  }, [timeLeft, isPlaying]);

  // انتهاء الوقت: السيرفر هو اللي يحدد الفائز (نعيد المحاولة كل ٧٠٠ms لين ينجح)
  useEffect(() => {
    if (timeLeft > 0 || !isPlaying) return;
    const t = Date.now();
    if (t - finishTriedRef.current < 700) return;
    if (finishTriedRef.current === 0) playGameOver();
    finishTriedRef.current = t;
    raceFinish(roomCode).then(r => r?.state && apply(r.state)).catch(console.error);
  }, [timeLeft, isPlaying, roomCode, apply]);

  const showFeedback = useCallback((ok, text) => {
    clearTimeout(feedbackTimer.current);
    setLocalFeedback({ ok, text });
    feedbackTimer.current = setTimeout(() => setLocalFeedback(null), ok ? 700 : 1400);
  }, []);

  // ينفّذ طلب سيرفر بالترتيب، يطبّق الحالة الحقيقية، ويعرض سبب الرفض
  const runServer = useCallback((call) => {
    queueRef.current = queueRef.current
      .then(call)
      .then(r => {
        if (r?.state) apply(r.state);
        if (r && !r.ok) {
          playReject();
          showFeedback(false, r.reason === 'stale' ? `سبقك ${oppName}! ⚡` : (RACE_REASONS[r.reason] || 'تعذر التنفيذ'));
        }
      })
      .catch(async (e) => {
        console.error(e);
        showFeedback(false, 'مشكلة اتصال — حاول مرة ثانية');
        try { const s = await getRoom(roomCode); if (s) apply(s); } catch {}
      });
  }, [apply, showFeedback, oppName, roomCode]);

  const submitWord = useCallback(() => {
    if (timeLeft <= 0 || isFrozen || !isPlaying) return;
    const word = input.trim();
    if (!word) return;

    const used = [...(roomState.words_p1 || []), ...(roomState.words_p2 || [])].map(wordStr);
    const check = checkRaceWord(word, currentEnding, used);
    if (!check.ok) { playReject(); showFeedback(false, check.error); return; }

    playAccept();
    setInput('');
    showFeedback(true, '✓ ' + check.word);

    // عرض فوري (متفائل) — السيرفر يأكّد أو يصحّح
    const idx = currentEndingIndex;
    const entry = { w: check.word, ts: now(), ending: currentEnding };
    setRoomState(prev => ({
      ...prev,
      [myWordKey]: [...(prev[myWordKey] || []), entry],
      currentEndingIndex: idx + 1,
    }));
    runServer(() => raceSubmit(roomCode, myRole, check.word, idx));
  }, [input, timeLeft, isFrozen, isPlaying, roomState, myWordKey, currentEnding, currentEndingIndex, setRoomState, runServer, roomCode, myRole, showFeedback]);

  const handleResign = useCallback(() => {
    if (!confirmResign) {
      setConfirmResign(true);
      clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmResign(false), 2500);
      return;
    }
    clearTimeout(confirmTimer.current);
    setConfirmResign(false);
    runServer(() => raceResign(roomCode, myRole));
  }, [confirmResign, runServer, roomCode, myRole]);

  const handleKey = useCallback((e) => { if (e.key === 'Enter') submitWord(); }, [submitWord]);
  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);
  useEffect(() => () => { clearTimeout(feedbackTimer.current); clearTimeout(confirmTimer.current); }, []);

  const lastAnswerTsRef = useRef(undefined);

  const myWords = roomState[myWordKey] || [];
  const oppWords = roomState[oppWordKey] || [];
  const myScore = myWords.length;
  const oppScore = oppWords.length;
  const myDisplayScore = raceScore(roomState, myRole);
  const oppDisplayScore = raceScore(roomState, oppRole);
  const prevMyScoreRef = useRef(myScore);
  const prevOppScoreRef = useRef(oppScore);

  useEffect(() => {
    if (myScore > prevMyScoreRef.current) {
      const id = Date.now() + Math.random();
      setFloaters(f => [...f, { id, side: 'mine' }]);
      setTimeout(() => setFloaters(f => f.filter(x => x.id !== id)), 950);
    }
    prevMyScoreRef.current = myScore;
  }, [myScore]);

  useEffect(() => {
    if (oppScore > prevOppScoreRef.current) {
      const id = Date.now() + Math.random();
      setFloaters(f => [...f, { id, side: 'opp' }]);
      setTimeout(() => setFloaters(f => f.filter(x => x.id !== id)), 950);
    }
    prevOppScoreRef.current = oppScore;
  }, [oppScore]);

  const wasFrozenRef = useRef(false);
  useEffect(() => {
    if (isFrozen && !wasFrozenRef.current) {
      wasFrozenRef.current = true;
      playFreeze();
    }
    if (!isFrozen) wasFrozenRef.current = false;
  }, [isFrozen]);

  const handleFreeze = useCallback(() => {
    if (myDisplayScore < 3 || isOppFrozen || isFrozen || timeLeft <= 0) return;
    setRoomState(prev => ({
      ...prev,
      frozenUntil: { ...(prev.frozenUntil || {}), [oppRole]: now() + 5000 },
      penalties: { ...(prev.penalties || {}), [myRole]: (prev.penalties?.[myRole] ?? 0) + 3 },
    }));
    playFreeze();
    runServer(() => raceFreeze(roomCode, myRole));
  }, [myDisplayScore, isOppFrozen, isFrozen, timeLeft, oppRole, myRole, setRoomState, runServer, roomCode]);

  const handleSkip = useCallback(() => {
    if (myDisplayScore < 1 || timeLeft <= 0 || isFrozen) return;
    const idx = currentEndingIndex;
    setRoomState(prev => ({
      ...prev,
      currentEndingIndex: idx + 1,
      penalties: { ...(prev.penalties || {}), [myRole]: (prev.penalties?.[myRole] ?? 0) + 1 },
    }));
    playSkip();
    runServer(() => raceSkip(roomCode, myRole, idx));
  }, [myDisplayScore, timeLeft, isFrozen, currentEndingIndex, myRole, setRoomState, runServer, roomCode]);

  const recentAnswers = useMemo(() => {
    const my  = myWords.map(w  => ({ word: wordStr(w), ts: wordTs(w), ending: w?.ending ?? '', color: myColor,  name: myName }));
    const opp = oppWords.map(w => ({ word: wordStr(w), ts: wordTs(w), ending: w?.ending ?? '', color: oppColor, name: oppName }));
    return [...my, ...opp].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 8);
  }, [myWords, oppWords, myColor, oppColor, myName, oppName]);

  const mins = Math.floor(timeLeft / 60);
  const secs = Math.floor(timeLeft % 60);
  const timerDisplay = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const timerR = 28;
  const timerCirc = 2 * Math.PI * timerR;
  const timerOffset = timerCirc * (1 - Math.min(1, timeLeft / duration));

  const lastAnswer = recentAnswers[0] ?? null;

  useEffect(() => {
    if (lastAnswerTsRef.current === undefined) {
      lastAnswerTsRef.current = lastAnswer?.ts ?? null;
      return;
    }
    if (lastAnswer?.ts && lastAnswer.ts !== lastAnswerTsRef.current) {
      lastAnswerTsRef.current = lastAnswer.ts;
      playWordAppear();
    }
  }, [lastAnswer?.ts]);

  const myDeep = PLAYER_DEEP[myRole], oppDeep = PLAYER_DEEP[oppRole];
  const myOn = PLAYER_ON[myRole], oppOn = PLAYER_ON[oppRole];

  const scorePanel = (side) => {
    const mine = side === 'mine';
    const color = mine ? myColor : oppColor, deep = mine ? myDeep : oppDeep, on = mine ? myOn : oppOn;
    const score = mine ? myDisplayScore : oppDisplayScore;
    const name = mine ? myName : oppName;
    const frozen = mine ? isFrozen : isOppFrozen;
    return (
      <div className="flex-1 min-w-0 rounded-2xl px-2.5 py-1.5 text-center relative"
        style={{ background: frozen ? '#7dd3fc' : color, boxShadow: `0 5px 0 ${frozen ? '#0369a1' : deep}`, border: '2px solid rgba(255,255,255,0.4)' }}>
        <div className="font-display font-black truncate" style={{ fontSize: '0.85rem', color: frozen ? '#0c4a6e' : on }}>
          {frozen && '❄ '}{name}
        </div>
        <div className="relative inline-block">
          <div key={`${side}-${score}`} className="score-bump font-display font-black text-white" style={{ fontSize: '1.9rem', lineHeight: 1.05, textShadow: `0 3px 0 ${frozen ? '#0369a1' : deep}` }}>
            <bdi>{score}</bdi>
          </div>
          {floaters.filter(f => f.side === side).map(f => (
            <div key={f.id} className="float-plus font-display font-black text-white" style={{ fontSize: '0.9rem' }}>+1</div>
          ))}
        </div>
      </div>
    );
  };

  const wordColumn = (side) => {
    const mine = side === 'mine';
    const words = mine ? myWords : oppWords;
    const color = mine ? myColor : oppColor, deep = mine ? myDeep : oppDeep, on = mine ? myOn : oppOn;
    return (
      <div className="glass flex flex-col rounded-2xl overflow-hidden" style={{ width: '27%' }}>
        <div className="shrink-0 py-1.5 px-1 text-center font-display font-black truncate" style={{ fontSize: '0.72rem', color: '#fff', background: 'rgba(255,255,255,0.12)' }}>
          {mine ? 'كلماتك' : `كلمات ${oppName}`}
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar p-1.5 space-y-1.5">
          {[...words].reverse().map((w, i) => (
            <div key={`${wordStr(w)}-${words.length - i}`}
              className={`rounded-xl px-2 py-1 text-center ${i === 0 ? 'word-pop' : ''}`}
              style={i === 0
                ? { background: color, color: on, boxShadow: `0 3px 0 ${deep}` }
                : { background: 'rgba(255,255,255,0.9)', color: '#3b1d6e' }}>
              <div className="font-display font-black truncate" style={{ fontSize: i === 0 ? '0.98rem' : '0.86rem' }}>{wordStr(w)}</div>
            </div>
          ))}
          {!words.length && <div className="text-center text-white/45 font-display text-[0.7rem] pt-2">لا شيء بعد</div>}
        </div>
      </div>
    );
  };

  return (
    <div className="app-fixed flex flex-col" style={{ color: '#fff', userSelect: 'none' }}>
      <ArcadeBg letters={false} />

      {/* ===== شريط العنوان ===== */}
      <div className="shrink-0 flex items-center justify-between px-3 pt-1.5 pb-1">
        <button onClick={handleResign} aria-label="استسلام"
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ background: confirmResign ? '#ff4d6d' : 'rgba(255,255,255,0.16)' }}>
          <ArrowLeft className="w-4 h-4 text-white" strokeWidth={2.8} />
        </button>
        <div className="flex items-center gap-1.5 font-display font-black rounded-full px-3 py-1 bg-white/15" style={{ fontSize: '0.85rem' }}>
          <Zap className="w-4 h-4 text-[#ffb020]" fill="#ffb020" />
          <span>سباق الكلمات</span>
        </div>
        <div style={{ width: 32 }} />
      </div>

      {/* ===== النقاط + المؤقت ===== */}
      <div className="shrink-0 px-3 pb-2 pt-1">
        <div className="flex items-center gap-2.5">
          {scorePanel('mine')}
          <div className="race-timer shrink-0 relative rounded-full bg-white" style={{ width: 72, height: 72, boxShadow: '0 5px 0 #c4b5fd' }}>
            <svg width="72" height="72" className="absolute inset-0" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="36" cy="36" r={timerR} fill="none" stroke="#ede9fe" strokeWidth="6" />
              <circle cx="36" cy="36" r={timerR} fill="none" stroke={timeColor} strokeWidth="6"
                strokeDasharray={timerCirc} strokeDashoffset={timerOffset} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-mono-ar font-black" style={{ fontSize: '1rem', color: '#3b1d6e', lineHeight: 1 }}>{timerDisplay}</span>
            </div>
          </div>
          {scorePanel('opp')}
        </div>
      </div>

      {/* ===== المنطقة الرئيسية: ٣ أعمدة ===== */}
      <div className="flex-1 flex gap-2 px-3 pt-1 pb-2 min-h-0 overflow-hidden">

        {wordColumn('mine')}

        {/* العمود الأوسط — السؤال + الإجابة */}
        <div className="flex-1 flex flex-col items-center min-h-0 gap-2">

          {/* السؤال */}
          <div className="wood-card shrink-0 w-full text-center rounded-2xl px-2 pt-2 pb-3">
            <div className="kb-hide inline-block font-display font-black rounded-full px-2.5 py-0.5 mb-1.5"
              style={{ fontSize: '0.65rem', background: '#ede9fe', color: '#6d28d9' }}>
              السؤال <bdi>{currentEndingIndex + 1}</bdi>
            </div>
            <div className="kb-hide font-display font-bold text-muted mb-2" style={{ fontSize: '0.75rem' }}>اكتب كلمة تنتهي بـ</div>
            <LetterTiles key={`q-${currentEndingIndex}`} text={currentEnding} size={42} />
          </div>

          {/* تجميد الخصم */}
          <button onClick={handleFreeze}
            disabled={myDisplayScore < 3 || isOppFrozen || isFrozen || timeLeft <= 0}
            className="btn-3d shrink-0 w-full flex items-center justify-between gap-1 rounded-xl px-2.5 py-1.5 font-display font-black"
            style={{ background: '#38bdf8', color: '#fff', boxShadow: '0 4px 0 #0369a1', border: '2px solid #7dd3fc', fontSize: '0.75rem' }}>
            <span className="flex items-center gap-1.5">
              <Snowflake className="w-3.5 h-3.5 shrink-0" strokeWidth={3} style={isOppFrozen ? { animation: 'spin-slow 3s linear infinite' } : undefined} />
              {isOppFrozen
                ? <>مجمّد <bdi>{Math.ceil(((roomState.frozenUntil?.[oppRole] ?? 0) - displayNow) / 1000)}</bdi>ث</>
                : 'تجميد'}
            </span>
            <span className="shrink-0 rounded-full bg-white/25 px-1.5" style={{ fontSize: '0.68rem' }}>💎 3</span>
          </button>

          {/* تجاوز السؤال */}
          <button onClick={handleSkip}
            disabled={myDisplayScore < 1 || timeLeft <= 0 || isFrozen}
            className="btn-3d shrink-0 w-full flex items-center justify-between gap-1 rounded-xl px-2.5 py-1.5 font-display font-black"
            style={{ background: '#fff', color: '#5b21b6', boxShadow: '0 4px 0 #c4b5fd', border: '2px solid #ede9fe', fontSize: '0.75rem' }}>
            <span>تجاوز السؤال</span>
            <span className="shrink-0 rounded-full bg-[#ede9fe] px-1.5" style={{ fontSize: '0.68rem' }}>💎 1</span>
          </button>

          {/* الكلمة الأخيرة */}
          <div className="flex-1 flex flex-col items-center justify-center min-h-0 w-full">
            {lastAnswer ? (
              <>
                <div key={lastAnswer.ts} className="center-word-burst font-display font-black text-center text-white"
                  style={{ fontSize: 'clamp(1.8rem, 9vw, 2.7rem)', lineHeight: 1.15, textShadow: `0 4px 0 ${lastAnswer.color === myColor ? myDeep : oppDeep}` }}>
                  {lastAnswer.word}
                </div>
                <div className="font-display font-black mt-1.5 rounded-full px-2.5 py-0.5"
                  style={{ fontSize: '0.72rem', background: lastAnswer.color, color: lastAnswer.color === myColor ? myOn : oppOn }}>
                  +1 · {lastAnswer.name}
                </div>
              </>
            ) : (
              <div className="font-display font-bold text-center text-white/55" style={{ fontSize: '0.85rem' }}>
                اكتب أول كلمة 🏁
              </div>
            )}
          </div>
        </div>

        {wordColumn('opp')}
      </div>

      {/* ===== الإدخال ===== */}
      <div className="shrink-0 px-3 pb-2 pt-1">
        <div className="h-7 flex items-center justify-center">
          {localFeedback && (
            <div className="slide-in font-display font-black rounded-full px-3 py-0.5 text-white"
              style={{ fontSize: '0.85rem', background: localFeedback.ok ? '#22c55e' : '#ff4d6d', boxShadow: `0 3px 0 ${localFeedback.ok ? '#15803d' : '#b3123a'}` }}>
              {localFeedback.text}
            </div>
          )}
        </div>
        <div className="flex items-stretch gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={isFrozen ? `❄ مجمّد ${freezeSecsLeft}ث` : 'اكتب كلمة...'}
            disabled={timeLeft <= 0 || isFrozen}
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="off"
            className="flex-1 min-w-0 rounded-2xl px-4 py-3 font-display font-bold text-lg focus:outline-none"
            style={{
              direction: 'rtl',
              background: isFrozen ? '#e0f2fe' : '#fff',
              color: '#2e1065',
              border: `3px solid ${isFrozen ? '#7dd3fc' : '#ede9fe'}`,
              boxShadow: `0 5px 0 ${isFrozen ? '#38bdf8' : '#c4b5fd'}`,
            }}
          />
          <button onClick={submitWord} disabled={!input.trim() || timeLeft <= 0 || isFrozen} aria-label="إرسال"
            className="btn-3d shrink-0 w-14 rounded-2xl flex items-center justify-center"
            style={{ background: isFrozen ? '#38bdf8' : '#22c55e', color: '#fff', boxShadow: `0 5px 0 ${isFrozen ? '#0369a1' : '#15803d'}`, border: `2px solid ${isFrozen ? '#7dd3fc' : '#4ade80'}` }}>
            {isFrozen
              ? <Snowflake className="w-6 h-6" strokeWidth={3} style={{ animation: 'spin-slow 3s linear infinite' }} />
              : <Check className="w-7 h-7" strokeWidth={3.2} />}
          </button>
        </div>

        <button onClick={handleResign}
          className="kb-hide w-full mt-3 font-display font-bold flex items-center justify-center gap-1.5 py-1 transition-all active:scale-95"
          style={{ fontSize: '0.8rem', color: confirmResign ? '#fff' : 'rgba(255,255,255,0.6)' }}>
          <Flag className="w-3.5 h-3.5" /> {confirmResign ? 'اضغط مرة ثانية للتأكيد' : 'استسلام'}
        </button>
      </div>
    </div>
  );
}

// ============== المكون الرئيسي ==============
const screenForStatus = (status) =>
  status === 'waiting' ? 'waiting' : status === 'finished' ? 'gameover' : 'playing';

function setRoomInUrl(code) {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (code) url.searchParams.set('room', code);
    else url.searchParams.delete('room');
    window.history.replaceState(null, '', url.toString());
  } catch {}
}

export default function Game() {
  useVisualViewport();
  const [screen, setScreen] = useState('menu');
  const [booting, setBooting] = useState(true);
  const [myRole, setMyRoleState] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [roomState, setRoomState] = useState(null);
  const [connected, setConnected] = useState(true);
  const [busy, setBusy] = useState(false);
  const [globalError, setGlobalError] = useState(null);

  // إعدادات الإنشاء
  const [hostName, setHostName] = useState('');
  const [selectedMode, setSelectedMode] = useState('chess');
  const [selectedTime, setSelectedTime] = useState(TIME_CONTROLS[1]);
  const [selectedTurnSkip, setSelectedTurnSkip] = useState(10);
  const [selectedRaceDuration, setSelectedRaceDuration] = useState(60);
  const [selectedEnding, setSelectedEnding] = useState('ام');
  const [customEnding, setCustomEnding] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  // الانضمام
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinPreview, setJoinPreview] = useState(null);

  // أثناء اللعب
  const [currentInput, setCurrentInput] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [displayNow, setDisplayNow] = useState(() => now());
  const inputRef = useRef(null);
  const winSubmittedRef = useRef(false);
  const prevWordsLenRef = useRef(0);
  const prevTurnStartedRef = useRef(null);
  const prevTurnRef = useRef(null);
  const prevStatusRef = useRef(null);
  const prevPendingRef = useRef(null);
  const lastTickRef = useRef(null);

  // يطبّق حالة من السيرفر فقط إذا كانت أحدث من الموجودة (يتجاهل التحديثات المتأخرة)
  const applyServerState = useCallback((next) => {
    if (!next) return;
    setRoomState(prev => (isNewerState(prev, next) ? next : prev));
  }, []);

  const enterRoom = useCallback((code, role, state) => {
    setMyRole(code, role);
    setCurrentRoom(code);
    setRoomInUrl(code);
    setRoomCode(code);
    setMyRoleState(role);
    setRoomState(state);
    setGlobalError(null);
    setScreen(screenForStatus(state.status));
  }, []);

  // ============== الإقلاع: مزامنة الساعة + العودة للغرفة / رابط الدعوة ==============
  useEffect(() => {
    syncClock();
    const savedName = getSavedName();
    if (savedName) { setHostName(savedName); setJoinName(savedName); }

    // وضع المعاينة (للتطوير فقط): ?demo=waiting | chess | pending | over-race ...
    if (process.env.NODE_ENV !== 'production') {
      const demo = demoRoom(new URLSearchParams(window.location.search).get('demo'));
      if (demo) {
        setRoomCode('DEMO');
        setMyRoleState(1);
        setRoomState(demo.state);
        setScreen(demo.screen);
        setBooting(false);
        return;
      }
    }

    let urlCode = '';
    try { urlCode = (new URLSearchParams(window.location.search).get('room') || '').replace(/\D/g, '').slice(0, 4); } catch {}
    const code = urlCode || getCurrentRoom();
    if (!code) { setBooting(false); return; }

    (async () => {
      try {
        const state = await getRoom(code);
        if (!state) {
          setCurrentRoom(null);
          setRoomInUrl(null);
          if (urlCode) { setScreen('join-setup'); setJoinCode(urlCode); setGlobalError('ما لقينا غرفة بهذا الكود'); }
          return;
        }
        const role = getMyRole(code);
        if (role && !state.players[role]?.left) {
          enterRoom(code, role, state);
          return;
        }
        if (urlCode) {
          setJoinCode(urlCode);
          setScreen('join-setup');
          if (state.players[2]?.joined) setGlobalError('الغرفة ممتلئة');
          else setJoinPreview(state);
        } else {
          setCurrentRoom(null);
        }
      } catch (e) {
        console.error('[resume]', e);
      } finally {
        setBooting(false);
      }
    })();
  }, [enterRoom]);

  // ============== الاشتراك بـ Realtime ==============
  useEffect(() => {
    if (!roomCode || roomCode === 'local' || roomCode === 'DEMO') return;

    let active = true;

    const refresh = async () => {
      try {
        const state = await getRoom(roomCode);
        if (active && state) { applyServerState(state); setConnected(true); }
      } catch (e) {
        console.error('[refresh]', e);
        if (active) setConnected(false);
      }
    };
    refresh();

    const channel = supabase
      .channel(`room-${roomCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` },
        (payload) => {
          if (!active) return;
          const newState = payload.new?.state;
          if (newState) { applyServerState(newState); setConnected(true); }
        }
      )
      .subscribe((status) => {
        if (!active) return;
        setConnected(status === 'SUBSCRIBED');
        // بعد إعادة الاتصال نجيب آخر حالة (ممكن فاتتنا تحديثات)
        if (status === 'SUBSCRIBED') refresh();
      });

    // الجوال يوقف الاتصال لما التطبيق بالخلفية — نحدّث عند الرجوع
    const onWake = () => {
      if (document.visibilityState === 'visible') { syncClock(); refresh(); }
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('online', onWake);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('online', onWake);
      supabase.removeChannel(channel);
    };
  }, [roomCode, applyServerState]);

  // ============== انتقال الشاشات ==============
  useEffect(() => {
    if (!roomState) return;
    if (roomState.status === 'playing' && (screen === 'waiting')) {
      setScreen('playing');
    } else if (roomState.status === 'finished' && (screen === 'playing' || screen === 'waiting')) {
      setScreen('gameover');
    } else if (roomState.status === 'playing' && screen === 'gameover') {
      const opp = myRole === 1 ? 2 : 1;
      if (roomState.players[opp]?.left) return;
      setCurrentInput('');
      setFeedback(null);
      winSubmittedRef.current = false;
      setScreen('playing');
    }
  }, [roomState, screen, myRole]);

  // ============== مؤقت العرض ==============
  useEffect(() => {
    if (screen !== 'playing') return;
    const interval = setInterval(() => setDisplayNow(now()), 100);
    return () => clearInterval(interval);
  }, [screen]);

  // ============== كتابة مشروطة لساعة الشطرنج ==============
  // تعرض التغيير فوراً، والسيرفر يرفضه إذا تغيّرت الغرفة في نفس اللحظة
  const commitChess = useCallback(async (base, next, stamp = null) => {
    setRoomState(next);
    try {
      const r = await roomCas(roomCode, base.version ?? 0, next, stamp);
      if (r?.state) applyServerState(r.state);
      return r;
    } catch (e) {
      console.error('[commit]', e);
      setConnected(false);
      try { const s = await getRoom(roomCode); if (s) applyServerState(s); } catch {}
      return null;
    }
  }, [roomCode, applyServerState]);

  // ============== كشف انتهاء الوقت ==============
  useEffect(() => {
    if (screen !== 'playing' || !roomState || roomState.mode === 'race' || roomState.status !== 'playing') return;
    if (roomCode === 'DEMO') return;
    if (roomState.pendingWord || roomState.winner || winSubmittedRef.current) return;
    // اللاعب الحالي يكتب أولاً؛ إذا جواله نايم، الخصم يتولى بعد ثانيتين.
    // الكتابة المشروطة تمنع أي تكرار لو كتب الاثنان.
    const grace = roomState.currentTurn === myRole ? 0 : 2;

    const elapsed = (displayNow - roomState.turnStartedAt) / 1000;
    const current = roomState.currentTurn;
    const remaining = roomState.timeRemaining[current] - elapsed;

    if (remaining <= -grace) {
      winSubmittedRef.current = true;
      commitChess(roomState, {
        ...roomState,
        status: 'finished',
        winner: current === 1 ? 2 : 1,
        timeRemaining: { ...roomState.timeRemaining, [current]: 0 },
      });
    } else if (remaining > 0 && elapsed >= (roomState.settings?.turnSkipSeconds ?? TURN_SKIP_SECONDS) + grace) {
      winSubmittedRef.current = true;
      commitChess(roomState, {
        ...roomState,
        timeRemaining: { ...roomState.timeRemaining, [current]: Math.max(0, remaining) },
        currentTurn: current === 1 ? 2 : 1,
        turnStartedAt: now(),
      }, 'turnStartedAt');
    }
  }, [displayNow, roomState, screen, myRole, commitChess, roomCode]);

  // إعادة تعيين عند تغيير الدور
  useEffect(() => {
    winSubmittedRef.current = false;
  }, [roomState?.turnStartedAt, roomState?.version]);

  // ============== الأصوات ==============
  useEffect(() => {
    if (!roomState) return;
    if (roomState.mode === 'race') return;
    const newLen = (roomState.usedWords || []).length;
    const prevTs = prevTurnStartedRef.current;

    if (prevTs !== null && roomState.turnStartedAt !== prevTs) {
      if (newLen > prevWordsLenRef.current) {
        playAccept();
      } else if (roomState.currentTurn !== prevTurnRef.current) {
        playSkip();
      }
    }
    if (prevPendingRef.current && !roomState.pendingWord && newLen === prevWordsLenRef.current) {
      playReject();
    }
    if (roomState.status === 'finished' && prevStatusRef.current !== 'finished') {
      playGameOver();
    }

    prevWordsLenRef.current = newLen;
    prevTurnStartedRef.current = roomState.turnStartedAt;
    prevTurnRef.current = roomState.currentTurn;
    prevStatusRef.current = roomState.status;
    prevPendingRef.current = roomState.pendingWord;
  }, [roomState]);

  const turnSkipSecs = roomState?.settings?.turnSkipSeconds ?? TURN_SKIP_SECONDS;

  const turnTimeLeft = useMemo(() => {
    if (!roomState || roomState.mode === 'race' || roomState.status !== 'playing' || roomState.pendingWord) return turnSkipSecs;
    const elapsed = (displayNow - roomState.turnStartedAt) / 1000;
    return Math.max(0, turnSkipSecs - elapsed);
  }, [roomState, displayNow, turnSkipSecs]);

  // نقرات العد التنازلي
  useEffect(() => {
    if (!roomState || roomState.mode === 'race' || roomState.status !== 'playing' || roomState.pendingWord) {
      lastTickRef.current = null;
      return;
    }
    const secs = Math.ceil(turnTimeLeft);
    if (secs <= 3 && secs > 0 && secs !== lastTickRef.current) {
      lastTickRef.current = secs;
      playTick();
    }
    if (secs > 3) lastTickRef.current = null;
  }, [turnTimeLeft, roomState]);

  // التركيز على الإدخال
  useEffect(() => {
    if (screen === 'playing' && roomState?.currentTurn === myRole && !roomState?.pendingWord) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [screen, roomState?.currentTurn, roomState?.pendingWord, myRole]);

  // ============== الإجراءات ==============
  const createRoom = useCallback(async () => {
    if (!hostName.trim()) { setGlobalError('اكتب اسمك أولاً'); return; }
    const finalEnding = useCustom ? customEnding.trim() : selectedEnding;
    if (selectedMode !== 'race' && !finalEnding) { setGlobalError('اختر نهاية الكلمات'); return; }

    setBusy(true);
    setGlobalError(null);

    try {
      let code, exists;
      let tries = 0;
      do {
        code = generateRoomCode();
        exists = await getRoom(code);
        tries++;
      } while (exists && tries < 10);

      const state = selectedMode === 'race'
        ? createRaceState(code, hostName.trim(), { duration: selectedRaceDuration })
        : createInitialState(code, hostName.trim(), { timeControl: selectedTime, ending: finalEnding, turnSkipSeconds: selectedTurnSkip });

      await saveRoom(code, state);
      saveName(hostName.trim());
      enterRoom(code, 1, state);
    } catch (e) {
      console.error('[createRoom]', e);
      setGlobalError(`تعذر إنشاء الغرفة: ${e?.message || 'خطأ غير معروف'}`);
    } finally {
      setBusy(false);
    }
  }, [hostName, useCustom, customEnding, selectedEnding, selectedTime, selectedTurnSkip, selectedMode, selectedRaceDuration, enterRoom]);

  const checkJoinCode = useCallback(async () => {
    if (joinCode.length !== 4) { setGlobalError('الكود لازم يكون ٤ أرقام'); return; }
    setBusy(true);
    setGlobalError(null);
    try {
      const state = await getRoom(joinCode);
      if (!state) { setGlobalError('ما لقينا غرفة بهذا الكود'); return; }
      const stored = getMyRole(joinCode);
      if (stored && !state.players[stored]?.left) { enterRoom(joinCode, stored, state); return; }
      if (state.players[2]?.joined) { setGlobalError('الغرفة ممتلئة'); return; }
      setJoinPreview(state);
    } catch (e) {
      console.error('[checkJoinCode]', e);
      setGlobalError(`خطأ: ${e?.message || 'تعذر الوصول للغرفة'}`);
    } finally {
      setBusy(false);
    }
  }, [joinCode, enterRoom]);

  const confirmJoin = useCallback(async () => {
    if (!joinName.trim()) { setGlobalError('اكتب اسمك'); return; }
    setBusy(true);
    setGlobalError(null);
    try {
      const r = await roomJoin(joinCode, joinName.trim());
      if (!r?.ok) {
        setGlobalError(r?.reason === 'full' ? 'الغرفة ممتلئة' : 'الغرفة لم تعد متاحة');
        return;
      }
      saveName(joinName.trim());
      enterRoom(joinCode, 2, r.state);
    } catch (e) {
      console.error('[confirmJoin]', e);
      setGlobalError(`خطأ: ${e?.message || 'تعذر الانضمام'}`);
    } finally {
      setBusy(false);
    }
  }, [joinCode, joinName, enterRoom]);

  const submitWord = useCallback(async () => {
    if (!roomState || roomState.currentTurn !== myRole || roomState.pendingWord) return;
    const word = currentInput.trim();
    if (!word) return;

    const normalized = normalize(word);
    const normalizedEnding = normalize(roomState.settings.ending);

    if (!normalized.endsWith(normalizedEnding)) {
      playReject();
      setFeedback({ type: 'error', text: `يجب أن تنتهي بـ "${roomState.settings.ending}"` });
      return;
    }
    if (normalized.length < 2) {
      playReject();
      setFeedback({ type: 'error', text: 'الكلمة قصيرة جداً' });
      return;
    }
    if (roomState.usedWords.some(w => normalizeStrict(w.word) === normalizeStrict(word))) {
      playReject();
      setFeedback({ type: 'error', text: 'استُخدمت من قبل' });
      return;
    }

    let canonicalWord = word;
    let inDict = roomState.customDict.includes(normalized);
    if (!inDict && NORMALIZED_DICT.size > 0) {
      const lu = lookupWord(word);
      if (lu.ambiguous) {
        playReject();
        setFeedback({ type: 'error', text: 'حدد موضع الهمزة' });
        return;
      }
      if (lu.valid) { canonicalWord = lu.canonical; inDict = true; }
    }
    const elapsed = (now() - roomState.turnStartedAt) / 1000;
    const newTimeForCurrent = Math.max(0, roomState.timeRemaining[myRole] - elapsed);

    setCurrentInput('');
    if (inDict) {
      setFeedback({ type: 'success', text: canonicalWord });
      setTimeout(() => setFeedback(null), 1200);
      commitChess(roomState, {
        ...roomState,
        usedWords: [{ word: canonicalWord, player: myRole }, ...roomState.usedWords],
        timeRemaining: { ...roomState.timeRemaining, [myRole]: newTimeForCurrent },
        currentTurn: myRole === 1 ? 2 : 1,
        turnStartedAt: now(),
      }, 'turnStartedAt');
    } else {
      commitChess(roomState, {
        ...roomState,
        timeRemaining: { ...roomState.timeRemaining, [myRole]: newTimeForCurrent },
        pendingWord: { word, by: myRole },
      });
    }
  }, [roomState, myRole, currentInput, commitChess]);

  const acceptPending = useCallback(() => {
    if (!roomState?.pendingWord) return;
    const { word, by } = roomState.pendingWord;
    commitChess(roomState, {
      ...roomState,
      usedWords: [{ word, player: by }, ...roomState.usedWords],
      customDict: [...roomState.customDict, normalize(word)],
      pendingWord: null,
      currentTurn: by === 1 ? 2 : 1,
      turnStartedAt: now(),
    }, 'turnStartedAt');
  }, [roomState, commitChess]);

  const rejectPending = useCallback(() => {
    if (!roomState?.pendingWord) return;
    commitChess(roomState, {
      ...roomState,
      pendingWord: null,
      turnStartedAt: now(),
    }, 'turnStartedAt');
  }, [roomState, commitChess]);

  const resign = useCallback(() => {
    if (!roomState || roomState.status !== 'playing') return;
    commitChess(roomState, {
      ...roomState,
      status: 'finished',
      winner: myRole === 1 ? 2 : 1,
      resigned: myRole,
    });
  }, [roomState, myRole, commitChess]);

  const rematch = useCallback(async () => {
    if (!roomState) return;
    const gameNumber = roomState.gameNumber || 1;
    const newGameNum = gameNumber + 1;
    const cleanPlayers = {
      1: { ...roomState.players[1], left: false },
      2: { ...roomState.players[2], left: false },
    };
    let newState;
    if (roomState.mode === 'race') {
      newState = {
        ...roomState,
        status: 'playing',
        players: cleanPlayers,
        words_p1: [],
        words_p2: [],
        endingQueue: generateEndingQueue(),
        currentEndingIndex: 0,
        gameStartedAt: now(),
        winner: null,
        resigned: null,
        penalties: { 1: 0, 2: 0 },
        frozenUntil: { 1: null, 2: null },
        gameNumber: newGameNum,
      };
    } else {
      const seconds = roomState.settings.initialSeconds;
      newState = {
        ...roomState,
        status: 'playing',
        players: cleanPlayers,
        timeRemaining: { 1: seconds, 2: seconds },
        currentTurn: newGameNum % 2 === 0 ? 2 : 1,
        turnStartedAt: now(),
        pendingWord: null,
        usedWords: [],
        winner: null,
        resigned: null,
        gameNumber: newGameNum,
      };
    }
    setBusy(true);
    try {
      // إذا ضغط الخصم قبلك، السيرفر يرجع جولته بدل ما تبدأ جولة ثانية
      const r = await roomRematch(roomCode, gameNumber, newState);
      if (r?.state) applyServerState(r.state);
    } catch (e) {
      console.error('[rematch]', e);
    } finally {
      setBusy(false);
    }
  }, [roomState, roomCode, applyServerState]);

  const leaveRoom = useCallback(async () => {
    if (roomCode && roomCode !== 'local' && myRole && roomState) {
      if (roomState.status === 'waiting' && myRole === 1) {
        deleteRoom(roomCode).catch(() => {});
      } else {
        roomLeave(roomCode, myRole).catch(() => {});
      }
    }
    if (roomCode && roomCode !== 'local') clearMyRole(roomCode);
    setCurrentRoom(null);
    setRoomInUrl(null);
    setScreen('menu');
    setRoomCode('');
    setMyRoleState(null);
    setRoomState(null);
    setCurrentInput('');
    setFeedback(null);
    setJoinCode('');
    setJoinPreview(null);
    setGlobalError(null);
  }, [roomCode, myRole, roomState]);

  const inviteUrl = roomCode && roomCode !== 'local' && typeof window !== 'undefined'
    ? `${window.location.origin}/?room=${roomCode}` : '';

  const flash = useCallback((text) => {
    setFeedback({ type: 'success', text });
    setTimeout(() => setFeedback(null), 1500);
  }, []);

  const copyCode = useCallback(() => {
    if (!roomCode) return;
    try { navigator.clipboard?.writeText(roomCode); flash('تم نسخ الكود'); } catch {}
  }, [roomCode, flash]);

  const copyLink = useCallback(() => {
    if (!inviteUrl) return;
    try { navigator.clipboard?.writeText(inviteUrl); flash('تم نسخ الرابط'); } catch {}
  }, [inviteUrl, flash]);

  const shareInvite = useCallback(async () => {
    if (!inviteUrl) return;
    const text = `تعال نلعب لعبة الكلمات! 🎮\nكود الغرفة: ${roomCode}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'لعبة الكلمات', text, url: inviteUrl }); return; }
      catch (e) { if (e?.name === 'AbortError') return; }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${inviteUrl}`)}`, '_blank', 'noopener');
  }, [inviteUrl, roomCode]);

  const startLocal = useCallback(() => {
    const finalEnding = useCustom ? customEnding.trim() : selectedEnding;
    if (!hostName.trim() || !finalEnding) {
      setGlobalError('أكمل البيانات أولاً');
      return;
    }
    saveName(hostName.trim());
    const state = createInitialState('local', hostName.trim(), {
      timeControl: selectedTime, ending: finalEnding, turnSkipSeconds: selectedTurnSkip,
    });
    state.players[2] = { name: 'اللاعب الثاني', joined: true };
    state.status = 'playing';
    state.turnStartedAt = Date.now();
    setRoomCode('local');
    setMyRoleState(null);
    setRoomState(state);
    setScreen('local-playing');
  }, [hostName, useCustom, customEnding, selectedEnding, selectedTime, selectedTurnSkip]);


  // ============== المعطيات المحسوبة ==============
  const displayTimes = useMemo(() => {
    if (!roomState || roomState.mode === 'race') return { 1: 0, 2: 0 };
    const t1 = roomState.timeRemaining[1];
    const t2 = roomState.timeRemaining[2];
    if (roomState.status !== 'playing' || roomState.pendingWord) return { 1: t1, 2: t2 };
    const elapsed = (displayNow - roomState.turnStartedAt) / 1000;
    if (roomState.currentTurn === 1) return { 1: Math.max(0, t1 - elapsed), 2: t2 };
    return { 1: t1, 2: Math.max(0, t2 - elapsed) };
  }, [roomState, displayNow]);

  const wordCounts = useMemo(() => {
    if (!roomState) return { 1: 0, 2: 0 };
    if (roomState.mode === 'race') return {
      1: (roomState.words_p1 || []).length,
      2: (roomState.words_p2 || []).length,
    };
    return {
      1: (roomState.usedWords || []).filter(w => w.player === 1).length,
      2: (roomState.usedWords || []).filter(w => w.player === 2).length,
    };
  }, [roomState]);

  const isMyTurn = roomState?.currentTurn === myRole && !roomState?.pendingWord;
  const myName = roomState?.players[myRole]?.name || '';
  const oppRole = myRole === 1 ? 2 : 1;
  const oppName = roomState?.players[oppRole]?.name || 'الخصم';

  // ============== الشاشات ==============
  // -------- شاشة القائمة --------
  if (booting) {
    return (
      <Screen>
        <div className="flex justify-center"><Loader2 className="w-9 h-9 animate-spin text-white" /></div>
      </Screen>
    );
  }

  if (screen === 'menu') {
    const logo = [
      { ch: 'ك', bg: '#ffffff', fg: '#3b1d6e', sh: '#c4b5fd', r: -8 },
      { ch: 'ل', bg: '#ffb020', fg: '#4a2400', sh: '#b86b00', r: 5 },
      { ch: 'م', bg: '#ffffff', fg: '#3b1d6e', sh: '#c4b5fd', r: -3 },
      { ch: 'ا', bg: '#22c55e', fg: '#ffffff', sh: '#15803d', r: 7 },
      { ch: 'ت', bg: '#ffffff', fg: '#3b1d6e', sh: '#c4b5fd', r: -6 },
    ];
    const go = (s, local) => () => {
      if (local) setMyRoleState('local');
      setScreen(s);
      setGlobalError(null);
    };
    const solo = [
      {
        key: 'guess', title: 'خمّن الكلمة', desc: 'اكتشف الكلمة المخفية بالألوان', isNew: true, onClick: go('guess'),
        icon: (
          <span className="grid grid-cols-2 gap-[3px]">
            <i className="block w-[11px] h-[11px] rounded-[3px] bg-[#22c55e]" />
            <i className="block w-[11px] h-[11px] rounded-[3px] bg-[#ffb020]" />
            <i className="block w-[11px] h-[11px] rounded-[3px] bg-white/40" />
            <i className="block w-[11px] h-[11px] rounded-[3px] bg-[#22c55e]" />
          </span>
        ),
        bg: '#7c3aed', sh: '#4c1d95',
      },
      { key: 'solo', title: 'تدريب فردي', desc: 'أكبر عدد كلمات قبل ما يخلص الوقت', onClick: go('solo'),
        icon: <Target className="w-6 h-6 text-white" strokeWidth={2.6} />, bg: '#ff4d6d', sh: '#b3123a' },
      { key: 'local', title: 'جهاز واحد', desc: 'اثنين بالدور على نفس الجوال', onClick: go('create-setup', true),
        icon: <Smartphone className="w-6 h-6 text-white" strokeWidth={2.6} />, bg: '#0ea5e9', sh: '#0369a1' },
    ];

    return (
      <Screen>
        <div className="fade-in py-3">
          {/* الشعار */}
          <div className="text-center mb-6">
            <div className="flex justify-center gap-1.5 mb-3" dir="rtl">
              {logo.map((t, i) => (
                <div key={i} style={{ transform: `rotate(${t.r}deg)` }}>
                  <div className="word-pop rounded-xl flex items-center justify-center font-display font-black"
                    style={{
                      width: 44, height: 48, fontSize: 26, paddingBottom: 3,
                      background: t.bg, color: t.fg, boxShadow: `0 5px 0 ${t.sh}, 0 12px 18px -10px rgba(30,10,80,.6)`,
                      border: '3px solid rgba(255,255,255,.65)', animationDelay: `${i * 80}ms`,
                    }}>
                    {t.ch}
                  </div>
                </div>
              ))}
            </div>
            <h1 className="font-display font-black text-white"
              style={{ fontSize: 'clamp(2.3rem, 11vw, 3rem)', lineHeight: 1.15, textShadow: '0 4px 0 rgba(46,16,101,0.5)' }}>
              لعبة الكلمات
            </h1>
            <p className="text-white/85 font-display font-bold text-sm mt-1">مين أسرع واحد يلقى الكلمة؟ ⚡</p>
          </div>

          {/* مع صاحبك */}
          <Card className="p-4 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-[18px] h-[18px] text-[#7c3aed]" strokeWidth={2.6} />
              <span className="font-display font-black text-[#4c1d95]">العب مع صاحبك</span>
              <span className="text-xs text-muted font-bold mr-auto">كل واحد من جواله</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={go('create-setup')}
                className="btn-3d rounded-2xl py-3 flex flex-col items-center gap-1 font-display font-black"
                style={{ color: '#4a2400', background: '#ffb020', boxShadow: '0 5px 0 #b86b00', border: '2px solid #ffc95c' }}>
                <UserPlus className="w-6 h-6" strokeWidth={2.6} />
                <span className="text-[1rem]">إنشاء غرفة</span>
              </button>
              <button onClick={go('join-setup')}
                className="btn-3d rounded-2xl py-3 flex flex-col items-center gap-1 font-display font-black"
                style={{ color: '#083344', background: '#22d3ee', boxShadow: '0 5px 0 #0e7490', border: '2px solid #67e8f9' }}>
                <LogIn className="w-6 h-6" strokeWidth={2.6} />
                <span className="text-[1rem]">دخول بكود</span>
              </button>
            </div>
          </Card>

          {/* لحالك */}
          <div className="flex items-center gap-2 mb-2.5 px-1">
            <span className="font-display font-black text-white">العب لحالك</span>
            <div className="h-[2px] flex-1 rounded-full bg-white/20" />
          </div>
          <div className="space-y-3">
            {solo.map(m => (
              <button key={m.key} onClick={m.onClick}
                className="btn-3d relative w-full rounded-2xl bg-white p-2.5 pl-3 flex items-center gap-3 text-right"
                style={{ boxShadow: '0 5px 0 #c4b5fd', border: '2px solid #ede9fe' }}>
                <span className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: m.bg, boxShadow: `0 3px 0 ${m.sh}` }}>
                  {m.icon}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="font-display font-black text-[1.05rem] text-[#2e1065]">{m.title}</span>
                    {m.isNew && (
                      <span className="rounded-full bg-[#ff4d6d] px-2 py-[1px] text-[0.62rem] font-display font-black text-white">جديد</span>
                    )}
                  </span>
                  <span className="block text-[0.78rem] font-bold text-[#6d5b95] truncate">{m.desc}</span>
                </span>
                <ChevronLeft className="shrink-0 w-5 h-5 text-[#c4b5fd]" strokeWidth={3} />
              </button>
            ))}
          </div>
        </div>
      </Screen>
    );
  }

  // -------- خمّن الكلمة --------
  if (screen === 'guess') {
    return <GuessGame onExit={() => setScreen('menu')} />;
  }

  // -------- التدريب الفردي --------
  if (screen === 'solo') {
    return <SoloGame endings={ENDING_PRESETS.map(p => p.value)} onExit={() => setScreen('menu')} />;
  }

  // -------- شاشة إعداد الإنشاء --------
  if (screen === 'create-setup') {
    const isLocal = myRole === 'local';
    const isRace = !isLocal && selectedMode === 'race';
    const example = ENDING_PRESETS.find(p => p.value === selectedEnding)?.example;
    return (
      <Screen glow="#fbbf24">
        <BackButton onClick={leaveRoom} />
        <Card className="p-5 sm:p-7 fade-in">
          <Title sub={isLocal ? 'العبوا بالتناوب على نفس الجهاز' : 'بعد الإنشاء، أرسل الدعوة لصاحبك'}>
            {isLocal ? 'لعبة على جهاز واحد' : 'غرفة جديدة'}
          </Title>

          <div className="space-y-5">
            <div>
              <Label>{isLocal ? 'اسم اللاعب الأول' : 'اسمك'}</Label>
              <input
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="اكتب اسمك"
                maxLength={20}
                autoComplete="nickname"
                enterKeyHint="done"
                className={inputClass}
              />
            </div>

            {!isLocal && (
              <div>
                <Label>نوع اللعبة</Label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'chess', label: 'ساعة الشطرنج', sub: 'بالأدوار، ولكل لاعب ساعته', Icon: Hourglass },
                    { id: 'race',  label: 'سباق الكلمات', sub: 'الاثنين يكتبون بنفس الوقت', Icon: Zap },
                  ].map(({ id, label, sub, Icon }) => (
                    <Choice key={id} selected={selectedMode === id} onClick={() => setSelectedMode(id)} className="p-3.5">
                      <Icon className="w-6 h-6 mx-auto mb-1.5" style={{ color: selectedMode === id ? '#4a2400' : '#8b5cf6' }} strokeWidth={2.4} />
                      <div className="font-display font-bold">{label}</div>
                      <div className="text-[0.72rem] opacity-75 mt-0.5 leading-snug">{sub}</div>
                    </Choice>
                  ))}
                </div>
              </div>
            )}

            {!isRace && (
              <>
                <div>
                  <Label>وقت كل لاعب</Label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {TIME_CONTROLS.map(tc => {
                      const Icon = tc.icon;
                      const sel = selectedTime.id === tc.id;
                      return (
                        <Choice key={tc.id} selected={sel} onClick={() => setSelectedTime(tc)} className="py-3 px-1">
                          <Icon className="w-5 h-5 mx-auto mb-1" style={{ color: sel ? '#4a2400' : '#8b5cf6' }} strokeWidth={2.4} />
                          <div className="font-display font-bold">{tc.name}</div>
                          <div className="text-[0.72rem] opacity-75">{tc.desc}</div>
                        </Choice>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label>وقت الدور الواحد</Label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[10, 20, 30].map(sec => (
                      <Choice key={sec} selected={selectedTurnSkip === sec} onClick={() => setSelectedTurnSkip(sec)} className="py-2.5">
                        <span className="font-mono-ar font-bold text-xl">{sec}</span>
                        <span className="text-xs opacity-75 mr-1">ثانية</span>
                      </Choice>
                    ))}
                  </div>
                </div>
              </>
            )}

            {isRace && (
              <div>
                <Label>مدة السباق</Label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[{ s: 30, label: '٣٠', sub: 'ثانية' }, { s: 60, label: '١', sub: 'دقيقة' }, { s: 90, label: '١.٥', sub: 'دقيقة' }].map(({ s, label, sub }) => (
                    <Choice key={s} selected={selectedRaceDuration === s} onClick={() => setSelectedRaceDuration(s)} className="py-2.5">
                      <span className="font-mono-ar font-bold text-xl">{label}</span>
                      <span className="text-xs opacity-75 mr-1">{sub}</span>
                    </Choice>
                  ))}
                </div>
                <p className="text-xs text-dim mt-2.5 leading-relaxed">
                  كل سؤال نهاية مختلفة، وأول من يجاوب ياخذ النقطة. تقدر تجمّد خصمك أو تتجاوز السؤال مقابل نقاط.
                </p>
              </div>
            )}

            {!isRace && (
              <div>
                <Label aside={
                  <button onClick={() => setUseCustom(!useCustom)}
                    className="text-xs font-display font-bold text-[#7c3aed] hover:text-[#5b21b6] transition-colors inline-flex items-center gap-1">
                    <Plus className="w-3 h-3" /> {useCustom ? 'النهايات الجاهزة' : 'نهاية مخصصة'}
                  </button>
                }>نهاية الكلمات</Label>
                {!useCustom ? (
                  <>
                    <div className="grid grid-cols-5 gap-2">
                      {ENDING_PRESETS.map(p => (
                        <Choice key={p.value} selected={selectedEnding === p.value} onClick={() => setSelectedEnding(p.value)}
                          className="font-display font-bold text-[1.35rem] leading-none py-2.5">
                          {p.value}
                        </Choice>
                      ))}
                    </div>
                    {example && <p className="text-xs text-dim mt-2.5 text-center">مثل: <span className="text-muted">{example}</span></p>}
                  </>
                ) : (
                  <input
                    type="text"
                    value={customEnding}
                    onChange={(e) => setCustomEnding(e.target.value)}
                    placeholder="مثلاً: وب، اف"
                    maxLength={4}
                    className={`${inputClass} text-center font-display text-2xl`}
                  />
                )}
              </div>
            )}

            <ErrorNote>{globalError}</ErrorNote>

            <Btn onClick={isLocal ? startLocal : createRoom} busy={busy} icon={Play}>
              {isLocal ? 'ابدأ اللعبة' : 'إنشاء الغرفة'}
            </Btn>
          </div>
        </Card>
      </Screen>
    );
  }

  // -------- شاشة الانضمام --------
  if (screen === 'join-setup') {
    return (
      <Screen glow="#2dd4bf">
        <BackButton onClick={leaveRoom} />
        <Card className="p-5 sm:p-7 fade-in">
          <Title sub={joinPreview ? 'تأكد من التفاصيل واكتب اسمك' : 'اكتب الكود اللي وصلك'}>دخول غرفة</Title>
          {!joinPreview ? (
            <div className="space-y-4">
              <input
                type="tel"
                inputMode="numeric"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={(e) => e.key === 'Enter' && joinCode.length === 4 && checkJoinCode()}
                placeholder="0000"
                maxLength={4}
                dir="ltr"
                autoComplete="one-time-code"
                style={{ textIndent: '0.5em' }}
                className="w-full rounded-2xl py-4 bg-[#f5f3ff] border-[3px] border-[#ede9fe] focus:border-[#22d3ee] focus:bg-white focus:outline-none transition-all text-center font-mono-ar text-5xl font-black tracking-[0.5em] text-[#2e1065] placeholder:text-[#d9d0fb]"
              />
              <ErrorNote>{globalError}</ErrorNote>
              <Btn variant="teal" icon={LogIn} busy={busy} disabled={joinCode.length !== 4} onClick={checkJoinCode}>
                بحث عن الغرفة
              </Btn>
            </div>
          ) : (
            <div className="space-y-4">
              <RoomInfo state={joinPreview} />
              <div>
                <Label>اسمك</Label>
                <input
                  type="text"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  placeholder="اكتب اسمك"
                  maxLength={20}
                  autoFocus
                  autoComplete="nickname"
                  enterKeyHint="go"
                  onKeyDown={(e) => e.key === 'Enter' && confirmJoin()}
                  className={`${inputClass} focus:!border-[#22d3ee]`}
                />
              </div>
              <ErrorNote>{globalError}</ErrorNote>
              <div className="flex gap-2.5">
                <div className="flex-1">
                  <Btn variant="wood" size="md" onClick={() => { setJoinPreview(null); setGlobalError(null); }}>تغيير الكود</Btn>
                </div>
                <div className="flex-[1.5]">
                  <Btn variant="teal" size="md" icon={Check} busy={busy} disabled={!joinName.trim()} onClick={confirmJoin}>يلا ندخل</Btn>
                </div>
              </div>
            </div>
          )}
        </Card>
      </Screen>
    );
  }

  // -------- شاشة الانتظار --------
  if (screen === 'waiting' && roomState) {
    return (
      <Screen glow="#fbbf24">
        <div className="text-center fade-in">
          <div className="ending-badge mx-auto mb-3 w-16 h-16 rounded-full flex items-center justify-center">
            <Users className="w-8 h-8 text-[#7c3aed] float" strokeWidth={2.4} />
          </div>
          <h2 className="font-display font-black text-white" style={{ fontSize: 'clamp(1.7rem, 7.5vw, 2.1rem)', textShadow: '0 3px 0 rgba(46,16,101,0.4)' }}>
            <Thinking>بانتظار صاحبك</Thinking>
          </h2>
          <p className="text-white/85 text-sm font-display mt-1 mb-5">أرسل له الدعوة، واللعبة تبدأ أول ما يدخل</p>

          <Card className="p-5 mb-4" accent="#fbbf24">
            <div className="text-xs text-muted font-display font-bold mb-3">كود الغرفة</div>
            <div dir="ltr" className="flex justify-center gap-2.5 mb-5">
              {roomCode.split('').map((d, i) => (
                <div key={i} className="code-digit w-14 h-16 rounded-xl flex items-center justify-center font-mono-ar text-4xl font-black word-pop"
                  style={{ animationDelay: `${i * 70}ms` }}>
                  {d}
                </div>
              ))}
            </div>
            <Btn variant="green" icon={Share2} onClick={shareInvite}>أرسل الدعوة</Btn>
            <div className="flex justify-center gap-2 mt-3">
              <GhostBtn onClick={copyLink}><Link2 className="w-4 h-4" /> نسخ الرابط</GhostBtn>
              <GhostBtn onClick={copyCode}><Copy className="w-4 h-4" /> نسخ الكود</GhostBtn>
            </div>
            <div className="h-5 mt-2 text-[#16a34a] font-display font-bold text-xs">
              {feedback?.type === 'success' && <span className="slide-in inline-block">{feedback.text}</span>}
            </div>
          </Card>

          <RoomInfo state={roomState} />

          <button onClick={leaveRoom} className="mt-5 text-sm font-display font-bold text-white/70 hover:text-white transition-colors py-2">
            إلغاء الغرفة
          </button>
        </div>
      </Screen>
    );
  }

  // -------- شاشة اللعب --------
  if (screen === 'playing' && roomState && myRole && roomState.mode === 'race') {
    return <RaceGame key={roomState.gameNumber} roomState={roomState} setRoomState={setRoomState} applyServerState={applyServerState} myRole={myRole} roomCode={roomCode} />;
  }

  if (screen === 'playing' && roomState && myRole) {
    const pendingByMe = roomState.pendingWord?.by === myRole;
    const pendingByOpp = roomState.pendingWord && !pendingByMe;
    const tcName = TIME_CONTROLS.find(t => t.id === roomState.settings.timeControlId)?.name;

    return (
      <Screen center={false} className="pt-2">
        <ChessTable
          state={roomState}
          order={[myRole, oppRole]}
          myRole={myRole}
          activeRole={roomState.pendingWord ? null : roomState.currentTurn}
          displayTimes={displayTimes}
          turnTimeLeft={turnTimeLeft}
          turnSkipSecs={turnSkipSecs}
          wordCounts={wordCounts}
          onResign={resign}
          topInfo={<>
            <span className={`w-2 h-2 rounded-full shrink-0 ${connected ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'}`} title={connected ? 'متصل' : 'غير متصل'} />
            <bdi className="font-mono-ar">#{roomCode}</bdi>
            {tcName && <span className="text-white/75">· {tcName}</span>}
          </>}
        >
          <Card className="p-4 sm:p-5">
            {roomState.pendingWord ? (
              pendingByOpp ? (
                <div className="text-center slide-in">
                  <div className="text-xs text-muted font-display">{oppName} يقترح كلمة مو موجودة في القاموس</div>
                  <div className="font-display font-black my-3 text-[#7c3aed]" style={{ fontSize: 'clamp(2.2rem, 11vw, 3rem)', lineHeight: 1.25 }}>
                    {roomState.pendingWord.word}
                  </div>
                  <div className="text-sm text-muted mb-4">تقبلها؟ <span className="text-dim text-xs">(الوقت متوقف)</span></div>
                  <div className="flex gap-2.5">
                    <div className="flex-1"><Btn variant="green" size="md" icon={Check} onClick={acceptPending}>أقبلها</Btn></div>
                    <div className="flex-1"><Btn variant="red" size="md" icon={X} onClick={rejectPending}>أرفضها</Btn></div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-2 slide-in">
                  <Loader2 className="w-7 h-7 mx-auto mb-2 text-[#7c3aed] animate-spin" />
                  <div className="font-display text-2xl text-parchment mb-1">{roomState.pendingWord.word}</div>
                  <div className="text-sm text-muted"><Thinking>بانتظار قرار {oppName}</Thinking></div>
                  <div className="text-xs text-dim mt-1">الوقت متوقف لكم الاثنين</div>
                </div>
              )
            ) : isMyTurn ? (
              <>
                <div className="text-center text-base mb-3 font-display font-black" style={{ color: PLAYER_INK[myRole] }}>دورك! 🔥</div>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitWord()}
                    placeholder={`كلمة تنتهي بـ ${roomState.settings.ending}`}
                    enterKeyHint="send"
                    autoComplete="off"
                    autoCorrect="off"
                    className={`${inputClass} flex-1 min-w-0 font-display text-xl text-center ${feedback?.type === 'error' ? 'shake !border-[#ff4d6d]' : ''}`}
                  />
                  <button
                    onClick={submitWord}
                    disabled={!currentInput.trim()}
                    aria-label="إرسال"
                    className="btn-3d shrink-0 w-14 rounded-2xl flex items-center justify-center"
                    style={{ color: '#fff', background: '#22c55e', boxShadow: '0 5px 0 #15803d', border: '2px solid #4ade80' }}>
                    <Check className="w-7 h-7" strokeWidth={3.2} />
                  </button>
                </div>
                <div className="h-6 mt-2 text-center text-sm font-display">
                  {feedback && (
                    <span className={`slide-in inline-flex items-center gap-1.5 ${feedback.type === 'success' ? 'text-[#16a34a]' : 'text-[#e11d48]'} font-bold`}>
                      {feedback.type === 'success' && <Sparkles className="w-4 h-4" />}{feedback.text}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-4 text-muted">
                <div className="text-base"><Thinking>{oppName} يفكّر</Thinking></div>
                <div className="text-xs text-dim mt-1">جهّز كلمتك الجاية 😉</div>
              </div>
            )}
          </Card>
        </ChessTable>
      </Screen>
    );
  }

  // -------- شاشة النهاية --------
  if (screen === 'gameover' && roomState && roomState.winner != null) {
    const winner = roomState.winner;
    const isDraw = winner === 0;
    const isRace = roomState.mode === 'race';
    const oppLeft = roomState.players[oppRole]?.left === true;
    const oppResigned = roomState.resigned === oppRole;
    const iResigned = roomState.resigned === myRole;
    const scoreOf = (r) => (isRace ? raceScore(roomState, r) : wordCounts[r]);
    const iWon = !isDraw && winner === myRole;

    return (
      <Screen glow={isDraw ? '#a8a29e' : PLAYER_COLORS[winner]} className="py-2">
        {iWon && <Confetti />}
        <div className="fade-in">
          <ResultHeader
            isDraw={isDraw}
            winnerName={!isDraw ? roomState.players[winner].name : ''}
            winnerPlayer={winner}
            subtitle={isDraw ? 'كلاكم على نفس المستوى 🤝' : iWon ? 'مبروك! 🎉' : 'حظ أوفر المرة الجاية'}
            unit={isRace ? 'نقطة' : 'كلمة'}
            sides={[myRole, oppRole].map(r => ({
              name: roomState.players[r]?.name, player: r, score: scoreOf(r), tag: r === myRole ? '(أنت)' : '',
            }))}
          />

          {(oppResigned || iResigned || oppLeft) && (
            <div className="glass rounded-2xl px-4 py-2.5 mb-4 text-sm text-center font-display font-bold slide-in text-white">
              {oppResigned ? <>🏳️ استسلم <span className="font-black">{oppName}</span></>
                : iResigned ? 'استسلمت في هذه الجولة'
                : <>غادر <span className="font-black">{oppName}</span> الغرفة</>}
            </div>
          )}

          <MatchSummary roomState={roomState} myRole={myRole} />

          <div className="flex gap-2.5">
            {!oppLeft && !oppResigned && (
              <div className="flex-[1.5]">
                <Btn icon={RotateCcw} busy={busy} onClick={rematch}>جولة ثانية</Btn>
              </div>
            )}
            <div className="flex-1">
              <Btn variant="wood" onClick={leaveRoom}>خروج</Btn>
            </div>
          </div>
        </div>
      </Screen>
    );
  }

  // -------- اللعب المحلي على جهاز واحد --------
  if (screen === 'local-playing' && roomState) {
    return <LocalGame
      roomState={roomState}
      setRoomState={setRoomState}
      onExit={leaveRoom}
      onGameOver={() => setScreen('local-gameover')}
    />;
  }

  if (screen === 'local-gameover' && roomState) {
    const winner = roomState.winner;
    const countOf = (r) => roomState.usedWords.filter(w => w.player === r).length;
    return (
      <Screen glow={PLAYER_COLORS[winner]} className="py-2">
        <Confetti />
        <div className="fade-in">
          <ResultHeader
            isDraw={false}
            winnerName={roomState.players[winner].name}
            winnerPlayer={winner}
            subtitle="مبروك! 🎉"
            unit="كلمة"
            sides={[1, 2].map(r => ({ name: roomState.players[r].name, player: r, score: countOf(r) }))}
          />
          <MatchSummary roomState={roomState} myRole={1} />
          <div className="flex gap-2.5">
            <div className="flex-[1.5]">
              <Btn icon={RotateCcw} onClick={() => {
                const seconds = roomState.settings.initialSeconds;
                setRoomState({
                  ...roomState, status: 'playing',
                  timeRemaining: { 1: seconds, 2: seconds },
                  currentTurn: 1, turnStartedAt: Date.now(),
                  pendingWord: null, usedWords: [], winner: null,
                });
                setScreen('local-playing');
              }}>جولة ثانية</Btn>
            </div>
            <div className="flex-1"><Btn variant="wood" onClick={leaveRoom}>خروج</Btn></div>
          </div>
        </div>
      </Screen>
    );
  }

  return null;
}

// ============== مكون اللعب المحلي ==============
function LocalGame({ roomState, setRoomState, onGameOver }) {
  const [currentInput, setCurrentInput] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [pendingWord, setPendingWord] = useState(null);
  const [displayNow, setDisplayNow] = useState(Date.now());
  const inputRef = useRef(null);
  const gameOverRef = useRef(false);
  const turnSkipRef = useRef(false);
  const localLastTickRef = useRef(null);

  const turnSkipSecs = roomState.settings?.turnSkipSeconds ?? TURN_SKIP_SECONDS;
  const turnTimeLeft = pendingWord ? turnSkipSecs :
    Math.max(0, turnSkipSecs - (displayNow - roomState.turnStartedAt) / 1000);

  useEffect(() => {
    const interval = setInterval(() => setDisplayNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (pendingWord || gameOverRef.current) return;
    const elapsed = (displayNow - roomState.turnStartedAt) / 1000;
    const current = roomState.currentTurn;
    const remaining = roomState.timeRemaining[current] - elapsed;
    if (remaining <= 0) {
      gameOverRef.current = true;
      playGameOver();
      setRoomState({
        ...roomState, status: 'finished',
        winner: current === 1 ? 2 : 1,
        timeRemaining: { ...roomState.timeRemaining, [current]: 0 },
      });
      onGameOver();
    } else if (!turnSkipRef.current && elapsed >= (roomState.settings?.turnSkipSeconds ?? TURN_SKIP_SECONDS)) {
      turnSkipRef.current = true;
      playSkip();
      setRoomState({
        ...roomState,
        timeRemaining: { ...roomState.timeRemaining, [current]: Math.max(0, remaining) },
        currentTurn: current === 1 ? 2 : 1,
        turnStartedAt: Date.now(),
      });
    }
  }, [displayNow, roomState, pendingWord, setRoomState, onGameOver]);

  useEffect(() => {
    turnSkipRef.current = false;
    localLastTickRef.current = null;
  }, [roomState.turnStartedAt]);

  useEffect(() => {
    if (pendingWord) { localLastTickRef.current = null; return; }
    const secs = Math.ceil(turnTimeLeft);
    if (secs <= 3 && secs > 0 && secs !== localLastTickRef.current) {
      localLastTickRef.current = secs;
      playTick();
    }
    if (secs > 3) localLastTickRef.current = null;
  }, [turnTimeLeft, pendingWord]);

  useEffect(() => { inputRef.current?.focus(); }, [roomState.currentTurn]);

  const submitWord = () => {
    const word = currentInput.trim();
    if (!word) return;
    const normalized = normalize(word);
    const normalizedEnding = normalize(roomState.settings.ending);
    if (!normalized.endsWith(normalizedEnding)) {
      playReject();
      setFeedback({ type: 'error', text: `يجب أن تنتهي بـ "${roomState.settings.ending}"` });
      return;
    }
    if (normalized.length < 2) {
      playReject();
      setFeedback({ type: 'error', text: 'الكلمة قصيرة' });
      return;
    }
    if (roomState.usedWords.some(w => normalizeStrict(w.word) === normalizeStrict(word))) {
      playReject();
      setFeedback({ type: 'error', text: 'استُخدمت من قبل' });
      return;
    }
    let canonicalLocal = word;
    let inDict = roomState.customDict.includes(normalized);
    if (!inDict && NORMALIZED_DICT.size > 0) {
      const lu = lookupWord(word);
      if (lu.ambiguous) {
        playReject();
        setFeedback({ type: 'error', text: 'حدد موضع الهمزة' });
        return;
      }
      if (lu.valid) { canonicalLocal = lu.canonical; inDict = true; }
    }
    if (inDict) acceptWord(canonicalLocal);
    else { setPendingWord(word); setFeedback(null); }
  };

  const acceptWord = (word) => {
    const elapsed = (Date.now() - roomState.turnStartedAt) / 1000;
    const cur = roomState.currentTurn;
    setRoomState({
      ...roomState,
      usedWords: [{ word, player: cur }, ...roomState.usedWords],
      timeRemaining: { ...roomState.timeRemaining, [cur]: Math.max(0, roomState.timeRemaining[cur] - elapsed) },
      currentTurn: cur === 1 ? 2 : 1,
      turnStartedAt: Date.now(),
    });
    playAccept();
    setCurrentInput('');
    setFeedback({ type: 'success', text: word });
    setPendingWord(null);
    setTimeout(() => setFeedback(null), 900);
  };

  const confirmPending = () => {
    setRoomState({ ...roomState, customDict: [...roomState.customDict, normalize(pendingWord)] });
    acceptWord(pendingWord);
  };

  const rejectPending = () => {
    playReject();
    setPendingWord(null);
    setFeedback({ type: 'error', text: 'اكتب كلمة أخرى' });
    setCurrentInput('');
  };

  const resign = () => {
    gameOverRef.current = true;
    playGameOver();
    setRoomState({ ...roomState, status: 'finished', winner: roomState.currentTurn === 1 ? 2 : 1 });
    onGameOver();
  };

  const displayTimes = (() => {
    const t1 = roomState.timeRemaining[1];
    const t2 = roomState.timeRemaining[2];
    if (pendingWord) return { 1: t1, 2: t2 };
    const elapsed = (displayNow - roomState.turnStartedAt) / 1000;
    if (roomState.currentTurn === 1) return { 1: Math.max(0, t1 - elapsed), 2: t2 };
    return { 1: t1, 2: Math.max(0, t2 - elapsed) };
  })();

  const wordCounts = {
    1: roomState.usedWords.filter(w => w.player === 1).length,
    2: roomState.usedWords.filter(w => w.player === 2).length,
  };
  const cur = roomState.currentTurn;

  return (
    <Screen center={false} className="pt-2">
      <ChessTable
        state={roomState}
        order={[1, 2]}
        myRole={null}
        activeRole={pendingWord ? null : cur}
        displayTimes={displayTimes}
        turnTimeLeft={turnTimeLeft}
        turnSkipSecs={turnSkipSecs}
        wordCounts={wordCounts}
        onResign={resign}
        topInfo={<>
          <Smartphone className="w-3.5 h-3.5" />
          <span>جهاز واحد</span>
          <span className="text-white/75">· {TIME_CONTROLS.find(t => t.id === roomState.settings.timeControlId)?.name}</span>
        </>}
      >
        <Card className="p-4 sm:p-5">
          <div className="text-center text-base mb-3 font-display font-black" style={{ color: PLAYER_INK[cur] }}>
            دور {roomState.players[cur].name}
          </div>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { pendingWord ? confirmPending() : submitWord(); } }}
              disabled={!!pendingWord}
              placeholder={`كلمة تنتهي بـ ${roomState.settings.ending}`}
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="off"
              className={`${inputClass} flex-1 min-w-0 font-display text-xl text-center disabled:opacity-50 ${feedback?.type === 'error' ? 'shake !border-[#ff4d6d]' : ''}`}
            />
            <button
              onClick={submitWord}
              disabled={!currentInput.trim() || !!pendingWord}
              aria-label="إرسال"
              className="btn-3d shrink-0 w-14 rounded-2xl flex items-center justify-center"
              style={{ color: '#fff', background: '#22c55e', boxShadow: '0 5px 0 #15803d', border: '2px solid #4ade80' }}>
              <Check className="w-7 h-7" strokeWidth={3.2} />
            </button>
          </div>

          {pendingWord ? (
            <div className="mt-4 rounded-2xl p-4 slide-in info-list text-center">
              <div className="font-display font-black text-3xl text-[#7c3aed] mb-1">{pendingWord}</div>
              <p className="text-sm text-muted mb-3">مو موجودة في القاموس — تتفقون عليها؟</p>
              <div className="flex gap-2.5">
                <div className="flex-1"><Btn variant="green" size="md" icon={Check} onClick={confirmPending}>نقبلها</Btn></div>
                <div className="flex-1"><Btn variant="red" size="md" icon={X} onClick={rejectPending}>نرفضها</Btn></div>
              </div>
            </div>
          ) : (
            <div className="h-6 mt-2 text-center text-sm font-display">
              {feedback && (
                <span className={`slide-in inline-flex items-center gap-1.5 ${feedback.type === 'success' ? 'text-[#16a34a]' : 'text-[#e11d48]'} font-bold`}>
                  {feedback.type === 'success' && <Sparkles className="w-4 h-4" />}{feedback.text}
                </span>
              )}
            </div>
          )}
        </Card>
      </ChessTable>
    </Screen>
  );
}
