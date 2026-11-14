// يحمّل القاموس الموسّع مرة وحدة بالخلفية (اللعبة تشتغل بالقاموس الأساسي لين يوصل)
// القائمة كبيرة (~127 ألف كلمة)، فنضيفها على دفعات صغيرة عشان ما تعلّق الشاشة.
import { extendDictionary } from './dictionary';
import { extendKnown } from './guess';

const CHUNK = 4000;
const idle = (fn) => (typeof requestIdleCallback === 'function'
  ? requestIdleCallback(fn, { timeout: 200 })
  : setTimeout(fn, 0));

let promise = null;
export function loadWordlist() {
  if (promise || typeof window === 'undefined') return promise;
  promise = fetch('/words-ar.txt')
    .then(r => (r.ok ? r.text() : ''))
    .then(text => new Promise((resolve) => {
      const words = text.split(/\r?\n/);
      let i = 0;
      const step = () => {
        const part = words.slice(i, i + CHUNK);
        extendDictionary(part);
        extendKnown(part);
        i += CHUNK;
        if (i < words.length) idle(step); else resolve();
      };
      step();
    }))
    .catch(() => {});
  return promise;
}
