'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Target, Trophy, RotateCcw, SkipForward, Flame } from 'lucide-react';
import { checkRaceWord, shuffledEndingQueue, endingAt } from '@/lib/rules';
import { playAccept, playReject, playSkip, playTick, playGameOver, playStreak } from '@/lib/sounds';

const DURATIONS = [
  { s: 30, label: '٣٠', sub: 'ثانية' },
  { s: 60, label: '١', sub: 'دقيقة' },
  { s: 90, label: '١.٥', sub: 'دقيقة' },
];
const SKIP_COST_SECONDS = 3;
const STREAK_EVERY = 5;
const ACCENT = '#fbbf24';

const bestKey = (d) => `wg:solo-best:${d}`;
function readBest(d) {
  try { return parseInt(localStorage.getItem(bestKey(d)) || '0', 10) || 0; } catch { return 0; }
}
function writeBest(d, v) {
  try { localStorage.setItem(bestKey(d), String(v)); } catch {}
}

export default function SoloGame({ endings, onExit }) {
  const [phase, setPhase] = useState('setup'); // setup | playing | done
  const [duration, setDuration] = useState(60);
  const [bests, setBests] = useState({});
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [words, setWords] = useState([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [skips, setSkips] = useState(0);
  const [endsAt, setEndsAt] = useState(0);
  const [nowTs, setNowTs] = useState(Date.now());
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);
  const feedbackTimer = useRef(null);
  const lastTickRef = useRef(null);

  useEffect(() => {
    const b = {};
    DURATIONS.forEach(({ s }) => { b[s] = readBest(s); });
    setBests(b);
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    const iv = setInterval(() => setNowTs(Date.now()), 100);
    return () => clearInterval(iv);
  }, [phase]);

  const timeLeft = phase === 'playing' ? Math.max(0, (endsAt - nowTs) / 1000) : 0;
  const ending = endingAt(queue, index);

  const flash = useCallback((ok, text) => {
    clearTimeout(feedbackTimer.current);
    setFeedback({ ok, text });
    feedbackTimer.current = setTimeout(() => setFeedback(null), ok ? 700 : 1300);
  }, []);
  useEffect(() => () => clearTimeout(feedbackTimer.current), []);

  const start = useCallback(() => {
    setQueue(shuffledEndingQueue(endings, 10));
    setIndex(0);
    setWords([]);
    setStreak(0);
    setBestStreak(0);
    setSkips(0);
    setInput('');
    setFeedback(null);
    setResult(null);
    const t = Date.now();
    setNowTs(t);
    setEndsAt(t + duration * 1000);
    setPhase('playing');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [endings, duration]);

  // نهاية الوقت
  useEffect(() => {
    if (phase !== 'playing' || timeLeft > 0) return;
    playGameOver();
    const score = words.length;
    const prevBest = readBest(duration);
    const isRecord = score > prevBest;
    if (isRecord) {
      writeBest(duration, score);
      setBests(b => ({ ...b, [duration]: score }));
    }
    setResult({ score, prevBest, isRecord });
    setPhase('done');
  }, [phase, timeLeft, words.length, duration]);

  // نقرات آخر ٥ ثوانٍ
  useEffect(() => {
    if (phase !== 'playing') return;
    const secs = Math.ceil(timeLeft);
    if (secs <= 5 && secs > 0 && secs !== lastTickRef.current) {
      lastTickRef.current = secs;
      playTick();
    }
    if (secs > 5) lastTickRef.current = null;
  }, [timeLeft, phase]);

  const submit = useCallback(() => {
    if (phase !== 'playing' || timeLeft <= 0 || !input.trim()) return;
    const check = checkRaceWord(input, ending, words.map(w => w.w));
    if (!check.ok) {
      if (check.error) { playReject(); flash(false, check.error); }
      setStreak(0);
      return;
    }
    const nextStreak = streak + 1;
    setStreak(nextStreak);
    setBestStreak(b => Math.max(b, nextStreak));
    if (nextStreak % STREAK_EVERY === 0) playStreak(); else playAccept();
    setWords(ws => [...ws, { w: check.word, ending }]);
    setIndex(i => i + 1);
    setInput('');
    flash(true, nextStreak % STREAK_EVERY === 0 ? `🔥 ${nextStreak} متتالية!` : '✓ ' + check.word);
  }, [phase, timeLeft, input, ending, words, streak, flash]);

  const skip = useCallback(() => {
    if (phase !== 'playing' || timeLeft <= SKIP_COST_SECONDS) return;
    playSkip();
    setEndsAt(e => e - SKIP_COST_SECONDS * 1000);
    setIndex(i => i + 1);
    setSkips(s => s + 1);
    setStreak(0);
    setInput('');
    inputRef.current?.focus();
  }, [phase, timeLeft]);

  const shell = (children) => (
    <div className="flex flex-col" style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#0c0c1a', color: '#fff' }}>
      <div className="shrink-0 flex items-center justify-between px-4 pt-3 pb-2">
        <button onClick={onExit} className="transition-opacity hover:opacity-70 active:scale-90" aria-label="رجوع">
          <ArrowLeft className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.45)' }} />
        </button>
        <div className="flex items-center gap-1.5 font-display font-bold" style={{ fontSize: '0.95rem' }}>
          <Target className="w-4 h-4 text-amber-400" />
          <span>تدريب فردي</span>
        </div>
        <div style={{ width: 20 }} />
      </div>
      {children}
    </div>
  );

  // -------- الإعداد --------
  if (phase === 'setup') {
    return shell(
      <div className="flex-1 overflow-y-auto px-4 pb-6 flex items-center justify-center">
        <div className="w-full max-w-sm space-y-6 fade-in">
          <p className="text-center text-stone-400 text-sm leading-relaxed">
            اكتب أكبر عدد من الكلمات قبل ما يخلص الوقت.<br />
            كل سؤال نهاية مختلفة · التجاوز يكلّفك {SKIP_COST_SECONDS} ثوانٍ
          </p>
          <div className="grid grid-cols-3 gap-2">
            {DURATIONS.map(({ s, label, sub }) => (
              <button key={s} onClick={() => setDuration(s)}
                className={`p-3 rounded-xl border-2 transition-all ${duration === s ? 'bg-amber-400/10 border-amber-400/60 text-amber-200' : 'bg-stone-900/40 border-white/5 hover:border-white/20 text-stone-300'}`}>
                <div className="font-mono-ar font-bold text-xl">{label}</div>
                <div className="text-xs text-stone-400 mt-0.5">{sub}</div>
                <div className="text-[0.7rem] mt-1.5 text-stone-500 flex items-center justify-center gap-1">
                  <Trophy className="w-3 h-3" /> {bests[s] || 0}
                </div>
              </button>
            ))}
          </div>
          <button onClick={start}
            className="w-full bg-gradient-to-l from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-display font-bold text-lg py-4 rounded-xl transition-all shadow-lg shadow-amber-500/20">
            ابدأ
          </button>
        </div>
      </div>
    );
  }

  // -------- النتيجة --------
  if (phase === 'done' && result) {
    return shell(
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="w-full max-w-md mx-auto text-center fade-in pt-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 bg-amber-400/15 text-amber-300">
            <Trophy className="w-10 h-10 bounce-gentle" />
          </div>
          {result.isRecord && (
            <div className="font-display font-bold text-emerald-300 mb-1 slide-in">🎉 رقم قياسي جديد!</div>
          )}
          <div className="font-display font-black" style={{ fontSize: '3.5rem', color: ACCENT, lineHeight: 1.1 }}>{result.score}</div>
          <div className="text-stone-400 text-sm mb-5">كلمة في {duration} ثانية</div>

          <div className="grid grid-cols-3 gap-2 mb-5 text-sm">
            <Stat label="أفضل نتيجة" value={Math.max(result.score, result.prevBest)} />
            <Stat label="أطول سلسلة" value={bestStreak} />
            <Stat label="تجاوزات" value={skips} />
          </div>

          {words.length > 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 mb-6 text-right">
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                {words.map((w, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md font-display text-sm"
                    style={{ background: `${ACCENT}14`, color: ACCENT, border: `1px solid ${ACCENT}30` }}>
                    {w.w}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={start}
              className="flex-1 bg-gradient-to-l from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-display font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
              <RotateCcw className="w-5 h-5" /> مرة ثانية
            </button>
            <button onClick={() => setPhase('setup')}
              className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-stone-200 font-display font-bold py-3 rounded-xl transition-colors">
              تغيير المدة
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------- اللعب --------
  const timeColor = timeLeft <= 10 ? '#f87171' : timeLeft <= 20 ? '#fb923c' : '#4ade80';
  const pct = Math.min(100, (timeLeft / duration) * 100);
  const recent = [...words].reverse().slice(0, 12);

  return shell(
    <div className="flex-1 flex flex-col px-4 pb-3 min-h-0">
      {/* الوقت + النقاط */}
      <div className="shrink-0 flex items-end justify-between mb-2">
        <div>
          <div className="text-xs text-stone-500">النقاط</div>
          <div key={words.length} className="score-bump font-display font-black" style={{ fontSize: '2rem', color: ACCENT, lineHeight: 1 }}>{words.length}</div>
        </div>
        {streak >= 2 && (
          <div className="flex items-center gap-1 font-display font-bold text-orange-300 slide-in" style={{ fontSize: '0.9rem' }}>
            <Flame className="w-4 h-4" /> {streak}
          </div>
        )}
        <div className="text-left">
          <div className="text-xs text-stone-500">الوقت</div>
          <div className="font-mono-ar font-black" style={{ fontSize: '1.6rem', color: timeColor, lineHeight: 1 }}>{Math.ceil(timeLeft)}</div>
        </div>
      </div>
      <div className="shrink-0 h-1.5 rounded-full overflow-hidden mb-4" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: timeColor, transition: 'width 0.1s linear' }} />
      </div>

      {/* السؤال */}
      <div className="shrink-0 text-center rounded-2xl px-3 py-4 mb-3"
        style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.35)' }}>
        <div className="font-display font-bold text-stone-400 mb-2" style={{ fontSize: '0.85rem' }}>اكتب كلمة تنتهي بـ</div>
        <div key={index} className="word-pop font-display font-black"
          style={{ fontSize: 'clamp(2.6rem, 14vw, 3.6rem)', lineHeight: 1, color: ACCENT, textShadow: '0 0 24px rgba(251,191,36,0.6)' }}>
          {ending}
        </div>
      </div>

      {/* الإدخال */}
      <div className="shrink-0">
        <div className="h-6 text-center">
          {feedback && (
            <div className={`font-bold slide-in ${feedback.ok ? 'text-emerald-400' : 'text-rose-400'}`} style={{ fontSize: '0.85rem' }}>
              {feedback.text}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder="اكتب كلمة..."
            className={`flex-1 min-w-0 rounded-2xl px-4 py-3 font-display text-lg focus:outline-none ${feedback && !feedback.ok ? 'shake' : ''}`}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f5f0e8' }}
          />
          <button onClick={skip} disabled={timeLeft <= SKIP_COST_SECONDS}
            className="shrink-0 flex flex-col items-center justify-center rounded-2xl px-3 py-2 transition-all active:scale-95 disabled:opacity-30"
            style={{ background: 'rgba(10,14,28,0.7)', border: '1px solid rgba(251,191,36,0.25)' }}>
            <SkipForward className="w-4 h-4 text-amber-300" />
            <span className="text-[0.65rem] text-stone-400 mt-0.5">−{SKIP_COST_SECONDS}ث</span>
          </button>
        </div>
      </div>

      {/* آخر الكلمات */}
      <div className="flex-1 min-h-0 overflow-y-auto mt-4">
        <div className="flex flex-wrap gap-1.5 justify-center">
          {recent.map((w, i) => (
            <span key={words.length - i} className={`px-2 py-0.5 rounded-md font-display text-sm ${i === 0 ? 'word-pop' : ''}`}
              style={{ background: i === 0 ? `${ACCENT}22` : 'rgba(255,255,255,0.03)', color: i === 0 ? ACCENT : 'rgba(255,255,255,0.6)' }}>
              {w.w}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl py-2">
      <div className="font-display font-bold text-lg text-stone-200">{value}</div>
      <div className="text-[0.7rem] text-stone-500">{label}</div>
    </div>
  );
}
