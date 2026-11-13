// ============== أبو شماغ: العبارات ==============
// كل موقف له عبارات، ويطلع منها وحدة عشوائية (ما تتكرر نفس العبارة مرتين ورا بعض).
// يطلب أبو شماغ من أي مكان: abuSay('win') — يظهر فوق الشاشة (components/AbuShmagh.jsx).

export const PHRASES = {
  hi: ['هلا والله!', 'يا هلا ومرحبا', 'حيّ الله من جانا', 'نوّرت يا الذيب', 'وينك من زمان؟ 😤'],
  win: ['كفو!', 'كفو والله!', 'ذيب!', 'عز الله إنك فلتة', 'يا سلام عليك', 'تستاهل العقال 😂'],
  first: ['وش ذا؟! ساحر؟', 'من أول ضربة!', 'هذي ما يسويها إلا الكبار'],
  sad: [
    'ولا يهمك، المرة الجاية', 'هاردلك', 'والله كانت سهلة 😅', 'لا تزعل، عادي',
    // تنمّر خفيف 😏
    'حتى جدتي حلّتها 👵', 'أكيد كنت نايم 😴', 'خلك على القهوة أحسن ☕', 'حسبالي إنك ذيب 😏',
    'روح تقهوى وارجع', 'يا شينها 😂', 'وين راح الذكاء؟ 🧠',
  ],
  think: ['امممم…', 'خلني أفكر معك', 'شوف هالحرف 👀', 'التلميح عليّ هالمرة'],
  streak: ['مولّع! 🔥', 'ما أحد يوقفك!', 'يا ذيب كمّل', 'هب عليه!'],
  record: ['رقم جديد! تاريخي!', 'سجّلها باسمك', 'ما توقعتها منك 😮'],
  hurry: ['بسرعة بسرعة!', 'الوقت يركض!', 'يلا يلا يلا!'],
  // لما تضغط عليه في الرئيسية
  poke: ['لا تدغدغني 😂', 'وش تبي؟ روح العب!', 'آي! بشويش', 'أنا مو زر 😒', 'خلاص فهمنا، يلا العب', 'لا تلعب بعقالي!', 'ما عندك شغل؟ 😂', 'هههه يكفي!', 'اضغط على اللعبة مو عليّ'],
  unknown: ['هذي من وين جبتها؟ 😂', 'وش ذي الكلمة؟', 'متأكد منها؟', 'اني بورلي 😂', 'ياعمي تستهبل انت!!'],
};

// الحركة المناسبة لكل موقف
export const MOOD_OF = { hi: 'hi', win: 'win', first: 'win', sad: 'sad', think: 'think', streak: 'streak', record: 'win', hurry: 'think', unknown: 'think', poke: 'hi' };

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
