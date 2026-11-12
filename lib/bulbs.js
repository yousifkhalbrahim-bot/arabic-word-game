// ============== لمبات التلميح 💡 ==============
// التلميح مو مجاني كل جولة: عندك رصيد لمبات تكسبه باللعب الزين.
//  - تبدأ بـ ٣ لمبات، والحد الأعلى ٩
//  - +١ لمبة لكل فوز بدون أي تلميح
//  - +١ لمبة إضافية كل ما وصل الستريك مضاعفات ٥
//  - التلميح ما يفتح إلا بعد أول محاولة
// الرصيد الحقيقي على السيرفر (supabase-migration-v7-bulbs.sql)، والجهاز يحفظ نسخة
// عشان يطلع الرقم فوراً ويشتغل لو النت مقطوع.

import { bulbsGetRpc, bulbsSpendRpc, bulbsEarnRpc } from './supabase';
import { getPlayerId, playerName } from './points';

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

const clamp = (n) => Math.max(0, Math.min(BULB_MAX, n | 0));

// النسخة المحفوظة على الجهاز
export function getBulbs() {
  try {
    const v = localStorage.getItem(KEY);
    return v == null ? BULB_START : clamp(parseInt(v, 10) || 0);
  } catch { return BULB_START; }
}
function setLocal(n) {
  const v = clamp(n);
  try { localStorage.setItem(KEY, String(v)); } catch {}
  return v;
}

// يجيب الرصيد من السيرفر
export async function syncBulbs() {
  const id = getPlayerId();
  if (!id) return getBulbs();
  try {
    const n = await bulbsGetRpc(id);
    return typeof n === 'number' ? setLocal(n) : getBulbs();
  } catch { return getBulbs(); }
}

// يصرف لمبات. يرجع { ok, bulbs }
export async function spendBulbs(cost) {
  const id = getPlayerId();
  const local = getBulbs();
  if (local < cost) return { ok: false, bulbs: local };
  try {
    const r = await bulbsSpendRpc(id, playerName(), cost);
    if (r && typeof r.bulbs === 'number') return { ok: !!r.ok, bulbs: setLocal(r.bulbs) };
  } catch {}
  // النت مقطوع: نصرف من النسخة المحلية
  return { ok: true, bulbs: setLocal(local - cost) };
}

// يضيف لمبات بعد الفوز. يرجع { added, bulbs }
export async function earnBulbs(amount) {
  const local = getBulbs();
  if (amount <= 0) return { added: 0, bulbs: local };
  try {
    const r = await bulbsEarnRpc(getPlayerId(), playerName(), amount);
    if (r && typeof r.bulbs === 'number') return { added: r.added | 0, bulbs: setLocal(r.bulbs) };
  } catch {}
  const v = setLocal(local + amount);
  return { added: v - local, bulbs: v };
}

// كم لمبة يستاهل بعد الفوز
export function bulbsEarned({ usedHints, streak }) {
  return (usedHints ? 0 : 1) + (streak > 0 && streak % 5 === 0 ? 1 : 0);
}
