'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, Target, Trophy, RotateCcw, SkipForward, Flame, Play, Check, HelpCircle, X, Share2 } from 'lucide-react';
import { ArcadeBg, Card, Choice, Btn, WordChip, Num, LetterTiles } from '@/components/ui';
import { Confetti } from '@/components/GameParts';
import { awardPoints, racePoints } from '@/lib/points';
import { haptic, publicUrl, shareContent } from '@/lib/native';
import { AbuShmagh, AbuCorner } from '@/components/AbuShmagh';
import { WordKeyboard, WordBox, useWordTyping } from '@/components/WordKeys';
import { abuSay, phraseFor } from '@/lib/abu';
import { checkRaceWord, shuffledEndingQueue, endingAt } from '@/lib/rules';
import { playAccept, playReject, playSkip, playTick, playGameOver, playStreak } from '@/lib/sounds';

// مدة ثابتة: دقيقتين
const SOLO_SECONDS = 120;
const DURATIONS = [{ s: SOLO_SECONDS }];
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
  const duration = SOLO_SECONDS;
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
  const hurriedRef = useRef(false);   // «بسرعة!» مرة وحدة بس كل جولة
  const [showHelp, setShowHelp] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const pausedAt = useRef(0);

  // أول مرة: يفتح الشرح تلقائي
  useEffect(() => {
    try { if (!localStorage.getItem('wg:solo-seen-help')) { setShowHelp(true); localStorage.setItem('wg:solo-seen-help', '1'); } } catch {}
  }, []);

  // الشرح وقت اللعب يوقف الوقت
  const openHelp = useCallback(() => {
    haptic('light');
    if (phase === 'playing') pausedAt.current = Date.now();
    setShowHelp(true);
  }, [phase]);
  const closeHelp = useCallback(() => {
    if (pausedAt.current) {
      const gap = Date.now() - pausedAt.current;
      pausedAt.current = 0;
      setEndsAt(e => e + gap);
      setNowTs(Date.now());
    }
    setShowHelp(false);
  }, []);

  useEffect(() => {
    const b = {};
    DURATIONS.forEach(({ s }) => { b[s] = readBest(s); });
    setBests(b);
  }, []);

  useEffect(() => {
    if (phase !== 'playing' || showHelp) return;
    const iv = setInterval(() => setNowTs(Date.now()), 100);
    return () => clearInterval(iv);
  }, [phase, showHelp]);

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
    setShareNote('');
    hurriedRef.current = false;
    setPhase('playing');
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
      try { window.dispatchEvent(new Event('wg:stats')); } catch {}
      setBests(b => ({ ...b, [duration]: score }));
    }
    setResult({ score, prevBest, isRecord, pts: racePoints(score), line: isRecord ? phraseFor('record') : '' });
    if (score > 0) awardPoints(racePoints(score), false);
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
    if (secs === 10 && !hurriedRef.current && duration > 10) { hurriedRef.current = true; abuSay('hurry'); }
  }, [timeLeft, phase, duration]);

  const submit = useCallback(() => {
    if (phase !== 'playing' || timeLeft <= 0 || !input.trim()) return;
    const check = checkRaceWord(input, ending, words.map(w => w.w));
    if (!check.ok) {
      if (check.error) { playReject(); flash(false, check.error); if (check.error === 'كلمة غير معروفة') abuSay('unknown'); }
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
    const best = bests[duration] || 0;
    if (best > 0 && words.length + 1 === best + 1) abuSay('record');
    flash(true, best > 0 && words.length + 1 === best + 1 ? '🏆 كسرت رقمك القياسي!'
      : nextStreak % STREAK_EVERY === 0 ? `🔥 ${nextStreak} متتالية!` : '✓ ' + check.word);
  }, [phase, timeLeft, input, ending, words, streak, flash, bests, duration]);

  const skip = useCallback(() => {
    if (phase !== 'playing' || timeLeft <= SKIP_COST_SECONDS) return;
    playSkip();
    setEndsAt(e => e - SKIP_COST_SECONDS * 1000);
    setIndex(i => i + 1);
    setSkips(s => s + 1);
    setStreak(0);
    setInput('');
  }, [phase, timeLeft]);

  // مشاركة النتيجة (واتساب وغيره)
  const shareResult = async () => {
    if (!result) return;
    const label = 'دقيقتين';
    const url = publicUrl('/');
    const text = `⏱ حليت ${result.score} كلمة في ${label} بتحدي النهايات 🔥
تقدر تغلبني؟
${url}`;
    if (await shareContent({ title: 'تحدي النهايات', text })) return;
    try { await navigator.clipboard.writeText(text); setShareNote('تم نسخ النتيجة 📋'); }
    catch { window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener'); }
  };

  const onKey = useWordTyping({ active: phase === 'playing' && timeLeft > 0 && !showHelp, setValue: setInput, onSubmit: submit });

  const shell = (children) => (
    <div className="app-fixed flex flex-col" style={{ color: '#fff' }}>
      <ArcadeBg letters={phase !== 'playing'} />
      <div className="shrink-0 flex items-center justify-between px-3 pt-2 pb-2">
        <button onClick={onExit} aria-label="رجوع"
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 active:scale-90 transition-all">
          <ArrowRight className="w-5 h-5 text-white" strokeWidth={2.8} />
        </button>
        <div className="flex items-center gap-1.5 font-display font-black rounded-full px-3 py-1 bg-white/15" style={{ fontSize: '0.9rem' }}>
          <Target className="w-4 h-4 text-[#ffb020]" strokeWidth={2.8} />
          <span>تحدي النهايات · ضد الوقت</span>
        </div>
        <button onClick={openHelp} aria-label="طريقة اللعب"
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 active:scale-90 transition-all">
          <HelpCircle className="w-4 h-4 text-white" strokeWidth={2.6} />
        </button>
      </div>
      {children}
      {showHelp && <HelpSheet paused={phase === 'playing'} onClose={closeHelp} />}
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
          <h2 className="text-center font-display font-black text-[var(--ink-2)] text-2xl mb-1">تحدَّ نفسك</h2>
          <p className="text-center text-muted text-sm leading-relaxed mb-5">
            أكبر عدد من الكلمات قبل ما يخلص الوقت.<br />
            <span className="text-dim">كل سؤال نهاية مختلفة · التجاوز يكلّفك <Num>{SKIP_COST_SECONDS}</Num> ثوانٍ</span>
          </p>
          <div className="rounded-2xl bg-[var(--soft)] border-2 border-[var(--line)] px-4 py-3 mb-5 flex items-center justify-around text-center font-display">
            <div><div className="font-black text-lg text-[var(--ink)]">⏱ <Num>2</Num> دقيقة</div><div className="text-xs font-bold text-[var(--muted-c)]">الوقت</div></div>
            <div className="w-px h-8 bg-[var(--line)]" />
            <div><div className="font-black text-lg text-[var(--ink)] flex items-center justify-center gap-1"><Trophy className="w-4 h-4 text-[#ca8a04]" /> <Num>{bests[SOLO_SECONDS] || 0}</Num></div><div className="text-xs font-bold text-[var(--muted-c)]">أفضل نتيجة</div></div>
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
          {result.isRecord ? (
            <div className="flex justify-center pt-12 mb-1"><AbuShmagh mood="win" say={result.line} size={110} /></div>
          ) : (
          <div className="mx-auto mb-2 w-16 h-16 rounded-2xl flex items-center justify-center bounce-gentle rotate-[-6deg]"
            style={{ background: '#ffb020', boxShadow: '0 6px 0 #b86b00', border: '3px solid rgba(255,255,255,0.6)' }}>
            <Trophy className="w-8 h-8 text-[#4a2400]" strokeWidth={2.6} />
          </div>
          )}
          {result.isRecord && (
            <div className="inline-block font-display font-black text-white bg-[#22c55e] rounded-full px-3 py-0.5 mb-1 slide-in" style={{ boxShadow: '0 3px 0 #15803d' }}>
              🎉 رقم قياسي جديد!
            </div>
          )}
          <div className="font-display font-black text-white" style={{ fontSize: '4rem', lineHeight: 1.1, textShadow: '0 5px 0 rgba(46,16,101,0.45)' }}>
            <Num>{result.score}</Num>
          </div>
          <div className="text-white/85 font-display font-bold text-sm mb-3">كلمة في دقيقتين</div>
          {result.pts > 0 && (
            <div className="inline-block mb-4 rounded-full px-4 py-1 font-display font-black text-[#4a2400]" style={{ background: '#fde047', boxShadow: '0 4px 0 #ca8a04' }}>
              ⭐ +<Num>{result.pts}</Num> نقطة
            </div>
          )}

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
            <div className="flex-1"><Btn variant="wood" onClick={() => setPhase('setup')}>رجوع</Btn></div>
          </div>
          {result.score > 0 && (
            <div className="mt-3"><Btn variant="green" size="md" icon={Share2} onClick={shareResult}>شارك نتيجتك</Btn></div>
          )}
          {shareNote && <div className="mt-2 text-sm font-display font-bold text-white/90 slide-in">{shareNote}</div>}
        </div>
      </div>
    );
  }

  // -------- اللعب --------
  const low = timeLeft <= 10;
  const best = bests[duration] || 0;
  const timeColor = low ? '#ff4d6d' : timeLeft <= 20 ? '#ffb020' : '#22c55e';
  const pct = Math.min(100, (timeLeft / duration) * 100);
  const recent = [...words].reverse().slice(0, 14);

  return shell(
    <div className="flex-1 flex flex-col min-h-0">
    <div className="flex-1 flex flex-col px-4 pb-2 min-h-0">
      {/* النقاط + الوقت */}
      <div className="shrink-0 flex items-stretch gap-2.5 mb-3">
        <div className="flex-1 rounded-2xl px-3 py-1.5 text-center" style={{ background: '#ffb020', boxShadow: '0 5px 0 #b86b00', border: '2px solid rgba(255,255,255,0.4)' }}>
          <div className="font-display font-black text-[0.75rem] text-[#4a2400]">النقاط</div>
          <div key={words.length} className="score-bump font-display font-black text-white" style={{ fontSize: '2rem', lineHeight: 1.05, textShadow: '0 3px 0 #b86b00' }}>
            <Num>{words.length}</Num>
          </div>
          {/* رقمك القياسي قدامك */}
          {best > 0 && (
            <div className="font-display font-black text-[0.75rem] text-[#4a2400] leading-tight">
              {words.length > best ? '🔥 رقم قياسي!'
                : best - words.length < 3 ? <>باقي <Num>{best - words.length + 1}</Num> وتكسره!</>
                : <>🏆 رقمك <Num>{best}</Num></>}
            </div>
          )}
        </div>
        <div className="flex-1 rounded-2xl px-3 py-1.5 text-center" style={{ background: low ? '#ff4d6d' : 'var(--card)', boxShadow: `0 5px 0 ${low ? '#b3123a' : 'var(--edge)'}`, border: '2px solid rgba(255,255,255,0.5)' }}>
          <div className="font-display font-black text-[0.75rem]" style={{ color: low ? '#fff' : 'var(--muted-c)' }}>الوقت</div>
          <div className={`font-mono-ar font-black ${low ? 'animate-pulse' : ''}`} style={{ fontSize: '2rem', lineHeight: 1.05, color: low ? '#fff' : 'var(--ink-3)' }}>
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
        <AbuCorner size={44} className="absolute left-2 bottom-1 z-20" />
      </div>

      {/* آخر الكلمات */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        <div className="flex flex-wrap gap-2 justify-center pb-1">
          {recent.map((w, i) => (
            <WordChip key={words.length - i} player={1} fresh={i === 0}>{w.w}</WordChip>
          ))}
        </div>
      </div>

      {/* مكان الإجابة: يعرض اللي تكتبه بكيبورد اللعبة */}
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
          <WordBox value={input} placeholder={`كلمة تنتهي بـ ${ending}`} shake={!!feedback && !feedback.ok} />
          <button onClick={skip} disabled={timeLeft <= SKIP_COST_SECONDS} aria-label="تجاوز"
            className="btn-3d shrink-0 rounded-2xl px-3 flex flex-col items-center justify-center font-display font-black text-[0.78rem]"
            style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', boxShadow: '0 4px 0 rgba(0,0,0,0.18)', border: '2px solid rgba(255,255,255,0.25)' }}>
            <SkipForward className="w-5 h-5" strokeWidth={2.6} />
            <span>تجاوز <span className="opacity-75">−<Num>{SKIP_COST_SECONDS}</Num>ث</span></span>
          </button>
        </div>
      </div>
    </div>
      <WordKeyboard onKey={onKey} disabled={timeLeft <= 0} />
    </div>
  );
}

// ============== طريقة اللعب ==============
function HelpSheet({ onClose, paused }) {
  const chip = (w, ok) => (
    <span className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 font-display font-black text-[0.95rem]"
      style={ok ? { background: '#22c55e', color: '#fff', boxShadow: '0 3px 0 #15803d' } : { background: '#ff4d6d', color: '#fff', boxShadow: '0 3px 0 #b3123a' }}>
      {w} {ok ? <Check className="w-3.5 h-3.5" strokeWidth={3.5} /> : <X className="w-3.5 h-3.5" strokeWidth={3.5} />}
    </span>
  );
  const step = (n, title, body) => (
    <div className="flex gap-3">
      <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-display font-black text-sm text-[#4a2400]" style={{ background: '#ffb020', boxShadow: '0 2px 0 #b86b00' }}><Num>{n}</Num></span>
      <div className="flex-1 min-w-0">
        <div className="font-display font-black text-[var(--ink)]">{title}</div>
        {body}
      </div>
    </div>
  );
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-[#1e0b4b]/60 fade-in" onClick={onClose}>
      <Card className="w-full max-w-sm p-5 slide-in max-h-full overflow-y-auto no-scrollbar">
        <div onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <div className="font-display font-black text-xl text-[var(--ink-2)]">طريقة اللعب</div>
            {paused && <span className="rounded-full bg-[var(--soft)] px-2.5 py-0.5 text-xs font-display font-bold text-[var(--muted-c)]">⏸ الوقت واقف</span>}
          </div>

          <div className="space-y-4">
            {step(1, 'يطلع لك نهاية', (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="rounded-2xl px-4 py-1.5 font-display font-black text-2xl text-[var(--ink-2)] bg-[var(--soft)] border-2 border-[var(--line)]">ـام</span>
                <span className="text-sm text-muted font-bold">مثلاً</span>
              </div>
            ))}
            {step(2, 'اكتب كلمة تنتهي فيها', (
              <div className="mt-1.5 space-y-2">
                <div className="flex flex-wrap gap-1.5">{chip('كلام', true)}{chip('سلام', true)}{chip('طعام', true)}</div>
                <div className="flex flex-wrap items-center gap-1.5">{chip('قلم', false)}<span className="text-xs text-muted font-bold">ما تنتهي بـ «ام»</span></div>
              </div>
            ))}
            {step(3, 'كل كلمة صح = نهاية جديدة', (
              <p className="text-sm text-muted font-bold leading-relaxed mt-0.5">حل أكثر عدد قبل ما يخلص الوقت</p>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-5 text-[0.78rem] font-display font-bold text-[var(--ink)]">
            <div className="rounded-xl bg-[var(--soft)] px-2.5 py-2">⏭ التجاوز ينقص <Num>{SKIP_COST_SECONDS}</Num> ثواني</div>
            <div className="rounded-xl bg-[var(--soft)] px-2.5 py-2">🔥 كل <Num>{STREAK_EVERY}</Num> ورا بعض ستريك</div>
            <div className="rounded-xl bg-[var(--soft)] px-2.5 py-2">🚫 الكلمة ما تتكرر</div>
            <div className="rounded-xl bg-[var(--soft)] px-2.5 py-2">⭐ <Num>2</Num> نقطة لكل كلمة</div>
          </div>
          <p className="text-[0.78rem] text-muted font-bold mt-3 leading-relaxed">
            الهمزات تُحسب ألف (أ إ آ = ا)، والألف المقصورة ياء (ى = ي).
          </p>

          <div className="mt-4"><Btn size="md" onClick={onClose}>{paused ? 'كمّل اللعب' : 'يلا نلعب'}</Btn></div>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="wood-card rounded-2xl py-2">
      <div className="font-display font-black text-xl text-parchment"><Num>{value}</Num></div>
      <div className="text-[0.76rem] font-bold text-muted">{label}</div>
    </div>
  );
}
