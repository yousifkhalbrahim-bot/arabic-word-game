'use client';

// ============== كيبورد تحدي النهايات ==============
// نفس كيبورد خمّن الكلمة (شكل الآيفون) + صف الهمزات، ودايم ظاهر — ما تحتاج تضغط على خانة.
// WordBox: مكان الإجابة (يعرض اللي تكتبه بدال خانة الكتابة).
import React, { useCallback, useEffect, useRef } from 'react';
import { GuessKeyboard } from '@/components/GuessGame';

const HAMZAS = ['أ', 'إ', 'آ', 'ؤ', 'ئ'];
const MAX_LEN = 16;
const AR_LETTER = /^[ء-ي]$/;

// يرجّع دالة الضغط، ويربط كيبورد الكمبيوتر بعد
export function useWordTyping({ active = true, setValue, onSubmit }) {
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;
  const onKey = useCallback((k) => {
    if (!active) return;
    if (k === 'ENTER') { submitRef.current?.(); return; }
    if (k === 'BACK') { setValue(v => [...v].slice(0, -1).join('')); return; }
    setValue(v => ([...v].length >= MAX_LEN ? v : v + k));
  }, [active, setValue]);

  useEffect(() => {
    if (!active) return;
    const h = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'Enter') { e.preventDefault(); onKey('ENTER'); }
      else if (e.key === 'Backspace') { e.preventDefault(); onKey('BACK'); }
      else if (AR_LETTER.test(e.key)) { e.preventDefault(); onKey(e.key); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [active, onKey]);

  return onKey;
}

export function WordKeyboard({ onKey, disabled = false }) {
  return <GuessKeyboard keyStates={{}} onKey={onKey} disabled={disabled} extraKeys={HAMZAS} />;
}

// مكان الإجابة: يعرض الكلمة ومؤشر يومض
export function WordBox({ value, placeholder, shake = false, tone = 'normal', className = '', style }) {
  const tones = {
    normal: { background: 'var(--card)', border: '3px solid var(--line)', boxShadow: '0 5px 0 var(--edge)', color: 'var(--ink)' },
    active: { background: 'var(--card)', border: '3px solid #22c55e', boxShadow: '0 5px 0 #15803d', color: 'var(--ink)' },
    frozen: { background: '#e0f2fe', border: '3px solid #7dd3fc', boxShadow: '0 5px 0 #38bdf8', color: '#0c4a6e' },
  };
  return (
    <div className={`flex-1 min-w-0 rounded-2xl px-4 min-h-[56px] flex items-center justify-center font-display font-bold text-xl ${shake ? 'shake' : ''} ${className}`}
      style={{ ...tones[tone], ...style }} dir="rtl" aria-live="polite">
      {value
        ? <span className="truncate">{value}<span className="word-caret" aria-hidden="true" /></span>
        : <span className="truncate opacity-45 text-lg">{placeholder}</span>}
    </div>
  );
}
