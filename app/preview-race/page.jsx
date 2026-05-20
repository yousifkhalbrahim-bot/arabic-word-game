'use client';
import { useState } from 'react';
import { RaceGame } from '@/components/Game';

const MOCK_ENDINGS = ['ام','ان','ار','ال','ير','ون','ين','وم','اب','اح','ام','ان','ار','ال','ير'];

const now = Date.now();

const MOCK_STATE = {
  code: 'DEMO',
  mode: 'race',
  status: 'playing',
  players: {
    1: { name: 'يوسف', joined: true },
    2: { name: 'خالد', joined: true },
  },
  settings: { duration: 120 },
  words_p1: [
    { w: 'حمام',  ts: now - 8000,  ending: 'ام' },
    { w: 'كلام',  ts: now - 16000, ending: 'ام' },
    { w: 'مكان',  ts: now - 24000, ending: 'ان' },
  ],
  words_p2: [
    { w: 'رمان',  ts: now - 7000,  ending: 'ان' },
    { w: 'قطار',  ts: now - 15000, ending: 'ار' },
  ],
  endingQueue: MOCK_ENDINGS,
  currentEndingIndex: 4,
  gameStartedAt: now - 30000,
  winner: null,
  gameNumber: 1,
  resigned: null,
  penalties: { 1: 0, 2: 0 },
  frozenUntil: { 1: null, 2: null },
};

export default function PreviewRacePage() {
  const [roomState, setRoomState] = useState(MOCK_STATE);

  return (
    <RaceGame
      roomState={roomState}
      setRoomState={setRoomState}
      myRole={1}
      roomCode="DEMO"
    />
  );
}
