// ساعة موحّدة: كل الأجهزة تحسب الوقت بناءً على ساعة السيرفر
// حتى لو كانت ساعة الجوال متقدمة أو متأخرة بثوانٍ.
import { fetchServerNow } from './supabase';

let offset = 0;

export const now = () => Date.now() + offset;

export async function syncClock(samples = 3) {
  let best = null;
  for (let i = 0; i < samples; i++) {
    try {
      const t0 = Date.now();
      const server = Number(await fetchServerNow());
      const t1 = Date.now();
      const rtt = t1 - t0;
      if (Number.isFinite(server) && (!best || rtt < best.rtt)) {
        best = { rtt, offset: server - (t0 + t1) / 2 };
      }
    } catch {
      // السيرفر غير محدّث أو لا يوجد اتصال — نبقى على الساعة المحلية
      break;
    }
  }
  if (best) offset = best.offset;
  return offset;
}
