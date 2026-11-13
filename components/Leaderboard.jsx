'use client';

// ============== المتصدرون ==============
import React, { useEffect, useState } from 'react';
import { ArrowRight, Loader2, Star, Users, Clock, Crown, Trophy } from 'lucide-react';
import { ArcadeBg, Num } from '@/components/ui';
import { fetchLeaderboard, POINTS } from '@/lib/points';

// ألوان المراكز: ذهبي، فضي، برونزي
const PLACE = {
  1: { bg: '#ffb020', sh: '#b86b00', ink: '#4a2400', crown: '#fde047' },
  2: { bg: '#cbd5e1', sh: '#64748b', ink: '#1e293b', crown: '#e2e8f0' },
  3: { bg: '#fb923c', sh: '#9a3412', ink: '#431407', crown: '#fdba74' },
};

export default function Leaderboard({ onExit }) {
  const [scope, setScope] = useState('week');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [showHow, setShowHow] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchLeaderboard(scope).then(r => {
      if (!alive) return;
      setData(d => ({ ...d, [scope]: r || { error: true } }));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [scope]);

  const cur = data[scope];
  const top = cur?.top || [];
  const me = cur?.me;
  const meInTop = top.some(r => r.me);
  const rest = top.slice(3);

  // -------- منصة أول ٣ (الأول بالنص) --------
  const podiumSlot = (place) => {
    const r = top[place - 1];
    const c = PLACE[place];
    const big = place === 1;
    return (
      <div key={place} className={`flex-1 min-w-0 flex flex-col items-center rounded-3xl px-1.5 pb-3 ${big ? 'pt-3' : 'pt-2.5 mt-6'} ${r ? 'word-pop' : ''}`}
        style={{
          background: r?.me ? 'rgba(255,255,255,0.95)'
            : big && r ? 'linear-gradient(180deg, rgba(255,176,32,0.38), rgba(255,255,255,0.12))'
            : 'rgba(255,255,255,0.14)',
          border: `2px solid ${r ? c.bg : 'rgba(255,255,255,0.15)'}`,
          boxShadow: r ? `0 6px 0 ${big ? c.sh : 'rgba(30,10,80,0.35)'}` : 'none',
          animationDelay: `${(place === 1 ? 0 : place === 2 ? 120 : 220)}ms`,
        }}>
        <Crown className={big ? 'w-8 h-8' : 'w-6 h-6'} fill={r ? c.crown : 'transparent'} strokeWidth={1.8}
          style={{ color: r ? c.sh : 'rgba(255,255,255,0.35)' }} />
        <div className={`${big ? 'w-16 h-16 text-[2.2rem]' : 'w-12 h-12 text-[1.6rem]'} -mt-0.5 rounded-2xl flex items-center justify-center font-display font-black`}
          style={r ? { background: c.bg, color: c.ink, boxShadow: `0 4px 0 ${c.sh}`, border: '2px solid rgba(255,255,255,0.6)' } : { background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)' }}>
          <Num>{place}</Num>
        </div>
        <div className={`mt-2 w-full text-center font-display font-black truncate ${big ? 'text-[1.05rem]' : 'text-[0.9rem]'}`}
          style={{ color: r?.me ? '#2e1065' : '#fff' }}>
          {r ? (r.name || 'لاعب') : '—'}
        </div>
        {r && (
          <>
            <div className="flex items-center gap-1 font-display font-black text-[0.95rem]" style={{ color: r.me ? '#b45309' : '#fde047' }}>
              <Star className="w-3.5 h-3.5" fill="currentColor" strokeWidth={0} /><Num>{r.score}</Num>
            </div>
            <div className="text-[0.76rem] font-display font-bold" style={{ color: r.me ? '#6d5b95' : 'rgba(255,255,255,0.7)' }}>
              🏆 <Num>{r.wins}</Num> فوز
            </div>
          </>
        )}
      </div>
    );
  };

  // -------- سطر في القائمة (من الرابع وتحت) — لون واحد للكل --------
  const row = (r, rank, mine) => (
    <div key={`${rank}-${r.name}`} className="flex items-center gap-3 px-3 min-h-[60px]"
      style={mine ? { background: 'var(--gold-soft)' } : undefined}>
      <div className="w-8 shrink-0 text-center font-display font-black text-[1.05rem] text-[var(--muted-c)]"><Num>{rank}</Num></div>
      <div className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center font-display font-black"
        style={mine ? { background: '#ffb020', color: '#4a2400' } : { background: 'var(--soft)', color: 'var(--ink-2)' }}>
        {((r.name || 'أنت').trim() || '؟').slice(0, 1)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display font-black truncate text-[var(--ink)]">
          {r.name || 'أنت'}{mine && r.name && <span className="text-xs font-bold text-[var(--muted-c)] mr-1">(أنت)</span>}
        </div>
        {r.wins != null && <div className="text-[0.76rem] font-bold text-[var(--muted-c)]">🏆 <Num>{r.wins}</Num> فوز</div>}
      </div>
      <div className="shrink-0 flex items-center gap-1 font-display font-black text-lg text-[var(--ink)]">
        <Num>{r.score}</Num>
        <Star className="w-4 h-4 text-[#ffb020]" fill="currentColor" strokeWidth={0} />
      </div>
    </div>
  );

  return (
    <div className="app-fixed flex flex-col" style={{ color: '#fff' }}>
      <ArcadeBg letters={false} />

      {/* العنوان */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 pt-2 pb-2">
        <button onClick={onExit} aria-label="رجوع"
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 active:scale-90 transition-all">
          <ArrowRight className="w-5 h-5 text-white" strokeWidth={2.8} />
        </button>
        <div className="flex items-center gap-2">
          <Trophy className="w-7 h-7 text-[#fde047]" fill="#ffb020" strokeWidth={1.6} />
          <h1 className="font-display font-black text-white text-[1.6rem] leading-none" style={{ textShadow: '0 3px 0 rgba(46,16,101,0.45)' }}>المتصدرون</h1>
        </div>
        <div className="h-10 rounded-full px-3 bg-white/15 flex items-center gap-1.5 font-display font-bold text-xs">
          <Users className="w-4 h-4" strokeWidth={2.4} />
          <Num>{cur?.players ?? 0}</Num> لاعب
        </div>
      </div>

      {/* التبويبات */}
      <div className="shrink-0 px-4">
        <div className="flex gap-1.5 p-1 rounded-2xl bg-white/15">
          {[['week', 'الأسبوع'], ['all', 'الكل']].map(([id, label]) => (
            <button key={id} onClick={() => setScope(id)}
              className="flex-1 rounded-xl min-h-[42px] font-display font-black text-sm transition-all"
              style={scope === id ? { background: 'var(--card)', color: 'var(--ink-2)', boxShadow: '0 3px 0 var(--edge)' } : { color: 'rgba(255,255,255,0.85)' }}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-center gap-3 mt-2 text-[0.75rem] font-display font-bold text-white/80">
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" strokeWidth={2.4} />
            {scope === 'week' ? 'يبدأ من جديد كل إثنين' : 'كل نقاطك من أول يوم'}</span>
          <span className="w-px h-3 bg-white/30" />
          <button onClick={() => setShowHow(v => !v)} className="underline underline-offset-2 min-h-[32px]">كيف أجمع نقاط؟</button>
        </div>
        {showHow && (
          <div className="mt-2 rounded-2xl bg-[var(--card)] text-[var(--ink)] p-3 text-sm font-display font-bold leading-relaxed slide-in" style={{ boxShadow: '0 4px 0 var(--edge)' }}>
            <div>🟩 خمّن الكلمة لحالك: 10 (3 أحرف) أو 20 (5 أحرف) + بونص لكل محاولة ما استخدمتها + بونص الستريك · التلميح ينقص (🧹 −2 · 🔍 −5)</div>
            <div>⚔️ فوز مع صاحبك (مباراة أو لعبة): <Num>{POINTS.onlineWin}</Num> · تعادل: <Num>{POINTS.onlineDraw}</Num></div>
            <div>⏱ تحدي النهايات: 2 لكل كلمة (أقصى <Num>40</Num>)</div>
            <div className="mt-1.5 pt-1.5 border-t-2 border-[var(--line)]">⭐ المستويات: أول مستوى يحتاج <Num>100</Num> نقطة، وكل مستوى بعده يحتاج <Num>25</Num> نقطة زيادة (<Num>125</Num>، <Num>150</Num>، <Num>175</Num>…)</div>
          </div>
        )}
      </div>

      {/* المحتوى */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pt-4 pb-3">
        {loading && !cur ? (
          <div className="flex justify-center pt-10"><Loader2 className="w-8 h-8 animate-spin text-white" /></div>
        ) : cur?.error ? (
          <div className="text-center pt-10 font-display font-bold text-white/85">الترتيب مو جاهز الحين — جرّب بعد شوي</div>
        ) : top.length === 0 ? (
          <div className="text-center pt-10 font-display font-bold text-white/85">
            {scope === 'week' ? 'ما أحد جمع نقاط هالأسبوع — كن الأول! 🏁' : 'ما فيه نقاط بعد — العب وكن الأول! 🏁'}
          </div>
        ) : (
          <>
            {/* المنصة: 2 يمين، 1 بالنص، 3 يسار */}
            <div className="flex items-start gap-2.5 mb-4" dir="rtl">
              {podiumSlot(2)}
              {podiumSlot(1)}
              {podiumSlot(3)}
            </div>
            {rest.length > 0 && (
              <div className="rounded-3xl bg-[var(--card)] overflow-hidden divide-y-2 divide-[var(--soft)]"
                style={{ boxShadow: '0 5px 0 var(--edge)', border: '2px solid var(--line)' }}>
                {rest.map((r, i) => row(r, i + 4, r.me))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ترتيبك (لو مو ظاهر فوق) */}
      {me && !meInTop && cur && !cur.error && (
        <div className="shrink-0 px-4 pb-3 pt-1">
          {me.score > 0 ? (
            <div className="rounded-2xl bg-[var(--card)] overflow-hidden" style={{ boxShadow: '0 4px 0 var(--edge)', border: '2px solid #fde68a' }}>
              {row({ name: me.name || '', score: me.score }, me.rank, true)}
            </div>
          ) : (
            // ما عنده نقاط: لا نطلّع له مركز
            <button onClick={onExit}
              className="w-full flex items-center justify-between gap-3 rounded-2xl px-4 min-h-[58px] bg-[var(--card)] text-[var(--ink)] font-display font-black active:scale-[0.98] transition-all"
              style={{ boxShadow: '0 4px 0 var(--edge)', border: '2px solid var(--line)' }}>
              <span className="text-right">
                <span className="block">{scope === 'week' ? 'ما عندك نقاط هالأسبوع' : 'ما عندك نقاط للحين'}</span>
                <span className="block text-[0.78rem] font-bold text-[var(--muted-c)]">العب وادخل المنافسة 🔥</span>
              </span>
              <span className="text-[#7c3aed] text-sm">العب ←</span>
            </button>
          )}
        </div>
      )}
      {/* مكان شريط التنقل */}
      <div className="shrink-0" style={{ height: 68 }} />
    </div>
  );
}
