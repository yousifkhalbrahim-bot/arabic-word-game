// حالات تجريبية لمعاينة الشاشات بدون سيرفر — تعمل فقط في وضع التطوير
// الاستخدام: http://localhost:3000/?demo=waiting | chess | pending | over-race | over-chess | draw
import { now } from './clock';

const players = {
  1: { name: 'يوسف', joined: true },
  2: { name: 'خالد', joined: true },
};

function chessBase(t) {
  return {
    code: 'DEMO', status: 'playing', version: 1, gameNumber: 1,
    players,
    settings: { timeControlId: 'blitz', initialSeconds: 300, ending: 'ان', turnSkipSeconds: 20 },
    timeRemaining: { 1: 241.4, 2: 187.9 },
    currentTurn: 1, turnStartedAt: t,
    pendingWord: null,
    usedWords: [
      { word: 'زمان', player: 2 }, { word: 'مكان', player: 1 }, { word: 'إنسان', player: 2 },
      { word: 'بستان', player: 1 }, { word: 'ميزان', player: 2 }, { word: 'ريحان', player: 1 },
    ],
    customDict: [], winner: null,
  };
}

function raceBase(t) {
  const w = (list, start) => list.map((x, i) => ({ w: x, ts: start + i * 4000, ending: '' }));
  return {
    code: 'DEMO', mode: 'race', status: 'finished', version: 9, gameNumber: 1,
    players,
    settings: { duration: 60 },
    words_p1: w(['كلام', 'مكان', 'قطار', 'جميل', 'سعيد', 'كريم', 'اقتصاد', 'موجود'], t - 60000),
    words_p2: w(['حمام', 'زمان', 'نهار', 'دليل', 'جديد'], t - 59000),
    endingQueue: ['ام'], currentEndingIndex: 13,
    gameStartedAt: t - 61000,
    winner: 1, resigned: null,
    penalties: { 1: 1, 2: 0 },
    frozenUntil: { 1: null, 2: null },
  };
}

export function demoRoom(name) {
  const t = now();
  switch (name) {
    case 'waiting': {
      const s = chessBase(t);
      return { screen: 'waiting', state: { ...s, status: 'waiting', players: { 1: players[1], 2: { name: '', joined: false } }, usedWords: [] } };
    }
    case 'waiting-race': {
      const s = raceBase(t);
      return { screen: 'waiting', state: { ...s, status: 'waiting', players: { 1: players[1], 2: { name: '', joined: false } }, words_p1: [], words_p2: [] } };
    }
    case 'chess':
      return { screen: 'playing', state: chessBase(t) };
    case 'chess-opp':
      return { screen: 'playing', state: { ...chessBase(t), currentTurn: 2 } };
    case 'pending':
      return { screen: 'playing', state: { ...chessBase(t), currentTurn: 2, pendingWord: { word: 'طوفان', by: 2 } } };
    case 'over-race':
      return { screen: 'gameover', state: raceBase(t) };
    case 'over-chess':
      return { screen: 'gameover', state: { ...chessBase(t), status: 'finished', winner: 2, timeRemaining: { 1: 0, 2: 120 } } };
    case 'draw': {
      const s = raceBase(t);
      return { screen: 'gameover', state: { ...s, winner: 0, penalties: { 1: 3, 2: 0 } } };
    }
    default:
      return null;
  }
}
