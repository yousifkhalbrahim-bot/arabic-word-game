// يتحقق من قائمة الأجوبة (POOL في lib/guess.js) والقاموس الموسّع (public/words-ar.txt)
// الاستخدام: node scripts/validate-words.mjs
import fs from 'node:fs';
import { execSync } from 'node:child_process';

// نفس normalizeGuess في lib/guess.js
const normalizeGuess = (text) => (text || '').trim()
  .replace(/[ً-ٰٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/[ىئ]/g, 'ي').replace(/ؤ/g, 'و');

const src = fs.readFileSync('lib/guess.js', 'utf8');
const pool = src.match(/const POOL = `([\s\S]*?)`/)[1].split(/\s+/).filter(Boolean);

const buckets = {};
const bad = [], dupes = [];
const seen = new Set();
for (const w of pool) {
  const n = normalizeGuess(w);
  if (!/^[ء-ي]+$/.test(n)) { bad.push(w); continue; }
  if (seen.has(n)) dupes.push(w);
  seen.add(n);
  const len = [...n].length;
  (buckets[len] ||= new Set()).add(n);
}
console.log('POOL tokens:', pool.length);
for (const len of Object.keys(buckets).sort()) {
  const used = ['3', '4', '5'].includes(len) ? '' : '  (ignored: not 3/4/5)';
  console.log(`  ${len} letters: ${buckets[len].size}${used}`);
}
console.log('non-Arabic answers:', bad.length ? bad.join(' ') : 'none');
console.log('duplicates after normalization:', dupes.length ? dupes.join(' ') : 'none');

const lines = fs.readFileSync('public/words-ar.txt', 'utf8').split(/\r?\n/).filter(Boolean);
console.log('words-ar.txt lines:', lines.length);
try {
  const head = execSync('git show HEAD:public/words-ar.txt', { encoding: 'utf8', maxBuffer: 1 << 26 })
    .split(/\r?\n/).filter(Boolean);
  const now = new Set(lines);
  console.log(`  vs HEAD: ${head.length} → ${lines.length} (removed ${head.filter(w => !now.has(w)).length})`);
} catch { /* مو داخل git */ }

if (bad.length || dupes.length || (buckets[3]?.size || 0) < 300 || (buckets[5]?.size || 0) < 250) process.exitCode = 1;
