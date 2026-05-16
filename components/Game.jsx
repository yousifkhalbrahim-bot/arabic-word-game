'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Trophy, RotateCcw, Play, Plus, Check, X, Flag, Zap, Flame,
  Hourglass, BookOpen, Sparkles, Users, Copy, ArrowLeft, Wifi, WifiOff,
  Loader2, Smartphone, UserPlus, LogIn,
} from 'lucide-react';
import { supabase, getRoom, saveRoom, getMyRole, setMyRole, clearMyRole } from '@/lib/supabase';
import { NORMALIZED_DICT, normalize } from '@/lib/dictionary';

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
];

const generateRoomCode = () =>
  Math.floor(1000 + Math.random() * 9000).toString();

const formatTime = (seconds) => {
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

const BG_STYLE = {
  backgroundImage: `radial-gradient(circle at 25% 25%, #fbbf24 0%, transparent 50%), radial-gradient(circle at 75% 75%, #2dd4bf 0%, transparent 50%)`,
};

// ============== المكون الرئيسي ==============
export default function Game() {
  const [screen, setScreen] = useState('menu');
  const [myRole, setMyRoleState] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [roomState, setRoomState] = useState(null);
  const [connected, setConnected] = useState(true);
  const [busy, setBusy] = useState(false);
  const [globalError, setGlobalError] = useState(null);

  // إعدادات الإنشاء
  const [hostName, setHostName] = useState('');
  const [selectedTime, setSelectedTime] = useState(TIME_CONTROLS[1]);
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
  const [displayNow, setDisplayNow] = useState(Date.now());
  const inputRef = useRef(null);
  const winSubmittedRef = useRef(false);

  // ============== الاشتراك بـ Realtime ==============
  useEffect(() => {
    if (!roomCode || roomCode === 'local') return;

    let active = true;

    // التحميل الأولي
    (async () => {
      try {
        const state = await getRoom(roomCode);
        if (active && state) {
          setRoomState(state);
          setConnected(true);
        }
      } catch (e) {
        console.error('[initial load]', e);
        setConnected(false);
      }
    })();

    // الاشتراك بالتحديثات اللحظية
    const channel = supabase
      .channel(`room-${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `code=eq.${roomCode}`,
        },
        (payload) => {
          if (!active) return;
          const newState = payload.new?.state;
          if (newState) {
            setRoomState(newState);
            setConnected(true);
          }
        }
      )
      .subscribe((status) => {
        if (!active) return;
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [roomCode]);

  // ============== انتقال الشاشات ==============
  useEffect(() => {
    if (!roomState) return;
    if (roomState.status === 'playing' && (screen === 'waiting')) {
      setScreen('playing');
    } else if (roomState.status === 'finished' && (screen === 'playing' || screen === 'waiting')) {
      setScreen('gameover');
    } else if (roomState.status === 'playing' && screen === 'gameover') {
      setCurrentInput('');
      setFeedback(null);
      winSubmittedRef.current = false;
      setScreen('playing');
    }
  }, [roomState, screen]);

  // ============== مؤقت العرض ==============
  useEffect(() => {
    if (screen !== 'playing') return;
    const interval = setInterval(() => setDisplayNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, [screen]);

  // ============== كشف انتهاء الوقت ==============
  useEffect(() => {
    if (screen !== 'playing' || !roomState || roomState.status !== 'playing') return;
    if (roomState.pendingWord || roomState.winner || winSubmittedRef.current) return;
    // فقط اللاعب الحالي يكتب نهاية اللعبة (لتجنب الكتابة المتزامنة)
    if (roomState.currentTurn !== myRole) return;

    const elapsed = (displayNow - roomState.turnStartedAt) / 1000;
    const current = roomState.currentTurn;
    const remaining = roomState.timeRemaining[current] - elapsed;

    if (remaining <= 0) {
      winSubmittedRef.current = true;
      const newState = {
        ...roomState,
        status: 'finished',
        winner: current === 1 ? 2 : 1,
        timeRemaining: { ...roomState.timeRemaining, [current]: 0 },
      };
      saveRoom(roomCode, newState).catch(console.error);
    }
  }, [displayNow, roomState, screen, roomCode, myRole]);

  // إعادة تعيين عند تغيير الدور
  useEffect(() => {
    winSubmittedRef.current = false;
  }, [roomState?.turnStartedAt]);

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
    if (!finalEnding) { setGlobalError('اختر نهاية الكلمات'); return; }

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

      const state = createInitialState(code, hostName.trim(), {
        timeControl: selectedTime,
        ending: finalEnding,
      });

      await saveRoom(code, state);
      setMyRole(code, 1);
      setRoomCode(code);
      setMyRoleState(1);
      setRoomState(state);
      setScreen('waiting');
    } catch (e) {
      console.error('[createRoom]', e);
      setGlobalError(`تعذر إنشاء الغرفة: ${e?.message || 'خطأ غير معروف'}`);
    } finally {
      setBusy(false);
    }
  }, [hostName, useCustom, customEnding, selectedEnding, selectedTime]);

  const checkJoinCode = useCallback(async () => {
    if (joinCode.length !== 4) { setGlobalError('الكود لازم يكون ٤ أرقام'); return; }
    setBusy(true);
    setGlobalError(null);
    try {
      const state = await getRoom(joinCode);
      if (!state) { setGlobalError('ما لقينا غرفة بهذا الكود'); return; }
      if (state.players[2].joined && state.status !== 'waiting') {
        const myStoredRole = getMyRole(joinCode);
        if (myStoredRole) {
          setRoomCode(joinCode);
          setMyRoleState(myStoredRole);
          setRoomState(state);
          setScreen(state.status === 'finished' ? 'gameover' : 'playing');
          return;
        }
        setGlobalError('الغرفة ممتلئة');
        return;
      }
      setJoinPreview(state);
    } catch (e) {
      console.error('[checkJoinCode]', e);
      setGlobalError(`خطأ: ${e?.message || 'تعذر الوصول للغرفة'}`);
    } finally {
      setBusy(false);
    }
  }, [joinCode]);

  const confirmJoin = useCallback(async () => {
    if (!joinName.trim()) { setGlobalError('اكتب اسمك'); return; }
    setBusy(true);
    setGlobalError(null);
    try {
      const fresh = await getRoom(joinCode);
      if (!fresh) { setGlobalError('الغرفة لم تعد متاحة'); return; }
      const updated = {
        ...fresh,
        status: 'playing',
        players: {
          ...fresh.players,
          2: { name: joinName.trim(), joined: true },
        },
        turnStartedAt: Date.now(),
      };
      await saveRoom(joinCode, updated);
      setMyRole(joinCode, 2);
      setRoomCode(joinCode);
      setMyRoleState(2);
      setRoomState(updated);
      setScreen('playing');
    } catch (e) {
      console.error('[confirmJoin]', e);
      setGlobalError(`خطأ: ${e?.message || 'تعذر الانضمام'}`);
    } finally {
      setBusy(false);
    }
  }, [joinCode, joinName]);

  const submitWord = useCallback(async () => {
    if (!roomState || roomState.currentTurn !== myRole || roomState.pendingWord) return;
    const word = currentInput.trim();
    if (!word) return;

    const normalized = normalize(word);
    const normalizedEnding = normalize(roomState.settings.ending);

    if (!normalized.endsWith(normalizedEnding)) {
      setFeedback({ type: 'error', text: `يجب أن تنتهي بـ "${roomState.settings.ending}"` });
      return;
    }
    if (normalized.length < 2) {
      setFeedback({ type: 'error', text: 'الكلمة قصيرة جداً' });
      return;
    }
    if (roomState.usedWords.some(w => normalize(w.word) === normalized)) {
      setFeedback({ type: 'error', text: 'استُخدمت من قبل' });
      return;
    }

    const inDict = NORMALIZED_DICT.has(normalized) || roomState.customDict.includes(normalized);
    const elapsed = (Date.now() - roomState.turnStartedAt) / 1000;
    const newTimeForCurrent = Math.max(0, roomState.timeRemaining[myRole] - elapsed);

    if (inDict) {
      const newState = {
        ...roomState,
        usedWords: [{ word, player: myRole }, ...roomState.usedWords],
        timeRemaining: { ...roomState.timeRemaining, [myRole]: newTimeForCurrent },
        currentTurn: myRole === 1 ? 2 : 1,
        turnStartedAt: Date.now(),
      };
      setRoomState(newState);
      setCurrentInput('');
      setFeedback({ type: 'success', text: word });
      setTimeout(() => setFeedback(null), 1200);
      try { await saveRoom(roomCode, newState); }
      catch (e) { console.error('[submit]', e); }
    } else {
      const newState = {
        ...roomState,
        timeRemaining: { ...roomState.timeRemaining, [myRole]: newTimeForCurrent },
        pendingWord: { word, by: myRole },
      };
      setRoomState(newState);
      setCurrentInput('');
      try { await saveRoom(roomCode, newState); }
      catch (e) { console.error('[submit pending]', e); }
    }
  }, [roomState, myRole, currentInput, roomCode]);

  const acceptPending = useCallback(async () => {
    if (!roomState?.pendingWord) return;
    const { word, by } = roomState.pendingWord;
    const newState = {
      ...roomState,
      usedWords: [{ word, player: by }, ...roomState.usedWords],
      customDict: [...roomState.customDict, normalize(word)],
      pendingWord: null,
      currentTurn: by === 1 ? 2 : 1,
      turnStartedAt: Date.now(),
    };
    setRoomState(newState);
    try { await saveRoom(roomCode, newState); }
    catch (e) { console.error('[accept]', e); }
  }, [roomState, roomCode]);

  const rejectPending = useCallback(async () => {
    if (!roomState?.pendingWord) return;
    const newState = {
      ...roomState,
      pendingWord: null,
      turnStartedAt: Date.now(),
    };
    setRoomState(newState);
    try { await saveRoom(roomCode, newState); }
    catch (e) { console.error('[reject]', e); }
  }, [roomState, roomCode]);

  const resign = useCallback(async () => {
    if (!roomState) return;
    const newState = {
      ...roomState,
      status: 'finished',
      winner: myRole === 1 ? 2 : 1,
    };
    setRoomState(newState);
    try { await saveRoom(roomCode, newState); }
    catch (e) { console.error('[resign]', e); }
  }, [roomState, myRole, roomCode]);

  const rematch = useCallback(async () => {
    if (!roomState) return;
    const seconds = roomState.settings.initialSeconds;
    const newGameNum = (roomState.gameNumber || 1) + 1;
    const newState = {
      ...roomState,
      status: 'playing',
      timeRemaining: { 1: seconds, 2: seconds },
      currentTurn: newGameNum % 2 === 0 ? 2 : 1,
      turnStartedAt: Date.now(),
      pendingWord: null,
      usedWords: [],
      winner: null,
      gameNumber: newGameNum,
    };
    setRoomState(newState);
    winSubmittedRef.current = false;
    setCurrentInput('');
    setFeedback(null);
    setScreen('playing');
    try { await saveRoom(roomCode, newState); }
    catch (e) { console.error('[rematch]', e); }
  }, [roomState, roomCode]);

  const leaveRoom = useCallback(async () => {
    if (roomCode && roomCode !== 'local') clearMyRole(roomCode);
    setScreen('menu');
    setRoomCode('');
    setMyRoleState(null);
    setRoomState(null);
    setCurrentInput('');
    setFeedback(null);
    setJoinCode('');
    setJoinName('');
    setJoinPreview(null);
    setHostName('');
    setGlobalError(null);
  }, [roomCode]);

  const copyCode = useCallback(() => {
    if (!roomCode) return;
    try {
      navigator.clipboard?.writeText(roomCode);
      setFeedback({ type: 'success', text: 'تم نسخ الكود' });
      setTimeout(() => setFeedback(null), 1500);
    } catch {}
  }, [roomCode]);

  const startLocal = useCallback(() => {
    const finalEnding = useCustom ? customEnding.trim() : selectedEnding;
    if (!hostName.trim() || !finalEnding) {
      setGlobalError('أكمل البيانات أولاً');
      return;
    }
    const state = createInitialState('local', hostName.trim(), {
      timeControl: selectedTime, ending: finalEnding,
    });
    state.players[2] = { name: 'اللاعب الثاني', joined: true };
    state.status = 'playing';
    state.turnStartedAt = Date.now();
    setRoomCode('local');
    setMyRoleState(null);
    setRoomState(state);
    setScreen('local-playing');
  }, [hostName, useCustom, customEnding, selectedEnding, selectedTime]);

  // ============== المعطيات المحسوبة ==============
  const displayTimes = useMemo(() => {
    if (!roomState) return { 1: 0, 2: 0 };
    const t1 = roomState.timeRemaining[1];
    const t2 = roomState.timeRemaining[2];
    if (roomState.status !== 'playing' || roomState.pendingWord) return { 1: t1, 2: t2 };
    const elapsed = (displayNow - roomState.turnStartedAt) / 1000;
    if (roomState.currentTurn === 1) return { 1: Math.max(0, t1 - elapsed), 2: t2 };
    return { 1: t1, 2: Math.max(0, t2 - elapsed) };
  }, [roomState, displayNow]);

  const wordCounts = useMemo(() => {
    if (!roomState) return { 1: 0, 2: 0 };
    return {
      1: roomState.usedWords.filter(w => w.player === 1).length,
      2: roomState.usedWords.filter(w => w.player === 2).length,
    };
  }, [roomState]);

  const isMyTurn = roomState?.currentTurn === myRole && !roomState?.pendingWord;
  const myName = roomState?.players[myRole]?.name || '';
  const oppRole = myRole === 1 ? 2 : 1;
  const oppName = roomState?.players[oppRole]?.name || 'الخصم';

  // ============== الشاشات ==============
  // -------- شاشة القائمة --------
  if (screen === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-950 via-slate-950 to-stone-950 text-stone-100 p-4 sm:p-6 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={BG_STYLE} />
        <div className="relative w-full max-w-md">
          <div className="text-center mb-10 fade-in">
            <div className="inline-flex items-center gap-3 mb-3">
              <div className="h-px w-12 bg-gradient-to-l from-amber-400/60 to-transparent" />
              <BookOpen className="w-5 h-5 text-amber-400/80" />
              <div className="h-px w-12 bg-gradient-to-r from-amber-400/60 to-transparent" />
            </div>
            <h1 className="font-display text-5xl sm:text-6xl font-bold mb-2 bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-transparent">
              لعبة الكلمات
            </h1>
            <p className="text-stone-400 text-sm">العبوا من جوالين مختلفين</p>
          </div>
          <div className="space-y-4 fade-in">
            <button
              onClick={() => { setScreen('create-setup'); setGlobalError(null); }}
              className="w-full bg-gradient-to-l from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-display font-bold py-5 rounded-2xl transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 flex items-center justify-center gap-3"
            >
              <UserPlus className="w-6 h-6" />
              <span className="text-lg">إنشاء غرفة جديدة</span>
            </button>
            <button
              onClick={() => { setScreen('join-setup'); setGlobalError(null); }}
              className="w-full bg-white/[0.05] hover:bg-white/[0.08] border-2 border-teal-400/30 hover:border-teal-400/60 text-teal-200 font-display font-bold py-5 rounded-2xl transition-all flex items-center justify-center gap-3"
            >
              <LogIn className="w-6 h-6" />
              <span className="text-lg">دخول بكود</span>
            </button>
            <div className="flex items-center gap-3 py-2">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-stone-500">أو</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            <button
              onClick={() => { setMyRoleState('local'); setScreen('create-setup'); setGlobalError(null); }}
              className="w-full bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 text-stone-300 py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Smartphone className="w-4 h-4" />
              اللعب على جهاز واحد
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------- شاشة إعداد الإنشاء --------
  if (screen === 'create-setup') {
    const isLocal = myRole === 'local';
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-950 via-slate-950 to-stone-950 text-stone-100 p-4 sm:p-6 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={BG_STYLE} />
        <div className="relative w-full max-w-2xl">
          <button onClick={leaveRoom} className="mb-4 text-stone-400 hover:text-stone-200 text-sm flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> رجوع
          </button>
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-7 fade-in">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-amber-200 mb-1">
                {isLocal ? 'لعبة على جهاز واحد' : 'إنشاء غرفة'}
              </h2>
              <p className="text-stone-400 text-sm">
                {isLocal ? 'العبوا بالتناوب على نفس الجهاز' : 'بعد الإنشاء، شارك الكود مع شريكك'}
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-xs uppercase tracking-widest text-stone-400 font-semibold">اسمك</label>
              <div className="relative">
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-400" />
                <input
                  type="text"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="اكتب اسمك"
                  maxLength={20}
                  className="w-full bg-stone-900/60 border border-white/10 rounded-xl px-4 pr-8 py-3 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-400/50 focus:bg-stone-900 transition-all"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs uppercase tracking-widest text-stone-400 font-semibold">سرعة اللعبة</label>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {TIME_CONTROLS.map(tc => {
                  const Icon = tc.icon;
                  const isSel = selectedTime.id === tc.id;
                  return (
                    <button
                      key={tc.id}
                      onClick={() => setSelectedTime(tc)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        isSel ? 'bg-amber-400/10 border-amber-400/60 text-amber-200'
                              : 'bg-stone-900/40 border-white/5 hover:border-white/20 text-stone-300'
                      }`}
                    >
                      <Icon className={`w-6 h-6 mx-auto mb-2 ${isSel ? 'text-amber-400' : 'text-stone-400'}`} />
                      <div className="font-display font-semibold text-base sm:text-lg">{tc.name}</div>
                      <div className="text-xs text-stone-400 mt-0.5">{tc.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase tracking-widest text-stone-400 font-semibold">نهاية الكلمات</label>
                <button
                  onClick={() => setUseCustom(!useCustom)}
                  className="text-xs text-amber-400/80 hover:text-amber-300 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  {useCustom ? 'الجاهزة' : 'مخصصة'}
                </button>
              </div>
              {!useCustom ? (
                <div className="grid grid-cols-5 gap-2">
                  {ENDING_PRESETS.map(p => {
                    const isSel = selectedEnding === p.value;
                    return (
                      <button
                        key={p.value}
                        onClick={() => setSelectedEnding(p.value)}
                        title={p.example}
                        className={`py-3 rounded-xl font-display text-2xl font-semibold border-2 transition-all ${
                          isSel ? 'bg-amber-400/15 border-amber-400/60 text-amber-200 scale-105'
                                : 'bg-stone-900/40 border-white/5 hover:border-white/20 text-stone-300'
                        }`}
                      >
                        {p.value}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input
                  type="text"
                  value={customEnding}
                  onChange={(e) => setCustomEnding(e.target.value)}
                  placeholder="مثلا: وب، اف"
                  maxLength={4}
                  className="w-full bg-stone-900/60 border border-white/10 rounded-xl px-4 py-3 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-400/50 transition-all text-center font-display text-xl"
                />
              )}
            </div>

            {globalError && (
              <div className="bg-rose-500/10 border border-rose-400/30 text-rose-200 text-sm rounded-xl p-3 text-center slide-in">
                {globalError}
              </div>
            )}

            <button
              onClick={isLocal ? startLocal : createRoom}
              disabled={busy}
              className="w-full bg-gradient-to-l from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 disabled:from-stone-700 disabled:to-stone-700 disabled:cursor-not-allowed text-stone-950 font-display font-bold text-lg py-4 rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              {isLocal ? 'ابدأ اللعبة' : 'إنشاء الغرفة'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------- شاشة الانضمام --------
  if (screen === 'join-setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-950 via-slate-950 to-stone-950 text-stone-100 p-4 sm:p-6 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={BG_STYLE} />
        <div className="relative w-full max-w-md">
          <button onClick={leaveRoom} className="mb-4 text-stone-400 hover:text-stone-200 text-sm flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> رجوع
          </button>
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 fade-in">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-teal-200 mb-1">دخول غرفة</h2>
              <p className="text-stone-400 text-sm">أدخل الكود اللي وصلك</p>
            </div>
            {!joinPreview ? (
              <>
                <div className="space-y-3">
                  <label className="text-xs uppercase tracking-widest text-stone-400 font-semibold">كود الغرفة</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="0000"
                    maxLength={4}
                    className="w-full bg-stone-900/60 border-2 border-white/10 rounded-2xl px-4 py-5 text-stone-100 placeholder-stone-700 focus:outline-none focus:border-teal-400/50 transition-all text-center font-mono-ar text-5xl font-bold tracking-[0.5em]"
                  />
                </div>
                {globalError && (
                  <div className="bg-rose-500/10 border border-rose-400/30 text-rose-200 text-sm rounded-xl p-3 text-center slide-in">{globalError}</div>
                )}
                <button
                  onClick={checkJoinCode}
                  disabled={busy || joinCode.length !== 4}
                  className="w-full bg-gradient-to-l from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-300 disabled:from-stone-700 disabled:to-stone-700 text-stone-950 font-display font-bold text-lg py-4 rounded-xl transition-all shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2"
                >
                  {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                  بحث
                </button>
              </>
            ) : (
              <>
                <div className="bg-stone-900/60 border border-white/10 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-stone-400">المضيف</span>
                    <span className="font-display font-bold text-amber-300">{joinPreview.players[1].name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-stone-400">السرعة</span>
                    <span className="font-display">
                      {TIME_CONTROLS.find(t => t.id === joinPreview.settings.timeControlId)?.name}
                      <span className="text-stone-500 text-sm mr-2">({joinPreview.settings.initialSeconds / 60} د)</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-stone-400">نهاية الكلمات</span>
                    <span className="font-display text-2xl font-bold text-teal-300">{joinPreview.settings.ending}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-xs uppercase tracking-widest text-stone-400 font-semibold">اسمك</label>
                  <div className="relative">
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-teal-400" />
                    <input
                      type="text"
                      value={joinName}
                      onChange={(e) => setJoinName(e.target.value)}
                      placeholder="اكتب اسمك"
                      maxLength={20}
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && confirmJoin()}
                      className="w-full bg-stone-900/60 border border-white/10 rounded-xl px-4 pr-8 py-3 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-teal-400/50 transition-all"
                    />
                  </div>
                </div>
                {globalError && (
                  <div className="bg-rose-500/10 border border-rose-400/30 text-rose-200 text-sm rounded-xl p-3 text-center slide-in">{globalError}</div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setJoinPreview(null); setGlobalError(null); }}
                    className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-stone-200 font-display py-3 rounded-xl transition-colors"
                  >
                    تغيير الكود
                  </button>
                  <button
                    onClick={confirmJoin}
                    disabled={busy || !joinName.trim()}
                    className="flex-1 bg-gradient-to-l from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-300 disabled:from-stone-700 disabled:to-stone-700 text-stone-950 font-display font-bold py-3 rounded-xl transition-all shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2"
                  >
                    {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                    دخول
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // -------- شاشة الانتظار --------
  if (screen === 'waiting' && roomState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-950 via-slate-950 to-stone-950 text-stone-100 p-4 sm:p-6 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={BG_STYLE} />
        <div className="relative w-full max-w-md text-center fade-in">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-400/10 border-2 border-amber-400/30 mb-4">
              <Users className="w-10 h-10 text-amber-400 spin-slow" />
            </div>
            <h2 className="font-display text-3xl font-bold text-stone-100 mb-2">بانتظار اللاعب الثاني</h2>
            <p className="text-stone-400 text-sm">شارك هذا الكود</p>
          </div>
          <div className="bg-white/[0.03] border-2 border-amber-400/30 rounded-3xl p-8 mb-6">
            <div className="text-xs uppercase tracking-widest text-amber-400/80 font-semibold mb-3">كود الغرفة</div>
            <div className="font-mono-ar text-7xl font-bold text-amber-200 mb-4 tracking-[0.3em]">
              {roomCode}
            </div>
            <button
              onClick={copyCode}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-stone-300 transition-colors"
            >
              <Copy className="w-4 h-4" />
              نسخ الكود
            </button>
            {feedback?.type === 'success' && (
              <div className="text-emerald-300 text-xs mt-2 slide-in">{feedback.text}</div>
            )}
          </div>
          <div className="bg-stone-900/40 border border-white/5 rounded-2xl p-4 mb-6 text-right space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-stone-400">المضيف</span>
              <span className="font-display text-amber-300">{roomState.players[1].name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-400">السرعة</span>
              <span className="font-display">{TIME_CONTROLS.find(t => t.id === roomState.settings.timeControlId)?.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-400">نهاية الكلمات</span>
              <span className="font-display text-xl font-bold text-amber-300">{roomState.settings.ending}</span>
            </div>
          </div>
          <button onClick={leaveRoom} className="text-stone-400 hover:text-stone-200 text-sm transition-colors">
            إلغاء الغرفة
          </button>
        </div>
      </div>
    );
  }

  // -------- شاشة اللعب --------
  if (screen === 'playing' && roomState && myRole) {
    const isP1Active = roomState.currentTurn === 1 && !roomState.pendingWord;
    const isP2Active = roomState.currentTurn === 2 && !roomState.pendingWord;
    const pendingByMe = roomState.pendingWord?.by === myRole;
    const pendingByOpp = roomState.pendingWord && !pendingByMe;

    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-950 via-slate-950 to-stone-950 text-stone-100 p-3 sm:p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={BG_STYLE} />
        <div className="relative max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-stone-300">
                نهاية: <span className="font-display font-bold text-amber-300 mx-1">{roomState.settings.ending}</span>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-stone-300">
                {TIME_CONTROLS.find(t => t.id === roomState.settings.timeControlId)?.name}
              </div>
              <div className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-stone-400 font-mono-ar">
                #{roomCode}
              </div>
              <div className={`flex items-center gap-1 text-xs ${connected ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
                {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              </div>
            </div>
            <button
              onClick={resign}
              className="px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs hover:bg-rose-500/20 transition-colors flex items-center gap-1.5"
            >
              <Flag className="w-3 h-3" />
              استسلام
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-6 mb-6">
            <div className={`relative rounded-3xl p-4 sm:p-8 border-2 transition-all duration-500 ${
              isP1Active ? 'border-amber-400/60 bg-amber-500/5 pulse-amber' : 'border-white/5 bg-stone-900/40 opacity-60'
            }`}>
              <div className="flex items-center justify-between mb-3 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isP1Active ? 'bg-amber-400 animate-pulse' : 'bg-stone-600'}`} />
                  <span className="font-display text-sm sm:text-lg font-semibold truncate">
                    {roomState.players[1].name}
                    {myRole === 1 && <span className="text-amber-400/70 text-xs mr-1">(أنت)</span>}
                  </span>
                </div>
                <span className="text-xs text-stone-400 shrink-0">{wordCounts[1]}</span>
              </div>
              <div className={`font-mono-ar text-4xl sm:text-7xl font-bold text-center py-2 transition-colors ${
                isP1Active ? (displayTimes[1] <= 10 ? 'text-rose-300' : 'text-amber-200') : 'text-stone-500'
              }`}>
                {formatTime(displayTimes[1])}
              </div>
            </div>
            <div className={`relative rounded-3xl p-4 sm:p-8 border-2 transition-all duration-500 ${
              isP2Active ? 'border-teal-400/60 bg-teal-500/5 pulse-teal' : 'border-white/5 bg-stone-900/40 opacity-60'
            }`}>
              <div className="flex items-center justify-between mb-3 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isP2Active ? 'bg-teal-400 animate-pulse' : 'bg-stone-600'}`} />
                  <span className="font-display text-sm sm:text-lg font-semibold truncate">
                    {roomState.players[2].name}
                    {myRole === 2 && <span className="text-teal-400/70 text-xs mr-1">(أنت)</span>}
                  </span>
                </div>
                <span className="text-xs text-stone-400 shrink-0">{wordCounts[2]}</span>
              </div>
              <div className={`font-mono-ar text-4xl sm:text-7xl font-bold text-center py-2 transition-colors ${
                isP2Active ? (displayTimes[2] <= 10 ? 'text-rose-300' : 'text-teal-200') : 'text-stone-500'
              }`}>
                {formatTime(displayTimes[2])}
              </div>
            </div>
          </div>

          <div className={`bg-white/[0.03] border-2 rounded-3xl p-5 sm:p-6 mb-6 transition-colors ${
            myRole === 1 ? 'border-amber-400/30' : 'border-teal-400/30'
          }`}>
            {roomState.pendingWord ? (
              pendingByOpp ? (
                <div className="space-y-4 slide-in">
                  <div className="text-center">
                    <div className="text-xs text-stone-400 mb-2 font-display">{oppName} يقترح كلمة غير موجودة في القاموس</div>
                    <div className="font-display text-4xl sm:text-5xl font-bold text-amber-200 my-4">
                      &quot;{roomState.pendingWord.word}&quot;
                    </div>
                    <div className="text-sm text-stone-400">هل تقبلها؟</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={acceptPending} className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 rounded-xl py-3 text-sm font-display font-semibold flex items-center justify-center gap-1.5 transition-colors">
                      <Check className="w-4 h-4" /> نعم، أقبلها
                    </button>
                    <button onClick={rejectPending} className="flex-1 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 rounded-xl py-3 text-sm font-display font-semibold flex items-center justify-center gap-1.5 transition-colors">
                      <X className="w-4 h-4" /> لا، أرفضها
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 slide-in">
                  <Loader2 className="w-8 h-8 mx-auto mb-3 text-amber-400/70 animate-spin" />
                  <div className="font-display text-xl text-stone-200 mb-2">&quot;{roomState.pendingWord.word}&quot;</div>
                  <div className="text-sm text-stone-400">في انتظار قرار {oppName}...</div>
                  <div className="text-xs text-stone-500 mt-1">الوقت متوقف لكليكما</div>
                </div>
              )
            ) : isMyTurn ? (
              <>
                <div className="text-center text-xs text-stone-400 mb-3 font-display">
                  دورك <span className={`font-bold ${myRole === 1 ? 'text-amber-300' : 'text-teal-300'}`}>{myName}</span>
                </div>
                <div className="flex gap-2 sm:gap-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitWord()}
                    placeholder={`كلمة تنتهي بـ "${roomState.settings.ending}"`}
                    className={`flex-1 bg-stone-900/80 border-2 rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-stone-100 placeholder-stone-500 focus:outline-none transition-all font-display text-xl sm:text-2xl text-center ${
                      myRole === 1 ? 'border-amber-400/30 focus:border-amber-400/70' : 'border-teal-400/30 focus:border-teal-400/70'
                    } ${feedback?.type === 'error' ? 'shake border-rose-400/70' : ''}`}
                  />
                  <button
                    onClick={submitWord}
                    disabled={!currentInput.trim()}
                    className={`px-4 sm:px-6 rounded-2xl font-display font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                      myRole === 1
                        ? 'bg-amber-400/20 hover:bg-amber-400/30 border-2 border-amber-400/40 text-amber-200'
                        : 'bg-teal-400/20 hover:bg-teal-400/30 border-2 border-teal-400/40 text-teal-200'
                    }`}
                  >
                    <Check className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
                {feedback && (
                  <div className={`mt-3 text-center text-sm font-display slide-in ${
                    feedback.type === 'success' ? 'text-emerald-300' : 'text-rose-300'
                  }`}>
                    {feedback.type === 'success' ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" /> {feedback.text}
                      </span>
                    ) : feedback.text}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-6">
                <div className="inline-flex items-center gap-2 text-stone-400 font-display text-base sm:text-lg">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  دور {oppName}...
                </div>
                <div className="text-xs text-stone-500 mt-2">{oppName} يفكر في كلمة</div>
              </div>
            )}
          </div>

          {roomState.usedWords.length > 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase tracking-widest text-stone-400 font-semibold">الكلمات المستخدمة</span>
                <span className="text-xs text-stone-500">{roomState.usedWords.length}</span>
              </div>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {roomState.usedWords.map((w, i) => (
                  <span key={i} className={`px-3 py-1 rounded-lg font-display text-sm border ${
                    w.player === 1 ? 'bg-amber-500/10 border-amber-400/20 text-amber-200' : 'bg-teal-500/10 border-teal-400/20 text-teal-200'
                  }`}>
                    {w.word}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // -------- شاشة النهاية --------
  if (screen === 'gameover' && roomState) {
    const winner = roomState.winner;
    const winnerName = roomState.players[winner].name;
    const winnerCount = wordCounts[winner];
    const loserCount = wordCounts[winner === 1 ? 2 : 1];
    const iWon = winner === myRole;
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-950 via-slate-950 to-stone-950 text-stone-100 p-4 sm:p-6 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
          backgroundImage: winner === 1
            ? `radial-gradient(circle at 50% 30%, #fbbf24 0%, transparent 60%)`
            : `radial-gradient(circle at 50% 30%, #2dd4bf 0%, transparent 60%)`
        }} />
        <div className="relative w-full max-w-xl text-center fade-in">
          <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-6 ${
            winner === 1 ? 'bg-amber-400/20 text-amber-300' : 'bg-teal-400/20 text-teal-300'
          }`}>
            <Trophy className="w-12 h-12" />
          </div>
          <p className="text-stone-400 text-sm mb-2 font-display">الفائز</p>
          <h1 className={`font-display text-5xl sm:text-6xl font-bold mb-3 ${
            winner === 1
              ? 'bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-transparent'
              : 'bg-gradient-to-b from-teal-200 to-teal-500 bg-clip-text text-transparent'
          }`}>
            {winnerName}
          </h1>
          <p className="text-stone-400 mb-10">{iWon ? 'مبروك! 🎉' : 'حظ أوفر المرة القادمة'}</p>
          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
              <div className="text-xs text-stone-400 mb-1">كلمات الفائز</div>
              <div className={`font-display text-3xl font-bold ${winner === 1 ? 'text-amber-300' : 'text-teal-300'}`}>{winnerCount}</div>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
              <div className="text-xs text-stone-400 mb-1">كلمات الخاسر</div>
              <div className="font-display text-3xl font-bold text-stone-400">{loserCount}</div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={rematch}
              className={`flex-1 bg-gradient-to-l ${
                winner === 1
                  ? 'from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 shadow-amber-500/30'
                  : 'from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-300 shadow-teal-500/30'
              } text-stone-950 font-display font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2`}
            >
              <RotateCcw className="w-5 h-5" /> جولة ثانية
            </button>
            <button onClick={leaveRoom} className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-stone-200 font-display font-bold py-3 rounded-xl transition-colors">
              خروج
            </button>
          </div>
        </div>
      </div>
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
    const winnerName = roomState.players[winner].name;
    const winnerCount = roomState.usedWords.filter(w => w.player === winner).length;
    const loserCount = roomState.usedWords.filter(w => w.player !== winner).length;
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-950 via-slate-950 to-stone-950 text-stone-100 p-4 sm:p-6 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
          backgroundImage: winner === 1
            ? `radial-gradient(circle at 50% 30%, #fbbf24 0%, transparent 60%)`
            : `radial-gradient(circle at 50% 30%, #2dd4bf 0%, transparent 60%)`
        }} />
        <div className="relative w-full max-w-xl text-center fade-in">
          <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-6 ${
            winner === 1 ? 'bg-amber-400/20 text-amber-300' : 'bg-teal-400/20 text-teal-300'
          }`}>
            <Trophy className="w-12 h-12" />
          </div>
          <p className="text-stone-400 text-sm mb-2 font-display">الفائز</p>
          <h1 className={`font-display text-5xl sm:text-6xl font-bold mb-3 ${
            winner === 1
              ? 'bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-transparent'
              : 'bg-gradient-to-b from-teal-200 to-teal-500 bg-clip-text text-transparent'
          }`}>{winnerName}</h1>
          <p className="text-stone-400 mb-10">مبروك! 🎉</p>
          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
              <div className="text-xs text-stone-400 mb-1">كلمات الفائز</div>
              <div className={`font-display text-3xl font-bold ${winner === 1 ? 'text-amber-300' : 'text-teal-300'}`}>{winnerCount}</div>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
              <div className="text-xs text-stone-400 mb-1">كلمات الخاسر</div>
              <div className="font-display text-3xl font-bold text-stone-400">{loserCount}</div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                const seconds = roomState.settings.initialSeconds;
                setRoomState({
                  ...roomState, status: 'playing',
                  timeRemaining: { 1: seconds, 2: seconds },
                  currentTurn: 1, turnStartedAt: Date.now(),
                  pendingWord: null, usedWords: [], winner: null,
                });
                setScreen('local-playing');
              }}
              className={`flex-1 bg-gradient-to-l ${
                winner === 1
                  ? 'from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 shadow-amber-500/30'
                  : 'from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-300 shadow-teal-500/30'
              } text-stone-950 font-display font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2`}
            >
              <RotateCcw className="w-5 h-5" /> جولة ثانية
            </button>
            <button onClick={leaveRoom} className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-stone-200 font-display font-bold py-3 rounded-xl transition-colors">
              خروج
            </button>
          </div>
        </div>
      </div>
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
      setRoomState({
        ...roomState, status: 'finished',
        winner: current === 1 ? 2 : 1,
        timeRemaining: { ...roomState.timeRemaining, [current]: 0 },
      });
      onGameOver();
    }
  }, [displayNow, roomState, pendingWord, setRoomState, onGameOver]);

  useEffect(() => { inputRef.current?.focus(); }, [roomState.currentTurn]);

  const submitWord = () => {
    const word = currentInput.trim();
    if (!word) return;
    const normalized = normalize(word);
    const normalizedEnding = normalize(roomState.settings.ending);
    if (!normalized.endsWith(normalizedEnding)) {
      setFeedback({ type: 'error', text: `يجب أن تنتهي بـ "${roomState.settings.ending}"` });
      return;
    }
    if (normalized.length < 2) {
      setFeedback({ type: 'error', text: 'الكلمة قصيرة' });
      return;
    }
    if (roomState.usedWords.some(w => normalize(w.word) === normalized)) {
      setFeedback({ type: 'error', text: 'استُخدمت من قبل' });
      return;
    }
    const inDict = NORMALIZED_DICT.has(normalized) || roomState.customDict.includes(normalized);
    if (inDict) acceptWord(word);
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
    setPendingWord(null);
    setFeedback({ type: 'error', text: 'اكتب كلمة أخرى' });
    setCurrentInput('');
  };

  const resign = () => {
    gameOverRef.current = true;
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
  const isP1Active = roomState.currentTurn === 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-slate-950 to-stone-950 text-stone-100 p-3 sm:p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={BG_STYLE} />
      <div className="relative max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-stone-300">
              نهاية: <span className="font-display font-bold text-amber-300 mx-1">{roomState.settings.ending}</span>
            </div>
            <div className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-stone-300">
              {TIME_CONTROLS.find(t => t.id === roomState.settings.timeControlId)?.name}
            </div>
          </div>
          <button onClick={resign} className="px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs hover:bg-rose-500/20 transition-colors flex items-center gap-1.5">
            <Flag className="w-3 h-3" /> استسلام
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-6 mb-6">
          <div className={`rounded-3xl p-4 sm:p-8 border-2 transition-all ${isP1Active && !pendingWord ? 'border-amber-400/60 bg-amber-500/5 pulse-amber' : 'border-white/5 bg-stone-900/40 opacity-60'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${isP1Active && !pendingWord ? 'bg-amber-400 animate-pulse' : 'bg-stone-600'}`} />
                <span className="font-display text-sm sm:text-lg font-semibold truncate">{roomState.players[1].name}</span>
              </div>
              <span className="text-xs text-stone-400">{wordCounts[1]}</span>
            </div>
            <div className={`font-mono-ar text-4xl sm:text-7xl font-bold text-center py-2 ${isP1Active && !pendingWord ? (displayTimes[1] <= 10 ? 'text-rose-300' : 'text-amber-200') : 'text-stone-500'}`}>
              {formatTime(displayTimes[1])}
            </div>
          </div>
          <div className={`rounded-3xl p-4 sm:p-8 border-2 transition-all ${!isP1Active && !pendingWord ? 'border-teal-400/60 bg-teal-500/5 pulse-teal' : 'border-white/5 bg-stone-900/40 opacity-60'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${!isP1Active && !pendingWord ? 'bg-teal-400 animate-pulse' : 'bg-stone-600'}`} />
                <span className="font-display text-sm sm:text-lg font-semibold truncate">{roomState.players[2].name}</span>
              </div>
              <span className="text-xs text-stone-400">{wordCounts[2]}</span>
            </div>
            <div className={`font-mono-ar text-4xl sm:text-7xl font-bold text-center py-2 ${!isP1Active && !pendingWord ? (displayTimes[2] <= 10 ? 'text-rose-300' : 'text-teal-200') : 'text-stone-500'}`}>
              {formatTime(displayTimes[2])}
            </div>
          </div>
        </div>

        <div className={`bg-white/[0.03] border-2 rounded-3xl p-5 sm:p-6 mb-6 ${isP1Active ? 'border-amber-400/30' : 'border-teal-400/30'}`}>
          <div className="text-center text-xs text-stone-400 mb-3 font-display">
            دور <span className={`font-bold ${isP1Active ? 'text-amber-300' : 'text-teal-300'}`}>
              {isP1Active ? roomState.players[1].name : roomState.players[2].name}
            </span>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <input
              ref={inputRef}
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { pendingWord ? confirmPending() : submitWord(); }}}
              disabled={!!pendingWord}
              placeholder={`كلمة تنتهي بـ "${roomState.settings.ending}"`}
              className={`flex-1 bg-stone-900/80 border-2 rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-stone-100 placeholder-stone-500 focus:outline-none transition-all font-display text-xl sm:text-2xl text-center disabled:opacity-50 ${
                isP1Active ? 'border-amber-400/30 focus:border-amber-400/70' : 'border-teal-400/30 focus:border-teal-400/70'
              } ${feedback?.type === 'error' ? 'shake border-rose-400/70' : ''}`}
            />
            <button
              onClick={submitWord}
              disabled={!currentInput.trim() || !!pendingWord}
              className={`px-4 sm:px-6 rounded-2xl font-display font-bold disabled:opacity-30 disabled:cursor-not-allowed ${
                isP1Active ? 'bg-amber-400/20 border-2 border-amber-400/40 text-amber-200' : 'bg-teal-400/20 border-2 border-teal-400/40 text-teal-200'
              }`}
            >
              <Check className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
          {pendingWord && (
            <div className="mt-4 bg-amber-500/10 border border-amber-400/30 rounded-2xl p-4 slide-in">
              <p className="text-sm text-amber-200 mb-3 text-center">
                <span className="font-display font-bold text-lg">&quot;{pendingWord}&quot;</span> غير موجودة في القاموس
              </p>
              <p className="text-xs text-stone-400 text-center mb-3">هل تتفقان على قبولها؟</p>
              <div className="flex gap-2">
                <button onClick={confirmPending} className="flex-1 bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 rounded-xl py-2 text-sm font-display font-semibold flex items-center justify-center gap-1.5">
                  <Check className="w-4 h-4" /> نقبلها
                </button>
                <button onClick={rejectPending} className="flex-1 bg-rose-500/20 border border-rose-400/40 text-rose-200 rounded-xl py-2 text-sm font-display font-semibold flex items-center justify-center gap-1.5">
                  <X className="w-4 h-4" /> نرفضها
                </button>
              </div>
            </div>
          )}
          {feedback && !pendingWord && (
            <div className={`mt-3 text-center text-sm font-display slide-in ${feedback.type === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
              {feedback.type === 'success' ? <span className="inline-flex items-center gap-1.5"><Sparkles className="w-4 h-4" />{feedback.text}</span> : feedback.text}
            </div>
          )}
        </div>

        {roomState.usedWords.length > 0 && (
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-widest text-stone-400 font-semibold">الكلمات المستخدمة</span>
              <span className="text-xs text-stone-500">{roomState.usedWords.length}</span>
            </div>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {roomState.usedWords.map((w, i) => (
                <span key={i} className={`px-3 py-1 rounded-lg font-display text-sm border ${
                  w.player === 1 ? 'bg-amber-500/10 border-amber-400/20 text-amber-200' : 'bg-teal-500/10 border-teal-400/20 text-teal-200'
                }`}>{w.word}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
