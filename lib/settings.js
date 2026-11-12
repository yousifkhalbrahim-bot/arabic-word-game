// ============== إعدادات اللاعب (محفوظة على الجهاز) ==============
const KEYS = { sound: 'wg:sound', haptics: 'wg:haptics' };
const THEME_KEY = 'wg:theme';

// الافتراضي: كلها شغالة
export function getSetting(name) {
  try { return localStorage.getItem(KEYS[name]) !== 'off'; } catch { return true; }
}
export function setSetting(name, on) {
  try { localStorage.setItem(KEYS[name], on ? 'on' : 'off'); } catch {}
}

// -------- المظهر: auto (حسب الجوال) | light | dark --------
export function getTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch { return 'auto'; }
}
export function applyTheme(pref = getTheme()) {
  if (typeof document === 'undefined') return;
  const dark = pref === 'dark' || (pref === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#120d30' : '#6d28d9');
}
export function setTheme(pref) {
  try { localStorage.setItem(THEME_KEY, pref); } catch {}
  applyTheme(pref);
}
// يتابع إعداد الجوال لو اللاعب مختار «تلقائي»
export function watchSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const on = () => { if (getTheme() === 'auto') applyTheme('auto'); };
  mq.addEventListener?.('change', on);
  return () => mq.removeEventListener?.('change', on);
}
