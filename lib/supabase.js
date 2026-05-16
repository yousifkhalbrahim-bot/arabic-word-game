import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase env vars missing!');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

// ============== دوال الغرف ==============

export async function getRoom(code) {
  const { data, error } = await supabase
    .from('rooms')
    .select('state')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  return data?.state ?? null;
}

export async function saveRoom(code, state) {
  const { error } = await supabase
    .from('rooms')
    .upsert({
      code,
      state,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
  return true;
}

export async function deleteRoom(code) {
  const { error } = await supabase.from('rooms').delete().eq('code', code);
  if (error) throw error;
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
