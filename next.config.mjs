/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // نسخة تطبيق الآيفون: ملفات ثابتة تنحط داخل التطبيق (Capacitor)
  ...(process.env.BUILD_TARGET === 'app' ? { output: 'export', images: { unoptimized: true } } : {}),
};

export default nextConfig;
