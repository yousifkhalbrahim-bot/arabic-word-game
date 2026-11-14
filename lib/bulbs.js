// ============== لمبات التلميح 💡 ==============
// التلميح مو مجاني كل جولة: عندك رصيد لمبات تكسبه باللعب الزين.
//  - تبدأ بـ ٣ لمبات، والحد الأعلى ٩
//  - +١ لمبة لكل فوز بدون أي تلميح
//  - +١ لمبة إضافية كل ما وصل الستريك مضاعفات ٥
//  - التلميح ما يفتح إلا بعد أول محاولة
// الرصيد الحقيقي على السيرفر (supabase-migration-v7-bulbs.sql)، والجهاز يحفظ نسخة
// عشان يطلع الرقم فوراً ويشتغل لو النت مقطوع.

import { bulbsGetRpc, bulbsSpendRpc, bulbsEarnRpc } from './supabase';
import { getPlayerId, playerName, serverWritesOff } from './points';

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
  if (serverWritesOff()) return { ok: true, bulbs: setLocal(local - cost) };
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

// ============== طرق كسب اللمبات ==============
//   فوز بدون تلميح +1 · كل 5 ستريك +1 · من أول محاولة +2 · أول فوز في اليوم +1
//   تطلع مستوى +2 · وسام جديد +1 · رقم قياسي في تحدي النهايات +1
export const EARN = { clean: 1, streak5: 1, firstTry: 2, daily: 1, level: 2, badge: 1, record: 1 };

// كم لمبة يستاهل بعد فوز في خمّن الكلمة
export function bulbsEarned({ usedHints, streak, triesUsed = 0 }) {
  return (usedHints ? 0 : EARN.clean) + (streak > 0 && streak % 5 === 0 ? EARN.streak5 : 0) + (triesUsed === 1 ? EARN.firstTry : 0);
}

// أول فوز في اليوم: يرجع 1 مرة وحدة كل يوم (بتوقيت الجهاز)
const DAY_KEY = 'wg:bulb-daily';
export function claimDailyWin() {
  try {
    const d = new Date(); const today = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    if (localStorage.getItem(DAY_KEY) === today) return 0;
    localStorage.setItem(DAY_KEY, today);
    return EARN.daily;
  } catch { return 0; }
}

// -------- طابور الكسب --------
// السيرفر يقبل لمبتين بالكثير كل مرة ومرة كل 5 ثواني، فنرسل على دفعات.
// الرقم يزيد على الجوال فوراً، والسيرفر يلحق.
const PENDING = 'wg:bulbs-pending';
const readPending = () => { try { return Math.max(0, parseInt(localStorage.getItem(PENDING) || '0', 10) || 0); } catch { return 0; } };
const writePending = (n) => { try { localStorage.setItem(PENDING, String(Math.max(0, n))); } catch {} };
const notify = (v) => { try { window.dispatchEvent(new CustomEvent('wg:bulbs', { detail: v })); } catch {} };
let flushing = false;
const wait = (ms) => new Promise(r => setTimeout(r, ms));

// يضيف لمبات (كل طرق الكسب تمر من هنا). يرجع كم انضاف فعلاً
export function queueBulbs(n) {
  n = n | 0;
  if (n <= 0) return 0;
  const before = getBulbs();
  const v = setLocal(before + n);
  const added = v - before;
  if (added > 0) { writePending(readPending() + added); notify(v); flushBulbs(); }
  return added;
}

async function flushBulbs() {
  if (flushing || serverWritesOff()) return;
  flushing = true;
  try {
    let misses = 0;
    while (readPending() > 0 && misses < 4) {
      const want = Math.min(2, readPending());
      let r = null;
      try { r = await bulbsEarnRpc(getPlayerId(), playerName(), want); } catch {}
      if (!r || typeof r.bulbs !== 'number') break;           // النت مقطوع: نخليها للمرة الجاية
      if (r.added > 0) { writePending(readPending() - r.added); misses = 0; }
      else if (r.bulbs >= BULB_MAX) { writePending(0); }       // الرصيد مليان
      else misses++;                                            // وقت الانتظار أو حد اليوم
      notify(setLocal(r.bulbs + readPending()));
      if (readPending() > 0) await wait(5600);
    }
    if (misses >= 4) writePending(0);
  } finally { flushing = false; }
}
if (typeof window !== 'undefined') setTimeout(() => { if (readPending() > 0) flushBulbs(); }, 3000);
