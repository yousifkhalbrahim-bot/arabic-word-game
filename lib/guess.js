// ============== منطق "خمّن الكلمة" ==============
import { ARABIC_DICTIONARY } from './dictionary';

export const LENGTHS = { 3: { tries: 6 }, 4: { tries: 6 }, 5: { tries: 7 } };

// توحيد الحروف: أ/إ/آ = ا ، ى/ئ = ي ، ؤ = و — وحذف التشكيل
export function normalizeGuess(text) {
  return (text || '')
    .trim()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ىئ]/g, 'ي')
    .replace(/ؤ/g, 'و');
}

export const lettersOf = (text) => [...normalizeGuess(text)];

// تقييم التخمين: correct (مكانه صح) / present (موجود بمكان ثاني) / absent
export function evaluateGuess(guess, answer) {
  const g = [...guess], a = [...answer];
  const res = Array(g.length).fill('absent');
  const remaining = {};
  a.forEach((ch, i) => {
    if (g[i] === ch) res[i] = 'correct';
    else remaining[ch] = (remaining[ch] || 0) + 1;
  });
  g.forEach((ch, i) => {
    if (res[i] !== 'correct' && remaining[ch] > 0) {
      res[i] = 'present';
      remaining[ch]--;
    }
  });
  return res;
}

const RANK = { absent: 1, present: 2, correct: 3 };
// ألوان الكيبورد: الأفضل يغلب
export function mergeKeyStates(prev, guess, result) {
  const next = { ...prev };
  [...guess].forEach((ch, i) => {
    if (!next[ch] || RANK[result[i]] > RANK[next[ch]]) next[ch] = result[i];
  });
  return next;
}

// ============== الكلمات ==============
// كلمات شائعة ومعروفة (تُوزّع حسب عدد الحروف بعد التوحيد)
const POOL = `
قمر شمس بحر نهر جبل ثلج مطر برق رعد نور يوم شهر سنة وقت باب بيت وطن اسد نمر فيل ذئب قطة كلب صقر نسر حوت قرد جمل قلب عقل راس عين اذن شعر وجه كتف انف لحم سمك ارز خبز عسل سكر ملح شاي ماء تمر تين عنب موز خوخ كرز لوز جوز بصل ثوم قمح ذهب فضة نحل ورد زهر شجر عشب رمل طين حجر صخر نار ريح غيم ضوء ليل فجر ظهر عصر صيف برد قلم كتب درس علم فكر حلم امل صبر شكر فرح حزن خوف حرب سيف رمح درع قوس سهم خيل غنم طير ديك بطة بوم نمل دود سوق مال عمل بلد دار قصر برج جسر درب سفر لعب كرة فوز هدف ركض قفز نوم اكل شرب صوم عيد حفل عرس ثوب عقد تاج كنز لون صوت لحن عود طبل لغز كوب صحن قدر فرن سقف حبل قفل عصا كيس نجم كون ارض جيش شعب ملك شيخ طفل رجل ولد بنت اخت خال جار ضيف رسم زيت لبن جبن بيض ورق حبر لوح بحث نخل وعد سحر غزل ثمر حقل كهف
كتاب بحار جبال سماء نجوم غيوم رياح مطار قطار شجرة زهرة وردة نخلة تفاح بطيخ جزرة خيار حليب جبنة زبدة قهوة عصير طعام غداء عشاء فطور
معلم طالب دفتر كرسي منزل غرفة مطبخ شارع قرية بلاد عالم رمال ظلام صباح مساء ليلة نهار ساعة زمان مكان طريق قارب حصان ثعلب ارنب غزال
سمكة نحلة نملة ضفدع بقرة خروف ماعز ركبة اصبع لسان صديق اخوة والد شباب فرحة حديد نحاس ذكاء سرعة لعبة ملعب فريق سباق هاتف شاشة صورة
شاعر كلمة جملة سؤال جواب فكرة نجمة كوكب فضاء هواء دخان شمعة هدية متجر درهم ريال مطعم فندق مسجد جامع طبيب دواء مريض حلوى كعكة سلطة
حساء دجاج بيضة فلفل قرفة ربيع خريف شتاء شاطئ شلال قلعة خيمة قميص حذاء قبعة خاتم مظلة رسام لوحة احمر ازرق اخضر اصفر ابيض اسود كنغر
شعير تمور رمان مشمش بندق فستق واجب مكتب شركة موظف مدير عامل طيار شرطي جندي نجار خباز حلاق طباخ ممرض محطة رحلة مرآة منبه سرير رفوف
زجاج ورقة قماش حرير ضباب مجرة حقيبة قلادة صحن ملعقة شوكة سكين كاسة ابريق فنجان دلة مخدة بطانية

مدرسة طاولة نافذة حديقة مدينة صحراء سفينة طائرة دراجة عصفور حمامة دلفين فراشة دجاجة عائلة والدة امرأة سعادة شجاعة جائزة بطولة رسالة
حاسوب رواية قصيدة مصباح مفتاح صندوق دينار مكتبة رياضة سباحة نعناع ليمون اسنان ضيافة ثقافة صداقة حكاية جزيرة غابات بحيرة سجادة وسادة
ملابس نظارة محفظة كتابة قراءة الوان زرافة تمساح ببغاء طاووس بطريق حلزون صرصور بعوضة ذبابة جرادة مزرعة طماطم بطاطا ملفوف زيتون جامعة
تلميذ شهادة سبورة مسطرة ممحاة مهندس سيارة شاحنة حافلة ميناء اشارة خريطة بوصلة تلفاز راديو ثلاجة غسالة مكنسة مروحة مدفأة خزانة بركان
زلزال اعصار عاصفة كواكب صاروخ مسرحية قنديل عنقود مغارة ينبوع مملكة اميرة فارس سيوف قافلة جمال نخيل واحة كثبان عطلة مهرجان مسابقة
`;

