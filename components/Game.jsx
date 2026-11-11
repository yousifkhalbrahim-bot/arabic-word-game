'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Trophy, RotateCcw, Play, Plus, Check, X, Flag, Zap, Flame,
  Hourglass, BookOpen, Sparkles, Users, Copy, ArrowLeft, Wifi, WifiOff,
  Loader2, Smartphone, UserPlus, LogIn, Snowflake, Share2, Link2, Target, ChevronLeft, Bot, User, Star, Pencil,
} from 'lucide-react';
import {
  supabase, getRoom, saveRoom, deleteRoom, getMyRole, setMyRole, clearMyRole, roomCreate, roomCancel,
  roomJoin, roomLeave, roomCas, roomRematch, raceSubmit, raceSkip, raceFreeze, raceFinish, raceResign,
  isNewerState, getCurrentRoom, setCurrentRoom, getSavedName, saveName,
} from '@/lib/supabase';
import { NORMALIZED_DICT, ARABIC_DICTIONARY, normalize, normalizeStrict, lookupWord } from '@/lib/dictionary';
import { now, syncClock } from '@/lib/clock';
import { useVisualViewport } from '@/lib/useViewport';
import { demoRoom } from '@/lib/demo';
import { initNative, publicUrl, shareContent } from '@/lib/native';
import { loadWordlist } from '@/lib/wordlist';
import { checkRaceWord, shuffledEndingQueue, endingAt, raceScore } from '@/lib/rules';
import SoloGame from '@/components/SoloGame';
import Leaderboard from '@/components/Leaderboard';
import { awardOnce, cachedPoints, fetchLeaderboard, renamePlayer, POINTS } from '@/lib/points';
import GuessGame, { MiniBoard } from '@/components/GuessGame';
import GuessDuel, { settleGuessDuel, DUEL_SECONDS } from '@/components/GuessDuel';
import { LENGTHS as GUESS_LENGTHS, randomAnswer, normalizeGuess } from '@/lib/guess';
import {
  ArcadeBg, Screen, BackButton, Card, Title, Label, Btn, GhostBtn, Choice, ErrorNote, inputClass, LetterTiles,
  PLAYER_COLORS, PLAYER_DEEP, PLAYER_INK, PLAYER_ON,
} from '@/components/ui';
import { ChessTable, MatchSummary, ResultHeader, Confetti, Thinking } from '@/components/GameParts';
import { playAccept, playReject, playSkip, playTick, playGameOver, playWordAppear, playFreeze, playYourTurn } from '@/lib/sounds';

