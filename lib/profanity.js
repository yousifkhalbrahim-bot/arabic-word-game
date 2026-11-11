// ============== فلتر الكلمات المسيئة ==============
// يُستخدم للأسماء (تطلع في الترتيب) والكلمة السرية والتلميح (يشوفها صاحبك).
// نفس المنطق موجود على السيرفر في supabase-migration-v6-filter.sql (_is_bad).

// توحيد: حروف صغيرة، بدون تشكيل/تطويل، أ/إ/آ=ا، ى=ي، ة=ه، وحذف التكرار (كسسس → كس)
export function normalizeForFilter(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[@]/g, 'a')
    .replace(/[0]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/[$5]/g, 's')
    .replace(/(.)\1+/g, '$1');
}

// كلمات تنرفض إذا كانت كلمة كاملة (لأنها ممكن تكون جزء من كلمات عادية: كس داخل "عكس"، زب داخل "زبدة")
const WHOLE = [
  'كس', 'كسم', 'زب', 'زبي', 'زبر', 'طيز', 'نيك', 'نيج', 'نايك', 'عير', 'عيري', 'خول', 'عرص', 'مص',
  'خرا', 'خره', 'زنا', 'زاني', 'عاهر', 'لوطي', 'شاذ', 'ديوث', 'قواد', 'منيك', 'سكس', 'بورن', 'كحبه',
  'fuck', 'fck', 'fuk', 'shit', 'bitch', 'dick', 'cock', 'pussy', 'cunt', 'ass', 'asshole', 'whore',
  'slut', 'porn', 'sex', 'fag', 'nigger', 'nigga', 'rape', 'penis', 'boobs',
];

// كلمات تنرفض حتى لو كانت ملصوقة بكلام ثاني (طويلة وما تطلع بالغلط داخل كلمات عادية)
const SUB = [
  'كسمك', 'كسامك', 'كسختك', 'كسخت', 'كسيس', 'منيوك', 'منيوكه', 'متناك', 'شرموط', 'قحبه', 'قحاب',
  'عاهره', 'معرص', 'مخنث', 'زانيه', 'طيزك', 'زبك', 'نيكني', 'نيكم', 'يلعن', 'سكسي',
  'بورنو', 'مومس', 'دعاره', 'ابنالكلب', 'ياكلب', 'ياحمار', 'يازق',
  'fuck', 'shit', 'bitch', 'pussy', 'cunt', 'asshole', 'whore', 'porn', 'nigger', 'nigga', 'motherf',
];

export function isOffensive(text) {
  const n = normalizeForFilter(text);
  if (!n) return false;
  const squashed = n.replace(/[^a-zء-ي]/g, '');
  if (SUB.some(w => squashed.includes(normalizeForFilter(w)))) return true;
  const tokens = n.split(/[^a-zء-ي]+/).filter(Boolean);
  // "ال" ملصوقة: الكس، والزب...
  return tokens.some(t => {
    const bare = t.replace(/^(و|ف|ب|ل|ك)?(ال)?/, '');
    return WHOLE.includes(t) || WHOLE.includes(bare);
  });
}

export const OFFENSIVE_MSG = 'فيه كلمة غير لائقة — اختر شي ثاني 🙏';
