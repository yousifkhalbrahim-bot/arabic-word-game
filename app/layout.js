import './globals.css';

export const metadata = {
  title: 'لعبة الكلمات',
  description: 'لعبة كلمات عربية ضد ساعة الشطرنج',
  themeColor: '#0c0a09',
  icons: {
    icon: '/icon.png.png',
    apple: '/icon.png.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="font-body bg-stone-950 text-stone-100 antialiased">
        {children}
      </body>
    </html>
  );
}
