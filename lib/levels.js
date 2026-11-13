// ============== المستوى ==============
// مراحل بأرقام مدوّرة — كم نقطة تحتاج عشان تطلع من كل مستوى للي بعده:
//   المستويات 1–10 : 100 نقطة لكل مستوى   (تقريباً 5 فوز)
//   المستويات 11–20: 200 نقطة لكل مستوى
//   المستويات 21–30: 300 نقطة لكل مستوى
//   بعد 30         : 500 نقطة لكل مستوى
// يعني: مستوى 11 = 1000 نقطة، مستوى 21 = 3000، مستوى 31 = 6000.

export const levelCost = (n) => (n <= 10 ? 100 : n <= 20 ? 200 : n <= 30 ? 300 : 500);

// النقاط اللي يبدأ منها المستوى n
export function levelStart(n) {
  let s = 0;
  for (let k = 1; k < n; k++) s += levelCost(k);
  return s;
}

// لون الشارة يتغير كل 10 مستويات (كل مرحلة)
const STAGE_COLORS = [
  { bg: '#ffd166', ink: '#4a2400', deep: '#b86b00' },   // 1–10 ذهبي
  { bg: '#7dd3fc', ink: '#083344', deep: '#0e7490' },   // 11–20 أزرق
  { bg: '#c4b5fd', ink: '#2e1065', deep: '#6d28d9' },   // 21–30 بنفسجي
  { bg: '#4ade80', ink: '#052e16', deep: '#15803d' },   // 31+ أخضر
];

export function levelFor(points = 0) {
  const pts = Math.max(0, Math.floor(points || 0));
  let n = 1, from = 0;
  while (pts >= from + levelCost(n)) { from += levelCost(n); n++; }
  const cost = levelCost(n), to = from + cost, into = pts - from;
  const color = STAGE_COLORS[Math.min(STAGE_COLORS.length - 1, Math.floor((n - 1) / 10))];
  return { n, from, to, into, cost, left: to - pts, pct: Math.min(100, (into / cost) * 100), color };
}
