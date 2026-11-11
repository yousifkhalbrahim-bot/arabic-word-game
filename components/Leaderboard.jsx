'use client';

// ============== الترتيب ==============
import React, { useEffect, useState } from 'react';
import { ArrowRight, Trophy, Loader2, Star } from 'lucide-react';
import { ArcadeBg, Num } from '@/components/ui';
import { fetchLeaderboard, POINTS } from '@/lib/points';

const MEDAL = ['🥇', '🥈', '🥉'];

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

  const row = (r, rank, highlight) => (
    <div key={`${rank}-${r.name}`}
      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${highlight ? '' : 'bg-white'}`}
      style={highlight
        ? { background: '#ffb020', color: '#4a2400', boxShadow: '0 4px 0 #b86b00' }
        : { boxShadow: '0 3px 0 #ddd6fe', color: '#2e1065' }}>
      <div className="w-9 text-center font-display font-black text-lg shrink-0">
        {rank <= 3 ? <span className="text-2xl">{MEDAL[rank - 1]}</span> : <Num>{rank}</Num>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display font-black truncate">{r.name ? <>{r.name}{highlight && <span className="text-xs opacity-75 mr-1">(أنت)</span>}</> : "أنت"}</div>
        {r.wins != null && <div className="text-[0.7rem] font-bold opacity-70"><Num>{r.wins}</Num> فوز</div>}
      </div>
      <div className="shrink-0 flex items-center gap-1 font-display font-black text-lg">
        <Num>{r.score}</Num> <Star className="w-4 h-4" fill="currentColor" strokeWidth={0} style={{ color: highlight ? '#4a2400' : '#ffb020' }} />
      </div>
    </div>
  );

  return (
    <div className="app-fixed flex flex-col" style={{ color: '#fff' }}>
      <ArcadeBg />
      <div className="shrink-0 flex items-center justify-between px-3 pt-2 pb-2">
        <button onClick={onExit} aria-label="رجوع"
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 active:scale-90 transition-all">
          <ArrowRight className="w-5 h-5 text-white" strokeWidth={2.8} />
        </button>
        <div className="flex items-center gap-1.5 font-display font-black rounded-full px-3 py-1 bg-white/15" style={{ fontSize: '0.95rem' }}>
          <Trophy className="w-4 h-4 text-[#fde047]" strokeWidth={2.6} /> الترتيب
        </div>
        <button onClick={() => setShowHow(v => !v)} className="h-10 rounded-full px-3 bg-white/15 font-display font-bold text-xs">كيف أجمع؟</button>
      </div>

      <div className="shrink-0 px-4">
        <div className="flex gap-2 p-1 rounded-2xl bg-white/15">
          {[['week', 'هذا الأسبوع'], ['all', 'الكل']].map(([id, label]) => (
            <button key={id} onClick={() => setScope(id)}
              className="flex-1 rounded-xl py-2 font-display font-black text-sm transition-all"
              style={scope === id ? { background: '#fff', color: '#4c1d95', boxShadow: '0 3px 0 #c4b5fd' } : { color: 'rgba(255,255,255,0.85)' }}>
              {label}
            </button>
          ))}
        </div>
        {showHow && (
          <div className="mt-3 rounded-2xl bg-white text-[#2e1065] p-3 text-sm font-display font-bold leading-relaxed slide-in" style={{ boxShadow: '0 4px 0 #c4b5fd' }}>
            <div>🟩 خمّن الكلمة لحالك: ١٠ (٣ أحرف) أو ٢٠ (٥ أحرف) + بونص لكل محاولة ما استخدمتها + بونص الستريك · كل تلميح −٣</div>
            <div>⚔️ فوز أونلاين مع صاحبك: <Num>{POINTS.onlineWin}</Num> · تعادل: <Num>{POINTS.onlineDraw}</Num></div>
            <div>🎯 «أنت تختار الكلمة»: اللي يحلها <Num>{POINTS.customGuesserWin}</Num> · اللي يصعّبها <Num>{POINTS.customSetterWin}</Num></div>
            <div>🤖 فوز ضد الكمبيوتر: <Num>{POINTS.botWin}</Num> · ⏱ ضد الوقت: ٢ لكل كلمة</div>
            <div className="text-xs text-[#6d5b95] mt-1">ترتيب «هذا الأسبوع» يبدأ من جديد كل إثنين.</div>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pt-3 pb-3 space-y-2">
        {loading && !cur ? (
          <div className="flex justify-center pt-10"><Loader2 className="w-8 h-8 animate-spin text-white" /></div>
        ) : cur?.error ? (
          <div className="text-center pt-10 font-display font-bold text-white/85">الترتيب مو جاهز الحين — جرّب بعد شوي</div>
        ) : top.length === 0 ? (
          <div className="text-center pt-10 font-display font-bold text-white/85">
            {scope === 'week' ? 'ما أحد جمع نقاط هالأسبوع — كن الأول! 🏁' : 'ما فيه نقاط بعد — العب وكن الأول! 🏁'}
          </div>
        ) : (
          top.map((r, i) => row(r, i + 1, r.me))
        )}
      </div>

      {me && !meInTop && cur && !cur.error && (
        <div className="shrink-0 px-4 pb-3 pt-1">
          {row({ name: me.name || '', score: me.score }, me.rank, true)}
        </div>
      )}
    </div>
  );
}
