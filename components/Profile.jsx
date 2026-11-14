'use client';

// ============== ملفي ==============
import React, { useEffect, useState } from 'react';
import { ArrowRight, Pencil, Check, X, ChevronLeft } from 'lucide-react';
import { ArcadeBg, Num, inputClass, ErrorNote } from '@/components/ui';
import BadgeArt from '@/components/BadgeArt';
import { fetchProfile, cachedPoints } from '@/lib/points';
import { LENGTHS, PLAYABLE_LENGTHS } from '@/lib/guess';
import { levelFor } from '@/lib/levels';
import { readProgress, computeBadges } from '@/lib/badges';
import { getSetting, setSetting, getTheme, setTheme } from '@/lib/settings';
import { playAccept } from '@/lib/sounds';
import { haptic } from '@/lib/native';

const ENDING_TIMES = [{ s: 120, label: 'دقيقتين' }];

// كسر يطلع بالترتيب الصح داخل النص العربي (٤/٩ مو ٩/٤)
const Frac = ({ a, b }) => <span dir="ltr" className="inline-block"><Num>{a}</Num>/<Num>{b}</Num></span>;

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

function readJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
const readInt = (key) => { try { return parseInt(localStorage.getItem(key) || '0', 10) || 0; } catch { return 0; } };

