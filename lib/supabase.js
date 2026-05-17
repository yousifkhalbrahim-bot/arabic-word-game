import { createClient } from '@supabase/supabase-js';

// Values hardcoded to avoid invisible Unicode chars from env var copy-paste
const SUPABASE_URL = 'https://lsyknkoogyjkmpuostph.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-6d29L9VSbtXauu7i6s0UQ_D6oNlt9P';

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

// ============== دور اللاعب في المتصفح ==============

export function getMyRole(code) {
  if (typeof window === 'undefined') return null;
  try {
    const r = localStorage.getItem(`wgrole:${code}`);
    return r ? parseInt(r) : null;
  } catch { return null; }
}

export function setMyRole(code, role) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(`wgrole:${code}`, role.toString()); } catch {}
}

export function clearMyRole(code) {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(`wgrole:${code}`); } catch {}
}
