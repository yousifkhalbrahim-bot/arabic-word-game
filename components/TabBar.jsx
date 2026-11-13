'use client';

// ============== شريط التنقل تحت ==============
// يطلع في الرئيسية والمتصدرين وملفي بس — يختفي وقت اللعب.
import React from 'react';
import { Home, Trophy, User } from 'lucide-react';
import { haptic } from '@/lib/native';

const TABS = [
  { id: 'menu', label: 'الرئيسية', Icon: Home },
  { id: 'leaderboard', label: 'المتصدرون', Icon: Trophy },
  { id: 'profile', label: 'ملفي', Icon: User },
];

// ارتفاع الشريط (بدون مساحة أسفل الآيفون) — الشاشات تترك مكانه فاضي
export const TABBAR_SPACE = 'calc(68px + env(safe-area-inset-bottom, 0px))';

export default function TabBar({ active, onNav }) {
  return (
    <nav className="tabbar fixed left-0 right-0 bottom-0 z-40" aria-label="التنقل"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}>
      <div className="mx-auto max-w-md flex items-stretch justify-around h-[68px] px-2">
        {TABS.map(({ id, label, Icon }) => {
          const on = active === id;
          return (
            <button key={id} onClick={() => { if (!on) { haptic('light'); onNav(id); } }}
              aria-current={on ? 'page' : undefined}
              className="flex-1 flex flex-col items-center justify-center gap-1 font-display font-black text-[0.78rem] transition-all active:scale-90"
              style={{ color: on ? 'var(--tab-on)' : 'var(--tab-off)' }}>
              <span className="w-12 h-7 rounded-full flex items-center justify-center transition-all"
                style={{ background: on ? 'var(--tab-pill)' : 'transparent' }}>
                <Icon className="w-[21px] h-[21px]" strokeWidth={on ? 2.8 : 2.3} fill={on && id !== 'profile' && id !== 'menu' ? 'currentColor' : 'none'} />
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