export default function Profile({ name, onSaveName, onExit, onLeaderboard }) {
  const [prof, setProf] = useState(null);
  const [cache, setCache] = useState(null);
  const [guessStats, setGuessStats] = useState({});
  const [endBest, setEndBest] = useState({});
  const [endStats, setEndStats] = useState(null);
  const [len, setLen] = useState(3);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [err, setErr] = useState('');
  const [settings, setSettings] = useState({ sound: true, haptics: true });
  const [themePref, setThemePref] = useState('auto');
  const toggle = (k) => {
    const on = !settings[k];
    setSetting(k, on);
    setSettings(v => ({ ...v, [k]: on }));
    // تجربة فورية لما يشغّلها
    if (on && k === 'sound') playAccept();
    if (on && k === 'haptics') haptic('medium');
  };

  useEffect(() => {
    setCache(cachedPoints());
    setSettings({ sound: getSetting('sound'), haptics: getSetting('haptics') });
    setThemePref(getTheme());
    const gs = {};
    for (const l of PLAYABLE_LENGTHS) gs[l] = readJSON(`wg:guess-stats:${l}`, null);
    setGuessStats(gs);
    const eb = {};
    for (const { s } of ENDING_TIMES) eb[s] = readInt(`wg:solo-best:${s}`);
    setEndStats(readJSON('wg:solo-stats', null));
    setEndBest(eb);
    if ((gs[5]?.played || 0) > (gs[3]?.played || 0)) setLen(5);

    fetchProfile().then(r => {
      if (r) setProf(r);
    });
  }, []);

  const points = prof?.points ?? cache?.points ?? 0;
  const week = prof?.week_points ?? cache?.week ?? 0;
  const rank = points > 0 ? (prof ? prof.rank : cache?.rank) : null;
  const weekRank = week > 0 ? (prof ? prof.week_rank : cache?.weekRank) : null;
  const since = prof?.since ? new Date(prof.since) : null;
  const lv = levelFor(points);

  // الأوسمة (نفس تعريفها في بطاقة «وسام جديد!»)
  const BADGES = computeBadges({ ...readProgress(), g3: guessStats[3] || {}, g5: guessStats[5] || {}, endBest }, prof?.wins);
  const wins = Math.max(prof?.wins ?? 0, readProgress().localWins);
  const earnedCount = BADGES.filter(b => b.earned).length;

  const save = () => {
    const e = onSaveName(draft);
    if (e) { setErr(e); return; }
    setErr(''); setEditing(false);
  };

  const gs = guessStats[len];
  const tries = LENGTHS[len].tries;
  // الإحصائيات القديمة لـ5 أحرف كانت 7 محاولات: نجمع الزيادة في آخر خانة
  const dist = (() => { const d = [...(gs?.dist || [])]; const out = Array(tries).fill(0); d.forEach((n, i) => { out[Math.min(i, tries - 1)] += n || 0; }); return out; })();
  const maxDist = Math.max(1, ...dist);
  const winPct = gs?.played ? Math.round((gs.wins / gs.played) * 100) : 0;

  const Section = ({ title, aside, children }) => (
    <section>
      <div className="flex items-center justify-between px-1 mb-2">
        <h2 className="font-display font-black text-white text-[1.05rem]" style={{ textShadow: '0 2px 0 rgba(46,16,101,0.4)' }}>{title}</h2>
        {aside}
      </div>
      <div className="rounded-3xl bg-[var(--card)] p-4 text-[var(--ink)]" style={{ boxShadow: '0 5px 0 var(--edge)', border: '2px solid var(--line)' }}>
        {children}
      </div>
    </section>
  );

  return (
    <div className="app-fixed flex flex-col" style={{ color: '#fff' }}>
      <ArcadeBg letters={false} />

      <div className="shrink-0 flex items-center justify-between gap-2 px-3 pt-2 pb-1">
        <button onClick={onExit} aria-label="رجوع"
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 active:scale-90 transition-all">
          <ArrowRight className="w-5 h-5 text-white" strokeWidth={2.8} />
        </button>
        <h1 className="font-display font-black text-white text-[1.35rem] leading-none">ملفي</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pt-2 pb-6 space-y-5">

        {/* ===== البطاقة الرئيسية ===== */}
        <div className="rounded-[28px] bg-[var(--card)] text-[var(--ink)] overflow-hidden fade-in" style={{ boxShadow: '0 6px 0 var(--edge), 0 18px 30px -16px rgba(20,5,60,0.6)' }}>
          <div className="relative px-4 pt-4 pb-3" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)' }}>
            <span className="absolute -left-10 -top-10 w-36 h-36 rounded-full bg-white/10" />
            <span className="absolute left-16 -bottom-12 w-24 h-24 rounded-full bg-white/[0.07]" />
            <div className="relative flex items-center gap-3.5">
              <div className="shrink-0 w-[76px] h-[76px] rounded-[24px] flex items-center justify-center font-display font-black text-[2.4rem] text-[#4a2400] word-pop"
                style={{ background: 'linear-gradient(160deg, #ffd166, #ffb020)', boxShadow: '0 5px 0 #b86b00', border: '3px solid rgba(255,255,255,0.75)', paddingBottom: 5 }}>
                {(name.trim() || '؟').slice(0, 1)}
              </div>
              <div className="flex-1 min-w-0">
                {editing ? (
                  <div>
                    <div className="flex gap-1.5">
                      <input type="text" value={draft} onChange={e => setDraft(e.target.value)} autoFocus maxLength={20}
                        onKeyDown={e => e.key === 'Enter' && save()} placeholder="اكتب اسمك" autoComplete="nickname" enterKeyHint="done"
                        className={`${inputClass} !py-2 !px-3 text-base min-w-0`} />
                      <button onClick={save} disabled={!draft.trim()} aria-label="حفظ"
                        className="shrink-0 w-10 rounded-xl flex items-center justify-center bg-[#22c55e] disabled:opacity-50" style={{ boxShadow: '0 3px 0 #15803d' }}>
                        <Check className="w-5 h-5 text-white" strokeWidth={3} />
                      </button>
                      <button onClick={() => { setEditing(false); setErr(''); setDraft(name); }} aria-label="إلغاء"
                        className="shrink-0 w-10 rounded-xl flex items-center justify-center bg-white/20">
                        <X className="w-5 h-5 text-white" strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setDraft(name); setEditing(true); }} className="flex items-center gap-1.5 max-w-full text-right active:scale-95 transition-all">
                    <span className="font-display font-black text-white text-[1.6rem] leading-tight truncate" style={{ textShadow: '0 2px 0 rgba(30,10,80,0.35)' }}>{name || 'لاعب'}</span>
                    <Pencil className="w-4 h-4 text-white/70 shrink-0" strokeWidth={2.6} />
                  </button>
                )}
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="rounded-full px-2.5 py-0.5 font-display font-black text-[0.78rem]" style={{ background: lv.color.bg, color: lv.color.ink }}>
                    ⭐ مستوى <Num>{lv.n}</Num>
                  </span>
                  {since && <span className="text-[0.78rem] font-display font-bold text-white/75">من {MONTHS[since.getMonth()]} <Num>{since.getFullYear()}</Num></span>}
                </div>
              </div>
            </div>
            {err && <div className="relative mt-2"><ErrorNote>{err}</ErrorNote></div>}

            {/* شريط المستوى */}
            <div className="relative mt-3.5">
              <div className="relative h-[18px] rounded-full bg-black/20 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(6, lv.pct)}%`, background: 'linear-gradient(90deg, #fde047, #ffb020)' }} />
                <div className="absolute inset-0 flex items-center justify-center font-mono-ar font-black text-[0.76rem] text-white" dir="ltr" style={{ textShadow: '0 1px 2px rgba(0,0,0,.45)' }}>
                  {lv.into} / {lv.cost}
                </div>
              </div>
              <div className="flex justify-between mt-1 text-[0.76rem] font-display font-bold text-white/80">
                <span>باقي <Num>{lv.left}</Num> نقطة للمستوى <Num>{lv.n + 1}</Num></span>
                <span>المستوى هذا يحتاج <Num>{lv.cost}</Num> نقطة</span>
              </div>
            </div>
          </div>

          {/* الأرقام */}
          <div className="grid grid-cols-3 divide-x divide-x-reverse divide-[var(--line)]">
            {[
              { label: 'النقاط', value: points, icon: '⭐' },
              { label: 'الفوز', value: wins, icon: '🏆' },
              { label: 'هالأسبوع', value: week, icon: '📅' },
            ].map(c => (
              <div key={c.label} className="py-3 text-center">
                <div className="font-display font-black text-[1.45rem] leading-none"><Num>{c.value}</Num></div>
                <div className="text-[0.76rem] font-display font-bold text-[var(--muted-c)] mt-1">{c.icon} {c.label}</div>
              </div>
            ))}
          </div>

          {/* الترتيب */}
          <button onClick={onLeaderboard} className="w-full flex items-center gap-3 px-4 py-3 border-t-2 border-[var(--soft)] hover:bg-[var(--soft-2)] active:bg-[var(--soft)] transition-all">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-[#4a2400]" style={{ background: '#ffb020', boxShadow: '0 3px 0 #b86b00' }}>
              {rank ? <Num>{rank}</Num> : '—'}
            </span>
            <span className="flex-1 text-right">
              <span className="block font-display font-black text-[0.95rem]">
                {rank ? <>مركزك في الترتيب{prof?.players ? <> من <Num>{prof.players}</Num></> : null}</> : 'العب عشان تدخل الترتيب'}
              </span>
              <span className="block text-[0.78rem] font-display font-bold text-[var(--muted-c)]">
                {weekRank ? <>هالأسبوع: المركز <Num>{weekRank}</Num></> : 'ما لعبت هالأسبوع'}
              </span>
            </span>
            <span className="flex items-center gap-0.5 text-[0.75rem] font-display font-black text-[#7c3aed]">المتصدرين <ChevronLeft className="w-4 h-4" strokeWidth={3} /></span>
          </button>
        </div>

        {/* ===== الأوسمة ===== */}
        <Section title="🏅 الأوسمة" aside={<span className="text-[0.8rem] font-display font-black text-white/85"><Frac a={earnedCount} b={BADGES.length} /></span>}>
          <div className="grid grid-cols-3 gap-2.5">
            {BADGES.map(b => {
              const ok = b.have >= b.need;
              return (
                <div key={b.name} className="rounded-2xl pt-2.5 pb-2 px-1 text-center flex flex-col items-center"
                  style={ok ? { background: 'var(--gold-soft)', border: '2px solid var(--gold-line)' } : { background: 'var(--soft)', border: '2px solid var(--line)' }}>
                  <BadgeArt {...b.art} on={ok} className={`w-[60px] h-[66px] ${ok ? 'word-pop' : ''}`} />
                  <div className="text-[0.74rem] font-display font-black mt-1" style={{ color: ok ? 'var(--ink)' : '#9c8cc4' }}>{b.name}</div>
                  {!ok && (
                    <div className="text-[0.72rem] font-display font-bold text-[#b9a8f0]">
                      <Frac a={Math.min(b.have, b.need)} b={b.need} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        {/* ===== خمّن الكلمة ===== */}
        <Section title="🟩 خمّن الكلمة" aside={
          <div className="flex gap-1 p-0.5 rounded-full bg-white/15">
            {PLAYABLE_LENGTHS.map(l => (
              <button key={l} onClick={() => setLen(l)}
                className="rounded-full px-3 py-1 text-xs font-display font-black transition-all"
                style={len === l ? { background: 'var(--card)', color: 'var(--ink-2)' } : { color: 'rgba(255,255,255,0.85)' }}>
                <Num>{l}</Num> أحرف
              </button>
            ))}
          </div>
        }>
          {gs?.played ? (
            <>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[['لعبت', gs.played], ['فوز %', winPct], ['ستريك', gs.streak], ['أعلى', gs.best]].map(([l, v]) => (
                  <div key={l}>
                    <div className="font-display font-black text-[1.35rem] leading-tight"><Num>{v}</Num></div>
                    <div className="text-[0.75rem] font-display font-bold text-[var(--muted-c)]">{l}</div>
                  </div>
                ))}
              </div>
              <div className="h-px bg-[#ede9fe] my-3" />
              <div className="text-[0.75rem] font-display font-bold text-[var(--muted-c)] mb-2">حليتها من كم محاولة؟</div>
              <div className="space-y-1.5">
                {dist.map((n, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-4 text-center font-display font-black text-sm text-[var(--muted-c)]"><Num>{i + 1}</Num></span>
                    <div className="flex-1 h-[22px] rounded-md bg-[var(--soft)] overflow-hidden">
                      {n > 0 && (
                        <div className="h-full rounded-md flex items-center justify-end px-2 font-display font-black text-xs text-white"
                          style={{ width: `${Math.max(12, (n / maxDist) * 100)}%`, background: n === maxDist ? '#22c55e' : '#a78bfa' }}>
                          <Num>{n}</Num>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center text-sm font-display font-bold text-[var(--muted-c)] py-4">ما لعبت <Num>{len}</Num> أحرف للحين 🙂</div>
          )}
        </Section>

        {/* ===== تحدي النهايات ===== */}
        <Section title="⏱ تحدي النهايات" aside={<span className="text-[0.75rem] font-display font-bold text-white/75">دقيقتين</span>}>
          {(() => {
            const best = Math.max(0, ...Object.values(endBest));
            const st = endStats;
            if (!best && !st?.played) return <div className="text-center text-sm font-display font-bold text-[var(--muted-c)] py-4">ما لعبت تحدي النهايات للحين 🙂</div>;
            const avg = st?.played ? Math.round(st.words / st.played) : 0;
            const last = st?.last || [];
            const top = Math.max(1, best, ...last);
            return (
              <>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[['🏆 أفضل', best], ['لعبت', st?.played || 0], ['المعدل', avg], ['🔥 أطول ستريك', st?.bestStreak || 0]].map(([l, v]) => (
                    <div key={l}>
                      <div className="font-display font-black text-[1.35rem] leading-tight"><Num>{v}</Num></div>
                      <div className="text-[0.72rem] font-display font-bold text-[var(--muted-c)]">{l}</div>
                    </div>
                  ))}
                </div>
                {last.length > 0 && (
                  <>
                    <div className="h-px bg-[var(--line)] my-3" />
                    <div className="flex justify-between text-[0.75rem] font-display font-bold text-[var(--muted-c)] mb-2">
                      <span>آخر جولاتك</span><span>كل كلماتك: <Num>{st.words}</Num></span>
                    </div>
                    <div className="flex items-end gap-1.5 h-[84px]" dir="ltr">
                      {last.map((n, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                          <span className="font-display font-black text-[0.72rem] text-[var(--ink)]"><Num>{n}</Num></span>
                          <div className="w-full rounded-md" style={{ height: Math.max(6, (n / top) * 58), background: n === best && n > 0 ? '#ffb020' : '#a78bfa' }} />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </Section>

        {/* ===== الإعدادات ===== */}
        <Section title="⚙️ الإعدادات">
          {/* المظهر */}
          <div className="pb-3 mb-1 border-b-2 border-[var(--soft)]">
            <div className="font-display font-black mb-2">🌙 المظهر</div>
            <div className="flex gap-1 p-1 rounded-2xl bg-[var(--soft)]">
              {[['auto', 'حسب الجوال'], ['light', '☀️ فاتح'], ['dark', '🌙 ليلي']].map(([k, label]) => (
                <button key={k} onClick={() => { setTheme(k); setThemePref(k); haptic('light'); }}
                  aria-pressed={themePref === k}
                  className="flex-1 rounded-xl min-h-[40px] font-display font-black text-[0.82rem] transition-all"
                  style={themePref === k ? { background: '#ffb020', color: '#4a2400', boxShadow: '0 3px 0 #b86b00' } : { color: 'var(--muted-c)' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y-2 divide-[var(--soft)] -my-1">
            {[['sound', '🔊 الأصوات', 'أصوات اللعب والفوز'], ['haptics', '📳 الاهتزاز', 'داخل تطبيق الآيفون']].map(([k, label, sub]) => (
              <button key={k} role="switch" aria-checked={settings[k]} onClick={() => toggle(k)}
                className="w-full flex items-center justify-between gap-3 py-2.5 text-right">
                <span>
                  <span className="block font-display font-black">{label}</span>
                  <span className="block text-[0.78rem] font-display font-bold text-[var(--muted-c)]">{sub}</span>
                </span>
                <span className="relative shrink-0 w-[52px] h-[30px] rounded-full transition-colors" style={{ background: settings[k] ? '#22c55e' : '#d4cdea' }}>
                  <span className="absolute top-[3px] w-6 h-6 rounded-full bg-white shadow transition-all" style={settings[k] ? { right: 25 } : { right: 3 }} />
                </span>
              </button>
            ))}
          </div>
        </Section>
      </div>
      {/* مكان شريط التنقل */}
      <div className="shrink-0" style={{ height: 68 }} />
    </div>
  );
}
