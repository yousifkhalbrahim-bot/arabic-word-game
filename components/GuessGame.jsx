'use client';

// ============== خمّن الكلمة ==============
// خمّن الكلمة المخفية: كل تخمين يكشف لك أي الحروف صح ومكانها.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowRight, Delete, CornerDownLeft, Share2, RotateCcw, BarChart3, HelpCircle, Lightbulb, Trophy, Play, Lock } from 'lucide-react';
import { ArcadeBg, Card, Choice, Btn, Num, LetterTiles } from '@/components/ui';
import { Confetti } from '@/components/GameParts';
import {
  LENGTHS, PLAYABLE_LENGTHS, bankFor, normalizeGuess, evaluateGuess, mergeKeyStates, KNOWN,
  dayNumber, dailyAnswer, randomAnswer, shareText,
} from '@/lib/guess';
import { playAccept, playReject, playGameOver, playStreak, playKey, playReveal, playWin, playLose } from '@/lib/sounds';
import { publicUrl, shareContent, haptic } from '@/lib/native';
import { awardPoints, guessPoints } from '@/lib/points';
import { getBulbs, syncBulbs, spendBulbs, earnBulbs, HINT_TYPES, revealLimit, elimCount, bulbsEarned, BULB_MAX } from '@/lib/bulbs';

// نسخة طبق الأصل من كيبورد الآيفون العربي (من اليسار لليمين كما يظهر على الشاشة)
const KEY_ROWS = [
  ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج'],
  ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ة'],
  ['ء', 'ظ', 'ط', 'ذ', 'د', 'ز', 'ر', 'و', 'ى', 'BACK'],
  ['ENTER'],
];
const LETTER_SET = new Set(KEY_ROWS.flat().filter(k => k.length === 1).map(normalizeGuess));

const PRAISE = ['عبقري! 🤯', 'خرافي! 🔥', 'رهيب! ⭐', 'ممتاز! 👏', 'حلو! 😄', 'كفو! 💪', 'لحقت عليها! 😅'];

const TILE = {
  correct: { background: '#22c55e', color: '#ffffff', boxShadow: '0 4px 0 #15803d', borderColor: '#4ade80' },
  present: { background: '#ffb020', color: '#4a2400', boxShadow: '0 4px 0 #b86b00', borderColor: '#ffc95c' },
  absent:  { background: '#3b1f7a', color: 'rgba(255,255,255,0.75)', boxShadow: '0 4px 0 #24124f', borderColor: '#4c2a94' },
};
const KEY = {
  correct: { background: '#22c55e', color: '#ffffff', boxShadow: '0 3px 0 #15803d' },
  present: { background: '#ffb020', color: '#4a2400', boxShadow: '0 3px 0 #b86b00' },
  absent:  { background: '#3b1f7a', color: 'rgba(255,255,255,0.45)', boxShadow: '0 3px 0 #24124f' },
};
const FLIP_MS = 260;

