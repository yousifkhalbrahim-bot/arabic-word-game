// ============== المستوى ==============
// مستوى 1 من الصفر، وكل مستوى يحتاج 20 نقطة أكثر من اللي قبله
// (2: 50 · 3: 120 · 4: 210 · 5: 320 · 10: 1170 · 20: 4370)
export const levelStart = (n) => 50 * (n - 1) + 10 * (n - 1) * (n - 2);

// لون شارة المستوى يتغير كل 5 مستويات
const LEVEL_COLORS = [
  { bg: '#e0f2fe', ink: '#075985' },
  { bg: '#fef9c3', ink: '#854d0e' },
  { bg: '#ffedd5', ink: '#9a3412' },
  { bg: '#ede9fe', ink: '#5b21b6' },
  { bg: '#fde047', ink: '#713f12' },
  { bg: '#22c55e', ink: '#ffffff' },
];

export function levelFor(points = 0) {
  const pts = Math.max(0, points || 0);
  let n = 1;
  while (pts >= levelStart(n + 1)) n++;
  const from = levelStart(n), to = levelStart(n + 1);
  const color = LEVEL_COLORS[Math.min(LEVEL_COLORS.length - 1, Math.floor((n - 1) / 5))];
  return { n, to, left: to - pts, pct: Math.min(100, ((pts - from) / (to - from)) * 100), color };
}
