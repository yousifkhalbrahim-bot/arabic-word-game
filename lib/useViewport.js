'use client';

import { useEffect } from 'react';

// على الآيفون، الكيبورد ما يصغّر الشاشات الثابتة (position: fixed)،
// فيغطي خانة الكتابة. هنا نتابع الجزء الظاهر فعلياً من الشاشة
// ونحطه في متغيرات CSS تستخدمها .app-fixed
export function useVisualViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    if (!vv) return;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty('--vv-h', `${vv.height}px`);
        root.style.setProperty('--vv-top', `${vv.offsetTop}px`);
        // الكيبورد مفتوح إذا اختفى جزء كبير من الشاشة
        root.classList.toggle('kb-open', window.innerHeight - vv.height > 120);
      });
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('orientationchange', update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
}
