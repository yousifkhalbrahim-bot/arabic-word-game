// يبني public/words-ar.txt من قائمة تكرار كلمات عربية مفتوحة المصدر
//
// المصدر: FrequencyWords — hermitdave (ar_50k.txt، من ترجمات OpenSubtitles 2018)
// https://github.com/hermitdave/FrequencyWords — المحتوى برخصة CC BY-SA 4.0
//
// الاستخدام: node scripts/build-wordlist.mjs <path/to/ar_50k.txt>
import fs from 'node:fs';
import { ARABIC_DICTIONARY } from '../lib/dictionary.js';

const src = process.argv[2];
if (!src) { console.error('usage: node scripts/build-wordlist.mjs <ar_50k.txt>'); process.exit(1); }

const MAX_RANK = 40000;   // أقل من كذا = أخطاء إملائية وكلمات نادرة غالباً
const MIN_LEN = 3, MAX_LEN = 10;

const strip = (t) => t.trim().replace(/[ً-ٰٟـ]/g, '');
const loose = (t) => strip(t).replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');
const ARABIC_ONLY = /^[ء-ي]+$/;

// كلمات غير لائقة (اللعبة لكل الأعمار)
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
// بعد البناء: شغّل scripts/clean-wordlist.mjs لحذف الأسماء الأجنبية (scripts/wordlist-exclude.txt)

// ---- قراءة القائمة ----
const rows = fs.readFileSync(src, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, MAX_RANK)
  .map(l => { const i = l.lastIndexOf(' '); return { w: strip(l.slice(0, i)), n: Number(l.slice(i + 1)) }; });
const count = new Map();
for (const r of rows) if (!count.has(r.w)) count.set(r.w, r.n);

// ---- القاموس الأساسي له الأولوية (يحافظ على قواعد الهمزة: أمام ≠ إمام) ----
const coreLoose = new Set(ARABIC_DICTIONARY.map(loose));

const kept = [];
const dropped = { notArabic: 0, length: 0, prefixAl: 0, clitic: 0, blocked: 0, inCore: 0 };
const seen = new Set();
for (const { w, n } of rows) {
  if (!ARABIC_ONLY.test(w)) { dropped.notArabic++; continue; }
  const len = [...w].length;
  if (len < MIN_LEN || len > MAX_LEN) { dropped.length++; continue; }
  // "ال" والسوابق المتصلة فيها (الكتاب، والكتاب، بالكتاب...)
  if (/^(ال|وال|بال|فال|كال|لل)/.test(w)) { dropped.prefixAl++; continue; }
  // سوابق متصلة (و ف ب ل ك س، أو اثنين منها): "وزمان"، "بسلام"، "لعام" تنحذف إذا الكلمة
  // بدون السابقة أشهر منها — "وطن" و"بلاد" تبقى لأن "طن" و"لاد" أقل شهرة
  const m = w.match(/^([وف]?[بلكس]|[وف])(.+)$/);
  if (m) {
    const variants = [m[2], w.slice(1)];
    if (variants.some(r => [...r].length >= 3 && (count.get(r) || 0) > n)) { dropped.clitic++; continue; }
  }
  const lk = loose(w);
  if (BLOCK.has(lk)) { dropped.blocked++; continue; }
  if (coreLoose.has(lk)) { dropped.inCore++; continue; }
  if (seen.has(w)) continue;
  seen.add(w);
  kept.push(w);
}

fs.writeFileSync('public/words-ar.txt', kept.join('\n') + '\n');
console.log('kept', kept.length, 'words →', (fs.statSync('public/words-ar.txt').size / 1024).toFixed(0), 'KB');
console.log('dropped', dropped);
