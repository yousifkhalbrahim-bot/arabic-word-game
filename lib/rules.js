import { normalize, normalizeStrict, lookupWord, NORMALIZED_DICT } from './dictionary';

// تحقق من كلمة في وضع السباق/التدريب (القاموس إلزامي)
// usedWords: مصفوفة نصوص الكلمات المستخدمة
export function checkRaceWord(word, ending, usedWords) {
  const w = (word || '').trim();
  if (!w) return { ok: false, error: '' };
  if (!normalize(w).endsWith(normalize(ending))) {
    return { ok: false, error: `لازم تنتهي بـ "${ending}"` };
  }
  if (usedWords.some(u => normalizeStrict(u) === normalizeStrict(w))) {
    return { ok: false, error: 'كلمة مستخدمة' };
  }
  let canonical = w;
  if (NORMALIZED_DICT.size > 0) {
    const lu = lookupWord(w);
    if (!lu.valid) {
      return { ok: false, error: lu.ambiguous ? 'حدد موضع الهمزة' : 'كلمة غير معروفة' };
    }
    canonical = lu.canonical;
  }
  // الكلمة الأصلية ممكن تكون مستخدمة بصيغة همزة مختلفة
  if (canonical !== w && usedWords.some(u => normalizeStrict(u) === normalizeStrict(canonical))) {
    return { ok: false, error: 'كلمة مستخدمة' };
  }
  return { ok: true, word: canonical };
}

// قائمة نهايات عشوائية — كل النهايات تظهر قبل أن تتكرر أي نهاية
export function shuffledEndingQueue(endings, rounds = 6) {
  const result = [];
  for (let round = 0; round < rounds; round++) {
    const arr = [...endings];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    // لا تكرر نفس النهاية على الحدود بين الجولات
    if (result.length && arr[0] === result[result.length - 1] && arr.length > 1) {
      [arr[0], arr[1]] = [arr[1], arr[0]];
    }
    result.push(...arr);
  }
  return result;
}

export const endingAt = (queue, index) =>
  queue && queue.length ? queue[index % queue.length] : 'ام';

export const raceScore = (state, role) =>
  (state?.[`words_p${role}`] || []).length - (state?.penalties?.[role] ?? 0);
