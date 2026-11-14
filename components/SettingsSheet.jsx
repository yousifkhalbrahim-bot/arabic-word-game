'use client';

// ============== لوحة الإعدادات (من زر ⚙️ في الرئيسية) ==============
import React, { useEffect, useState } from 'react';
import { X, ChevronLeft } from 'lucide-react';
import { getSetting, setSetting, getTheme, setTheme } from '@/lib/settings';
import { playAccept } from '@/lib/sounds';
import { haptic, publicUrl, shareContent } from '@/lib/native';

function Toggle({ on }) {
  return (
    <span className="relative shrink-0 w-[52px] h-[30px] rounded-full transition-colors" style={{ background: on ? '#22c55e' : '#d4cdea' }}>
      <span className="absolute top-[3px] w-6 h-6 rounded-full bg-white shadow transition-all" style={on ? { right: 3 } : { right: 25 }} />
    </span>
  );
}

export default function SettingsSheet({ name, onClose, onRename }) {
  const [s, setS] = useState({ sound: true, haptics: true });
  const [theme, setThemePref] = useState('auto');
  const [help, setHelp] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    setS({ sound: getSetting('sound'), haptics: getSetting('haptics') });
    setThemePref(getTheme());
  }, []);

  const toggle = (k) => {
    const on = !s[k];
    setSetting(k, on);
    setS(v => ({ ...v, [k]: on }));
    if (on && k === 'sound') playAccept();
    if (on && k === 'haptics') haptic('medium');
  };

  const share = async () => {
    const url = publicUrl('/');
    const text = `جرّب لعبة الكلمات 🔤 — خمّن الكلمة وتحدّى أصحابك!\n${url}`;
    if (await shareContent({ title: 'لعبة الكلمات', text })) return;
    try { await navigator.clipboard.writeText(text); setNote('تم نسخ الرابط 📋'); } catch { setNote(url); }
  };

  const row = 'w-full flex items-center justify-between gap-3 rounded-2xl px-3.5 min-h-[52px] bg-[var(--soft)] text-right font-display font-black text-[var(--ink)] active:scale-[0.99] transition-all';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1e0b4b]/55 fade-in" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-[28px] bg-[var(--card)] text-[var(--ink)] px-4 pt-3 slide-in"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', boxShadow: '0 -12px 30px -10px rgba(20,5,60,.5)' }}
        onClick={e => e.stopPropagation()} role="dialog" aria-label="الإعدادات">
        <div className="mx-auto mb-3 w-10 h-1.5 rounded-full bg-[var(--line)]" />
        <div className="flex items-center justify-between mb-3">
          <div className="font-display font-black text-xl text-[var(--ink-2)]">⚙️ الإعدادات</div>
          <button onClick={onClose} aria-label="إغلاق" className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--soft)]">
            <X className="w-5 h-5" strokeWidth={2.6} />
          </button>
        </div>

        {help ? (
          <div className="space-y-2.5 pb-1">
            <div className="rounded-2xl bg-[var(--soft)] p-3.5">
              <div className="font-display font-black mb-1">🟩 خمّن الكلمة</div>
              <p className="text-sm font-bold text-[var(--muted-c)] leading-relaxed">اكتب كلمة كاملة: الأخضر = الحرف صح وبمكانه، البرتقالي = موجود بمكان ثاني، الغامق = مو في الكلمة. عندك 6 محاولات.</p>
            </div>
            <div className="rounded-2xl bg-[var(--soft)] p-3.5">
              <div className="font-display font-black mb-1">⏱ تحدي النهايات</div>
              <p className="text-sm font-bold text-[var(--muted-c)] leading-relaxed">يطلع لك نهاية (مثل «ـام»)، اكتب كلمة تنتهي فيها. حل أكثر عدد قبل ما تخلص الدقيقتين.</p>
            </div>
            <div className="rounded-2xl bg-[var(--soft)] p-3.5">
              <div className="font-display font-black mb-1">👥 مع صاحبك</div>
              <p className="text-sm font-bold text-[var(--muted-c)] leading-relaxed">أنشئ غرفة وأرسل الكود لصاحبك، أو ادخل بكود وصلك.</p>
            </div>
            <button onClick={() => setHelp(false)} className={row}><span>رجوع</span><ChevronLeft className="w-5 h-5 rotate-180" /></button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* المظهر */}
            <div>
              <div className="font-display font-black text-sm text-[var(--muted-c)] mb-1.5">🌙 المظهر</div>
              <div className="flex gap-1 p-1 rounded-2xl bg-[var(--soft)]">
                {[['auto', 'حسب الجوال'], ['light', '☀️ فاتح'], ['dark', '🌙 ليلي']].map(([k, label]) => (
                  <button key={k} onClick={() => { setTheme(k); setThemePref(k); haptic('light'); }} aria-pressed={theme === k}
                    className="flex-1 rounded-xl min-h-[40px] font-display font-black text-[0.82rem] transition-all"
                    style={theme === k ? { background: '#ffb020', color: '#4a2400', boxShadow: '0 3px 0 #b86b00' } : { color: 'var(--muted-c)' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button role="switch" aria-checked={s.sound} onClick={() => toggle('sound')} className={row}><span>🔊 الأصوات</span><Toggle on={s.sound} /></button>
            <button role="switch" aria-checked={s.haptics} onClick={() => toggle('haptics')} className={row}><span>📳 الاهتزاز</span><Toggle on={s.haptics} /></button>
            <button onClick={onRename} className={row}>
              <span>✏️ تغيير الاسم</span>
              <span className="flex items-center gap-1 text-sm text-[var(--muted-c)] min-w-0"><span className="truncate max-w-[8rem]">{name}</span><ChevronLeft className="w-4 h-4 shrink-0" /></span>
            </button>
            <button onClick={() => setHelp(true)} className={row}><span>❓ طريقة اللعب</span><ChevronLeft className="w-4 h-4 text-[var(--muted-c)]" /></button>
            <div className="flex gap-2.5">
              <button onClick={share} className={row}><span>↗️ شارك اللعبة</span></button>
              <a href={publicUrl('/privacy')} target="_blank" rel="noopener" className={row}><span>🔒 الخصوصية</span></a>
            </div>
            {note && <div className="text-center text-sm font-display font-bold text-[var(--muted-c)]">{note}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
