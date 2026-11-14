// يبني public/words-ar.txt (الكلمات المقبولة) من قائمتين مفتوحتين لتكرار الكلمات العربية:
//
// 1) FrequencyWords — hermitdave (ar_full.txt، من ترجمات OpenSubtitles 2018) — CC BY-SA 4.0
//    https://github.com/hermitdave/FrequencyWords
// 2) wikipedia-word-frequency — Ilya Semenov (arwiki-2022-08-29.txt) — MIT
//    https://github.com/IlyaSemenov/wikipedia-word-frequency
//
// الكلمة تنقبل إذا: شائعة في الترجمات، أو شائعة في ويكيبيديا، أو موجودة في الاثنين.
// (الكلمة اللي في مصدر واحد بس وعددها قليل غالباً خطأ إملائي أو اسم.)
//
// الاستخدام: node scripts/build-wordlist.mjs <ar_full.txt> <arwiki.txt> [old-words-ar.txt]
// بعدها: node scripts/clean-wordlist.mjs   (يحذف الأسماء الأجنبية)
import fs from 'node:fs';
import { ARABIC_DICTIONARY } from '../lib/dictionary.js';
import { isOffensive } from '../lib/profanity.js';

const [subsFile, wikiFile] = process.argv.slice(2);
if (!subsFile || !wikiFile) { console.error('usage: node scripts/build-wordlist.mjs <ar_full.txt> <arwiki.txt>'); process.exit(1); }

// الحدود: S = الترجمات بس، W = ويكيبيديا بس، BOTH = موجودة في الاثنين
const S = 40, W = Infinity, BOTH_S = 4, BOTH_W = 12;   // لازم تطلع في الكلام (الترجمات): ويكيبيديا لحالها فيها أسماء أعلام كثير
const MIN_LEN = 3, MAX_LEN = 10;
// كلمات حرفين (يد، دم، حب…) تنقبل بس لو شائعة جداً في المصدرين
const TWO_MIN = 1000;

const strip = (t) => t.trim().replace(/[ً-ٰٟـ]/g, '');
const loose = (t) => strip(t).replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');
const ARABIC_ONLY = /^[ء-ي]+$/;

// كلمات غير لائقة (اللعبة لكل الأعمار) — فوق فلتر lib/profanity.js
const BLOCK = new Set([
  'زب', 'طيز', 'كس', 'نيك', 'منيوك', 'متناك', 'شرموطة', 'شرموط', 'قحبة', 'قحبه', 'عاهرة', 'عاهره',
  'زبي', 'كسك', 'كسم', 'نيكني', 'لوطي', 'خول', 'عرص', 'معرص', 'زانية', 'زاني',
  'عاهر', 'عاهرات', 'عاهرتك', 'مومس', 'داعر', 'دعارة', 'ساقطة', 'شاذ', 'شاذة', 'شاذا', 'شواذ',
  'سحاقية', 'مخنث', 'قواد', 'زنجي', 'زنوج', 'جماع', 'مهبل', 'مهبلي', 'قضيب', 'قضيبك', 'قضيبي', 'قضيبه',
  'ثدي', 'ثديي', 'خصيتي', 'خصيتيك', 'خصيتيه', 'متعرية', 'براز', 'غائط',
  'مضاجعة', 'مضاجعتها', 'مضاجعتي', 'مضاجعتك', 'ضاجع', 'ضاجعت', 'ضاجعتها', 'ضاجعني',
  'تضاجع', 'تضاجعها', 'يضاجع', 'أضاجع', 'نتضاجع',
  'مؤخرتك', 'مؤخرتي', 'مؤخرته', 'مؤخرتها', 'مؤخرتى', 'مؤخرات', 'مؤخراتهم', 'مؤخراتكم',
].map(loose));