// -------- التخزين المحلي --------
const statsKey = (len) => `wg:guess-stats:${len}`;
const rushKey = (len) => `wg:guess-rush-best:${len}`;
const RUSH_SECONDS = 120;
const RUSH_HINT_COST = 10;
const dailyKey = (len, day) => `wg:guess-daily:${len}:${day}`;
const MIX_KEY = 'wg:guess-mix';
const emptyStats = (len) => ({ played: 0, wins: 0, streak: 0, best: 0, dist: Array(LENGTHS[len].tries).fill(0) });
function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export default function GuessGame({ onExit }) {
  const [phase, setPhase] = useState('setup'); // setup | playing
  const [len, setLen] = useState(3);
  const [mode, setMode] = useState('daily');   // daily | free
  const [answer, setAnswer] = useState('');
  const [guesses, setGuesses] = useState([]);  // [{ word, result }]
  const [current, setCurrent] = useState('');
  const [keyStates, setKeyStates] = useState({});
  const [revealing, setRevealing] = useState(-1); // صف يتقلب الآن
  const [shakeRow, setShakeRow] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmUnknown, setConfirmUnknown] = useState('');
  const [status, setStatus] = useState('playing'); // playing | won | lost
  const [showResult, setShowResult] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [stats, setStats] = useState(() => emptyStats(3));
  const [dailyDone, setDailyDone] = useState({});
  const [hints, setHints] = useState([]);          // مواضع الحروف المكشوفة
  const [elims, setElims] = useState([]);          // حروف انطفت بالتلميح (مو في الكلمة)
  const [elimUses, setElimUses] = useState(0);
  const [bulbs, setBulbsState] = useState(3);
  const [showHints, setShowHints] = useState(false);
  const [earned, setEarned] = useState(0);
  // «مختلط»: كل جولة 3 أو 5 عشوائي، وله ستريك خاص فيه
  const [mixed, setMixed] = useState(false);
  const mixedRef = useRef(false);
  mixedRef.current = mixed;
  const [mixStats, setMixStats] = useState({ streak: 0, best: 0 });
  const [winRow, setWinRow] = useState(-1);        // الصف اللي يرقص وقت الفوز
  const [burst, setBurst] = useState(null);        // كلمة الاحتفال بالنص
  const [lostStreak, setLostStreak] = useState(0);
  const [gain, setGain] = useState(0);
  const [rushEndsAt, setRushEndsAt] = useState(0);
  const [rushScore, setRushScore] = useState(0);
  const [rushOver, setRushOver] = useState(null);
  const [nowTs, setNowTs] = useState(0);
  const rushOverRef = useRef(null);
  rushOverRef.current = rushOver;
  const toastTimer = useRef(null);
  const busy = revealing >= 0;

  const tries = LENGTHS[len].tries;
  const day = dayNumber();
  const bank = useMemo(() => bankFor(len, answer), [len, answer]);

  // حالة "تحدي اليوم" لكل طول
  useEffect(() => {
    const d = {};
    for (const l of PLAYABLE_LENGTHS) {
      const saved = load(dailyKey(l, day), null);
      d[l] = saved?.status && saved.status !== 'playing' ? saved.status : null;
    }
    setDailyDone(d);
    setBulbsState(getBulbs());
    setMixStats(load(MIX_KEY, { streak: 0, best: 0 }));
    syncBulbs().then(setBulbsState);
    try { if (!localStorage.getItem('wg:guess-seen-help')) { setShowHelp(true); localStorage.setItem('wg:guess-seen-help', '1'); } } catch {}
  }, [day, phase]);

  const flash = useCallback((text, ms = 1400) => {
    clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // -------- بدء لعبة --------
  const start = useCallback((m, l = len) => {
    if (m === 'free' && mixedRef.current) l = PLAYABLE_LENGTHS[Math.floor(Math.random() * PLAYABLE_LENGTHS.length)];
    const word = m === 'daily' ? dailyAnswer(l, day) : randomAnswer(l, answer);
    let restored = { guesses: [], status: 'playing', hints: [] };
    if (m === 'daily') restored = load(dailyKey(l, day), restored);

    let keys = {};
    for (const g of restored.guesses) keys = mergeKeyStates(keys, g.word, g.result);

    setLen(l);
    setMode(m);
    setAnswer(word);
    setGuesses(restored.guesses);
    setCurrent('');
    setKeyStates(keys);
    setRevealing(-1);
    setStatus(restored.status);
    setShowResult(restored.status !== 'playing');
    setConfirmUnknown('');
    setStats(load(statsKey(l), emptyStats(l)));
    setHints(restored.hints || []);
    setElims([]); setElimUses(0); setShowHints(false); setEarned(0);
    setRushOver(null);
    if (m === 'rush') {
      const t = Date.now();
      setNowTs(t);
      setRushEndsAt(t + RUSH_SECONDS * 1000);
      setRushScore(0);
    }
    setPhase('playing');
  }, [len, day, answer]);

  // ضد الساعة: الكلمة الجاية
  const nextRushWord = useCallback(() => {
    if (rushOverRef.current) return;
    setAnswer(a => randomAnswer(len, a));
    setGuesses([]);
    setCurrent('');
    setKeyStates({});
    setHints([]);
    setElims([]); setElimUses(0); setShowHints(false);
    setConfirmUnknown('');
    setStatus('playing');
  }, [len]);

  // ضد الساعة: المؤقت والنهاية
  useEffect(() => {
    if (phase !== 'playing' || mode !== 'rush' || rushOver) return;
    const iv = setInterval(() => setNowTs(Date.now()), 200);
    return () => clearInterval(iv);
  }, [phase, mode, rushOver]);
  const rushLeft = mode === 'rush' && rushEndsAt ? Math.max(0, (rushEndsAt - nowTs) / 1000) : 0;
  useEffect(() => {
    if (mode !== 'rush' || phase !== 'playing' || rushOver || !rushEndsAt || !nowTs || rushLeft > 0) return;
    playGameOver();
    const prev = load(rushKey(len), 0);
    const record = rushScore > prev;
    if (record) save(rushKey(len), rushScore);
    setRushOver({ score: rushScore, best: Math.max(prev, rushScore), record, last: answer });
    setStatus('lost');
  }, [mode, phase, rushOver, rushEndsAt, nowTs, rushLeft, len, rushScore, answer]);

  // -------- إنهاء --------
  const finish = useCallback((won, finalGuesses) => {
    const s = load(statsKey(len), emptyStats(len));
    s.played += 1;
    if (won) {
      s.wins += 1;
      s.streak += 1;
      s.best = Math.max(s.best, s.streak);
      s.dist[finalGuesses.length - 1] = (s.dist[finalGuesses.length - 1] || 0) + 1;
      const penalty = hints.length * HINT_TYPES.reveal.penalty + elimUses * HINT_TYPES.elim.penalty;
      const pts = guessPoints({ len, triesUsed: finalGuesses.length, tries: LENGTHS[len].tries, penalty, streak: s.streak });
      setGain(pts);
      awardPoints(pts, true);
      const want = bulbsEarned({ usedHints: hints.length + elimUses > 0, streak: s.streak });
      setEarned(Math.min(want, BULB_MAX - getBulbs()));
      earnBulbs(want).then(r => setBulbsState(r.bulbs));
    } else {
      setLostStreak(s.streak);
      s.streak = 0;
    }
    save(statsKey(len), s);
    if (mixedRef.current) {
      const ms = load(MIX_KEY, { streak: 0, best: 0 });
      if (won) { ms.streak += 1; ms.best = Math.max(ms.best, ms.streak); }
      else { setLostStreak(ms.streak); ms.streak = 0; }
      save(MIX_KEY, ms);
      setMixStats(ms);
    }
    try { window.dispatchEvent(new Event('wg:stats')); } catch {}
    setStats(s);
  }, [len, hints, elimUses]);

  // -------- إرسال تخمين --------
  const submit = useCallback(() => {
    if (busy || status !== 'playing') return;
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
      flash('مو في قاموسنا 🤔 — اضغط تأكيد مرة ثانية', 2200);
      return;
    }

    const result = evaluateGuess(word, answer);
    const next = [...guesses, { word, result }];
    const won = result.every(r => r === 'correct');
    const lost = !won && next.length >= tries;
    const newStatus = won ? 'won' : lost ? 'lost' : 'playing';

    setGuesses(next);
    setCurrent('');
    setConfirmUnknown('');
    setRevealing(guesses.length);
    playReveal(result, FLIP_MS);
    if (mode === 'daily') save(dailyKey(len, day), { guesses: next, status: newStatus, hints });

    // بعد ما تخلص الحركة: لوّن الكيبورد وأعلن النتيجة
    const total = FLIP_MS * len + 250;
    setTimeout(() => {
      setRevealing(-1);
      setKeyStates(k => mergeKeyStates(k, word, result));
      if (mode === 'rush') {
        if (rushOverRef.current) return;
        if (won) { playStreak(); setWinRow(next.length - 1); setRushScore(s => s + 1); flash('+1 🔥', 900); setStatus('won'); setTimeout(() => { setWinRow(-1); nextRushWord(); }, 900); }
        else if (lost) { playLose(); flash(`الكلمة كانت: ${answer}`, 1600); setStatus('lost'); setTimeout(nextRushWord, 1400); }
        else playAccept();
        return;
      }
      if (won) {
        playWin();
        setWinRow(next.length - 1);
        setBurst(PRAISE[next.length - 1] || PRAISE[PRAISE.length - 1]);
        setTimeout(() => setBurst(null), 1900);
      } else if (lost) {
        playLose();
      } else {
        playAccept();
      }
      if (newStatus !== 'playing') {
        setStatus(newStatus);
        finish(won, next);
        if (won) setTimeout(() => { setWinRow(-1); start('free'); }, 2000);
        else setTimeout(() => setShowResult(true), 900);
      }
    }, total);
  }, [busy, status, current, len, confirmUnknown, answer, guesses, tries, mode, day, flash, finish, hints, nextRushWord, start]);

  // للتجارب فقط (وضع التطوير)
  useEffect(() => { if (process.env.NODE_ENV !== 'production') window.__guessAnswer = answer; }, [answer]);

  // -------- التلميح --------
  // ما يفتح إلا بعد أول محاولة، وكل نوع له سعر باللمبات 💡
  const maxHints = mode === 'rush' ? len - 1 : revealLimit(len);
  const hintsLeft = Math.max(0, maxHints - hints.length);
  const hintsLocked = mode !== 'rush' && guesses.length === 0;
  const spending = useRef(false);
  const spend = useCallback(async (cost) => {
    if (spending.current) return false;
    spending.current = true;
    try {
      const r = await spendBulbs(cost);
      setBulbsState(r.bulbs);
      if (!r.ok) flash('ما عندك لمبات كافية 💡');
      return r.ok;
    } finally { spending.current = false; }
  }, [flash]);

  // حروف ممكن نطفيها: موجودة بالكيبورد، مو في الكلمة، وما انعرفت بعد
  const elimCandidates = useMemo(() => {
    const inAns = new Set([...answer]);
    return [...LETTER_SET].filter(ch => !inAns.has(ch) && !keyStates[ch] && !elims.includes(ch) && (!bank || bank.has(ch)));
  }, [answer, keyStates, elims, bank]);

  const useElim = useCallback(async () => {
    if (busy || status !== 'playing' || hintsLocked) return;
    if (elimUses >= HINT_TYPES.elim.maxPerGame || !elimCandidates.length) return;
    if (!(await spend(HINT_TYPES.elim.cost))) return;
    const pool = [...elimCandidates];
    const picked = [];
    for (let n = Math.min(elimCount(len), pool.length); n > 0; n--) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    setElims(e => [...e, ...picked]);
    setElimUses(u => u + 1);
    setShowHints(false);
    playAccept(); haptic('light');
    flash(`🧹 طفّينا ${picked.length} حروف مو في الكلمة`);
  }, [busy, status, hintsLocked, elimUses, elimCandidates, spend, len, flash]);

  const useHint = useCallback(async () => {
    if (busy || status !== 'playing' || hints.length >= maxHints || hintsLocked) return;
    const letters = [...answer];
    const known = new Set();
    guesses.forEach(g => g.result.forEach((r, i) => { if (r === 'correct') known.add(i); }));
    const cand = letters.map((_, i) => i).filter(i => !known.has(i) && !hints.includes(i));
    if (!cand.length) { flash('عرفت كل الحروف بمكانها! 😄'); return; }
    if (mode !== 'rush' && !(await spend(HINT_TYPES.reveal.cost))) return;
    setShowHints(false);
    const i = cand[Math.floor(Math.random() * cand.length)];
    const nh = [...hints, i];
    setHints(nh);
    playAccept();
    if (mode === 'daily') save(dailyKey(len, day), { guesses, status, hints: nh });
    if (mode === 'rush') { setRushEndsAt(t => t - RUSH_HINT_COST * 1000); flash(`💡 −${RUSH_HINT_COST} ثواني`); }
  }, [busy, status, hints, maxHints, hintsLocked, answer, guesses, mode, len, day, flash, spend]);

  // الكيبورد يلوّن حروف التلميح بالأخضر
  const shownKeys = useMemo(() => {
    if (!hints.length && !elims.length) return keyStates;
    const k = { ...keyStates };
    for (const ch of elims) if (!k[ch]) k[ch] = 'absent';
    const letters = [...answer];
    for (const i of hints) k[letters[i]] = 'correct';
    return k;
  }, [keyStates, hints, elims, answer]);

  const typeKey = useCallback((k) => {
    if (busy || status !== 'playing') return;
    if (k === 'ENTER') return submit();
    if (k === 'BACK') { setCurrent(c => [...c].slice(0, -1).join('')); return; }
    const ch = normalizeGuess(k);
    if (!LETTER_SET.has(ch)) return;
    if (bank && !bank.has(ch)) { flash('🔒 هذا الحرف مو في الكلمة'); return; }
    playKey();
    setCurrent(c => ([...c].length < len ? c + ch : c));
  }, [busy, status, submit, len, bank]);

  usePhysicalKeys(phase === 'playing', typeKey);

  const share = useCallback(async () => {
    const text = shareText({ results: guesses.map(g => g.result), won: status === 'won', tries, len, day: mode === 'daily' ? day : null })
      + (hints.length ? `\n💡 ${hints.length}` : '');
    const url = publicUrl('/');
    if (await shareContent({ title: 'خمّن الكلمة', text: `${text}\n${url}` })) return;
    try { await navigator.clipboard.writeText(`${text}\n${url}`); flash('تم نسخ النتيجة 📋'); }
    catch { window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank', 'noopener'); }
  }, [guesses, status, tries, len, mode, day, flash, hints]);

  // -------- الإطار --------
  const shell = (children, sub) => (
    <div className="app-fixed flex flex-col" style={{ color: '#fff', userSelect: 'none' }}>
      <ArcadeBg letters={phase !== 'playing'} />
      <div className="shrink-0 flex items-center justify-between px-3 pt-2 pb-1.5">
        <button onClick={phase === 'playing' ? () => setPhase('setup') : onExit} aria-label="رجوع"
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 active:scale-90 transition-all">
          <ArrowRight className="w-5 h-5 text-white" strokeWidth={2.8} />
        </button>
        <div className="flex items-center gap-1.5 font-display font-black rounded-full px-3 py-1 bg-white/15" style={{ fontSize: '0.9rem' }}>
          <span className="flex gap-0.5"><i className="block w-2.5 h-2.5 rounded-sm bg-[#22c55e]" /><i className="block w-2.5 h-2.5 rounded-sm bg-[#ffb020]" /></span>
          <span>خمّن الكلمة</span>
          {sub && <span className="text-white/70 text-[0.75rem]">· {sub}</span>}
        </div>
        <button onClick={() => setShowHelp(true)} aria-label="طريقة اللعب"
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 active:scale-90 transition-all">
          <HelpCircle className="w-4 h-4 text-white" strokeWidth={2.6} />
        </button>
      </div>
      {children}
      {showHelp && <HelpSheet onClose={() => setShowHelp(false)} />}
    </div>
  );

  // -------- الإعداد --------
  if (phase === 'setup') {
    const st = load(statsKey(len), emptyStats(len));
    return shell(
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6 flex items-center justify-center">
        <Card className="w-full max-w-sm p-5 fade-in">
          <LetterTiles text="خمن" size={46} className="mb-3" />
          <h2 className="text-center font-display font-black text-[var(--ink-2)] text-2xl mb-1">خمّن الكلمة</h2>
          <p className="text-center text-muted text-sm leading-relaxed mb-5">
            عندك محاولات محدودة تكتشف فيها الكلمة المخفية.<br />
            <span className="text-dim">الألوان تقول لك وين الحروف الصح</span>
          </p>

          <div className="font-display font-bold text-[0.85rem] text-muted mb-2">عدد الحروف</div>
          <div className="grid grid-cols-3 gap-2 mb-5">
            {PLAYABLE_LENGTHS.map(l => (
              <Choice key={l} selected={!mixed && len === l} onClick={() => { setMixed(false); setLen(l); }} className="py-2.5 px-1">
                <div className="font-display font-black text-xl leading-tight"><Num>{l}</Num> أحرف</div>
                <div className="text-xs opacity-75"><Num>{LENGTHS[l].tries}</Num> محاولات</div>
                <div className="text-[0.68rem] font-bold opacity-75 mt-0.5">{l === 3 ? 'أسهل' : 'أصعب'}</div>
              </Choice>
            ))}
            <Choice selected={mixed} onClick={() => setMixed(true)} className="py-2.5 px-1">
              <div className="font-display font-black text-xl leading-tight">🎲 مختلط</div>
              <div className="text-xs opacity-75"><Num>3</Num> أو <Num>5</Num></div>
              <div className="text-[0.68rem] font-bold opacity-75 mt-0.5">مفاجأة كل جولة</div>
            </Choice>
          </div>

          <Btn icon={Play} onClick={() => start('free')}>ابدأ</Btn>

          {st.played > 0 && (
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <MiniStat label="لعبت" value={st.played} />
              <MiniStat label="فوز %" value={Math.round((st.wins / st.played) * 100)} />
              <MiniStat label="سلسلة" value={st.streak} />
            </div>
          )}
        </Card>
      </div>
    );
  }

  // -------- اللعب --------
  const rows = buildRows(guesses, current, tries, status === 'playing');
  const shown = mixed ? mixStats : stats;

  return shell(
    <>
      {/* الشبكة */}
      {mode === 'rush' && (
        <div className="shrink-0 px-4 pt-1 flex items-stretch gap-2.5">
          <div className="flex-1 rounded-2xl px-3 py-1 text-center" style={{ background: '#ffb020', boxShadow: '0 4px 0 #b86b00', color: '#4a2400' }}>
            <div className="text-[0.7rem] font-display font-black">حليت</div>
            <div key={rushScore} className="score-bump font-display font-black text-2xl leading-none text-white" style={{ textShadow: '0 2px 0 #b86b00' }}><Num>{rushScore}</Num></div>
          </div>
          <div className={`flex-1 rounded-2xl px-3 py-1 text-center ${rushLeft <= 15 ? 'animate-pulse' : ''}`}
            style={rushLeft <= 15 ? { background: '#ff4d6d', boxShadow: '0 4px 0 #b3123a', color: '#fff' } : { background: 'var(--card)', boxShadow: '0 4px 0 var(--edge)', color: 'var(--ink-3)' }}>
            <div className="text-[0.7rem] font-display font-black opacity-80">الوقت</div>
            <div className="font-mono-ar font-black text-2xl leading-none"><bdi>{Math.floor(rushLeft / 60)}:{String(Math.floor(rushLeft % 60)).padStart(2, '0')}</bdi></div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 relative">
        {status === 'playing' && !rushOver && (
          <div className="flex items-center gap-2 mb-2.5" dir="rtl">
            {mode === 'rush' ? (
              <button onClick={useHint} disabled={!hintsLeft || busy}
                className="btn-3d inline-flex items-center gap-1 rounded-full px-3 py-1 font-display font-black text-[0.8rem]"
                style={hintsLeft ? { background: '#fde047', color: '#713f12', boxShadow: '0 3px 0 #ca8a04' } : { background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)' }}>
                <Lightbulb className="w-3.5 h-3.5" strokeWidth={2.6} />
                {hintsLeft ? <>تلميح <span className="opacity-75">(−<Num>{RUSH_HINT_COST}</Num>ث)</span></> : 'خلصت'}
              </button>
            ) : (
              <button disabled={busy}
                onClick={() => hintsLocked ? flash('خمّن مرة وحدة أول، بعدين يفتح التلميح 💡', 1800) : setShowHints(v => !v)}
                className="btn-3d inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-3 py-1 font-display font-black text-[0.8rem]"
                style={hintsLocked ? { background: 'rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.7)' } : { background: '#fde047', color: '#713f12', boxShadow: '0 3px 0 #ca8a04' }}>
                {hintsLocked ? <Lock className="w-3.5 h-3.5" strokeWidth={2.6} /> : <Lightbulb className="w-3.5 h-3.5" strokeWidth={2.6} />}
                تلميح
                <span className="rounded-full px-1.5 min-w-[1.6rem] text-center" style={{ background: hintsLocked ? 'rgba(255,255,255,0.15)' : 'rgba(113,63,18,0.15)' }}>
                  <Num>{bulbs}</Num>💡
                </span>
              </button>
            )}
            {hints.length > 0 && [...answer].map((ch, i) => (
              <div key={i} className="w-7 h-7 rounded-lg flex items-center justify-center font-display font-black text-base slide-in"
                style={hints.includes(i) ? { background: '#22c55e', color: '#fff', boxShadow: '0 2px 0 #15803d' } : { background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)' }}>
                {hints.includes(i) ? ch : '؟'}
              </div>
            ))}
          </div>
        )}
        <GuessBoard rows={rows} len={len} revealing={revealing} shakeRow={shakeRow} compact={mode === 'rush' || len === 5} winRow={winRow} />
        {mode !== 'rush' && (
          <div className="streak-bar mt-2.5 w-full max-w-[300px] rounded-2xl px-3 py-1 flex items-center justify-around glass" dir="rtl">
            <div className="flex items-center gap-1.5">
              <span key={shown.streak} className="score-bump font-display font-black text-xl text-white"><Num>{shown.streak}</Num></span>
              <span className="text-lg">🔥</span>
              <span className="text-[0.7rem] font-display font-bold text-white/75">ستريك حالي</span>
            </div>
            <div className="w-px h-6 bg-white/20" />
            <div className="flex items-center gap-1.5">
              <span className="font-display font-black text-xl text-white"><Num>{shown.best}</Num></span>
              <Trophy className="w-4 h-4 text-[#fde047]" strokeWidth={2.6} />
              <span className="text-[0.7rem] font-display font-bold text-white/75">أعلى ستريك</span>
            </div>
          </div>
        )}

        {showHints && status === 'playing' && !hintsLocked && mode !== 'rush' && (
          <HintMenu
            bulbs={bulbs}
            len={len}
            elimLeft={elimCandidates.length ? HINT_TYPES.elim.maxPerGame - elimUses : 0}
            revealLeft={hintsLeft}
            onElim={useElim}
            onReveal={useHint}
            onClose={() => setShowHints(false)}
          />
        )}

        {toast && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 slide-in font-display font-black rounded-full px-4 py-1.5 text-[var(--ink)] bg-[var(--card)] max-w-[calc(100%-24px)] text-center z-10"
            style={{ boxShadow: '0 4px 0 var(--edge)', fontSize: '0.9rem' }}>
            {toast}
          </div>
        )}

        {status === 'lost' && !showResult && !busy && (
          <button onClick={() => setShowResult(true)} className="mt-4 rounded-full bg-white/15 px-4 py-1.5 font-display font-bold text-sm">
            <BarChart3 className="w-4 h-4 inline ml-1" /> النتيجة
          </button>
        )}
      </div>

      {burst && <WinBurst text={burst} sub={gain > 0 ? `+${gain} ⭐${earned > 0 ? ` · +${earned} 💡` : ''}` : null} />}

      {/* الكيبورد */}
      <GuessKeyboard keyStates={shownKeys} onKey={typeKey} allowed={bank} disabled={!!rushOver} />

      {/* نتيجة ضد الساعة */}
      {rushOver && (
        <div className="absolute inset-0 z-20 flex items-end sm:items-center justify-center p-3 bg-[#1e0b4b]/55 fade-in">
          {rushOver.record && <Confetti />}
          <Card className="w-full max-w-sm p-5 slide-in text-center" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="font-display font-black text-xl text-[var(--ink-2)]">⏰ خلص الوقت!</div>
            {rushOver.record && (
              <div className="inline-block mt-1 font-display font-black text-white bg-[#22c55e] rounded-full px-3 py-0.5" style={{ boxShadow: '0 3px 0 #15803d' }}>🎉 رقم قياسي جديد!</div>
            )}
            <div className="font-display font-black text-[var(--ink)] mt-2" style={{ fontSize: '3.6rem', lineHeight: 1.1 }}><Num>{rushOver.score}</Num></div>
            <div className="text-muted text-sm font-display font-bold mb-3">كلمة حليتها في دقيقتين</div>
            <div className="flex items-center justify-center gap-2 mb-4 text-sm font-display font-bold text-[var(--muted-c)]">
              <Trophy className="w-4 h-4" /> أفضل نتيجة: <Num>{rushOver.best}</Num>
            </div>
            <div className="text-xs text-muted font-bold mb-1">آخر كلمة كانت</div>
            <LetterTiles text={rushOver.last} size={38} className="mb-4" />
            <div className="flex gap-2.5">
              <div className="flex-[1.3]"><Btn size="md" icon={RotateCcw} onClick={() => start('rush')}>مرة ثانية</Btn></div>
              <div className="flex-1"><Btn variant="wood" size="md" onClick={() => { setRushOver(null); setPhase('setup'); }}>رجوع</Btn></div>
            </div>
          </Card>
        </div>
      )}

      {/* الخسارة: صفحة بسيطة */}
      {showResult && status === 'lost' && (
        <div className="absolute inset-0 z-20 flex items-end sm:items-center justify-center p-3 bg-[#1e0b4b]/55 fade-in">
          <Card className="w-full max-w-sm p-5 slide-in text-center" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="font-display font-black text-2xl text-[var(--ink-2)]">المرة الجاية! 💪</div>
            <div className="text-muted text-sm font-display font-bold mt-1 mb-3">الكلمة كانت</div>
            <LetterTiles text={answer} size={len === 3 ? 52 : 40} className="mb-4" />
            <div className="flex items-center justify-center gap-4 mb-4 font-display font-bold text-[var(--muted-c)] text-sm">
              <span>🔥 ستريكك كان <Num>{lostStreak}</Num></span>
              <span className="w-px h-4 bg-[#ddd6fe]" />
              <span>🏆 أعلى <Num>{shown.best}</Num></span>
            </div>
            <Btn icon={RotateCcw} onClick={() => start('free')}>كلمة ثانية</Btn>
            <div className="flex justify-center gap-5 mt-3">
              <button onClick={share} className="text-sm font-display font-bold text-muted py-1 inline-flex items-center gap-1"><Share2 className="w-4 h-4" /> شارك</button>
              <button onClick={() => setPhase('setup')} className="text-sm font-display font-bold text-muted py-1">رجوع</button>
            </div>
          </Card>
        </div>
      )}
    </>,
    mixed ? <>🎲 <Num>{len}</Num> أحرف</> : null
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl py-1.5 bg-[var(--soft)] border-2 border-[var(--line)]">
      <div className="font-display font-black text-lg text-[var(--ink)] leading-tight"><Num>{value}</Num></div>
      <div className="text-[0.65rem] font-bold text-[var(--muted-c)]">{label}</div>
    </div>
  );
}

function Distribution({ dist, highlight }) {
  const max = Math.max(1, ...dist);
  return (
    <div className="space-y-1">
      <div className="text-xs font-display font-bold text-muted mb-1.5">توزيع المحاولات</div>
      {dist.map((n, i) => (
        <div key={i} className="flex items-center gap-2" dir="rtl">
          <span className="w-3 text-xs font-display font-black text-[var(--muted-c)] text-center"><Num>{i + 1}</Num></span>
          <div className="flex-1">
            <div className="h-5 rounded-md flex items-center justify-end px-1.5 text-[0.7rem] font-black transition-all"
              style={{
                width: `${Math.max(8, (n / max) * 100)}%`,
                background: highlight === i + 1 ? '#22c55e' : '#ede9fe',
                color: highlight === i + 1 ? '#ffffff' : 'var(--muted-c)',
              }}>
              <Num>{n}</Num>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function HelpSheet({ onClose }) {
  const Example = ({ word, mark, state, text }) => (
    <div className="mb-3">
      <div className="flex gap-1.5 mb-1" dir="rtl">
        {[...word].map((ch, i) => (
          <div key={i} className="w-9 h-9 rounded-lg border-2 flex items-center justify-center font-display font-black text-lg"
            style={i === mark ? TILE[state] : { background: 'var(--soft)', color: 'var(--ink-3)', borderColor: 'var(--line)' }}>
            {ch}
          </div>
        ))}
      </div>
      <div className="text-sm text-[var(--ink)]">{text}</div>
    </div>
  );
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-[#1e0b4b]/60 fade-in" onClick={onClose}>
      <Card className="w-full max-w-sm p-5 slide-in">
        <div onClick={e => e.stopPropagation()}>
          <div className="font-display font-black text-xl text-[var(--ink-2)] mb-1">طريقة اللعب</div>
          <p className="text-sm text-muted mb-4 leading-relaxed">
            اكتب كلمة كاملة واضغط ✓. بعد كل محاولة تتلوّن المربعات:
          </p>
          <Example word="كتاب" mark={0} state="correct" text={<><b>ك</b> موجودة وفي مكانها الصح</>} />
          <Example word="بحار" mark={0} state="present" text={<><b>ب</b> موجودة لكن بمكان ثاني</>} />
          <Example word="نهار" mark={3} state="absent" text={<><b>ر</b> مو موجودة في الكلمة</>} />
          <p className="text-xs text-muted mb-4 leading-relaxed">
            الهمزات تُحسب ألف (أ إ آ = ا)، والألف المقصورة ياء (ى = ي).
          </p>
          <div className="rounded-2xl bg-[#fef9c3] border-2 border-[#fde047] p-3 mb-4 text-[0.8rem] text-[#713f12] font-bold leading-relaxed">
            <div className="font-display font-black text-sm mb-0.5">💡 التلميحات</div>
            يفتح التلميح بعد أول محاولة، وتدفع له لمبات:<br />
            🧹 شيل حروف غلط = 1 💡 · 🔍 اكشف حرف = 2 💡<br />
            تكسب لمبة مع كل فوز بدون تلميح، ولمبة زيادة كل 5 ستريك 🔥
          </div>
          <Btn size="md" onClick={onClose}>يلا نلعب</Btn>
        </div>
      </Card>
    </div>
  );
}

// قائمة التلميح: نوعين بأسعار مختلفة
function HintMenu({ bulbs, len, elimLeft, revealLeft, onElim, onReveal, onClose }) {
  const Option = ({ icon, title, desc, cost, penalty, left, onClick }) => {
    const short = bulbs < cost;
    const off = left <= 0 || short;
    return (
      <button onClick={onClick} disabled={off}
        className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-right transition-all ${off ? 'opacity-50' : 'active:scale-[0.98]'}`}
        style={{ background: 'var(--card)', border: '2px solid var(--line)', boxShadow: off ? 'none' : '0 3px 0 var(--edge)' }}>
        <span className="text-2xl">{icon}</span>
        <span className="flex-1 min-w-0">
          <span className="block font-display font-black text-[var(--ink)]">{title}</span>
          <span className="block text-[0.72rem] font-bold text-[var(--muted-c)]">
            {left <= 0 ? 'استخدمته هالجولة' : short ? `تحتاج ${cost} 💡` : desc}
          </span>
        </span>
        <span className="shrink-0 text-center">
          <span className="block rounded-full px-2 py-0.5 font-display font-black text-sm" style={{ background: '#fde047', color: '#713f12' }}><Num>{cost}</Num>💡</span>
          <span className="block text-[0.65rem] font-bold text-[#b45309] mt-0.5">−<Num>{penalty}</Num>⭐</span>
        </span>
      </button>
    );
  };
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-[#1e0b4b]/45 fade-in" onClick={onClose}>
      <div className="w-full max-w-[320px] rounded-3xl p-3 slide-in" onClick={e => e.stopPropagation()}
        style={{ background: 'var(--soft)', boxShadow: '0 6px 0 var(--edge), 0 20px 40px -10px rgba(20,5,60,0.6)' }}>
        <div className="flex items-center justify-between px-1 mb-2.5">
          <div className="font-display font-black text-lg text-[var(--ink-2)]">💡 تلميح</div>
          <div className="rounded-full px-2.5 py-0.5 font-display font-black text-sm" style={{ background: '#fde047', color: '#713f12', boxShadow: '0 2px 0 #ca8a04' }}>
            عندك <Num>{bulbs}</Num>/<Num>{BULB_MAX}</Num> 💡
          </div>
        </div>
        <div className="space-y-2">
          <Option icon="🧹" title="شيل حروف غلط" desc={`نطفي ${elimCount(len)} حروف مو في الكلمة`}
            cost={HINT_TYPES.elim.cost} penalty={HINT_TYPES.elim.penalty} left={elimLeft} onClick={onElim} />
          <Option icon="🔍" title="اكشف حرف" desc="نحط لك حرف بمكانه الصح"
            cost={HINT_TYPES.reveal.cost} penalty={HINT_TYPES.reveal.penalty} left={revealLeft} onClick={onReveal} />
        </div>
        <div className="text-center text-[0.72rem] font-bold text-[var(--muted-c)] mt-2.5 leading-relaxed">
          اكسب 💡 مع كل فوز بدون تلميح · ولمبة زيادة كل 5 ستريك 🔥
        </div>
      </div>
    </div>
  );
}

// ============== أجزاء مشتركة (اللعب لحالك + التحدي أونلاين) ==============
export { TILE, FLIP_MS, KEY_ROWS, LETTER_SET, PRAISE };

export function buildRows(guesses, current, tries, active) {
  return Array.from({ length: tries }, (_, r) => {
    if (r < guesses.length) return { letters: [...guesses[r].word], result: guesses[r].result };
    if (r === guesses.length && active) return { letters: [...current], result: null, active: true };
    return { letters: [], result: null };
  });
}

export function GuessBoard({ rows, len, revealing = -1, shakeRow = false, compact = false, winRow = -1 }) {
  // حجم المربع: يتسع حسب العرض والارتفاع
  const tileSize = compact
    ? (len === 3 ? 'min(16vw, 4.4svh, 56px)' : len === 4 ? 'min(14vw, 4.4svh, 54px)' : 'min(12.5vw, 4svh, 50px)')
    : (len === 3 ? 'min(19vw, 5.6svh, 68px)' : len === 4 ? 'min(17vw, 5.6svh, 64px)' : 'min(14.5vw, 5.2svh, 60px)');
  return (
    <div className="flex flex-col gap-[min(1.4vw,7px)]" dir="rtl">
      {rows.map((row, r) => (
        <div key={r} className={`flex gap-[min(1.4vw,7px)] ${row.active && shakeRow ? 'shake' : ''}`}>
          {Array.from({ length: len }, (_, i) => {
            const ch = row.letters[i] || '';
            const res = row.result?.[i];
            const flipping = r === revealing;
            const filled = !!ch && !res;
            const style = res
              ? { ...TILE[res], ...(flipping ? { animation: `tile-flip ${FLIP_MS * 2}ms ease ${i * FLIP_MS}ms both`, transition: `background-color 0s ${i * FLIP_MS + FLIP_MS}ms, color 0s ${i * FLIP_MS + FLIP_MS}ms, box-shadow 0s ${i * FLIP_MS + FLIP_MS}ms` } : {}) }
              : filled
                ? { background: 'var(--card)', color: 'var(--ink-3)', borderColor: 'var(--line)', boxShadow: '0 4px 0 var(--edge)' }
                : { background: 'rgba(255,255,255,0.1)', borderColor: row.active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.18)' };
            return (
              <div key={r === winRow ? `w${i}` : i}
                className={`rounded-xl border-2 flex items-center justify-center font-display font-black ${filled ? 'tile-pop' : ''} ${r === winRow ? 'tile-win' : ''}`}
                style={{ width: tileSize, height: tileSize, fontSize: `calc(${tileSize} * 0.52)`, lineHeight: 1, paddingBottom: 3, ...style, ...(r === winRow ? { animationDelay: `${i * 100}ms` } : {}) }}>
                {ch}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// احتفال الفوز: توهج + أشعة + كلمة كبيرة + قصاصات
export function WinBurst({ text, sub = null }) {
  return (
    <div className="win-burst absolute inset-0 z-30 pointer-events-none flex items-center justify-center overflow-hidden">
      <Confetti count={50} />
      <div className="win-rays absolute w-[160vmax] h-[160vmax]"
        style={{ background: 'repeating-conic-gradient(rgba(255,255,255,0.13) 0deg 10deg, transparent 10deg 20deg)', maskImage: 'radial-gradient(circle, #000 0%, transparent 55%)', WebkitMaskImage: 'radial-gradient(circle, #000 0%, transparent 55%)' }} />
      <div className="win-glow absolute w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle, rgba(253,224,71,0.85) 0%, rgba(34,197,94,0.35) 45%, transparent 70%)' }} />
      <div className="win-text relative font-display font-black text-white text-center px-6"
        style={{ fontSize: 'clamp(2.6rem, 14vw, 4rem)', lineHeight: 1.15, textShadow: '0 5px 0 #15803d, 0 10px 30px rgba(20,5,60,0.6)' }}>
        {text}
        {sub && (
          <div className="mt-3 flex justify-center">
            <span className="rounded-full px-4 py-1 font-display font-black text-[1.4rem] text-[#4a2400]" style={{ background: '#fde047', boxShadow: '0 4px 0 #ca8a04', textShadow: 'none' }}>{sub}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// لوحة صغيرة بالألوان فقط (تقدّم الخصم بدون ما تكشف حروفه)
export function MiniBoard({ guesses, len, tries, size = 12 }) {
  return (
    <div className="flex flex-col gap-[3px]" dir="rtl">
      {Array.from({ length: tries }, (_, r) => (
        <div key={r} className="flex gap-[3px]">
          {Array.from({ length: len }, (_, i) => {
            const res = guesses[r]?.result?.[i];
            return (
              <div key={i} className="rounded-[3px]"
                style={{ width: size, height: size, background: res ? TILE[res].background : 'rgba(255,255,255,0.18)' }} />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function GuessKeyboard({ keyStates, onKey, disabled = false, allowed = null }) {
  const press = (k) => { haptic('light'); onKey(k); };
  return (
    <div className={`kb-tray shrink-0 px-[5px] pt-2.5 pb-2 space-y-[9px] ${disabled ? 'opacity-60 pointer-events-none' : ''}`} dir="ltr">
      {KEY_ROWS.map((row, ri) => (
        <div key={ri} className="flex justify-center gap-[5px]">
          {row.map(k => {
            const isEnter = k === 'ENTER', isBack = k === 'BACK';
            const st = keyStates[normalizeGuess(k)];
            const off = !!allowed && k.length === 1 && !allowed.has(normalizeGuess(k));
            const look = isEnter ? 'kb-enter' : isBack ? 'kb-back' : off ? 'kb-off' : st ? `kb-${st}` : 'kb-plain';
            return (
              <button key={k} onClick={() => press(k)} aria-disabled={off || undefined}
                data-ch={!isEnter && !isBack && !off ? k : undefined}
                className={`kb-key ${look} flex items-center justify-center font-display font-black`}
                style={{
                  height: isEnter ? 'min(11.5vw, 46px)' : 'min(12.4vw, 50px)',
                  flex: isEnter ? '1 1 100%' : isBack ? '1.55 1 0' : '1 1 0',
                  maxWidth: isEnter ? 440 : isBack ? 64 : 42,
                }}
                aria-label={isEnter ? 'إدخال' : isBack ? 'حذف' : k}>
                {isEnter ? <span className="flex items-center gap-2 text-[1.1rem]">تأكيد <CornerDownLeft className="w-5 h-5" strokeWidth={3} /></span>
                  : isBack ? <Delete className="w-[22px] h-[22px]" strokeWidth={2.4} />
                  : <span className="kb-glyph">{k}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// كيبورد الكمبيوتر
export function usePhysicalKeys(active, onKey) {
  useEffect(() => {
    if (!active) return;
    const handler = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'Enter') { e.preventDefault(); onKey('ENTER'); }
      else if (e.key === 'Backspace') { e.preventDefault(); onKey('BACK'); }
      else if (e.key.length === 1) onKey(e.key);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, onKey]);
}
