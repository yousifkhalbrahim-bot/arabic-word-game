// ============== إعدادات اللاعب (محفوظة على الجهاز) ==============
const KEYS = { sound: 'wg:sound', haptics: 'wg:haptics' };

// الافتراضي: كلها شغالة
export function getSetting(name) {
  try { return localStorage.getItem(KEYS[name]) !== 'off'; } catch { return true; }
}
export function setSetting(name, on) {
  try { localStorage.setItem(KEYS[name], on ? 'on' : 'off'); } catch {}
}
