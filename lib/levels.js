// ============== المستوى ==============
// كل مستوى له عدد نقاط ثابت، وكل ما ارتفع المستوى يحتاج نقاط أكثر:
//   مستوى 1 → 2 : 100 نقطة، وكل مستوى بعده يزيد 25
//   (100، 125، 150، 175، 200 … مستوى 10 يحتاج 325، مستوى 20 يحتاج 575)

export const LEVEL_BASE = 100;
export const LEVEL_STEP = 25;
export const levelCost = (n) => LEVEL_BASE + (n - 1) * LEVEL_STEP;

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