const read = (f) => {
  const m = new Map();
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const i = l.lastIndexOf(' ');
    if (i < 0) continue;
    const w = strip(l.slice(0, i)), n = Number(l.slice(i + 1));
    if (!w || !Number.isFinite(n)) continue;
    m.set(w, (m.get(w) || 0) + n);
  }
  return m;
};
const subs = read(subsFile), wiki = read(wikiFile);
// العدد الموحّد (لمقارنة الكلمة مع نفسها بدون السابقة)
const total = (w) => (subs.get(w) || 0) + (wiki.get(w) || 0) * 0.3;

const coreLoose = new Set(ARABIC_DICTIONARY.map(loose));
// كل كلمة كانت في القائمة القديمة تبقى (راجعناها من قبل)
const oldFile = process.argv[4];
const OLD = new Set(oldFile && fs.existsSync(oldFile)
  ? fs.readFileSync(oldFile, 'utf8').split(/\r?\n/).map(x => x.trim()).filter(Boolean) : []);
const kept = [];
const dropped = { notArabic: 0, length: 0, rare: 0, prefixAl: 0, clitic: 0, blocked: 0, inCore: 0 };
const seen = new Set();
const all = [...new Set([...subs.keys(), ...wiki.keys()])].sort((a, b) => total(b) - total(a));
for (const w of all) {
  if (!ARABIC_ONLY.test(w)) { dropped.notArabic++; continue; }
  const len = [...w].length;
  const s = subs.get(w) || 0, k = wiki.get(w) || 0;
  if (len === 2 ? !(s >= TWO_MIN && k >= TWO_MIN) : (len < MIN_LEN || len > MAX_LEN)) { dropped.length++; continue; }
  if (!OLD.has(w) && !(s >= S || k >= W || (s >= BOTH_S && k >= BOTH_W))) { dropped.rare++; continue; }
  // "ال" والسوابق المتصلة فيها (الكتاب، والكتاب، بالكتاب...)
  if (/^(ال|وال|بال|فال|كال|لل)/.test(w)) { dropped.prefixAl++; continue; }
  // سوابق متصلة (و ف ب ل ك س): تنحذف إذا الكلمة بدونها أشهر في الكلام (الترجمات) —
  // "وطن" و"بلاد" و"فكرة" و"سمكة" تبقى. الكلمة اللي في ويكيبيديا بس نقارنها بويكيبيديا.
  const m = w.match(/^([وف]?[بلكس]|[وف])(.+)$/);
  if (m && !OLD.has(w)) {
    const freq = s > 0 ? (r) => subs.get(r) || 0 : (r) => (wiki.get(r) || 0) / 3;
    const n = s > 0 ? s : k;
    // كلمة لها حضور قوي في ويكيبيديا بنفسها (سماء، وسادة) ما تنحذف — الصيغ المتصلة تكون فيها أندر بكثير
    const strongInWiki = (r) => k >= 200 && k * 20 >= (wiki.get(r) || 0);
    if ([m[2], w.slice(1)].some(r => [...r].length >= 3 && freq(r) > n && !strongInWiki(r))) { dropped.clitic++; continue; }
  }
  const lk = loose(w);
  if (BLOCK.has(lk) || isOffensive(w)) { dropped.blocked++; continue; }
  if (coreLoose.has(lk)) { dropped.inCore++; continue; }
  if (seen.has(w)) continue;
  seen.add(w);
  kept.push(w);
}

// كلمات القائمة القديمة اللي ما طلعت من المصدرين + كلمات نضيفها يدوياً (scripts/wordlist-include.txt)
const INCLUDE = fs.existsSync('scripts/wordlist-include.txt')
  ? fs.readFileSync('scripts/wordlist-include.txt', 'utf8').split(/\r?\n/).map(x => x.trim()).filter(x => x && !x.startsWith('#')) : [];
for (const w of [...OLD, ...INCLUDE]) if (!seen.has(w) && !coreLoose.has(loose(w))) { seen.add(w); kept.push(w); }
fs.writeFileSync('public/words-ar.txt', kept.join('\n') + '\n');
console.log('kept', kept.length, 'words →', (fs.statSync('public/words-ar.txt').size / 1024).toFixed(0), 'KB');
console.log('dropped', dropped);
