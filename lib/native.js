// ============== لمسات التطبيق الأصلي (آيفون) ==============
// كلها تشتغل بأمان في المتصفح كمان: لو مو داخل التطبيق ما تسوي شي أو ترجع للبديل.
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

export const isNative = () => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

// رابط الموقع الحقيقي (داخل التطبيق العنوان يكون capacitor://localhost فما ينفع للدعوات)
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://arabic-word-game.vercel.app').replace(/\/$/, '');

export function publicUrl(path = '/') {
  if (typeof window !== 'undefined' && !isNative()) return `${window.location.origin}${path}`;
  return `${SITE_URL}${path}`;
}

// -------- اهتزاز --------
export function haptic(kind) {
  if (!isNative()) return;
  try {
    if (kind === 'success') Haptics.notification({ type: NotificationType.Success });
    else if (kind === 'error') Haptics.notification({ type: NotificationType.Error });
    else if (kind === 'warning') Haptics.notification({ type: NotificationType.Warning });
    else if (kind === 'heavy') Haptics.impact({ style: ImpactStyle.Heavy });
    else if (kind === 'medium') Haptics.impact({ style: ImpactStyle.Medium });
    else Haptics.impact({ style: ImpactStyle.Light });
  } catch {}
}

// -------- مشاركة --------
// يرجع true لو تمت المشاركة (أو ألغاها المستخدم)، false لو ما فيه طريقة مشاركة
export async function shareContent({ title, text, url }) {
  if (isNative()) {
    try { await Share.share({ title, text, url, dialogTitle: title }); return true; }
    catch { return true; }
  }
  if (typeof navigator !== 'undefined' && navigator.share) {
    try { await navigator.share({ title, text, url }); return true; }
    catch (e) { return e?.name === 'AbortError'; }
  }
  return false;
}

// -------- تجهيز عند فتح التطبيق --------
let started = false;
export function initNative() {
  if (started || !isNative()) return;
  started = true;
  try { StatusBar.setStyle({ style: Style.Dark }); } catch {}
  try { StatusBar.setOverlaysWebView({ overlay: true }); } catch {}
  setTimeout(() => { try { SplashScreen.hide({ fadeOutDuration: 250 }); } catch {} }, 300);
}
