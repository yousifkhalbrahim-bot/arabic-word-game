import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase env vars missing!');
}

// Strip any invisible/non-ASCII Unicode chars that may be copied alongside the key
const cleanKey = (supabaseAnonKey || '').replace(/[^\x20-\x7E]/g, '').trim();

// Supabase client — used only for Realtime (WebSocket, no fetch involved)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: { eventsPerSecond: 10 },
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

// Direct REST API headers — bypasses supabase-js fetch wrapper entirely
// Uses cleanKey to strip invisible Unicode chars that break HTTP headers
const REST_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'apikey': cleanKey,
  'Authorization': `Bearer ${cleanKey}`,
};

export async function getRoom(code) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/rooms?select=state&code=eq.${encodeURIComponent(code)}&limit=1`,
    { headers: REST_HEADERS }
  );
  if (!res.ok) throw new Error(`getRoom failed: HTTP ${res.status}`);
  const data = await res.json();
  return data[0]?.state ?? null;
}

export async function saveRoom(code, state) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/rooms`,
    {
      method: 'POST',
      headers: {
        ...REST_HEADERS,
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        code,
        state,
        updated_at: new Date().toISOString(),
      }),
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
    `${supabaseUrl}/rest/v1/rooms?code=eq.${encodeURIComponent(code)}`,
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
  } catch {
    return null;
  }
}

export function setMyRole(code, role) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`wgrole:${code}`, role.toString());
  } catch {}
}

export function clearMyRole(code) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`wgrole:${code}`);
  } catch {}
}
