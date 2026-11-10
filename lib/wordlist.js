// يحمّل القاموس الموسّع مرة وحدة بالخلفية (اللعبة تشتغل بالقاموس الأساسي لين يوصل)
import { extendDictionary } from './dictionary';
import { extendKnown } from './guess';

let promise = null;
export function loadWordlist() {
  if (promise || typeof window === 'undefined') return promise;
  promise = fetch('/words-ar.txt')
    .then(r => (r.ok ? r.text() : ''))
    .then(text => {
      const words = text.split(/\r?\n/);
      extendDictionary(words);
      extendKnown(words);
    })
    .catch(() => {});
  return promise;
}
