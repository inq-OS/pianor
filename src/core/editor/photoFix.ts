/**
 * The photo tool's fixes for what the reading of a photo most often gets wrong (ft_Y_04 slice 5, AC18): a key signature
 * missed or misread, and a staff read in the wrong clef. They are made before the piece opens in the piece maker, from
 * what the person sees on the sheet. Pure.
 */
import { keyAlters, type Alter } from '../chart/key';
import { STEPS, type Step } from '../chart/pitch';
import { KEY_HIGH, KEY_LOW, handsOf, soundingMidi, type EditorHand, type EditorNote, type EditorPiece } from './model';
import type { KeyMode } from './key';

/** A treble staff read as bass, or the other way round: the same line is twelve letters apart (E4 and G2 on the bottom line). */
export const CLEF_STEPS = 12;

type Pitch = Pick<EditorNote, 'step' | 'octave' | 'alter'>;

/** A pitch with the alter the key gave it taken over by the new key; an accidental of its own stays. */
function rekeyed<P extends Pitch>(p: P, from: Record<Step, Alter>, to: Record<Step, Alter>): P {
  return p.alter === from[p.step] ? { ...p, alter: to[p.step] } : p;
}

/**
 * The piece in another key, as if the signature had been read right: every note that took the old key's sharp, flat or
 * natural takes the new key's, and a note with an accidental of its own keeps it.
 */
export function rekey(piece: EditorPiece, fifths: number, mode: KeyMode): EditorPiece {
  const from = keyAlters(piece.fifths);
  const to = keyAlters(fifths);
  const notes = piece.notes.map((n) => {
    const note = rekeyed(n, from, to);
    return n.grace ? { ...note, grace: rekeyed(n.grace, from, to) } : note;
  });
  return { ...piece, fifths, mode, notes };
}

/** A pitch moved by whole letters, keeping how far it is from the key's alter. */
function moved<P extends Pitch>(p: P, steps: number, key: Record<Step, Alter>): P {
  const index = STEPS.indexOf(p.step) + p.octave * STEPS.length + steps;
  const step = STEPS[((index % STEPS.length) + STEPS.length) % STEPS.length]!;
  const own = p.alter - key[p.step];
  const alter = Math.max(-1, Math.min(1, key[step] + own)) as Alter;
  return { ...p, step, octave: Math.floor(index / STEPS.length), alter };
}

/**
 * One hand's notes as if its staff had been read in the other clef: up (`1`: a treble staff read as bass, its notes came
 * out too low) or down (`-1`: a bass staff read as treble) by twelve letters. Null when a note would leave the keyboard.
 */
export function reclef(piece: EditorPiece, hand: EditorHand, direction: 1 | -1): EditorPiece | null {
  const key = keyAlters(piece.fifths);
  const notes = piece.notes.map((n) => {
    if (n.hand !== hand) return n;
    const note = moved(n, direction * CLEF_STEPS, key);
    return n.grace ? { ...note, grace: moved(n.grace, direction * CLEF_STEPS, key) } : note;
  });
  const out = notes.some((n) => n.hand === hand && (soundingMidi(n) < KEY_LOW || soundingMidi(n) > KEY_HIGH));
  return out ? null : { ...piece, notes };
}

/** Each hand's lowest and highest note, for the hands that have notes: a hand read in the wrong clef sits far off. */
export function handRanges(piece: EditorPiece): { hand: EditorHand; low: Pitch; high: Pitch }[] {
  return handsOf(piece).flatMap((hand) => {
    const notes = piece.notes.filter((n) => n.hand === hand).sort((a, b) => soundingMidi(a) - soundingMidi(b));
    const low = notes[0];
    const high = notes[notes.length - 1];
    return low && high ? [{ hand, low: pitchOf(low), high: pitchOf(high) }] : [];
  });
}

function pitchOf(n: Pitch): Pitch {
  return { step: n.step, octave: n.octave, alter: n.alter };
}
