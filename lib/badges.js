// ============== الأوسمة ==============
// تعريف الأوسمة + قراءة تقدّم اللاعب من الجهاز. تستخدمها صفحة «ملفي» وبطاقة «وسام جديد!».

// 120 = المدة الحالية، والقديمة تنحسب للوسام عشان ما يضيع شي
const ENDING_SECONDS = [30, 60, 90, 120];
const WINS_KEY = 'wg:wins-local';

function readJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
const readInt = (key) => { try { return parseInt(localStorage.getItem(key) || '0', 10) || 0; } catch { return 0; } };

// عدّاد فوز محلي (أونلاين/الكمبيوتر) — يكمّل عدد الفوز من السيرفر لو ما وصل
export function countLocalWin() {
  try { localStorage.setItem(WINS_KEY, String(readInt(WINS_KEY) + 1)); } catch {}
}

// كل اللي نحتاجه من الجهاز
export function readProgress() {
  const g3 = readJSON('wg:guess-stats:3', null) || {};
  const g5 = readJSON('wg:guess-stats:5', null) || {};
  const endBest = {};
  for (const s of ENDING_SECONDS) endBest[s] = readInt(`wg:solo-best:${s}`);
  return { g3, g5, endBest, localWins: (g3.wins || 0) + (g5.wins || 0) + readInt(WINS_KEY) };
}

// serverWins: عدد الفوز من السيرفر لو متوفر
export function computeBadges(progress, serverWins = null) {
  const { g3, g5, endBest, localWins } = progress;
  const wins = Math.max(serverWins ?? 0, localWins);
  const bestStreak = Math.max(g3.best || 0, g5.best || 0);
  const firstTry = (g3.dist?.[0] || 0) + (g5.dist?.[0] || 0);
  const bestEnding = Math.max(0, ...Object.values(endBest));
  return [
    { id: 'first-win',  name: 'أول فوز',       have: wins,         need: 1,  art: { shape: 'circle',   glyph: 'check',      color: 'green',  ribbon: true } },
    { id: 'streak-5',   name: 'ستريك 5',       have: bestStreak,   need: 5,  art: { shape: 'shield',   glyph: 'flame',      color: 'orange', tag: '5' } },
    { id: 'streak-10',  name: 'ستريك 10',      have: bestStreak,   need: 10, art: { shape: 'shield',   glyph: 'bolt',       color: 'red',    tag: '10' } },
    { id: 'first-try',  name: 'من أول محاولة', have: firstTry,     need: 1,  art: { shape: 'hex',      glyph: 'target',     color: 'blue' } },
    { id: 'five-hero',  name: 'بطل الخمسة',    have: g5.wins || 0, need: 10, art: { shape: 'squircle', glyph: 'five',       color: 'purple', tag: '5' } },
    { id: 'endings-king', name: 'ملك النهايات', have: bestEnding,  need: 15, art: { shape: 'seal',     glyph: 'crownClock', color: 'gold' } },
  ].map(b => ({ ...b, earned: b.have >= b.need }));
}
