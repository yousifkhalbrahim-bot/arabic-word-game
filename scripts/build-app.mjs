// يبني نسخة التطبيق (ملفات ثابتة في out/) ثم ينسخها لمشروع iOS
// الاستخدام: npm run build:app
import { execSync } from 'node:child_process';
import { rmSync, existsSync } from 'node:fs';

const run = (cmd, env = {}) => execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } });

run('npx next build', { BUILD_TARGET: 'app' });

// ملفات ما يحتاجها التطبيق (صور التصميم القديم + صفحة معاينة للمطورين) — توفّر ~٦ ميجا
const unused = [
  'bookshelf-mobile.png.png', 'bookshelf.png.png', 'bookshelf2.png.jpeg', 'bookshelf-mobile.jpg',
  'icon.png.png', 'preview-race.html', 'preview-race.txt', 'preview-race',
];
for (const f of unused) {
  const p = `out/${f}`;
  if (existsSync(p)) rmSync(p, { recursive: true, force: true });
}

if (existsSync('ios')) run('npx cap sync ios');
else console.log('\nios/ غير موجود بعد — شغّل: npx cap add ios');
