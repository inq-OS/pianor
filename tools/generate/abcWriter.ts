import { abcPitch, midiToSpelling } from '../../src/core/chart/index.ts';
import type { Draft, DraftVoice, Hand, Slot } from './model.ts';

/** An ABC note for a MIDI number: C4 is `C`, C5 is `c`, C3 is `C,`. Only natural notes (the key of C). */
export function abcPitchOfMidi(midi: number): string {
  const { step, alter, octave } = midiToSpelling(midi);
  if (alter !== 0) throw new Error(`MIDI ${midi} needs an accidental, which the generators do not write`);
  return abcPitch(step, octave);
}

/** The length suffix for a unit of `L:1/4`: 1 is nothing, 2 is `2`, an eighth is `/2`. */
function abcLength(beats: number): string {
  if (beats === 1) return '';
  if (beats === 0.5) return '/2';
  if (Number.isInteger(beats)) return String(beats);
  throw new Error(`a length of ${beats} beats cannot be written`);
}

/** The finger for a note of a hand: its MIDI number and its place among the hand's sounding notes (0 first). */
export type FingerFor = (hand: Hand, midi: number, index: number) => number | undefined;

function abcBar(slots: readonly Slot[], barBeats: number, hand: Hand, fingerFor: FingerFor, counter: { next: number }): string {
  if (slots.length === 1 && slots[0]!.midi === null && slots[0]!.beats === barBeats) return 'Z';
  return slots
    .map((slot) => {
      if (slot.midi === null) return `z${abcLength(slot.beats)}`;
      const finger = fingerFor(hand, slot.midi, counter.next++);
      return `${finger === undefined ? '' : `!${finger}!`}${abcPitchOfMidi(slot.midi)}${abcLength(slot.beats)}`;
    })
    .join(' ');
}

function abcVoice(voice: DraftVoice, barBeats: number, fingerFor: FingerFor): string {
  const counter = { next: 0 };
  return `${voice.bars.map((bar) => abcBar(bar, barBeats, voice.hand, fingerFor, counter)).join(' | ')} |]`;
}

/**
 * ABC text for a draft: the header, a comment line, and one line of music per hand (right hand first). Fingers come from
 * `fingerFor`; a note it has no finger for is written without one. The text is what a person would write by hand, so the
 * same compiler, linter and preview read it.
 */
export function writeAbc(draft: Draft, fingerFor: FingerFor): string {
  const barBeats = (draft.meter.num * 4) / draft.meter.den;
  const lines = ['X:1', `T:${draft.title}`, `M:${draft.meter.num}/${draft.meter.den}`, 'L:1/4', `Q:1/4=${draft.bpm}`, 'K:C', `% ${draft.comment}`];
  const voices = [...draft.voices].sort((a, b) => (a.hand === b.hand ? 0 : a.hand === 'RH' ? -1 : 1));
  if (voices.length === 1) {
    lines.push(abcVoice(voices[0]!, barBeats, fingerFor));
  } else {
    for (const v of voices) lines.push(`V:${v.hand} clef=${v.hand === 'RH' ? 'treble' : 'bass'}`);
    for (const v of voices) lines.push(`V:${v.hand}`, abcVoice(v, barBeats, fingerFor));
  }
  return `${lines.join('\n')}\n`;
}
