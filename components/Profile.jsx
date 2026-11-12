'use client';

// ============== ملفي ==============
import React, { useEffect, useState } from 'react';
import { ArrowRight, Pencil, Check, X, Star, Trophy, Calendar, Lightbulb, ChevronLeft, Flame } from 'lucide-react';
import { ArcadeBg, Num, inputClass, ErrorNote } from '@/components/ui';
import { fetchProfile, cachedPoints } from '@/lib/points';
import { getBulbs, syncBulbs, BULB_MAX } from '@/lib/bulbs';
import { LENGTHS, PLAYABLE_LENGTHS } from '@/lib/guess';

const ENDING_TIMES = [
  { s: 30, label: '30 ثانية' },
  { s: 60, label: 'دقيقة' },
  { s: 90, label: 'دقيقة ونص' },
];

function readJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
const readInt = (key) => { try { return parseInt(localStorage.getItem(key) || '0', 10) || 0; } catch { return 0; } };

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export default function Profile({ name, onSaveName, onExit, onLeaderboard }) {
  const [prof, setProf] = useState(null);
  const [cache, setCache] = useState(null);
  const [bulbs, setBulbs] = useState(3);
  const [guessStats, setGuessStats] = useState({});
  const [endBest, setEndBest] = useState({});
  const [len, setLen] = useState(3);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [err, setErr] = useState('');

  useEffect(() => {
    setCache(cachedPoints());
    setBulbs(getBulbs());
    const gs = {};
    for (const l of PLAYABLE_LENGTHS) gs[l] = readJSON(`wg:guess-stats:${l}`, null);
    setGuessStats(gs);
    const eb = {};
    for (const { s } of ENDING_TIMES) eb[s] = readInt(`wg:solo-best:${s}`);
    setEndBest(eb);
    // لو لعب ٥ أحرف أكثر نفتح عليها
    if ((gs[5]?.played || 0) > (gs[3]?.played || 0)) setLen(5);

    fetchProfile().then(r => {
      if (r) { setProf(r); if (typeof r.bulbs === 'number') setBulbs(Math.min(BULB_MAX, r.bulbs)); }
      else syncBulbs().then(setBulbs);
    });
  }, []);

  const points = prof?.points ?? cache?.points ?? 0;
  const week = prof?.week_points ?? cache?.week ?? 0;
  // الترتيب يطلع بس لو عندك نقاط
  const rank = points > 0 ? (prof ? prof.rank : cache?.rank) : null;
  const weekRank = week > 0 ? (prof ? prof.week_rank : cache?.weekRank) : null;
  const since = prof?.since ? new Date(prof.since) : null;

  const save = () => {
    const e = onSaveName(draft);
    if (e) { setErr(e); return; }
    setErr(''); setEditing(false);
  };

  // -------- إحصائيات خمّن الكلمة --------
  const gs = guessStats[len];
  const tries = LENGTHS[len].tries;
  const dist = gs?.dist || Array(tries).fill(0);
  const maxDist = Math.max(1, ...dist);
  const winPct = gs?.played ? Math.round((gs.wins / gs.played) * 100) : 0;

  const statTile = ({ icon, label, value, sub, bg, sh, ink }) => (
    <div className="rounded-2xl p-3 flex flex-col gap-0.5" style={{ background: bg, boxShadow: `0 4px 0 ${sh}`, color: ink }}>
      <div className="flex items-center gap-1.5 text-[0.75rem] font-display font-bold opacity-80">{icon}{label}</div>
      <div className="font-display font-black text-[1.7rem] leading-none mt-1">{value}</div>
      {sub && <div className="text-[0.7rem] font-display font-bold opacity-75">{sub}</div>}
    </div>
  );

  const section = (title, children, extra) => (
    <div className="rounded-3xl bg-white p-4 text-[#2e1065]" style={{ boxShadow: '0 5px 0 #c4b5fd', border: '2px solid #ede9fe' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="font-display font-black text-lg text-[#4c1d95]">{title}</div>
        {extra}
      </div>
      {children}
    </div>
  );

  return (
    <div className="app-fixed flex flex-col" style={{ color: '#fff' }}>
      <ArcadeBg letters={false} />

      <div className="shrink-0 flex items-center justify-between gap-2 px-3 pt-2 pb-2">
        <button onClick={onExit} aria-label="رجوع"
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 active:scale-90 transition-all">
          <ArrowRight className="w-5 h-5 text-white" strokeWidth={2.8} />
        </button>
        <h1 className="font-display font-black text-white text-[1.5rem] leading-none" style={{ textShadow: '0 3px 0 rgba(46,16,101,0.45)' }}>ملفي</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pb-6 space-y-4">
        {/* البطاقة الرئيسية */}
        <div className="flex flex-col items-center pt-2 fade-in">
          <div className="w-24 h-24 rounded-[28px] flex items-center justify-center font-display font-black text-[3rem] text-[#4a2400] word-pop"
            style={{ background: 'linear-gradient(160deg, #ffd166, #ffb020)', boxShadow: '0 6px 0 #b86b00, 0 16px 26px -12px rgba(20,5,60,0.7)', border: '3px solid rgba(255,255,255,0.7)', paddingBottom: 6 }}>
            {(name.trim() || '؟').slice(0, 1)}
          </div>

          {editing ? (
            <div className="w-full max-w-xs mt-3">
              <div className="flex gap-2">
                <input type="text" value={draft} onChange={e => setDraft(e.target.value)} autoFocus maxLength={20}
                  onKeyDown={e => e.key === 'Enter' && save()} placeholder="اكتب اسمك" autoComplete="nickname" enterKeyHint="done"
                  className={`${inputClass} text-center text-lg !py-2.5`} />
                <button onClick={save} disabled={!draft.trim()} aria-label="حفظ"
                  className="shrink-0 w-12 rounded-2xl flex items-center justify-center bg-[#22c55e] disabled:opacity-50" style={{ boxShadow: '0 4px 0 #15803d' }}>
                  <Check className="w-6 h-6 text-white" strokeWidth={3} />
                </button>
                <button onClick={() => { setEditing(false); setErr(''); setDraft(name); }} aria-label="إلغاء"
                  className="shrink-0 w-12 rounded-2xl flex items-center justify-center bg-white/20">
                  <X className="w-5 h-5 text-white" strokeWidth={3} />
                </button>
              </div>
              {err && <div className="mt-2"><ErrorNote>{err}</ErrorNote></div>}
            </div>
          ) : (
            <button onClick={() => { setDraft(name); setEditing(true); }}
              className="mt-3 flex items-center gap-2 rounded-full px-3 py-1 min-h-[44px] hover:bg-white/10 active:scale-95 transition-all">
              <span className="font-display font-black text-[1.7rem] leading-none truncate max-w-[14rem]" style={{ textShadow: '0 3px 0 rgba(46,16,101,0.45)' }}>{name || 'لاعب'}</span>
              <Pencil className="w-4 h-4 text-white/70" strokeWidth={2.6} />
            </button>
          )}
          {since && !editing && (
            <div className="text-[0.75rem] font-display font-bold text-white/70 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> يلعب معنا من {MONTHS[since.getMonth()]} <Num>{since.getFullYear()}</Num>
            </div>
          )}
        </div>

        {/* النقاط والترتيب */}
        <div className="grid grid-cols-2 gap-3">
          {statTile({ icon: <Star className="w-3.5 h-3.5" fill="currentColor" strokeWidth={0} />, label: 'كل نقاطي', value: <Num>{points}</Num>,
            sub: rank ? <>المركز <Num>{rank}</Num>{prof?.players ? <> من <Num>{prof.players}</Num></> : null}</> : 'العب عشان تدخل الترتيب',
            bg: '#fde047', sh: '#ca8a04', ink: '#4a2400' })}
          {statTile({ icon: <Calendar className="w-3.5 h-3.5" strokeWidth={2.6} />, label: 'هالأسبوع', value: <Num>{week}</Num>,
            sub: weekRank ? <>المركز <Num>{weekRank}</Num></> : 'ما لعبت هالأسبوع',
            bg: '#fff', sh: '#c4b5fd', ink: '#2e1065' })}
          {statTile({ icon: <Trophy className="w-3.5 h-3.5" strokeWidth={2.6} />, label: 'مرات الفوز', value: <Num>{prof?.wins ?? '—'}</Num>,
            sub: 'بكل الألعاب', bg: '#22c55e', sh: '#15803d', ink: '#fff' })}
          {statTile({ icon: <Lightbulb className="w-3.5 h-3.5" strokeWidth={2.6} />, label: 'لمبات التلميح', value: <><Num>{bulbs}</Num><span className="text-base opacity-70">/<Num>{BULB_MAX}</Num></span></>,
            sub: 'تكسبها بالفوز بدون تلميح', bg: '#fff', sh: '#c4b5fd', ink: '#2e1065' })}
        </div>

        <button onClick={onLeaderboard}
          className="btn-3d w-full flex items-center justify-between rounded-2xl px-4 min-h-[52px] font-display font-black text-[#4a2400]"
          style={{ background: '#ffb020', boxShadow: '0 4px 0 #b86b00' }}>
          <span className="flex items-center gap-2"><Trophy className="w-5 h-5" strokeWidth={2.6} /> شوف المتصدرين</span>
          <ChevronLeft className="w-5 h-5" strokeWidth={3} />
        </button>

        {/* خمّن الكلمة */}
        {section('🟩 خمّن الكلمة', (
          gs?.played ? (
            <>
              <div className="grid grid-cols-4 gap-2 text-center mb-4">
                {[['لعبت', gs.played], ['فوز %', winPct], ['ستريك', gs.streak], ['أعلى ستريك', gs.best]].map(([l, v]) => (
                  <div key={l} className="rounded-xl bg-[#f5f3ff] py-2">
                    <div className="font-display font-black text-xl leading-tight"><Num>{v}</Num></div>
                    <div className="text-[0.65rem] font-display font-bold text-[#6d5b95]">{l}</div>
                  </div>
                ))}
              </div>
              <div className="text-[0.75rem] font-display font-bold text-[#6d5b95] mb-1.5">حليتها من كم محاولة؟</div>
              <div className="space-y-1.5">
                {dist.map((n, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-4 text-center font-display font-black text-sm"><Num>{i + 1}</Num></span>
                    <div className="flex-1 h-6 rounded-lg bg-[#f5f3ff] overflow-hidden">
                      {n > 0 && <div className="h-full rounded-lg flex items-center justify-end px-2 font-display font-black text-xs text-white transition-all"
                        style={{ width: `${Math.max(12, (n / maxDist) * 100)}%`, background: n === maxDist && n > 0 ? '#22c55e' : '#a78bfa' }}>
                        <Num>{n}</Num>
                      </div>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center text-sm font-display font-bold text-[#6d5b95] py-3">ما لعبت <Num>{len}</Num> أحرف للحين 🙂</div>
          )
        ), (
          <div className="flex gap-1 p-0.5 rounded-full bg-[#f5f3ff]">
            {PLAYABLE_LENGTHS.map(l => (
              <button key={l} onClick={() => setLen(l)}
                className="rounded-full px-3 py-1 text-xs font-display font-black transition-all"
                style={len === l ? { background: '#4c1d95', color: '#fff' } : { color: '#6d5b95' }}>
                <Num>{l}</Num> أحرف
              </button>
            ))}
          </div>
        ))}

        {/* تحدي النهايات */}
        {section(<>⏱ تحدي النهايات <span className="text-[0.75rem] text-[#6d5b95]">· أفضل نتيجة</span></>, (
          <div className="grid grid-cols-3 gap-2 text-center">
            {ENDING_TIMES.map(({ s, label }) => (
              <div key={s} className="rounded-xl py-2.5" style={endBest[s] ? { background: '#fff7e6', border: '2px solid #ffd58a' } : { background: '#f5f3ff', border: '2px solid transparent' }}>
                <div className="font-display font-black text-2xl leading-tight" style={{ color: endBest[s] ? '#b45309' : '#b9a8f0' }}>
                  {endBest[s] ? <Num>{endBest[s]}</Num> : '—'}
                </div>
                <div className="text-[0.72rem] font-display font-bold text-[#6d5b95]">{label}</div>
              </div>
            ))}
          </div>
        ), <Flame className="w-5 h-5 text-[#ff6b1a]" />)}
      </div>
    </div>
  );
}
