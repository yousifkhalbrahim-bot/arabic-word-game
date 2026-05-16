import { Tajawal, Reem_Kufi } from 'next/font/google';
import './globals.css';

const tajawal = Tajawal({
  subsets: ['arabic'],
  weight: ['300', '400', '500', '700', '900'],
  variable: '--font-tajawal',
  display: 'swap',
});

const reemKufi = Reem_Kufi({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-reem-kufi',
  display: 'swap',
});

export const metadata = {
  title: 'لعبة الكلمات',
  description: 'لعبة كلمات عربية ضد ساعة الشطرنج',
  themeColor: '#0c0a09',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className={`${tajawal.variable} ${reemKufi.variable}`}>
      <body className="font-body bg-stone-950 text-stone-100 antialiased">
        {children}
      </body>
    </html>
  );
}
