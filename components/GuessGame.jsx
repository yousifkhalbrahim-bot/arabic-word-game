'use client';

// ============== خمّن الكلمة ==============
// خمّن الكلمة المخفية: كل تخمين يكشف لك أي الحروف صح ومكانها.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, Delete, CornerDownLeft, CalendarDays, Shuffle, Share2, RotateCcw, BarChart3, HelpCircle } from 'lucide-react';
import { ArcadeBg, Card, Choice, Btn, Num, LetterTiles } from '@/components/ui';
import { Confetti } from '@/components/GameParts';
import {
  LENGTHS, PLAYABLE_LENGTHS, bankFor, normalizeGuess, evaluateGuess, mergeKeyStates, KNOWN,
  dayNumber, dailyAnswer, randomAnswer, shareText,
} from '@/lib/guess';
import { playAccept, playReject, playGameOver, playStreak } from '@/lib/sounds';
import { publicUrl, shareContent } from '@/lib/native';

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
const dailyKey = (len, day) => `wg:guess-daily:${len}:${day}`;
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
  const toastTimer = useRef(null);
  const busy = revealing >= 0;

  const tries = LENGTHS[len].tries;
  const day = dayNumber();

  // حالة "تحدي اليوم" لكل طول
  useEffect(() => {
    const d = {};
    for (const l of PLAYABLE_LENGTHS) {
      const saved = load(dailyKey(l, day), null);
      d[l] = saved?.status && saved.status !== 'playing' ? saved.status : null;
    }
    setDailyDone(d);
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
    const word = m === 'daily' ? dailyAnswer(l, day) : randomAnswer(l, answer);
    let restored = { guesses: [], status: 'playing' };
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
    setPhase('playing');
  }, [len, day, answer]);

  // -------- إنهاء --------
  const finish = useCallback((won, finalGuesses) => {
    const s = load(statsKey(len), emptyStats(len));
    s.played += 1;
    if (won) {
      s.wins += 1;
      s.streak += 1;
      s.best = Math.max(s.best, s.streak);
      s.dist[finalGuesses.length - 1] = (s.dist[finalGuesses.length - 1] || 0) + 1;
    } else {
      s.streak = 0;
    }
    save(statsKey(len), s);
    setStats(s);
  }, [len]);

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
      flash('مو في قاموسنا 🤔 — اضغط ✓ مرة ثانية للتأكيد', 2200);
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
    if (mode === 'daily') save(dailyKey(len, day), { guesses: next, status: newStatus });

    // بعد ما تخلص الحركة: لوّن الكيبورد وأعلن النتيجة
    const total = FLIP_MS * len + 250;
    setTimeout(() => {
      setRevealing(-1);
      setKeyStates(k => mergeKeyStates(k, word, result));
      if (won) {
        playStreak();
        flash(PRAISE[next.length - 1] || PRAISE[PRAISE.length - 1], 1800);
      } else if (lost) {
        playGameOver();
      } else {
        playAccept();
      }
      if (newStatus !== 'playing') {
        setStatus(newStatus);
        finish(won, next);
        setTimeout(() => setShowResult(true), won ? 1300 : 700);
      }
    }, total);
  }, [busy, status, current, len, confirmUnknown, answer, guesses, tries, mode, day, flash, finish]);

  const bank = useMemo(() => bankFor(len, answer), [len, answer]);

  const typeKey = useCallback((k) => {
    if (busy || status !== 'playing') return;
    if (k === 'ENTER') return submit();
    if (k === 'BACK') { setCurrent(c => [...c].slice(0, -1).join('')); return; }
    const ch = normalizeGuess(k);
    if (!LETTER_SET.has(ch) || (bank && !bank.has(ch))) return;
    setCurrent(c => ([...c].length < len ? c + ch : c));
  }, [busy, status, submit, len, bank]);

  usePhysicalKeys(phase === 'playing', typeKey);

  const share = useCallback(async () => {
    const text = shareText({ results: guesses.map(g => g.result), won: status === 'won', tries, len, day: mode === 'daily' ? day : null });
    const url = publicUrl('/');
    if (await shareContent({ title: 'خمّن الكلمة', text: `${text}\n${url}` })) return;
    try { await navigator.clipboard.writeText(`${text}\n${url}`); flash('تم نسخ النتيجة 📋'); }
    catch { window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank', 'noopener'); }
  }, [guesses, status, tries, len, mode, day, flash]);

  // -------- الإطار --------
  const shell = (children, sub) => (
    <div className="app-fixed flex flex-col" style={{ color: '#fff', userSelect: 'none' }}>
      <ArcadeBg letters={phase !== 'playing'} />
      <div className="shrink-0 flex items-center justify-between px-3 pt-2 pb-1.5">
        <button onClick={phase === 'playing' ? () => setPhase('setup') : onExit} aria-label="رجوع"
          className="w-8 h-8 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 active:scale-90 transition-all">
          <ArrowLeft className="w-4 h-4 text-white" strokeWidth={2.8} />
        </button>
        <div className="flex items-center gap-1.5 font-display font-black rounded-full px-3 py-1 bg-white/15" style={{ fontSize: '0.9rem' }}>
          <span className="flex gap-0.5"><i className="block w-2.5 h-2.5 rounded-sm bg-[#22c55e]" /><i className="block w-2.5 h-2.5 rounded-sm bg-[#ffb020]" /></span>
          <span>خمّن الكلمة</span>
          {sub && <span className="text-white/70 text-[0.75rem]">· {sub}</span>}
        </div>
        <button onClick={() => setShowHelp(true)} aria-label="طريقة اللعب"
          className="w-8 h-8 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 active:scale-90 transition-all">
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
          <h2 className="text-center font-display font-black text-[#4c1d95] text-2xl mb-1">خمّن الكلمة</h2>
          <p className="text-center text-muted text-sm leading-relaxed mb-5">
            عندك محاولات محدودة تكتشف فيها الكلمة المخفية.<br />
            <span className="text-dim">الألوان تقول لك وين الحروف الصح</span>
          </p>

          <div className="font-display font-bold text-[0.85rem] text-muted mb-2">عدد الحروف</div>
          <div className="grid grid-cols-2 gap-2.5 mb-5">
            {PLAYABLE_LENGTHS.map(l => (
              <Choice key={l} selected={len === l} onClick={() => setLen(l)} className="py-2.5">
                <div className="font-display font-black text-xl leading-tight"><Num>{l}</Num> أحرف</div>
                <div className="text-xs opacity-75"><Num>{LENGTHS[l].tries}</Num> محاولات</div>
                <div className="text-[0.68rem] font-bold opacity-75 mt-0.5">{l === 3 ? 'أسهل · ٧ حروف مقفلة' : 'أصعب · كل الحروف'}</div>
              </Choice>
            ))}
          </div>

          <div className="space-y-3">
            <Btn icon={CalendarDays} onClick={() => start('daily')}>
              {dailyDone[len] ? (dailyDone[len] === 'won' ? 'تحدي اليوم ✓ (شوف النتيجة)' : 'تحدي اليوم (شوف النتيجة)') : <>تحدي اليوم <span className="opacity-70 text-sm">#<Num>{day}</Num></span></>}
            </Btn>
            <Btn variant="wood" icon={Shuffle} onClick={() => start('free')}>لعب حر</Btn>
          </div>

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

  return shell(
    <>
      {/* الشبكة */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 relative">
        <GuessBoard rows={rows} len={len} revealing={revealing} shakeRow={shakeRow} />

        {toast && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 slide-in font-display font-black rounded-full px-4 py-1.5 text-[#2e1065] bg-white whitespace-nowrap z-10"
            style={{ boxShadow: '0 4px 0 #c4b5fd', fontSize: '0.9rem' }}>
            {toast}
          </div>
        )}

        {status !== 'playing' && !showResult && !busy && (
          <button onClick={() => setShowResult(true)} className="mt-4 rounded-full bg-white/15 px-4 py-1.5 font-display font-bold text-sm">
            <BarChart3 className="w-4 h-4 inline ml-1" /> النتيجة
          </button>
        )}
      </div>

      {/* الكيبورد */}
      <GuessKeyboard keyStates={keyStates} onKey={typeKey} allowed={bank} />

      {/* النتيجة */}
      {showResult && (
        <div className="absolute inset-0 z-20 flex items-end sm:items-center justify-center p-3 bg-[#1e0b4b]/55 fade-in"
          onClick={() => setShowResult(false)}>
          {status === 'won' && <Confetti />}
          <Card className="w-full max-w-sm p-5 slide-in" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
            <div onClick={e => e.stopPropagation()}>
              <div className="text-center font-display font-black text-2xl text-[#4c1d95]">
                {status === 'won' ? (PRAISE[guesses.length - 1] || 'فزت!') : 'المرة الجاية! 💪'}
              </div>
              <div className="text-center text-muted text-sm font-display font-bold mt-1 mb-3">
                {status === 'won'
                  ? <>عرفتها من <Num>{guesses.length}</Num> {guesses.length === 1 ? 'محاولة' : 'محاولات'}</>
                  : 'الكلمة كانت'}
              </div>
              <LetterTiles text={answer} size={len === 3 ? 52 : len === 4 ? 46 : 40} className="mb-4" />

              <div className="grid grid-cols-4 gap-2 text-center mb-4">
                <MiniStat label="لعبت" value={stats.played} />
                <MiniStat label="فوز %" value={stats.played ? Math.round((stats.wins / stats.played) * 100) : 0} />
                <MiniStat label="سلسلة" value={stats.streak} />
                <MiniStat label="أفضل" value={stats.best} />
              </div>

              <Distribution dist={stats.dist} highlight={status === 'won' ? guesses.length : 0} />

              <div className="flex gap-2.5 mt-4">
                <div className="flex-1"><Btn variant="green" size="md" icon={Share2} onClick={share}>شارك</Btn></div>
                <div className="flex-1">
                  <Btn size="md" icon={mode === 'free' ? RotateCcw : Shuffle} onClick={() => start('free')}>
                    {mode === 'free' ? 'كلمة ثانية' : 'لعب حر'}
                  </Btn>
                </div>
              </div>
              <button onClick={() => setShowResult(false)} className="w-full mt-3 text-sm font-display font-bold text-muted py-1">إغلاق</button>
            </div>
          </Card>
        </div>
      )}
    </>,
    mode === 'daily' ? `#${day}` : 'حر'
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl py-1.5 bg-[#f5f3ff] border-2 border-[#ede9fe]">
      <div className="font-display font-black text-lg text-[#2e1065] leading-tight"><Num>{value}</Num></div>
      <div className="text-[0.65rem] font-bold text-[#6d5b95]">{label}</div>
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
          <span className="w-3 text-xs font-display font-black text-[#6d5b95] text-center"><Num>{i + 1}</Num></span>
          <div className="flex-1">
            <div className="h-5 rounded-md flex items-center justify-end px-1.5 text-[0.7rem] font-black transition-all"
              style={{
                width: `${Math.max(8, (n / max) * 100)}%`,
                background: highlight === i + 1 ? '#22c55e' : '#ede9fe',
                color: highlight === i + 1 ? '#ffffff' : '#6d5b95',
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
            style={i === mark ? TILE[state] : { background: '#f5f3ff', color: '#3b1d6e', borderColor: '#ede9fe' }}>
            {ch}
          </div>
        ))}
      </div>
      <div className="text-sm text-[#2e1065]">{text}</div>
    </div>
  );
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-[#1e0b4b]/60 fade-in" onClick={onClose}>
      <Card className="w-full max-w-sm p-5 slide-in">
        <div onClick={e => e.stopPropagation()}>
          <div className="font-display font-black text-xl text-[#4c1d95] mb-1">طريقة اللعب</div>
          <p className="text-sm text-muted mb-4 leading-relaxed">
            اكتب كلمة كاملة واضغط ✓. بعد كل محاولة تتلوّن المربعات:
          </p>
          <Example word="كتاب" mark={0} state="correct" text={<><b>ك</b> موجودة وفي مكانها الصح</>} />
          <Example word="بحار" mark={0} state="present" text={<><b>ب</b> موجودة لكن بمكان ثاني</>} />
          <Example word="نهار" mark={3} state="absent" text={<><b>ر</b> مو موجودة في الكلمة</>} />
          <p className="text-xs text-muted mb-4 leading-relaxed">
            الهمزات تُحسب ألف (أ إ آ = ا)، والألف المقصورة ياء (ى = ي). كل يوم فيه كلمة جديدة للجميع.
          </p>
          <Btn size="md" onClick={onClose}>يلا نلعب</Btn>
        </div>
      </Card>
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

export function GuessBoard({ rows, len, revealing = -1, shakeRow = false, compact = false }) {
  // حجم المربع: يتسع حسب العرض والارتفاع
  const tileSize = compact
    ? (len === 3 ? 'min(16vw, 4.6vh, 56px)' : len === 4 ? 'min(14vw, 4.6vh, 54px)' : 'min(12.5vw, 4.2vh, 50px)')
    : (len === 3 ? 'min(19vw, 6.6vh, 68px)' : len === 4 ? 'min(17vw, 6.6vh, 64px)' : 'min(14.5vw, 6vh, 60px)');
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
                ? { background: '#fff', color: '#3b1d6e', borderColor: '#ede9fe', boxShadow: '0 4px 0 #c4b5fd' }
                : { background: 'rgba(255,255,255,0.1)', borderColor: row.active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.18)' };
            return (
              <div key={i}
                className={`rounded-xl border-2 flex items-center justify-center font-display font-black ${filled ? 'tile-pop' : ''}`}
                style={{ width: tileSize, height: tileSize, fontSize: `calc(${tileSize} * 0.52)`, lineHeight: 1, paddingBottom: 3, ...style }}>
                {ch}
              </div>
            );
          })}
        </div>
      ))}
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
  const rows = KEY_ROWS;
  const keyMax = 40;
  return (
    <div className={`shrink-0 px-1.5 pb-2 pt-2 space-y-1.5 ${disabled ? 'opacity-60 pointer-events-none' : ''}`} dir="ltr">
      {rows.map((row, ri) => (
        <div key={ri} className="flex justify-center gap-[4px]">
          {row.map(k => {
            const wide = k === 'ENTER' || k === 'BACK';
            const st = keyStates[normalizeGuess(k)];
            const off = !!allowed && k.length === 1 && !allowed.has(normalizeGuess(k));
            const style = k === 'ENTER'
              ? { background: '#22c55e', color: '#fff', boxShadow: '0 3px 0 #15803d' }
              : st ? KEY[st] : { background: 'rgba(255,255,255,0.92)', color: '#3b1d6e', boxShadow: '0 3px 0 #c4b5fd' };
            return (
              <button key={k} onClick={() => onKey(k)} disabled={off}
                className="btn-3d rounded-lg flex items-center justify-center font-display font-black"
                style={{ height: k === 'ENTER' ? 'min(11vw, 44px)' : 'min(13vw, 52px)', flex: k === 'ENTER' ? '1 1 100%' : wide ? '1.6 1 0' : '1 1 0', maxWidth: k === 'ENTER' ? 420 : wide ? 62 : keyMax, fontSize: '1.05rem', ...style, ...(off ? { background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.35)', boxShadow: 'none', opacity: 1 } : {}) }}
                aria-label={k === 'ENTER' ? 'إدخال' : k === 'BACK' ? 'حذف' : k}>
                {k === 'ENTER' ? <span className="flex items-center gap-2">تأكيد <CornerDownLeft className="w-5 h-5" strokeWidth={3} /></span>
                  : k === 'BACK' ? <Delete className="w-5 h-5" strokeWidth={2.6} />
                  : k}
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
