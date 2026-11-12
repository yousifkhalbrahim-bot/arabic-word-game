// ============== نظام النقاط ==============
// كل جهاز له معرّف عشوائي محفوظ محلياً (بدون حسابات)، والنقاط تنحفظ على السيرفر.
import { isOffensive } from './profanity';
import { addPointsRpc, setPlayerNameRpc, leaderboardRpc, playerProfileRpc, getSavedName } from "./supabase";

const ID_KEY = 'wg:player-id';
const CACHE_KEY = 'wg:points-cache';

export function getPlayerId() {
  if (typeof window === 'undefined') return null;
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) ||
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch { return null; }
}

export const playerName = () => {
  const n = getSavedName();
  return n && !isOffensive(n) ? n : 'لاعب';
};

export function cachedPoints() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
}
function cache(v) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(v)); } catch {}
  try { window.dispatchEvent(new CustomEvent('wg:points', { detail: v })); } catch {}
}

// يضيف نقاط (لو السيرفر مو جاهز ما يخرب اللعبة)
export async function awardPoints(points, win = true) {
  const id = getPlayerId();
  if (!id || points <= 0) return null;
  try {
    const r = await addPointsRpc(id, playerName(), Math.round(points), win);
    if (r) cache({ points: r.points, week: r.week_points, rank: r.rank, weekRank: r.week_rank });
    return r;
  } catch { return null; }
}

// يمنع نفس الجولة تنحسب مرتين (لو حدّث الصفحة) — وتنحفظ "انحسبت" بس إذا نجحت
const inFlight = new Set();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
export function awardOnce(key, points, win = true) {
  const k = `wg:awarded:${key}`;
  try { if (localStorage.getItem(k)) return null; } catch {}
  if (inFlight.has(k)) return null;
  inFlight.add(k);
  return (async () => {
    try {
      let r = await awardPoints(points, win);
      if (r?.throttled) { await sleep(3200); r = await awardPoints(points, win); }
      if (r && (r.added > 0 || !r.throttled)) { try { localStorage.setItem(k, '1'); } catch {} }
      return r;
    } finally { inFlight.delete(k); }
  })();
}

export async function renamePlayer(name) {
  const id = getPlayerId();
  if (!id || isOffensive(name)) return;
  try { await setPlayerNameRpc(id, name); } catch {}
}

export async function fetchLeaderboard(scope = 'week') {
  const id = getPlayerId();
  try {
    const r = await leaderboardRpc(id, scope);
    if (r?.me && scope === 'week') {
      const c = cachedPoints() || {};
      cache({ ...c, week: r.me.score, weekRank: r.me.rank });
    }
    if (r?.me && scope === 'all') {
      const c = cachedPoints() || {};
      cache({ ...c, points: r.me.score, rank: r.me.rank });
    }
    return r;
  } catch { return null; }
}

// ---- قيم النقاط ----
export const POINTS = {
  onlineWin: 30,
  onlineDraw: 10,
  customGuesserWin: 25,
  customSetterWin: 15,
  botWin: 20,
};

// خمّن الكلمة لحالك
// penalty = مجموع خصم التلميحات (شوف lib/bulbs.js)
export function guessPoints({ len, triesUsed, tries, penalty = 0, streak = 0 }) {
  const base = len === 3 ? 10 : 20;
  const bonus = Math.max(0, tries - triesUsed) * (len === 3 ? 2 : 3);
  const streakBonus = Math.min(Math.max(streak - 1, 0), 10);
  return Math.max(5, base + bonus + streakBonus - penalty);
}

// سباق ضد الوقت
export const racePoints = (words) => Math.min(40, Math.max(0, words) * 2);

// ملفي: معلوماتي من السيرفر (لو ما رد نرجع null ونعتمد على النسخة المحفوظة)
export async function fetchProfile() {
  const id = getPlayerId();
  if (!id) return null;
  try {
    const r = await playerProfileRpc(id);
    if (r) {
      const c = cachedPoints() || {};
      cache({ ...c, points: r.points, week: r.week_points, rank: r.rank, weekRank: r.week_rank });
    }
    return r;
  } catch { return null; }
}