// ============== الثوابت ==============
const TIME_CONTROLS = [
  { id: 'bullet', name: 'بوليت', icon: Zap, minutes: 1, desc: 'دقيقة' },
  { id: 'blitz', name: 'بليتز', icon: Flame, minutes: 3, desc: '٣ دقائق' },
  { id: 'rapid', name: 'رابيد', icon: Hourglass, minutes: 5, desc: '٥ دقائق' },
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

const createGuessState = (code, hostName, len, customWord = null, clue = '') => ({
  code,
  mode: 'guess',
  status: 'waiting',
  players: { 1: { name: hostName, joined: true }, 2: { name: '', joined: false } },
  settings: { len, duration: DUEL_SECONDS[len], ...(customWord ? { custom: true } : {}) },
  ...(customWord ? { setter: 1, clue: (clue || '').trim().slice(0, 40) } : {}),
  answer: customWord || randomAnswer(len),
  guesses_p1: [],
  guesses_p2: [],
  winner: null,
  gameNumber: 1,
});

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

function ChooseWord({ roomState, myRole, onChoose, onExit }) {
  const [word, setWord] = useState('');
  const [clue, setClue] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const mine = roomState.setter === myRole;
  const other = roomState.players[roomState.setter]?.name || 'صاحبك';
  const otherRole = myRole === 1 ? 2 : 1;
  if (roomState.players[otherRole]?.left) {
    return (
      <Screen>
        <Card className="p-5 fade-in text-center">
          <div className="text-4xl mb-2">👋</div>
          <Title sub="الجولة انتهت">غادر {roomState.players[otherRole]?.name || 'صاحبك'} الغرفة</Title>
          <Btn variant="wood" onClick={onExit}>خروج</Btn>
        </Card>
      </Screen>
    );
  }
  const submit = async () => {
    const w = normalizeGuess(word);
    const l = [...w].length;
    if (!/^[\u0621-\u064A]+$/.test(w) || (l !== 3 && l !== 5)) { setErr('لازم تكون ٣ أو ٥ أحرف عربية'); return; }
    setErr(''); setBusy(true);
    await onChoose(w, clue);
    setBusy(false);
  };
  return (
    <Screen>
      <BackButton onClick={onExit}>خروج</BackButton>
      <Card className="p-5 fade-in text-center">
        {mine ? (
          <>
            <div className="text-4xl mb-1">🎯</div>
            <Title sub="أي كلمة عربية من ٣ أو ٥ أحرف — اختر وحدة تصعّب عليه!">دورك تختار الكلمة</Title>
            <input type="text" value={word} onChange={e => setWord(e.target.value)} autoFocus
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="٣ أو ٥ أحرف" maxLength={8} autoComplete="off" autoCorrect="off"
              className={`${inputClass} text-center font-display text-3xl mb-2.5`} />
            <input type="text" value={clue} onChange={e => setClue(e.target.value)}
              placeholder="💡 تلميح لصاحبك (اختياري)" maxLength={40} autoComplete="off"
              className={`${inputClass} text-center font-display mb-3`} />
            <ErrorNote>{err}</ErrorNote>
            <div className="mt-3"><Btn icon={Check} busy={busy} onClick={submit}>ابدأ الجولة</Btn></div>
          </>
        ) : (
          <div className="py-6">
            <div className="text-5xl mb-3">🤫</div>
            <div className="font-display font-black text-xl text-[#4c1d95]"><Thinking>{other} يختار لك كلمة</Thinking></div>
            <div className="text-sm text-muted font-bold mt-2">جهّز نفسك!</div>
          </div>
        )}
      </Card>
    </Screen>
  );
}

function RoomInfo({ state }) {
  const isRace = state.mode === 'race';
  const rows = [
    ['المضيف', <span key="h" className="font-black" style={{ color: PLAYER_INK[1] }}>{state.players[1]?.name}</span>],
    ['نوع اللعبة', isRace ? '⚡ سباق الكلمات' : state.mode === 'guess' ? (state.settings?.custom ? '🎯 خمّن كلمة المضيف' : '🟩 خمّن الكلمة') : '⏱ ساعة الشطرنج'],
    ...(state.mode === 'guess'
      ? [['عدد الحروف', <span key="l"><bdi className="font-mono-ar">{state.settings.len}</bdi> أحرف · <bdi className="font-mono-ar">{GUESS_LENGTHS[state.settings.len].tries}</bdi> محاولات</span>]]
      : isRace
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
          className="h-10 rounded-full px-3 flex items-center justify-center gap-1 font-display font-black text-xs text-white transition-all active:scale-90"
          style={{ background: confirmResign ? '#ff4d6d' : 'rgba(255,255,255,0.16)' }}>
          <Flag className="w-3.5 h-3.5" strokeWidth={2.8} /> {confirmResign ? 'متأكد؟' : 'استسلام'}
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

          <div className="shrink-0 w-full grid grid-cols-2 gap-2">
          {/* تجميد الخصم */}
          <button onClick={handleFreeze} onPointerDown={e => e.preventDefault()}
            disabled={myDisplayScore < 3 || isOppFrozen || isFrozen || timeLeft <= 0}
            className="btn-3d min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1 font-display font-black"
            style={{ background: '#38bdf8', color: '#fff', boxShadow: '0 4px 0 #0369a1', border: '2px solid #7dd3fc', fontSize: '0.75rem' }}>
            <span className="flex items-center gap-1.5">
              <Snowflake className="w-3.5 h-3.5 shrink-0" strokeWidth={3} style={isOppFrozen ? { animation: 'spin-slow 3s linear infinite' } : undefined} />
              {isOppFrozen
                ? <>مجمّد <bdi>{Math.ceil(((roomState.frozenUntil?.[oppRole] ?? 0) - displayNow) / 1000)}</bdi>ث</>
                : 'تجميد'}
            </span>
            <span className="shrink-0 rounded-full bg-white/25 px-1.5" style={{ fontSize: '0.72rem' }}>💎 3</span>
          </button>

          {/* تجاوز السؤال */}
          <button onClick={handleSkip} onPointerDown={e => e.preventDefault()}
            disabled={myDisplayScore < 1 || timeLeft <= 0 || isFrozen}
            className="btn-3d min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1 font-display font-black"
            style={{ background: '#fff', color: '#5b21b6', boxShadow: '0 4px 0 #c4b5fd', border: '2px solid #ede9fe', fontSize: '0.75rem' }}>
            <span>تجاوز</span>
            <span className="shrink-0 rounded-full bg-[#ede9fe] px-1.5" style={{ fontSize: '0.72rem' }}>💎 1</span>
          </button>
          </div>

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
            readOnly={timeLeft <= 0 || isFrozen}
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
          <button onClick={submitWord} onPointerDown={e => e.preventDefault()} disabled={!input.trim() || timeLeft <= 0 || isFrozen} aria-label="إرسال"
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
  const [homeTab, setHomeTab] = useState('solo');
  const [myPoints, setMyPoints] = useState(null);
  const [weekTop, setWeekTop] = useState([]);
  const [pointsGain, setPointsGain] = useState(0);
  const [nameOpen, setNameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [editName, setEditName] = useState(false);
  const [moreOpts, setMoreOpts] = useState(false);
  const [soloStyle, setSoloStyle] = useState('bot'); // لحالك: bot = ضد الكمبيوتر، time = ضد الوقت
  const [soloStartDuration, setSoloStartDuration] = useState(null);
  const [selectedTime, setSelectedTime] = useState(TIME_CONTROLS[1]);
  const [selectedTurnSkip, setSelectedTurnSkip] = useState(20);
  const [selectedRaceDuration, setSelectedRaceDuration] = useState(60);
  const [selectedGuessLen, setSelectedGuessLen] = useState(3);
  const [guessCustom, setGuessCustom] = useState(false);
  const [secretWord, setSecretWord] = useState('');
  const [secretClue, setSecretClue] = useState('');
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

  const roomStateRef = useRef(null);
  useEffect(() => { roomStateRef.current = roomState; }, [roomState]);

  // آخر حالة أكّدها السيرفر — النقاط تنحسب منها بس (مو من العرض المؤقت)
  const serverRef = useRef(null);

  // يطبّق حالة من السيرفر فقط إذا كانت أحدث من الموجودة (يتجاهل التحديثات المتأخرة)
  const applyServerState = useCallback((next) => {
    if (!next) return;
    if (isNewerState(serverRef.current, next)) serverRef.current = next;
    setRoomState(prev => (isNewerState(prev, next) ? next : prev));
  }, []);

  const enterRoom = useCallback((code, role, state) => {
    serverRef.current = state;
    setMyRole(code, role, state.rid);
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
    initNative();
    loadWordlist();
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
        const role = getMyRole(code, state);
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

  // ============== النقاط ==============
  useEffect(() => {
    const upd = () => setMyPoints(cachedPoints());
    upd();
    window.addEventListener('wg:points', upd);
    return () => window.removeEventListener('wg:points', upd);
  }, []);
  useEffect(() => {
    if (screen === 'menu') {
      fetchLeaderboard('week').then(r => { if (r?.top) setWeekTop(r.top.slice(0, 3)); });
      fetchLeaderboard('all');
    }
    if (screen !== 'gameover' && screen !== 'local-gameover') setPointsGain(0);
  }, [screen]);

  // فوز/تعادل أونلاين → نقاط (مرة وحدة لكل جولة)
  useEffect(() => {
    if (screen !== 'gameover' || !roomState || roomState.status !== 'finished' || !myRole || roomCode === 'DEMO') return;
    const confirmed = serverRef.current;
    if (!confirmed || confirmed.status !== 'finished' || (confirmed.version ?? 0) !== (roomState.version ?? 0)) return;
    const w = confirmed.winner;
    const custom = roomState.mode === 'guess' && roomState.settings?.custom;
    let pts = 0, win = false;
    if (w === 0) pts = POINTS.onlineDraw;
    else if (w === myRole) {
      win = true;
      pts = custom ? (roomState.setter === myRole ? POINTS.customSetterWin : POINTS.customGuesserWin) : POINTS.onlineWin;
    }
    if (!pts) return;
    const key = `${roomCode}:${roomState.gameNumber || 1}:${roomState.gameStartedAt || roomState.turnStartedAt || ''}:${myRole}`;
    const p = awardOnce(key, pts, win);
    if (p) p.then(r => r && setPointsGain(r.added || 0));
  }, [screen, roomState, myRole, roomCode]);

  // فوز ضد الكمبيوتر
  useEffect(() => {
    if (screen !== 'local-gameover' || !roomState?.vsBot || roomState.winner !== 1) return;
    const p = awardOnce(`bot:${roomState.turnStartedAt}`, POINTS.botWin, true);
    if (p) p.then(r => r && setPointsGain(r.added || 0));
  }, [screen, roomState]);

  const saveMyName = useCallback(() => {
    const n = nameDraft.trim().slice(0, 20);
    if (!n) return;
    saveName(n);
    setHostName(n);
    setJoinName(n);
    renamePlayer(n);
    setNameOpen(false);
  }, [nameDraft]);

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
    } else if (roomState.status === 'choosing' && screen === 'gameover') {
      setScreen('playing');
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
    if (screen !== 'playing' || roomState?.mode) return;
    const interval = setInterval(() => setDisplayNow(now()), 100);
    return () => clearInterval(interval);
  }, [screen, roomState?.mode]);

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
    if (screen !== 'playing' || !roomState || roomState.mode || roomState.status !== 'playing') return;
    if (roomCode === 'DEMO') return;
    if (roomState.pendingWord && roomState.pendingAt && !winSubmittedRef.current
        && displayNow - roomState.pendingAt > 20000 + (roomState.pendingWord.by === myRole ? 2000 : 0)) {
      winSubmittedRef.current = true;
      acceptPending();
      return;
    }
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
    if (roomState.mode) return;
    const newLen = (roomState.usedWords || []).length;
    const prevTs = prevTurnStartedRef.current;

    if (prevTs !== null && roomState.turnStartedAt !== prevTs) {
      if (newLen > prevWordsLenRef.current) {
        playAccept();
      } else if (roomState.currentTurn !== prevTurnRef.current) {
        playSkip();
      }
      if (roomState.status === 'playing' && !roomState.pendingWord
          && roomState.currentTurn === myRole && prevTurnRef.current !== myRole) {
        setTimeout(playYourTurn, 250);
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
  }, [roomState, myRole]);

  const turnSkipSecs = roomState?.settings?.turnSkipSeconds ?? TURN_SKIP_SECONDS;

  const turnTimeLeft = useMemo(() => {
    if (!roomState || roomState.mode || roomState.status !== 'playing' || roomState.pendingWord) return turnSkipSecs;
    const elapsed = (displayNow - roomState.turnStartedAt) / 1000;
    return Math.max(0, turnSkipSecs - elapsed);
  }, [roomState, displayNow, turnSkipSecs]);

  // نقرات العد التنازلي
  useEffect(() => {
    if (!roomState || roomState.mode || roomState.status !== 'playing' || roomState.pendingWord) {
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
    const finalEnding = ENDING_PRESETS[Math.floor(Math.random() * ENDING_PRESETS.length)].value;
    if (selectedMode === 'chess' && !finalEnding) { setGlobalError('اختر نهاية الكلمات'); return; }
    const secret = normalizeGuess(secretWord);
    if (selectedMode === 'guess' && guessCustom) {
      const sl = [...secret].length;
      if (!/^[\u0621-\u064A]+$/.test(secret) || (sl !== 3 && sl !== 5)) { setGlobalError('الكلمة السرية لازم تكون ٣ أو ٥ أحرف عربية'); return; }
    }

    setBusy(true);
    setGlobalError(null);

    try {
      const rid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random()).slice(2);
      const build = (code) => selectedMode === 'race'
        ? createRaceState(code, hostName.trim(), { duration: selectedRaceDuration })
        : selectedMode === 'guess'
        ? (guessCustom ? createGuessState(code, hostName.trim(), [...secret].length, secret, secretClue) : createGuessState(code, hostName.trim(), selectedGuessLen))
        : createInitialState(code, hostName.trim(), { timeControl: selectedTime, ending: finalEnding, turnSkipSeconds: selectedTurnSkip });

      let code = null, state = null;
      for (let tries = 0; tries < 12 && !code; tries++) {
        const c = generateRoomCode();
        const st = { ...build(c), rid };
        if (await roomCreate(c, st)) { code = c; state = st; }
      }
      if (!code) throw new Error('ما لقينا كود فاضي، جرّب مرة ثانية');
      saveName(hostName.trim());
      enterRoom(code, 1, state);
    } catch (e) {
      console.error('[createRoom]', e);
      setGlobalError(`تعذر إنشاء الغرفة: ${e?.message || 'خطأ غير معروف'}`);
    } finally {
      setBusy(false);
    }
  }, [hostName, useCustom, customEnding, selectedEnding, selectedTime, selectedTurnSkip, selectedMode, selectedRaceDuration, selectedGuessLen, guessCustom, secretWord, secretClue, enterRoom]);

  const checkJoinCode = useCallback(async () => {
    if (joinCode.length !== 4) { setGlobalError('الكود لازم يكون ٤ أرقام'); return; }
    setBusy(true);
    setGlobalError(null);
    try {
      const state = await getRoom(joinCode);
      if (!state) { setGlobalError('ما لقينا غرفة بهذا الكود'); return; }
      const stored = getMyRole(joinCode, state);
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
    if (!roomState || roomState.pendingWord) return;
    if (roomState.currentTurn !== myRole) {
      setFeedback({ type: 'error', text: 'مو دورك — انتظر شوي' });
      setTimeout(() => setFeedback(null), 1200);
      return;
    }
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
        pendingAt: now(),
      }, 'pendingAt');
    }
  }, [roomState, myRole, currentInput, commitChess]);

  // كتابة مشروطة مع إعادة محاولة: لو تعارضت مع كتابة الخصم بنفس اللحظة نعيد على أحدث نسخة
  const casRetry = useCallback(async (build, stamp = null) => {
    let base = roomStateRef.current;
    for (let attempt = 0; attempt < 4; attempt++) {
      const next = build(base);
      if (!next) return;
      setRoomState(next);
      if (roomCode === 'DEMO') return; // وضع المعاينة
      try {
        const r = await roomCas(roomCode, base.version ?? 0, next, stamp);
        if (r?.state) applyServerState(r.state);
        if (r?.ok || !r?.state) return;
        base = r.state;
      } catch (e) {
        console.error('[guess]', e);
        setConnected(false);
        try { const fresh = await getRoom(roomCode); if (fresh) applyServerState(fresh); } catch {}
        return;
      }
    }
  }, [roomCode, applyServerState]);

  // كل لاعب يضيف تخمينه فقط
  const submitGuessOnline = useCallback((word, result) => {
    const key = `guesses_p${myRole}`;
    const tries = GUESS_LENGTHS[roomStateRef.current?.settings?.len || 4].tries;
    return casRetry((base) => {
      if (!base || base.status !== 'playing') return null;
      const mine = base[key] || [];
      if (mine.length >= tries || mine.some(g => g.result.every(r => r === 'correct'))) return null;
      return settleGuessDuel({ ...base, [key]: [...mine, { word, result, ts: now() }] });
    });
  }, [myRole, casRetry]);

  // اختيار كلمة الجولة الجديدة
  const chooseSecret = useCallback((word, clue = '') => casRetry((base) => {
    if (!base || base.status !== 'choosing' || base.setter !== myRole) return null;
    if (base.players?.[myRole === 1 ? 2 : 1]?.left) return null;
    const len = [...word].length;
    return { ...base, status: 'playing', answer: word, clue: (clue || '').trim().slice(0, 40), settings: { ...base.settings, len, duration: DUEL_SECONDS[len] }, turnStartedAt: now() };
  }, 'turnStartedAt'), [casRetry, myRole]);

  // انتهى وقت التحدي → يتحسم الفائز
  const guessTimeUp = useCallback(() => casRetry((base) => {
    if (!base || base.status !== 'playing') return null;
    return settleGuessDuel(base, true);
  }), [casRetry]);

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
    if (roomState.mode === 'guess' && roomState.settings?.custom) {
      newState = {
        ...roomState,
        status: 'choosing',
        players: cleanPlayers,
        setter: roomState.setter === 1 ? 2 : 1,
        answer: null,
        clue: '',
        guesses_p1: [],
        guesses_p2: [],
        winner: null,
        resigned: null,
        timeUp: false,
        gameNumber: newGameNum,
      };
    } else if (roomState.mode === 'guess') {
      newState = {
        ...roomState,
        status: 'playing',
        players: cleanPlayers,
        answer: randomAnswer(roomState.settings.len),
        guesses_p1: [],
        guesses_p2: [],
        winner: null,
        resigned: null,
        timeUp: false,
        gameNumber: newGameNum,
      };
    } else if (roomState.mode === 'race') {
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
        const code = roomCode, role = myRole;
        roomCancel(code).then(ok => { if (!ok) roomLeave(code, role).catch(() => {}); }).catch(() => {});
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
    ? publicUrl(`/?room=${roomCode}`) : '';

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
    if (await shareContent({ title: 'لعبة الكلمات', text, url: inviteUrl })) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${inviteUrl}`)}`, '_blank', 'noopener');
  }, [inviteUrl, roomCode]);

  const startLocal = useCallback((vsBot = false) => {
    const finalEnding = ENDING_PRESETS[Math.floor(Math.random() * ENDING_PRESETS.length)].value;
    if (!hostName.trim() || !finalEnding) {
      setGlobalError('أكمل البيانات أولاً');
      return;
    }
    saveName(hostName.trim());
    const state = createInitialState('local', hostName.trim(), {
      timeControl: selectedTime, ending: finalEnding, turnSkipSeconds: selectedTurnSkip,
    });
    state.players[2] = vsBot ? { name: 'الكمبيوتر 🤖', joined: true } : { name: 'اللاعب الثاني', joined: true };
    state.vsBot = vsBot;
    state.status = 'playing';
    state.turnStartedAt = Date.now();
    setRoomCode('local');
    setMyRoleState(null);
    setRoomState(state);
    setScreen('local-playing');
  }, [hostName, useCustom, customEnding, selectedEnding, selectedTime, selectedTurnSkip]);


  // ============== المعطيات المحسوبة ==============
  const displayTimes = useMemo(() => {
    if (!roomState || roomState.mode) return { 1: 0, 2: 0 };
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

  // ============== الألعاب: كل لعبة فيها "لحالك" و "مع صاحبك" ==============
  const GAMES = {
    chess: {
      title: 'ساعة الشطرنج', tagline: 'بالدور، ولكل لاعب ساعته',
      rules: 'نهاية وحدة للجولة كلها. كل واحد يكتب كلمة بدوره قبل ما يخلص وقته — اللي يخلص وقته أول يخسر.',
      bg: '#ffb020', sh: '#b86b00', fg: '#4a2400',
      icon: <Hourglass className="w-6 h-6" strokeWidth={2.6} />,
      solo: { title: 'ضد الكمبيوتر', desc: 'تحدّى الكمبيوتر بالدور', icon: <Bot className="w-6 h-6 text-white" strokeWidth={2.6} />,
        go: () => { setMyRoleState('bot'); setScreen('create-setup'); } },
      local: true,
    },
    race: {
      title: 'سباق الكلمات', tagline: 'الأسرع ياخذ النقطة',
      rules: 'كل سؤال نهاية مختلفة، وأول واحد يكتب كلمة صح ياخذ النقطة. فيه تجميد للخصم وتجاوز للسؤال!',
      bg: '#22d3ee', sh: '#0e7490', fg: '#083344',
      icon: <Zap className="w-6 h-6" strokeWidth={2.6} />,
      solo: { title: 'تدريب ضد الوقت', desc: 'أكبر عدد كلمات، وسجّل رقمك القياسي', icon: <Target className="w-6 h-6 text-white" strokeWidth={2.6} />,
        go: () => setScreen('solo') },
    },
    guess: {
      title: 'خمّن الكلمة', tagline: 'اكتشف الكلمة المخفية بالألوان', isNew: true,
      rules: 'خمّن الكلمة المخفية. الأخضر حرف صح بمكانه، والبرتقالي حرف موجود بمكان ثاني.',
      bg: '#22c55e', sh: '#15803d', fg: '#ffffff',
      icon: (
        <span className="grid grid-cols-2 gap-[3px]">
          <i className="block w-[10px] h-[10px] rounded-[3px] bg-white" />
          <i className="block w-[10px] h-[10px] rounded-[3px] bg-[#ffb020]" />
          <i className="block w-[10px] h-[10px] rounded-[3px] bg-white/45" />
          <i className="block w-[10px] h-[10px] rounded-[3px] bg-white" />
        </span>
      ),
      solo: { title: 'خمّن الكلمة', desc: 'كلمة جديدة كل مرة، وسجّل الستريك', icon: <Target className="w-6 h-6 text-white" strokeWidth={2.6} />,
        go: () => setScreen('guess') },
    },
  };


  const listRow = ({ key, title, desc, icon, bg, sh, onClick, badge, chips }) => (
    <button key={key} onClick={onClick}
      className="btn-3d relative w-full rounded-2xl bg-white p-2.5 pl-3 flex items-center gap-3 text-right"
      style={{ boxShadow: '0 5px 0 #c4b5fd', border: '2px solid #ede9fe' }}>
      <span className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: bg, boxShadow: `0 3px 0 ${sh}` }}>
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="font-display font-black text-[1.05rem] text-[#2e1065]">{title}</span>
          {badge && <span className="rounded-full bg-[#ff4d6d] px-2 py-[1px] text-[0.62rem] font-display font-black text-white">{badge}</span>}
        </span>
        <span className="block text-[0.78rem] font-bold text-[#6d5b95] truncate">{desc}</span>
        {chips && (
          <span className="flex gap-1.5 mt-1">
            {chips.map(c => (
              <span key={c} className="rounded-full bg-[#f5f3ff] border border-[#ede9fe] px-2 py-[1px] text-[0.62rem] font-display font-bold text-[#6d28d9]">{c}</span>
            ))}
          </span>
        )}
      </span>
      <ChevronLeft className="shrink-0 w-5 h-5 text-[#c4b5fd]" strokeWidth={3} />
    </button>
  );

  if (screen === 'menu') {
    const logo = [
      { ch: 'ك', bg: '#ffffff', fg: '#3b1d6e', sh: '#c4b5fd', r: -8 },
      { ch: 'ل', bg: '#ffb020', fg: '#4a2400', sh: '#b86b00', r: 5 },
      { ch: 'م', bg: '#ffffff', fg: '#3b1d6e', sh: '#c4b5fd', r: -3 },
      { ch: 'ا', bg: '#22c55e', fg: '#ffffff', sh: '#15803d', r: 7 },
      { ch: 'ت', bg: '#ffffff', fg: '#3b1d6e', sh: '#c4b5fd', r: -6 },
    ];
    const gameIcon = (id) => <span style={{ color: GAMES[id].fg }}>{GAMES[id].icon}</span>;
    const createFor = (id) => () => { setSelectedMode(id); setMyRoleState(null); setGlobalError(null); setScreen('create-setup'); };

    const endingsIcon = (
      <span className="font-display font-black text-[1.25rem] leading-none" style={{ color: '#4a2400', paddingBottom: 3 }}>ـام</span>
    );
    const soloGames = [
      { key: 'endings', title: 'تحدي النهايات', desc: 'ضد الكمبيوتر 🤖 أو ضد الوقت ⏱', icon: endingsIcon, bg: '#ffb020', sh: '#b86b00',
        onClick: () => { setSelectedMode('chess'); setMyRoleState('bot'); setGlobalError(null); setScreen('create-setup'); } },
      { key: 'guess', title: 'خمّن الكلمة', desc: 'اكتشف الكلمة المخفية بالألوان', icon: gameIcon('guess'), bg: GAMES.guess.bg, sh: GAMES.guess.sh, badge: 'جديد',
        onClick: () => setScreen('guess') },
    ];
    const friendGames = [
      { key: 'endings', title: 'تحدي النهايات', desc: 'بالدور ⏱ أو سباق ⚡', icon: endingsIcon, bg: '#ffb020', sh: '#b86b00',
        onClick: () => { setSelectedMode(m => (m === 'race' ? 'race' : 'chess')); setMyRoleState(null); setGlobalError(null); setScreen('create-setup'); } },
      { key: 'guess', title: 'خمّن الكلمة', desc: 'نفس الكلمة، مين يحلها أول؟', icon: gameIcon('guess'), bg: GAMES.guess.bg, sh: GAMES.guess.sh, badge: 'جديد', onClick: createFor('guess') },
    ];

    const shownName = hostName.trim() || 'اختر اسمك';
    const pts = myPoints || {};

    // رسومات البطاقات
    const endingsArt = (
      <div className="relative w-[96px] h-[92px]">
        {[['ك', -14, 4, 0], ['ت', 6, 30, 1], ['ـام', -2, 52, 2]].map(([ch, rot, top, i]) => (
          <div key={i} className="absolute rounded-xl flex items-center justify-center font-display font-black"
            style={{
              top, left: i === 2 ? 10 : i * 34, transform: `rotate(${rot}deg)`,
              width: i === 2 ? 72 : 40, height: 38, fontSize: i === 2 ? 22 : 20, paddingBottom: 3,
              background: i === 2 ? '#fff' : 'rgba(255,255,255,0.35)', color: i === 2 ? '#b84a00' : '#fff',
              boxShadow: i === 2 ? '0 4px 0 #b84a00' : 'none', border: '2px solid rgba(255,255,255,0.6)',
            }}>{ch}</div>
        ))}
      </div>
    );
    const guessArt = (
      <div className="grid grid-cols-3 gap-[5px] rotate-[-6deg]">
        {['#fff', '#ffb020', '#3b1f7a', '#fff', '#fff', '#ffb020', '#16a34a', '#16a34a', '#16a34a'].map((c, i) => (
          <i key={i} className="block w-[26px] h-[26px] rounded-md"
            style={{ background: c === '#fff' ? 'rgba(255,255,255,0.35)' : c, boxShadow: c === '#16a34a' ? '0 3px 0 #0f5132' : 'none', border: '2px solid rgba(255,255,255,0.5)' }} />
        ))}
      </div>
    );

    const gameCard = ({ key, title, desc, from, to, sh, art, cta, onClick, badge }) => (
      <button key={key} onClick={onClick}
        className="btn-3d relative w-full overflow-hidden rounded-[28px] p-4 pl-3 flex items-center gap-3 text-right"
        style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`, boxShadow: `0 7px 0 ${sh}`, border: '2px solid rgba(255,255,255,0.4)', minHeight: 148 }}>
        <span className="absolute -left-8 -bottom-10 w-36 h-36 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
        <span className="absolute left-20 -top-8 w-20 h-20 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <span className="relative flex-1 min-w-0">
          {badge && (
            <span className="inline-block mb-1 rounded-full bg-white px-2.5 py-0.5 text-[0.72rem] font-display font-black" style={{ color: sh }}>{badge}</span>
          )}
          <span className="block font-display font-black text-white leading-tight" style={{ fontSize: '1.65rem', textShadow: `0 3px 0 ${sh}` }}>{title}</span>
          <span className="block text-white/95 font-display font-bold text-[0.85rem] mt-1 leading-snug">{desc}</span>
          <span className="inline-flex mt-3 items-center gap-1.5 rounded-full bg-white px-4 py-1.5 font-display font-black text-[0.95rem]"
            style={{ color: sh, boxShadow: '0 3px 0 rgba(0,0,0,0.18)' }}>
            <Play className="w-4 h-4" fill="currentColor" strokeWidth={0} /> {cta}
          </span>
        </span>
        <span className="relative shrink-0">{art}</span>
      </button>
    );

    const ENDINGS = { title: 'تحدي النهايات', from: '#ffb020', to: '#ff6b1a', sh: '#b84a00', art: endingsArt };
    const GUESS = { title: 'خمّن الكلمة', from: '#22c55e', to: '#0d9488', sh: '#0f5132', art: guessArt };

    return (
      <Screen center={false} className="pt-3 pb-6">
        <div className="fade-in">
          {/* الشريط العلوي: اسمك + نقاطك */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <button onClick={() => { setNameDraft(hostName); setNameOpen(true); }}
              className="flex items-center gap-2 rounded-full bg-white/15 hover:bg-white/25 pl-3 pr-1 py-1 min-h-[44px] min-w-0 transition-all active:scale-95">
              <span className="w-9 h-9 rounded-full flex items-center justify-center font-display font-black text-[#4a2400] shrink-0"
                style={{ background: '#ffb020', boxShadow: '0 2px 0 #b86b00' }}>
                {(hostName.trim() || '؟').slice(0, 1)}
              </span>
              <span className="font-display font-black text-white truncate max-w-[9rem]">{shownName}</span>
              <Pencil className="w-3.5 h-3.5 text-white/70 shrink-0" strokeWidth={2.6} />
            </button>
            <div className="flex items-center gap-1.5 rounded-full px-3.5 py-2 font-display font-black text-[#4a2400] shrink-0"
              style={{ background: '#fde047', boxShadow: '0 3px 0 #ca8a04' }}>
              <Star className="w-4 h-4" fill="currentColor" strokeWidth={0} />
              <bdi className="font-mono-ar">{pts.points ?? 0}</bdi>
            </div>
          </div>

          {/* الشعار */}
          <div className="text-center mb-4">
            <div className="flex justify-center gap-1.5 mb-2" dir="rtl">
              {logo.map((t, i) => (
                <div key={i} style={{ transform: `rotate(${t.r}deg)` }}>
                  <div className="word-pop rounded-xl flex items-center justify-center font-display font-black"
                    style={{
                      width: 40, height: 44, fontSize: 24, paddingBottom: 3,
                      background: t.bg, color: t.fg, boxShadow: `0 5px 0 ${t.sh}, 0 12px 18px -10px rgba(30,10,80,.6)`,
                      border: '3px solid rgba(255,255,255,.65)', animationDelay: `${i * 80}ms`,
                    }}>
                    {t.ch}
                  </div>
                </div>
              ))}
            </div>
            <h1 className="font-display font-black text-white"
              style={{ fontSize: 'clamp(2rem, 9.5vw, 2.6rem)', lineHeight: 1.15, textShadow: '0 4px 0 rgba(46,16,101,0.5)' }}>
              لعبة الكلمات
            </h1>
          </div>

          {/* بطاقة الترتيب */}
          <button onClick={() => setScreen('leaderboard')}
            className="btn-3d relative w-full overflow-hidden rounded-3xl p-3 mb-4 flex items-center gap-3 text-right bg-white"
            style={{ boxShadow: '0 6px 0 #c4b5fd', border: '2px solid #ede9fe' }}>
            {/* ترتيبك */}
            <span className="relative shrink-0 w-[60px] h-[60px] rounded-2xl flex flex-col items-center justify-center"
              style={{ background: 'linear-gradient(160deg, #ffe066 0%, #ffb020 100%)', boxShadow: '0 4px 0 #b86b00' }}>
              {pts.week > 0 && pts.weekRank && <Trophy className="absolute -top-2 -left-2 w-6 h-6 text-[#ca8a04] rotate-[-14deg]" fill="#fde047" strokeWidth={2} />}
              {pts.week > 0 && pts.weekRank ? (
                <>
                  <span className="text-[0.6rem] font-display font-black text-[#713f12] leading-none">ترتيبك</span>
                  <span className="font-display font-black text-[1.7rem] text-[#4a2400] leading-none mt-0.5">#<bdi className="font-mono-ar">{pts.weekRank}</bdi></span>
                </>
              ) : (
                <span className="text-2xl">🏆</span>
              )}
            </span>

            {/* النص */}
            <span className="flex-1 min-w-0">
              <span className="block font-display font-black text-[#2e1065] text-[1.05rem] leading-tight">ترتيب الأسبوع</span>
              <span className="block font-display font-bold text-[#6d5b95] text-[0.8rem] mt-0.5">
                {pts.week > 0
                  ? <>⭐ <bdi className="font-mono-ar">{pts.week}</bdi> نقطة هالأسبوع</>
                  : 'العب وادخل المنافسة 🔥'}
              </span>
            </span>

            {/* أول ٣ */}
            {weekTop.length > 0 ? (
              <span className="shrink-0 flex items-center" dir="ltr">
                {weekTop.map((r, i) => (
                  <span key={i} className="relative -ml-2 first:ml-0" style={{ zIndex: 3 - i }}>
                    <span className="w-9 h-9 rounded-full flex items-center justify-center font-display font-black text-sm border-[3px] border-white"
                      style={{ background: ['#ffb020', '#a5b4fc', '#fb923c'][i], color: '#2e1065' }}>
                      {(r.name || '؟').slice(0, 1)}
                    </span>
                    <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[0.75rem] leading-none">{['🥇', '🥈', '🥉'][i]}</span>
                  </span>
                ))}
              </span>
            ) : null}
            <ChevronLeft className="w-5 h-5 text-[#c4b5fd] shrink-0" strokeWidth={3} />
          </button>

          {/* لحالك / مع صاحبك */}
          <div className="flex gap-1.5 p-1 rounded-2xl bg-white/15 mb-4">
            {[['solo', 'العب لحالك', User], ['friends', 'مع صاحبك', Users]].map(([id, label, Icon]) => (
              <button key={id} onClick={() => setHomeTab(id)}
                className="flex-1 rounded-xl min-h-[44px] flex items-center justify-center gap-1.5 font-display font-black transition-all"
                style={homeTab === id ? { background: '#fff', color: '#4c1d95', boxShadow: '0 3px 0 #c4b5fd' } : { color: 'rgba(255,255,255,0.9)' }}>
                <Icon className="w-4 h-4" strokeWidth={2.8} /> {label}
              </button>
            ))}
          </div>

          {homeTab === 'solo' ? (
            <div key="solo" className="space-y-4 slide-in">
              {gameCard({ key: 'e', ...ENDINGS, desc: 'كلمات تنتهي بحروف معيّنة — ضد الكمبيوتر أو ضد الوقت', cta: 'العب',
                onClick: () => { setSelectedMode('chess'); setMyRoleState('bot'); setGlobalError(null); setScreen('create-setup'); } })}
              {gameCard({ key: 'g', ...GUESS, desc: 'اكتشف الكلمة المخفية بالألوان', cta: 'العب', badge: 'جديد',
                onClick: () => setScreen('guess') })}
            </div>
          ) : (
            <div key="friends" className="space-y-4 slide-in">
              <button onClick={() => { setScreen('join-setup'); setGlobalError(null); }}
                className="btn-3d w-full rounded-2xl min-h-[52px] flex items-center justify-center gap-2 font-display font-black"
                style={{ color: '#083344', background: '#22d3ee', boxShadow: '0 5px 0 #0e7490', border: '2px solid #67e8f9' }}>
                <LogIn className="w-5 h-5" strokeWidth={2.6} />
                ادخل بكود
              </button>
              {gameCard({ key: 'e', ...ENDINGS, desc: 'بالدور ⏱ أو سباق ⚡ — أونلاين بكود', cta: 'أنشئ غرفة',
                onClick: () => { setSelectedMode(m => (m === 'race' ? 'race' : 'chess')); setMyRoleState(null); setGlobalError(null); setScreen('create-setup'); } })}
              {gameCard({ key: 'g', ...GUESS, desc: 'نفس الكلمة، أو اختر له كلمة يخمّنها', cta: 'أنشئ غرفة', badge: 'جديد',
                onClick: createFor('guess') })}
            </div>
          )}
        </div>

        {/* تغيير الاسم */}
        {nameOpen && (
          <div className="fixed left-0 right-0 z-40 flex items-start justify-center p-4 pt-[12vh] bg-[#1e0b4b]/60 fade-in"
            style={{ top: 'var(--vv-top, 0px)', height: 'var(--vv-h, 100dvh)' }} onClick={() => setNameOpen(false)}>
            <div className="w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <Card className="p-5 slide-in">
                <Title sub="يظهر لأصحابك وفي الترتيب">اسمك</Title>
                <input type="text" value={nameDraft} onChange={e => setNameDraft(e.target.value)} autoFocus maxLength={20}
                  onKeyDown={e => e.key === 'Enter' && saveMyName()}
                  placeholder="اكتب اسمك" autoComplete="nickname" className={`${inputClass} text-center font-display text-xl mb-3`} />
                <Btn icon={Check} disabled={!nameDraft.trim()} onClick={saveMyName}>حفظ</Btn>
              </Card>
            </div>
          </div>
        )}
      </Screen>
    );
  }

  // -------- الترتيب --------
  if (screen === 'leaderboard') {
    return <Leaderboard onExit={() => setScreen('menu')} />;
  }

  // -------- خمّن الكلمة --------
  if (screen === 'guess') {
    return <GuessGame onExit={() => setScreen('menu')} />;
  }

  // -------- التدريب الفردي --------
  if (screen === 'solo') {
    return <SoloGame endings={ENDING_PRESETS.map(p => p.value)} startDuration={soloStartDuration}
      onExit={() => { setSoloStartDuration(null); setScreen('menu'); }} />;
  }

  // -------- شاشة إعداد الإنشاء --------
  if (screen === 'create-setup') {
    const isBot = myRole === 'bot';
    const isLocal = myRole === 'local' || isBot;
    const soloTime = isBot && soloStyle === 'time';
    const game = isLocal ? 'chess' : selectedMode;
    const isRace = game === 'race' || soloTime;
    const isGuess = game === 'guess';
    const isChess = game === 'chess' && !soloTime;
    const gameName = isGuess ? GAMES.guess.title : 'تحدي النهايات';
    const styleOptions = isBot
      ? [
          { id: 'bot', label: 'ضد الكمبيوتر', sub: 'بالدور، ولكل واحد ساعة', Icon: Bot },
          { id: 'time', label: 'ضد الوقت', sub: 'أكبر عدد كلمات', Icon: Target },
        ]
      : [
          { id: 'chess', label: 'بالدور', sub: 'كل واحد له ساعته', Icon: Hourglass },
          { id: 'race', label: 'سباق', sub: 'الاثنين بنفس الوقت', Icon: Zap },
        ];
    const showStyle = isBot || (!isLocal && !isGuess);
    const savedNameOk = !!hostName.trim() && hostName.trim() === (getSavedName() || '').trim();
    const example = ENDING_PRESETS.find(p => p.value === selectedEnding)?.example;
    const backToMode = () => { setEditName(false); setMoreOpts(false); setHomeTab(isLocal && isBot ? 'solo' : 'friends'); setMyRoleState(null); setGlobalError(null); setScreen('menu'); };

    return (
      <Screen>
        <BackButton onClick={backToMode} />
        <Card className="p-5 sm:p-7 fade-in">
          <Title sub={isBot ? 'اكتب كلمات تنتهي بالحروف المطلوبة'
            : isLocal ? `${gameName} · بالتناوب على نفس الجوال`
            : `${gameName} · بعد الإنشاء أرسل الدعوة لصاحبك`}>
            {isBot ? 'تحدي النهايات' : isLocal ? 'جهاز واحد' : 'غرفة جديدة'}
          </Title>

          <div className="space-y-5">
            {showStyle && (
              <div>
                <Label>طريقة اللعب</Label>
                <div className="grid grid-cols-2 gap-2.5">
                  {styleOptions.map(({ id, label, sub, Icon }) => {
                    const sel = isBot ? soloStyle === id : selectedMode === id;
                    return (
                      <Choice key={id} selected={sel} onClick={() => (isBot ? setSoloStyle(id) : setSelectedMode(id))} className="p-3">
                        <Icon className="w-6 h-6 mx-auto mb-1" style={{ color: sel ? '#4a2400' : '#8b5cf6' }} strokeWidth={2.4} />
                        <div className="font-display font-black">{label}</div>
                        <div className="text-[0.72rem] opacity-75 leading-snug">{sub}</div>
                      </Choice>
                    );
                  })}
                </div>
              </div>
            )}

            {!soloTime && savedNameOk && !editName && (
              <div className="flex items-center justify-between rounded-2xl bg-[#f5f3ff] border-2 border-[#ede9fe] px-4 min-h-[48px]">
                <span className="font-display font-bold text-[#6d5b95] text-sm">{isLocal && !isBot ? 'اللاعب الأول' : 'تلعب باسم'} <b className="text-[#2e1065] text-base">{hostName}</b></span>
                <button onClick={() => setEditName(true)} className="font-display font-bold text-sm text-[#7c3aed] min-h-[40px] px-2">تغيير</button>
              </div>
            )}

            {!soloTime && (!savedNameOk || editName) && <div>
              <Label>{isLocal && !isBot ? 'اسم اللاعب الأول' : 'اسمك'}</Label>
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
            </div>}

            {isChess && (
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
                <button onClick={() => setMoreOpts(v => !v)}
                  className="w-full flex items-center justify-between rounded-2xl bg-[#f5f3ff] border-2 border-[#ede9fe] px-4 min-h-[48px] font-display font-bold text-sm text-[#4c1d95]">
                  <span>وقت الدور</span>
                  <span className="flex items-center gap-2 text-[#6d5b95]">
                    <span>الدور <bdi className="font-mono-ar">{selectedTurnSkip}</bdi>ث</span>
                    <ChevronLeft className={`w-4 h-4 transition-transform ${moreOpts ? '-rotate-90' : ''}`} strokeWidth={3} />
                  </span>
                </button>
                {moreOpts && <>
                <div>
                  <Label>وقت الدور الواحد</Label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[15, 20, 30].map(sec => (
                      <Choice key={sec} selected={selectedTurnSkip === sec} onClick={() => setSelectedTurnSkip(sec)} className="py-2.5">
                        <span className="font-mono-ar font-bold text-xl">{sec}</span>
                        <span className="text-xs opacity-75 mr-1">ثانية</span>
                      </Choice>
                    ))}
                  </div>
                </div>
                </>}
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
                  {soloTime
                    ? 'كل سؤال نهاية مختلفة. اكتب أكبر عدد كلمات قبل ما يخلص الوقت، والتجاوز يكلّفك ٣ ثواني.'
                    : 'كل سؤال نهاية مختلفة، وأول من يجاوب ياخذ النقطة. تقدر تجمّد خصمك أو تتجاوز السؤال مقابل نقاط.'}
                </p>
              </div>
            )}

            {isGuess && (
              <div>
                <Label>نوع التحدي</Label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: false, label: 'نفس الكلمة', sub: 'الاثنين يخمّنون كلمة عشوائية', Icon: Users },
                    { id: true, label: 'أنت تختار', sub: 'اكتب كلمة وصاحبك يخمّنها', Icon: Target },
                  ].map(({ id, label, sub, Icon }) => (
                    <Choice key={String(id)} selected={guessCustom === id} onClick={() => setGuessCustom(id)} className="p-3">
                      <Icon className="w-6 h-6 mx-auto mb-1" style={{ color: guessCustom === id ? '#4a2400' : '#8b5cf6' }} strokeWidth={2.4} />
                      <div className="font-display font-black">{label}</div>
                      <div className="text-[0.72rem] opacity-75 leading-snug">{sub}</div>
                    </Choice>
                  ))}
                </div>
              </div>
            )}

            {isGuess && guessCustom && (
              <div>
                <Label>الكلمة السرية (٣ أو ٥ أحرف)</Label>
                <input
                  type="text"
                  value={secretWord}
                  onChange={(e) => setSecretWord(e.target.value)}
                  placeholder="مثلاً: قمر أو مدرسة"
                  maxLength={8}
                  autoComplete="off"
                  autoCorrect="off"
                  className={`${inputClass} text-center font-display text-2xl tracking-wide`}
                />
                <input
                  type="text"
                  value={secretClue}
                  onChange={(e) => setSecretClue(e.target.value)}
                  placeholder="💡 تلميح لصاحبك (اختياري) — مثلاً: حيوان"
                  maxLength={40}
                  autoComplete="off"
                  className={`${inputClass} mt-2.5 text-center font-display`}
                />
                <p className="text-xs text-dim mt-2">🔒 صاحبك ما يشوفها — أنت تتفرج عليه وهو يخمّن. أي كلمة عربية تمشي، حتى لو اسم أو عامية.</p>
              </div>
            )}

            {isGuess && !guessCustom && (
              <div>
                <Label>عدد الحروف</Label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[3, 5].map(l => (
                    <Choice key={l} selected={selectedGuessLen === l} onClick={() => setSelectedGuessLen(l)} className="py-2.5">
                      <div className="font-display font-black text-xl leading-tight"><bdi className="font-mono-ar">{l}</bdi> أحرف</div>
                      <div className="text-xs opacity-75"><bdi className="font-mono-ar">{GUESS_LENGTHS[l].tries}</bdi> محاولات</div>
                    </Choice>
                  ))}
                </div>
                <p className="text-xs text-dim mt-2.5 leading-relaxed">
                  الاثنين يخمّنون نفس الكلمة بنفس الوقت (بدون أدوار)، وعندكم <bdi className="font-mono-ar">{DUEL_SECONDS[selectedGuessLen] / 60}</bdi> دقائق. تشوف تقدّم صاحبك بالألوان، واللي يحلها بمحاولات أقل يفوز.
                </p>
              </div>
            )}

            <ErrorNote>{globalError}</ErrorNote>

            <Btn onClick={soloTime ? () => { setSoloStartDuration(selectedRaceDuration); setScreen('solo'); }
                : isLocal ? () => startLocal(isBot) : createRoom} busy={busy} icon={Play}>
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
  if (screen === 'playing' && roomState && myRole && roomState.mode === 'guess' && roomState.status === 'choosing') {
    return <ChooseWord roomState={roomState} myRole={myRole} onChoose={chooseSecret} onExit={leaveRoom} />;
  }

  if (screen === 'playing' && roomState && myRole && roomState.mode === 'guess') {
    return <GuessDuel key={roomState.gameNumber} roomState={roomState} myRole={myRole} connected={connected}
      onSubmitGuess={submitGuessOnline} onResign={resign} onTimeUp={guessTimeUp} />;
  }

  if (screen === 'playing' && roomState && myRole && roomState.mode === 'race') {
    return <RaceGame key={roomState.gameNumber} roomState={roomState} setRoomState={setRoomState} applyServerState={applyServerState} myRole={myRole} roomCode={roomCode} />;
  }

  if (screen === 'playing' && roomState && myRole) {
    const pendingByMe = roomState.pendingWord?.by === myRole;
    const pendingByOpp = roomState.pendingWord && !pendingByMe;
    const tcName = TIME_CONTROLS.find(t => t.id === roomState.settings.timeControlId)?.name;

    return (
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
          <Card className="p-3">
            {roomState.pendingWord && pendingByOpp ? (
              <div className="text-center slide-in">
                <div className="text-xs text-muted font-display font-bold">{oppName} يقترح كلمة مو موجودة في القاموس · تنقبل تلقائياً بعد ٢٠ ثانية</div>
                <div className="font-display font-black my-1.5 text-[#7c3aed]" style={{ fontSize: 'clamp(2rem, 10vw, 2.6rem)', lineHeight: 1.25 }}>
                  {roomState.pendingWord.word}
                </div>
                <div className="flex gap-2.5">
                  <div className="flex-1"><Btn variant="green" size="md" icon={Check} onClick={acceptPending}>أقبلها</Btn></div>
                  <div className="flex-1"><Btn variant="red" size="md" icon={X} onClick={rejectPending}>أرفضها</Btn></div>
                </div>
              </div>
            ) : roomState.pendingWord ? (
              <div className="text-center py-1.5 slide-in">
                <div className="font-display font-black text-2xl text-[#7c3aed]">{roomState.pendingWord.word}</div>
                <div className="text-sm text-muted font-bold"><Thinking>بانتظار قرار {oppName}</Thinking></div>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitWord()}
                    placeholder={isMyTurn ? `كلمة تنتهي بـ ${roomState.settings.ending}` : 'جهّز كلمتك هنا…'}
                    enterKeyHint="send"
                    autoComplete="off"
                    autoCorrect="off"
                    className={`${inputClass} flex-1 min-w-0 font-display text-xl text-center ${isMyTurn ? '!border-[#22c55e] !bg-white' : ''} ${feedback?.type === 'error' ? 'shake !border-[#ff4d6d]' : ''}`}
                  />
                  <button
                    onClick={submitWord} onPointerDown={e => e.preventDefault()}
                    disabled={!currentInput.trim() || !isMyTurn}
                    aria-label="إرسال"
                    className="btn-3d shrink-0 w-14 rounded-2xl flex items-center justify-center"
                    style={{ color: '#fff', background: '#22c55e', boxShadow: '0 5px 0 #15803d', border: '2px solid #4ade80' }}>
                    <Check className="w-7 h-7" strokeWidth={3.2} />
                  </button>
                </div>
                <div className="h-5 mt-1.5 text-center text-sm font-display">
                  {feedback ? (
                    <span className={`slide-in inline-flex items-center gap-1.5 ${feedback.type === 'success' ? 'text-[#16a34a]' : 'text-[#e11d48]'} font-bold`}>
                      {feedback.type === 'success' && <Sparkles className="w-4 h-4" />}{feedback.text}
                    </span>
                  ) : !isMyTurn && currentInput.trim() ? (
                    <span className="text-muted font-bold text-xs">جاهزة ✓ — ترسلها أول ما يجي دورك</span>
                  ) : null}
                </div>
              </>
            )}
          </Card>
        </ChessTable>
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
    const isGuess = roomState.mode === 'guess';
    const guessSolved = (r) => {
      const g = roomState[`guesses_p${r}`] || [];
      const i = g.findIndex(x => x.result.every(c => c === 'correct'));
      return i < 0 ? 0 : i + 1;
    };
    const isCustom = isGuess && !!roomState.settings?.custom;
    const scoreOf = (r) => (isCustom && roomState.setter === r ? '🎯' : isGuess ? (guessSolved(r) || '✗') : isRace ? raceScore(roomState, r) : wordCounts[r]);
    const iWon = !isDraw && winner === myRole;

    return (
      <Screen glow={isDraw ? '#a8a29e' : PLAYER_COLORS[winner]} className="py-2">
        {iWon && <Confetti />}
        <div className="fade-in">
          <ResultHeader
            isDraw={isDraw}
            winnerName={!isDraw ? roomState.players[winner].name : ''}
            winnerPlayer={winner}
            subtitle={isCustom
              ? (winner === roomState.setter ? 'الكلمة صعّبت عليه 😏' : 'حلّ الكلمة! 🎉')
              : isDraw ? 'كلاكم على نفس المستوى 🤝' : iWon ? 'مبروك! 🎉' : 'حظ أوفر المرة الجاية'}
            unit={isGuess ? 'محاولات' : isRace ? 'نقطة' : 'كلمة'}
            sides={[myRole, oppRole].map(r => ({
              name: roomState.players[r]?.name, player: r, score: scoreOf(r), tag: r === myRole ? '(أنت)' : '',
              ...(isGuess ? { dim: !isDraw && winner !== r } : {}),
            }))}
          />


          {pointsGain > 0 && (
            <div className="flex justify-center mb-4 -mt-1">
              <div className="word-pop inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-display font-black text-[#4a2400]"
                style={{ background: '#fde047', boxShadow: '0 4px 0 #ca8a04' }}>
                <Star className="w-4 h-4" fill="currentColor" strokeWidth={0} /> +<bdi className="font-mono-ar">{pointsGain}</bdi> نقطة
              </div>
            </div>
          )}
          {isGuess && roomState.timeUp && (
            <div className="glass rounded-2xl px-4 py-2.5 mb-4 text-sm text-center font-display font-bold slide-in text-white">
              ⏰ انتهى الوقت — {isDraw ? 'ما أحد حلّها' : 'الفائز اللي حلّها أو اللي كان أقرب'}
            </div>
          )}

          {(oppResigned || iResigned || oppLeft) && (
            <div className="glass rounded-2xl px-4 py-2.5 mb-4 text-sm text-center font-display font-bold slide-in text-white">
              {oppResigned ? <>🏳️ استسلم <span className="font-black">{oppName}</span></>
                : iResigned ? 'استسلمت في هذه الجولة'
                : <>غادر <span className="font-black">{oppName}</span> الغرفة</>}
            </div>
          )}

          {isGuess ? (
            <div className="mb-5 slide-in">
              <div className="text-center text-white/85 text-sm font-display font-bold mb-2">الكلمة كانت</div>
              <LetterTiles text={roomState.answer} size={roomState.settings.len === 3 ? 52 : roomState.settings.len === 4 ? 46 : 40} className="mb-4" />
              <div className="grid grid-cols-2 gap-3">
                {[myRole, oppRole].filter(r => !(isCustom && roomState.setter === r)).map(r => (
                  <div key={r} className="glass rounded-2xl p-3 flex flex-col items-center gap-2">
                    <span className="font-display font-black text-sm truncate max-w-full" style={{ color: PLAYER_COLORS[r] }}>{roomState.players[r]?.name}</span>
                    <MiniBoard guesses={roomState[`guesses_p${r}`] || []} len={roomState.settings.len} tries={GUESS_LENGTHS[roomState.settings.len].tries} size={14} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <MatchSummary roomState={roomState} myRole={myRole} />
          )}

          <div className="flex gap-2.5">
            {!oppLeft && !oppResigned && (
              <div className="flex-[1.5]">
                <Btn icon={RotateCcw} busy={busy} onClick={rematch}>{isCustom ? 'جولة ثانية · بدّلوا' : 'جولة ثانية'}</Btn>
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
    const botWon = roomState.vsBot && winner === 2;
    return (
      <Screen glow={PLAYER_COLORS[winner]} className="py-2">
        {!botWon && <Confetti />}
        <div className="fade-in">
          <ResultHeader
            isDraw={false}
            winnerName={roomState.players[winner].name}
            winnerPlayer={winner}
            subtitle={botWon ? 'الكمبيوتر فاز هالمرة… خذ ثأرك! 🤖' : 'مبروك! 🎉'}
            unit="كلمة"
            sides={[1, 2].map(r => ({ name: roomState.players[r].name, player: r, score: countOf(r) }))}
          />

          {pointsGain > 0 && (
            <div className="flex justify-center mb-4 -mt-1">
              <div className="word-pop inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-display font-black text-[#4a2400]"
                style={{ background: '#fde047', boxShadow: '0 4px 0 #ca8a04' }}>
                <Star className="w-4 h-4" fill="currentColor" strokeWidth={0} /> +<bdi className="font-mono-ar">{pointsGain}</bdi> نقطة
              </div>
            </div>
          )}
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

  if (screen === 'gameover' && roomState) {
    return (
      <Screen>
        <Card className="p-5 fade-in text-center">
          <div className="text-4xl mb-2">👋</div>
          <Title sub="ما تقدرون تكملون هالجولة">صاحبك طلع من الغرفة</Title>
          <Btn variant="wood" onClick={leaveRoom}>خروج</Btn>
        </Card>
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

  // -------- الكمبيوتر يلعب دوره --------
  const bot = !!roomState.vsBot;
  const botTurn = bot && roomState.currentTurn === 2;
  useEffect(() => {
    if (!botTurn || gameOverRef.current) return;
    const ending = normalize(roomState.settings.ending);
    const used = new Set(roomState.usedWords.map(w => normalizeStrict(w.word)));
    const options = ARABIC_DICTIONARY.filter(w => {
      const n = normalize(w);
      return n.endsWith(ending) && n.length > ending.length && !used.has(normalizeStrict(w));
    });
    // أحياناً "ينقفل" ويخلّي وقته يروح — وكل ما قلّت الكلمات يصير أصعب عليه
    const blankChance = 0.08 + Math.max(0, 0.25 - options.length / 200);
    if (!options.length || Math.random() < blankChance) return;
    const skipMs = (roomState.settings?.turnSkipSeconds ?? TURN_SKIP_SECONDS) * 1000;
    const delay = Math.min(skipMs - 900, 1400 + Math.random() * Math.min(5200, skipMs * 0.55));
    const t = setTimeout(() => {
      if (gameOverRef.current) return;
      acceptWord(options[Math.floor(Math.random() * options.length)]);
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botTurn, roomState.turnStartedAt]);

  const submitWord = () => {
    if (botTurn) return;
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
    else if (bot) { playReject(); setFeedback({ type: 'error', text: 'مو موجودة في القاموس' }); }
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
    setRoomState({ ...roomState, status: 'finished', winner: bot ? 2 : (roomState.currentTurn === 1 ? 2 : 1) });
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
          {bot ? <Bot className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
          <span>{bot ? 'ضد الكمبيوتر' : 'جهاز واحد'}</span>
          <span className="text-white/75">· {TIME_CONTROLS.find(t => t.id === roomState.settings.timeControlId)?.name}</span>
        </>}
      >
        <Card className="p-3">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { pendingWord ? confirmPending() : submitWord(); } }}
              readOnly={!!pendingWord}
              placeholder={botTurn ? 'جهّز كلمتك هنا…' : `كلمة تنتهي بـ ${roomState.settings.ending}`}
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="off"
              className={`${inputClass} flex-1 min-w-0 font-display text-xl text-center disabled:opacity-50 ${feedback?.type === 'error' ? 'shake !border-[#ff4d6d]' : ''}`}
            />
            <button
              onClick={submitWord} onPointerDown={e => e.preventDefault()}
              disabled={!currentInput.trim() || !!pendingWord || botTurn}
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
            <div className="h-5 mt-1.5 text-center text-sm font-display">
              {feedback && (
                <span className={`slide-in inline-flex items-center gap-1.5 ${feedback.type === 'success' ? 'text-[#16a34a]' : 'text-[#e11d48]'} font-bold`}>
                  {feedback.type === 'success' && <Sparkles className="w-4 h-4" />}{feedback.text}
                </span>
              )}
            </div>
          )}
        </Card>
      </ChessTable>
  );
}
