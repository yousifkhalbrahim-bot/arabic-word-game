// يخلّي اللعبة قابلة للتثبيت على الشاشة الرئيسية وتفتح بملء الشاشة
export default function manifest() {
  return {
    name: 'لعبة الكلمات',
    short_name: 'الكلمات',
    description: 'لعبة كلمات عربية متعددة اللاعبين',
    lang: 'ar',
    dir: 'rtl',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#4f46e5',
    theme_color: '#6d28d9',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
