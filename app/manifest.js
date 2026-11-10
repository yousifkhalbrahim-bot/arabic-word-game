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
    background_color: '#0c0a09',
    theme_color: '#0c0a09',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
