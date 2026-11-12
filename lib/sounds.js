import { haptic } from './native';
import { getSetting } from './settings';

let _ctx = null;

function ctx() {
  if (typeof window === 'undefined' || !getSetting('sound')) return null;
  try {
    _ctx = _ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
    return _ctx;
  } catch { return null; }
}

function note(c, freq, type, t, dur, vol = 0.22) {
  try {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.connect(g);
    g.connect(c.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  } catch {}
}

export function playAccept() {
  haptic('light');
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  note(c, 587, 'sine', t,        0.12, 0.2);
  note(c, 784, 'sine', t + 0.09, 0.12, 0.2);
  note(c, 1047,'sine', t + 0.18, 0.2,  0.15);
}

export function playReject() {
  haptic('error');
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.connect(g); g.connect(c.destination);
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.22);
  g.gain.setValueAtTime(0.15, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  osc.start(t); osc.stop(t + 0.27);
}

export function playSkip() {
  haptic('medium');
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.connect(g); g.connect(c.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(480, t);
  osc.frequency.exponentialRampToValueAtTime(160, t + 0.28);
  g.gain.setValueAtTime(0.16, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  osc.start(t); osc.stop(t + 0.33);
}

export function playTick() {
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  note(c, 1100, 'square', t, 0.035, 0.06);
}

export function playGameOver() {
  haptic('warning');
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  [523, 659, 784, 1047].forEach((f, i) => {
    note(c, f, 'sine', t + i * 0.13, 0.35, 0.18);
  });
}

export function playStreak() {
  haptic('success');
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  [523, 659, 784, 1047, 1319].forEach((f, i) => {
    note(c, f, 'sine', t + i * 0.07, 0.18, 0.22);
  });
}

export function playFreeze() {
  haptic('heavy');
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  note(c, 880, 'sine', t, 0.3, 0.18);
  note(c, 440, 'sine', t + 0.1, 0.35, 0.16);
  note(c, 220, 'sine', t + 0.22, 0.4, 0.14);
}

export function playSteal() {
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  note(c, 300, 'sawtooth', t, 0.08, 0.18);
  note(c, 600, 'sine', t + 0.09, 0.12, 0.22);
  note(c, 900, 'sine', t + 0.18, 0.1, 0.18);
}

export function playWordAppear() {
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  note(c, 660,  'sine', t,        0.055, 0.28, 0.18);
  note(c, 990,  'sine', t + 0.04, 0.07,  0.22, 0.14);
  note(c, 1320, 'sine', t + 0.08, 0.09,  0.18, 0.1);
}

export function playYourTurn() {
  haptic('medium');
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  note(c, 880, 'sine', t, 0.09, 0.2);
  note(c, 1175, 'sine', t + 0.1, 0.14, 0.2);
}

// ============== أصوات خمّن الكلمة ==============
// نقرة خفيفة مع كل حرف
export function playKey() {
  const c = ctx(); if (!c) return;
  note(c, 520 + Math.random() * 60, 'triangle', c.currentTime, 0.04, 0.07);
}

// صوت لكل مربع وقت ما يتقلّب (يتزامن مع الحركة)
export function playReveal(result, flipMs = 260) {
  const c = ctx(); if (!c) return;
  const t0 = c.currentTime;
  result.forEach((r, i) => {
    const t = t0 + (i * flipMs + flipMs) / 1000;
    if (r === 'correct') { note(c, 784 + i * 60, 'sine', t, 0.16, 0.2); note(c, 1175 + i * 90, 'sine', t + 0.02, 0.12, 0.08); }
    else if (r === 'present') note(c, 587 + i * 30, 'triangle', t, 0.14, 0.16);
    else note(c, 196, 'sine', t, 0.1, 0.14);
  });
}

// مقطوعة الفوز
export function playWin() {
  haptic('success');
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  [523, 659, 784, 1047].forEach((f, i) => note(c, f, 'square', t + i * 0.09, 0.12, 0.09));
  [1047, 1319, 1568].forEach(f => note(c, f, 'sine', t + 0.4, 0.7, 0.13));
  note(c, 523, 'triangle', t + 0.4, 0.8, 0.12);
  [2093, 2637, 3136].forEach((f, i) => note(c, f, 'sine', t + 0.5 + i * 0.07, 0.15, 0.04));
}

// خسارة (بدون إحباط زيادة)
export function playLose() {
  haptic('warning');
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  [392, 349, 311, 262].forEach((f, i) => note(c, f, 'triangle', t + i * 0.14, 0.22, 0.13));
}
