import { isWhiteKey } from '../chart/pitch';
import type { WrongReason } from './types';

function nextWhiteKey(midi: number, direction: 1 | -1): number {
  let key = midi + direction;
  while (!isWhiteKey(key)) key += direction;
  return key;
}

export interface WrongNoteDiagnosis {
  expectedMidi: number;
  reason: WrongReason;
  direction: 'higher' | 'lower';
}

/**
 * Explain a wrong key against the awaited notes (the closest one is used; the lower one on a tie).
 * - wrong-octave: right letter, other octave
 * - neighbour-key: the key right next to it, black or white
 * - wrong-letter: anything else
 */
export function classifyWrongNote(played: number, awaiting: readonly number[]): WrongNoteDiagnosis {
  const expectedMidi = awaiting.reduce((best, m) => {
    const d = Math.abs(played - m);
    const bestD = Math.abs(played - best);
    return d < bestD || (d === bestD && m < best) ? m : best;
  });
  const diff = played - expectedMidi;
  const direction = diff > 0 ? 'higher' : 'lower';
  let reason: WrongReason;
  if (diff % 12 === 0) reason = 'wrong-octave';
  else if (Math.abs(diff) === 1) reason = 'neighbour-key';
  else if (isWhiteKey(played) && isWhiteKey(expectedMidi) && played === nextWhiteKey(expectedMidi, diff > 0 ? 1 : -1)) reason = 'neighbour-key';
  else reason = 'wrong-letter';
  return { expectedMidi, reason, direction };
}