function bucket(words) {
  const out = { 3: new Set(), 4: new Set(), 5: new Set() };
  for (const w of words) {
    const n = normalizeGuess(w);
    if (!/^[ء-ي]+$/.test(n)) continue;
    const len = [...n].length;
    if (out[len]) out[len].add(n);
  }
  return out;
}

const poolBuckets = bucket(POOL.split(/\s+/).filter(Boolean));
const dictBuckets = bucket(ARABIC_DICTIONARY);

// الأجوبة: من القائمة المختارة فقط (متنوعة النهايات)
export const ANSWERS = { 3: [...poolBuckets[3]], 4: [...poolBuckets[4]], 5: [...poolBuckets[5]] };
// التخمينات المعروفة: الأجوبة + القاموس
export const KNOWN = {
  3: new Set([...poolBuckets[3], ...dictBuckets[3]]),
  4: new Set([...poolBuckets[4], ...dictBuckets[4]]),
  5: new Set([...poolBuckets[5], ...dictBuckets[5]]),
};

// يضيف كلمات القاموس الموسّع للتخمينات المقبولة بدون تأكيد
export function extendKnown(words) {
  for (const w of words) {
    const n = normalizeGuess(w);
    if (!/^[ء-ي]+$/.test(n)) continue;
    const len = [...n].length;
    if (KNOWN[len]) KNOWN[len].add(n);
  }
}

// خلط ثابت (نفس الترتيب لكل الأجهزة) حتى تكون كلمة اليوم موحّدة
function seededShuffle(arr, seed) {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const a = [...arr].sort();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DAILY_ORDER = { 3: seededShuffle(ANSWERS[3], 3033), 4: seededShuffle(ANSWERS[4], 4044), 5: seededShuffle(ANSWERS[5], 5055) };

// رقم اليوم (حسب التاريخ المحلي) — يبدأ من ١
export function dayNumber(date = new Date()) {
  const start = Date.UTC(2026, 0, 1);
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((today - start) / 86400000) + 1;
}

export function dailyAnswer(len, day = dayNumber()) {
  const list = DAILY_ORDER[len];
  return list[((day - 1) % list.length + list.length) % list.length];
}

export function randomAnswer(len, avoid) {
  const list = ANSWERS[len];
  let w;
  do { w = list[Math.floor(Math.random() * list.length)]; } while (list.length > 1 && w === avoid);
  return w;
}

// نص المشاركة (مربعات ملوّنة)
const EMOJI = { correct: '🟩', present: '🟧', absent: '⬜' };
// الأطوال المتاحة للاعب (٤ أحرف باقية للغرف القديمة بس)
export const PLAYABLE_LENGTHS = [3, 5];
export const BANK_SIZE = 10;

// لوحة حروف مختصرة لكلمات الـ٣ أحرف: حروف الكلمة + حروف تمويه (المجموع ١٠)
// ثابتة لنفس الكلمة → اللاعبين بالتحدي يشوفون نفس الحروف
const ALL_KEYS = [...'ضصثقفغعهخحجشسيبلاتنمكةءظطذدزرو'];
function hashStr(s) {
  let h = 2166136261;
  for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function letterBank(answer, size = BANK_SIZE) {
  const ans = [...new Set([...normalizeGuess(answer)])];
  const pool = seededShuffle(ALL_KEYS.filter(k => !ans.includes(k)), hashStr(answer) ^ 0x9e3779b9);
  return new Set([...ans, ...pool.slice(0, Math.max(0, size - ans.length))]);
}
export const bankFor = (len, answer) => (len === 3 && answer ? letterBank(answer) : null);

export function shareText({ results, won, tries, len, day }) {
  const head = `خمّن الكلمة ${day ? `#${day}` : '(لعب حر)'} · ${len} أحرف — ${won ? results.length : 'X'}/${tries}`;
  const grid = results.map(r => r.map(x => EMOJI[x]).join('')).join('\n');
  return `${head}\n${grid}`;
}
