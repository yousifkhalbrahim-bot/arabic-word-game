// ============== لمبات التلميح 💡 ==============
// التلميح مو مجاني كل جولة: عندك محفظة لمبات تكسبها باللعب الزين.
//  - تبدأ بـ ٣ لمبات، والحد الأعلى ٩
//  - +١ لمبة لكل فوز بدون أي تلميح
//  - +١ لمبة إضافية كل ما وصل الستريك مضاعفات ٥
//  - التلميح ما يفتح إلا بعد أول محاولة

const KEY = 'wg:bulbs';
export const BULB_START = 3;
export const BULB_MAX = 9;

// أنواع التلميح: السعر باللمبات + كم نجمة تنقص من نقاط الجولة
export const HINT_TYPES = {
  elim:   { cost: 1, penalty: 2, maxPerGame: 2 }, // يطفي حروف مو في الكلمة
  reveal: { cost: 2, penalty: 5 },                // يكشف حرف بمكانه (الحد حسب طول الكلمة)
};
export const revealLimit = (len) => (len === 3 ? 1 : 2);
export const elimCount = (len) => (len === 3 ? 3 : 4);

export function getBulbs() {
  try {
    const v = localStorage.getItem(KEY);
    if (v == null) return BULB_START;
    return Math.max(0, Math.min(BULB_MAX, parseInt(v, 10) || 0));
  } catch { return BULB_START; }
}

export function setBulbs(n) {
  const v = Math.max(0, Math.min(BULB_MAX, n));
  try { localStorage.setItem(KEY, String(v)); } catch {}
  return v;
}

// كم لمبة يكسب بعد الفوز
export function bulbsEarned({ usedHints, streak }) {
  return (usedHints ? 0 : 1) + (streak > 0 && streak % 5 === 0 ? 1 : 0);
}
