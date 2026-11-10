'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Target, Trophy, RotateCcw, SkipForward, Flame, Play, Check } from 'lucide-react';
import { ArcadeBg, Card, Choice, Btn, WordChip, Num, LetterTiles } from '@/components/ui';
import { Confetti } from '@/components/GameParts';
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

export default function SoloGame({ endings, onExit, startDuration }) {
  const [phase, setPhase] = useState('setup'); // setup | playing | done
  const [duration, setDuration] = useState(startDuration || 60);
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

  // جاي من صفحة "تحدي النهايات" بمدة جاهزة → يبدأ على طول
  const autoStarted = useRef(false);
  useEffect(() => {
    if (startDuration && !autoStarted.current) { autoStarted.current = true; start(); }
  }, [startDuration, start]);

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
    <div className="app-fixed flex flex-col" style={{ color: '#fff' }}>
      <ArcadeBg letters={phase !== 'playing'} />
      <div className="shrink-0 flex items-center justify-between px-3 pt-2 pb-2">
        <button onClick={onExit} aria-label="رجوع"
          className="w-8 h-8 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 active:scale-90 transition-all">
          <ArrowLeft className="w-4 h-4 text-white" strokeWidth={2.8} />
        </button>
        <div className="flex items-center gap-1.5 font-display font-black rounded-full px-3 py-1 bg-white/15" style={{ fontSize: '0.9rem' }}>
          <Target className="w-4 h-4 text-[#ffb020]" strokeWidth={2.8} />
          <span>تحدي النهايات · ضد الوقت</span>
        </div>
        <div style={{ width: 32 }} />
      </div>
      {children}
    </div>
  );

  // -------- الإعداد --------
  if (phase === 'setup') {
    return shell(
      <div className="flex-1 overflow-y-auto px-4 pb-6 flex items-center justify-center">
        <Card className="w-full max-w-sm p-5 fade-in">
          <div className="ending-badge mx-auto mb-3 w-14 h-14 rounded-full flex items-center justify-center">
            <Target className="w-7 h-7 text-[#7c3aed]" strokeWidth={2.6} />
          </div>
          <h2 className="text-center font-display font-black text-[#4c1d95] text-2xl mb-1">تحدَّ نفسك</h2>
          <p className="text-center text-muted text-sm leading-relaxed mb-5">
            أكبر عدد من الكلمات قبل ما يخلص الوقت.<br />
            <span className="text-dim">كل سؤال نهاية مختلفة · التجاوز يكلّفك <Num>{SKIP_COST_SECONDS}</Num> ثوانٍ</span>
          </p>
          <div className="grid grid-cols-3 gap-2.5 mb-5">
            {DURATIONS.map(({ s, label, sub }) => (
              <Choice key={s} selected={duration === s} onClick={() => setDuration(s)} className="py-3 px-1">
                <div className="font-mono-ar font-bold text-2xl leading-tight">{label}</div>
                <div className="text-xs opacity-75">{sub}</div>
                <div className="text-[0.72rem] mt-2 flex items-center justify-center gap-1 font-bold opacity-80">
                  <Trophy className="w-3 h-3" /> <Num>{bests[s] || 0}</Num>
                </div>
              </Choice>
            ))}
          </div>
          <Btn icon={Play} onClick={start}>ابدأ</Btn>
        </Card>
      </div>
    );
  }

  // -------- النتيجة --------
  if (phase === 'done' && result) {
    return shell(
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="w-full max-w-md mx-auto text-center fade-in pt-2">
          {result.isRecord && <Confetti />}
          <div className="mx-auto mb-2 w-16 h-16 rounded-2xl flex items-center justify-center bounce-gentle rotate-[-6deg]"
            style={{ background: '#ffb020', boxShadow: '0 6px 0 #b86b00', border: '3px solid rgba(255,255,255,0.6)' }}>
            <Trophy className="w-8 h-8 text-[#4a2400]" strokeWidth={2.6} />
          </div>
          {result.isRecord && (
            <div className="inline-block font-display font-black text-white bg-[#22c55e] rounded-full px-3 py-0.5 mb-1 slide-in" style={{ boxShadow: '0 3px 0 #15803d' }}>
              🎉 رقم قياسي جديد!
            </div>
          )}
          <div className="font-display font-black text-white" style={{ fontSize: '4rem', lineHeight: 1.1, textShadow: '0 5px 0 rgba(46,16,101,0.45)' }}>
            <Num>{result.score}</Num>
          </div>
          <div className="text-white/85 font-display font-bold text-sm mb-5">كلمة في <Num>{duration}</Num> ثانية</div>

          <div className="grid grid-cols-3 gap-2.5 mb-5 text-sm">
            <Stat label="أفضل نتيجة" value={Math.max(result.score, result.prevBest)} />
            <Stat label="أطول سلسلة" value={bestStreak} />
            <Stat label="تجاوزات" value={skips} />
          </div>

          {words.length > 0 && (
            <div className="glass rounded-2xl p-3 mb-6 text-right">
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto no-scrollbar pb-1">
                {words.map((w, i) => <WordChip key={i} player={1}>{w.w}</WordChip>)}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-[1.4]"><Btn icon={RotateCcw} onClick={start}>مرة ثانية</Btn></div>
            <div className="flex-1"><Btn variant="wood" onClick={() => setPhase('setup')}>تغيير المدة</Btn></div>
          </div>
        </div>
      </div>
    );
  }

  // -------- اللعب --------
  const low = timeLeft <= 10;
  const timeColor = low ? '#ff4d6d' : timeLeft <= 20 ? '#ffb020' : '#22c55e';
  const pct = Math.min(100, (timeLeft / duration) * 100);
  const recent = [...words].reverse().slice(0, 14);

  return shell(
    <div className="flex-1 flex flex-col px-4 pb-3 min-h-0">
      {/* النقاط + الوقت */}
      <div className="shrink-0 flex items-stretch gap-2.5 mb-3">
        <div className="flex-1 rounded-2xl px-3 py-1.5 text-center" style={{ background: '#ffb020', boxShadow: '0 5px 0 #b86b00', border: '2px solid rgba(255,255,255,0.4)' }}>
          <div className="font-display font-black text-[0.75rem] text-[#4a2400]">النقاط</div>
          <div key={words.length} className="score-bump font-display font-black text-white" style={{ fontSize: '2rem', lineHeight: 1.05, textShadow: '0 3px 0 #b86b00' }}>
            <Num>{words.length}</Num>
          </div>
        </div>
        <div className="flex-1 rounded-2xl px-3 py-1.5 text-center" style={{ background: low ? '#ff4d6d' : '#fff', boxShadow: `0 5px 0 ${low ? '#b3123a' : '#c4b5fd'}`, border: '2px solid rgba(255,255,255,0.5)' }}>
          <div className="font-display font-black text-[0.75rem]" style={{ color: low ? '#fff' : '#6d5b95' }}>الوقت</div>
          <div className={`font-mono-ar font-black ${low ? 'animate-pulse' : ''}`} style={{ fontSize: '2rem', lineHeight: 1.05, color: low ? '#fff' : '#3b1d6e' }}>
            <Num>{Math.ceil(timeLeft)}</Num>
          </div>
        </div>
      </div>
      <div className="shrink-0 h-3 rounded-full overflow-hidden mb-4 bg-white/20">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: timeColor, transition: 'width 0.1s linear' }} />
      </div>

      {/* السؤال */}
      <div className="wood-card shrink-0 text-center rounded-3xl px-3 pt-3 pb-4 mb-2 relative">
        {streak >= 2 && (
          <div className="absolute -top-3 left-3 flex items-center gap-1 font-display font-black text-white rounded-full px-2.5 py-0.5 slide-in"
            style={{ background: '#ff7a1a', boxShadow: '0 3px 0 #b84a00', fontSize: '0.8rem' }}>
            <Flame className="w-3.5 h-3.5" fill="#fff" /> <Num>{streak}</Num>
          </div>
        )}
        <div className="kb-hide font-display font-bold text-muted mb-2.5" style={{ fontSize: '0.85rem' }}>اكتب كلمة تنتهي بـ</div>
        <LetterTiles key={index} text={ending} size={58} />
      </div>

      {/* الإدخال */}
      <div className="shrink-0">
        <div className="h-8 flex items-center justify-center">
          {feedback && (
            <div className="slide-in font-display font-black rounded-full px-3 py-0.5 text-white"
              style={{ fontSize: '0.85rem', background: feedback.ok ? '#22c55e' : '#ff4d6d', boxShadow: `0 3px 0 ${feedback.ok ? '#15803d' : '#b3123a'}` }}>
              {feedback.text}
            </div>
          )}
        </div>
        <div className="flex items-stretch gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder="اكتب كلمة..."
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="off"
            className={`flex-1 min-w-0 rounded-2xl px-4 py-3 font-display font-bold text-lg focus:outline-none ${feedback && !feedback.ok ? 'shake' : ''}`}
            style={{ background: '#fff', color: '#2e1065', border: '3px solid #ede9fe', boxShadow: '0 5px 0 #c4b5fd' }}
          />
          <button onClick={submit} disabled={!input.trim()} aria-label="إرسال"
            className="btn-3d shrink-0 w-14 rounded-2xl flex items-center justify-center"
            style={{ background: '#22c55e', color: '#fff', boxShadow: '0 5px 0 #15803d', border: '2px solid #4ade80' }}>
            <Check className="w-7 h-7" strokeWidth={3.2} />
          </button>
        </div>
        <button onClick={skip} disabled={timeLeft <= SKIP_COST_SECONDS}
          className="kb-hide btn-3d mx-auto mt-4 flex items-center gap-1.5 rounded-full px-4 py-1.5 font-display font-black text-sm"
          style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', boxShadow: '0 3px 0 rgba(0,0,0,0.15)' }}>
          <SkipForward className="w-4 h-4" strokeWidth={2.8} /> تجاوز <span className="opacity-75">(−<Num>{SKIP_COST_SECONDS}</Num>ث)</span>
        </button>
      </div>

      {/* آخر الكلمات */}
      <div className="flex-1 min-h-0 overflow-y-auto mt-4">
        <div className="flex flex-wrap gap-2 justify-center pb-1">
          {recent.map((w, i) => (
            <WordChip key={words.length - i} player={1} fresh={i === 0}>{w.w}</WordChip>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="wood-card rounded-2xl py-2">
      <div className="font-display font-black text-xl text-parchment"><Num>{value}</Num></div>
      <div className="text-[0.7rem] font-bold text-muted">{label}</div>
    </div>
  );
}
