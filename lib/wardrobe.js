// ============== خزانة أبو شماغ ==============
// قطع يلبسها أبو شماغ، تنفتح بالمستوى والإنجازات. اللبس محفوظ على الجهاز.
// كل قطعة لها مكان: راس / وجه / جسم / يد. قطعة وحدة بكل مكان، إلا اليد تمسك الثنتين.
import { useEffect, useState } from 'react';
import { cachedPoints } from './points';
import { levelFor } from './levels';

export const OUTFIT_ITEMS = [
  { id: 'stache', slot: 'face', name: 'شنب',         req: { level: 3 } },
  { id: 'finjan', slot: 'hand', name: 'فنجال قهوة',  req: { level: 5 } },
  { id: 'beads',  slot: 'hand', name: 'مسبحة',       req: { level: 8 } },
  { id: 'shades', slot: 'face', name: 'نظارة شمسية', req: { streak: 10 } },
  { id: 'white',  slot: 'head', name: 'غترة بيضاء',  req: { level: 15 } },
  { id: 'bisht',  slot: 'body', name: 'بشت',         req: { level: 20 } },
  { id: 'crown',  slot: 'head', name: 'تاج',         req: { weekTop: true } },
];

const WORN_KEY = 'wg:abu-outfit';
const CROWN_KEY = 'wg:week-top';
const EVENT = 'wg:outfit';

export function reqLabel(item) {
  const r = item.req;
  if (r.level) return `مستوى ${r.level}`;
  if (r.streak) return `ستريك ${r.streak}`;
  if (r.weekTop) return 'الأول بالأسبوع';
  return '';
}

const readJSON = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };

// المستوى + أعلى ستريك + هل صار الأول بالأسبوع (مرة وحدة تكفي)
export function outfitProgress() {
  const c = cachedPoints();
  let weekTop = false;
  try {
    if (c?.weekRank === 1 && (c?.week || 0) > 0) localStorage.setItem(CROWN_KEY, '1');
    weekTop = localStorage.getItem(CROWN_KEY) === '1';
  } catch {}
  let streak = 0;
  for (const l of [3, 4, 5]) streak = Math.max(streak, readJSON(`wg:guess-stats:${l}`)?.best || 0);
  return { level: levelFor(c?.points || 0).n, streak, weekTop };
}

export function isUnlocked(item, p = outfitProgress()) {
  const r = item.req;
  if (r.level) return p.level >= r.level;
  if (r.streak) return p.streak >= r.streak;
  if (r.weekTop) return p.weekTop;
  return false;
}

export const unlockedIds = (p = outfitProgress()) => OUTFIT_ITEMS.filter(i => isUnlocked(i, p)).map(i => i.id);

// اللي لابسه الحين (بس المفتوح)
export function getOutfit() {
  const worn = readJSON(WORN_KEY);
  if (!Array.isArray(worn)) return [];
  const open = new Set(unlockedIds());
  return worn.filter(id => open.has(id));
}

function saveOutfit(list) {
  try { localStorage.setItem(WORN_KEY, JSON.stringify(list)); } catch {}
  try { window.dispatchEvent(new CustomEvent(EVENT, { detail: list })); } catch {}
  return list;
}

// يلبس/يشيل قطعة
export function toggleOutfit(id) {
  const item = OUTFIT_ITEMS.find(i => i.id === id);
  if (!item || !isUnlocked(item)) return getOutfit();
  const cur = getOutfit();
  if (cur.includes(id)) return saveOutfit(cur.filter(x => x !== id));
  const slotOf = (x) => OUTFIT_ITEMS.find(i => i.id === x)?.slot;
  const keep = item.slot === 'hand' ? cur : cur.filter(x => slotOf(x) !== item.slot);
  return saveOutfit([...keep, id]);
}

export function wearOutfit(id) {
  if (!getOutfit().includes(id)) toggleOutfit(id);
}

// اللبس الحالي، ويتحدث لما يتغير
export function useOutfit() {
  const [list, setList] = useState([]);
  useEffect(() => {
    setList(getOutfit());
    const on = () => setList(getOutfit());
    window.addEventListener(EVENT, on);
    window.addEventListener('storage', on);
    return () => { window.removeEventListener(EVENT, on); window.removeEventListener('storage', on); };
  }, []);
  return list;
}
