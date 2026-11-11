import { createClient } from '@supabase/supabase-js';

// Values hardcoded to avoid invisible Unicode chars from env var copy-paste
const SUPABASE_URL = 'https://dobtgataedanhzambrxh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_3H4kd38jqEXddqjlUTqLYg_SrYDp37P';

// Supabase client — used only for Realtime (WebSocket, not fetch)
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

// All DB calls use raw fetch with explicit ASCII-only headers
const REST_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
};

export async function getRoom(code) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/rooms?select=state&code=eq.${encodeURIComponent(code)}&limit=1`,
    { headers: REST_HEADERS }
  );
  if (!res.ok) throw new Error(`getRoom failed: HTTP ${res.status}`);
  const data = await res.json();
  return data[0]?.state ?? null;
}

export async function saveRoom(code, state) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/rooms`,
    {
      method: 'POST',
      headers: { ...REST_HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ code, state, updated_at: new Date().toISOString() }),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`saveRoom failed: HTTP ${res.status} ${text}`);
  }
  return true;
}

export async function deleteRoom(code) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/rooms?code=eq.${encodeURIComponent(code)}`,
    { method: 'DELETE', headers: REST_HEADERS }
  );
  if (!res.ok) throw new Error(`deleteRoom failed: HTTP ${res.status}`);
}

// ============== دوال السيرفر الذرّية (supabase-migration-v2.sql) ==============
// كل دالة ترجع { ok, reason, state } — state هي الحالة الحقيقية من السيرفر

async function rpc(fn, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: REST_HEADERS,
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${fn} failed: HTTP ${res.status} ${text}`);
  }
  return res.json();
}

export const fetchServerNow = () => rpc('server_now', {});

// إنشاء غرفة بدون الكتابة فوق غرفة موجودة / إلغاء غرفة انتظار
export const roomCreate = (code, state) => rpc('room_create', { p_code: code, p_state: state });
export const roomCancel = (code) => rpc('room_cancel', { p_code: code });

export const roomJoin    = (code, name)               => rpc('room_join',    { p_code: code, p_name: name });
export const roomLeave   = (code, role)               => rpc('room_leave',   { p_code: code, p_role: role });
export const roomCas     = (code, version, state, stamp = null) =>
  rpc('room_cas', { p_code: code, p_version: version ?? 0, p_state: state, p_stamp: stamp });
export const roomRematch = (code, gameNumber, state)  => rpc('room_rematch', { p_code: code, p_game_number: gameNumber, p_state: state });

export const raceSubmit  = (code, role, word, index)  => rpc('race_submit',  { p_code: code, p_role: role, p_word: word, p_index: index });
export const raceSkip    = (code, role, index)        => rpc('race_skip',    { p_code: code, p_role: role, p_index: index });
export const raceFreeze  = (code, role)               => rpc('race_freeze',  { p_code: code, p_role: role });
export const raceFinish  = (code)                     => rpc('race_finish',  { p_code: code });
export const raceResign  = (code, role)               => rpc('race_resign',  { p_code: code, p_role: role });

// هل الحالة القادمة أحدث من الحالية؟ (لتجاهل التحديثات المتأخرة)
export function isNewerState(prev, next) {
  if (!next) return false;
  if (!prev || prev.code !== next.code) return true;
  return (next.version ?? 0) >= (prev.version ?? 0);
}

// ============== دور اللاعب في المتصفح ==============

export function getMyRole(code, state) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`wgrole:${code}`);
    if (!raw) return null;
    const [r, rid] = raw.split(':');
    // غرفة جديدة بنفس الكود → الدور القديم ما يصلح
    if (state?.rid && rid !== state.rid) return null;
    return parseInt(r) || null;
  } catch { return null; }
}

export function setMyRole(code, role, rid = '') {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(`wgrole:${code}`, `${role}:${rid || ''}`); } catch {}
}

export function clearMyRole(code) {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(`wgrole:${code}`); } catch {}
}

// ============== الغرفة الحالية + الاسم المحفوظ ==============

export function getCurrentRoom() {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem('wg:current'); } catch { return null; }
}

export function setCurrentRoom(code) {
  if (typeof window === 'undefined') return;
  try {
    if (code) localStorage.setItem('wg:current', code);
    else localStorage.removeItem('wg:current');
  } catch {}
}

export function getSavedName() {
  if (typeof window === 'undefined') return '';
  try { return localStorage.getItem('wg:name') || ''; } catch { return ''; }
}

export function saveName(name) {
  if (typeof window === 'undefined' || !name) return;
  try { localStorage.setItem('wg:name', name); } catch {}
}

// ============== النقاط والترتيب (supabase-migration-v4-points.sql) ==============
export const addPointsRpc = (id, name, points, win = true) =>
  rpc('add_points', { p_id: id, p_name: name, p_points: points, p_win: win });
export const setPlayerNameRpc = (id, name) => rpc('set_player_name', { p_id: id, p_name: name });
export const leaderboardRpc = (id, scope) => rpc('leaderboard', { p_id: id, p_scope: scope });
