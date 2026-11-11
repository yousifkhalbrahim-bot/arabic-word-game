// ينظّف public/words-ar.txt (التخمينات المقبولة) من الأسماء الأجنبية والكلمات غير اللائقة
// بدون إعادة بنائه من المصدر.
//
// الاستخدام:  node scripts/clean-wordlist.mjs          ← يكتب الملف
//             node scripts/clean-wordlist.mjs --dry    ← يطبع اللي بينحذف بس
//
// 1) قائمة استبعاد يدوية: scripts/wordlist-exclude.txt (مطابقة حرفية، الأسطر اللي تبدأ بـ # تعليقات)
// 2) قواعد نهايات شائعة في الأسماء المعرّبة (جاكسون، هوليوود، بيتسبرغ، كوالسكي...).
//    هذي النهايات نادرة جداً في الكلمات العربية بشرط إن الكلمة ما تبدأ بحرف مضارعة
//    (يجلسون، تدرسون، نيستون...) — والكلمات العربية القليلة اللي تطابقها محفوظة في KEEP.
import fs from 'node:fs';

const FILE = 'public/words-ar.txt';
const EXCLUDE = 'scripts/wordlist-exclude.txt';
const dry = process.argv.includes('--dry');

const exclude = new Set(
  fs.readFileSync(EXCLUDE, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'))
);

// نهايات أسماء معرّبة (سون/ستون = -son/-ston، وود = -wood، فيلد = -field، برغ = -burg، سكي = -ski، وفيتش = -ovich)
const NAME_SUFFIX = /(سون|ستون|وود|فيلد|بيرغ|بورغ|برغ|بيرج|بورج|سكي|فسكي|وفيتش|شستر|ورث)$/;
// حروف المضارعة/السوابق العربية: الكلمة اللي تبدأ فيها غالباً فعل أو جمع عربي (يجلسون، متحمسون، خمسون)
const ARABIC_START = /^[يتنمس]/;
// كلمات عربية تطابق النهايات فوق (لا تنحذف)
const KEEP = new Set(['خمسون', 'حسون', 'ورث', 'أمسكي', 'امسكي', 'تمسكي', 'تماسكي', 'ويسكي', 'لسون', 'جالسون', 'دارسون', 'حارسون']);

const lines = fs.readFileSync(FILE, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
const removed = { exclude: [], suffix: [] };
const kept = [];
for (const w of lines) {
  if (exclude.has(w)) { removed.exclude.push(w); continue; }
  if (NAME_SUFFIX.test(w) && !ARABIC_START.test(w) && !KEEP.has(w)) { removed.suffix.push(w); continue; }
  kept.push(w);
}

console.log('before', lines.length, '→ after', kept.length, `(removed ${lines.length - kept.length})`);
console.log('  by exclusion list:', removed.exclude.length);
console.log('  by name-suffix rule:', removed.suffix.length, removed.suffix.join(' '));
if (!dry) {
  fs.writeFileSync(FILE, kept.join('\r\n') + '\r\n');
  console.log('wrote', FILE);
}
