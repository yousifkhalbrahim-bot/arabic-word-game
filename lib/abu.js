// ============== أبو شماغ: العبارات ==============
// كل موقف له عبارات، ويطلع منها وحدة عشوائية (ما تتكرر نفس العبارة مرتين ورا بعض).
// يطلب أبو شماغ من أي مكان: abuSay('win') — يظهر فوق الشاشة (components/AbuShmagh.jsx).
// أبو شماغ ما يكثر الكلام: ترحيب خفيف، ويتكلم وقت اللعب بس لو غلطت كذا مرة ورا بعض.

export const PHRASES = {
  hi: ['هلا والله!', 'يا هلا', 'حيّ الله', 'نوّرت'],
  win: ['كفو!', 'كفو والله!', 'ذيب!', 'عز الله إنك فلتة', 'يا سلام عليك', 'تستاهل العقال 😂'],
  first: ['وش ذا؟! ساحر؟', 'من أول ضربة!', 'هذي ما يسويها إلا الكبار'],
  sad: ['ولا يهمك، المرة الجاية', 'هاردلك', 'لا تزعل، عادي', 'قربت! المرة الجاية لك'],
  streak: ['مولّع! 🔥', 'ما أحد يوقفك!', 'يا ذيب كمّل', 'هب عليه!'],
  record: ['رقم جديد! تاريخي!', 'سجّلها باسمك'],
  // بعد كذا غلطة ورا بعض
  wrong: ['غلط، ركّز شوي', 'مو صح، جرّب غيرها', 'لا، مو هذي', 'خذ نفس وجرّب مرة ثانية'],
  // لما تضغط عليه في الرئيسية
  poke: ['لا تدغدغني 😂', 'وش تبي؟ روح العب!', 'آي! بشويش', 'أنا مو زر 😒', 'خلاص فهمنا، يلا العب', 'لا تلعب بعقالي!', 'هههه يكفي!', 'اضغط على اللعبة مو عليّ'],
};

// الحركة المناسبة لكل موقف
export const MOOD_OF = { hi: 'hi', win: 'win', first: 'win', sad: 'sad', think: 'think', streak: 'streak', record: 'win', wrong: 'think', poke: 'hi' };

const last = {};
export function phraseFor(kind) {
  const list = PHRASES[kind] || PHRASES.hi;
  let p = list[Math.floor(Math.random() * list.length)];
  if (list.length > 1 && p === last[kind]) p = list[(list.indexOf(p) + 1) % list.length];
  last[kind] = p;
  return p;
}

// يطلّع أبو شماغ فوق الشاشة (يلقطه <AbuToast/>)
export function abuSay(kind, text, sub) {
  if (typeof window === 'undefined') return;
  try { window.dispatchEvent(new CustomEvent('abu:say', { detail: { kind, text: text || phraseFor(kind), sub, mood: MOOD_OF[kind] || 'hi' } })); } catch {}
}

// -------- الغلطات --------
// كل غلطة نعدّها، وبعد ٣ ورا بعض يقول إنها غلط (ومرة وحدة بس لين تجيب وحدة صح).
const WRONG_AFTER = 3;
let misses = 0;
export function abuMiss() {
  misses += 1;
  if (misses === WRONG_AFTER) abuSay('wrong');
}
export function abuHit() { misses = 0; }
