import './globals.css';

export const metadata = {
  title: 'لعبة الكلمات',
  description: 'لعبة كلمات عربية ضد ساعة الشطرنج',
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
  appleWebApp: { capable: true, title: 'الكلمات', statusBarStyle: 'black-translucent' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#6d28d9',
};

// يطبّق الوضع الليلي قبل ما تطلع الصفحة (بدون وميض أبيض)
const THEME_BOOT = `try{var p=localStorage.getItem('wg:theme')||'auto';var d=p==='dark'||(p==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light')}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="font-body text-stone-100 antialiased">
        {children}
      </body>
    </html>
  );
}
