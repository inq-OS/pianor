// Covers ft_1_29.AC2, ft_1_29.AC5.
import { describe, expect, it } from 'vitest';
import chordsJson from '../../../content/trainer/chords.json';
import type { NoteEvent } from '../judge/types.ts';
import { CHORD_LIVES, CHORD_XP_PER_NOTE, ChordRound, chordLabel, loadChordContent, parseChord, wrongKeySpelling, type ChordContent } from './chordTrainer.ts';

const content: ChordContent = loadChordContent(chordsJson);
const on = (midi: number): NoteEvent => ({ kind: 'on', midi, velocity: 90, timeMs: 0, source: 'test' });
const off = (midi: number): NoteEvent => ({ kind: 'off', midi, velocity: 0, timeMs: 0, source: 'test' });
/** A round whose chords are only `names`, in a step of its own. */
const roundOf = (names: string[], seed = 's') => new ChordRound({ ...content, steps: [{ id: 't', name: 't', chords: names }] }, 0, seed);
const press = (round: ChordRound, keys: number[]) => keys.map((k) => round.press(on(k)));

describe('chord content (ft_1_29.AC5)', () => {
  it('loads and checks the dictionary and the steps; every chord of every step is a name the dictionary knows', () => {
    for (const step of content.steps) for (const name of step.chords) expect(() => parseChord(content, name)).not.toThrow();
    expect(content.steps.map((s) => s.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('refuses a step with a chord the dictionary does not know, and a file of another version', () => {
    expect(() => loadChordContent({ ...chordsJson, steps: [{ id: 'x', name: 'x', chords: ['Csus9'] }] })).toThrow(/Csus9/);
    expect(() => loadChordContent({ ...chordsJson, schemaVersion: 2 })).toThrow();
  });
});

describe('parseChord', () => {
  it('reads the root, its sign and the quality: a capital is major, a small letter minor', () => {
    expect(parseChord(content, 'C')).toMatchObject({ root: { step: 'C', alter: 0 }, quality: 'major', pitchClasses: [0, 4, 7] });
    expect(parseChord(content, 'a')).toMatchObject({ root: { step: 'A', alter: 0 }, quality: 'minor', pitchClasses: [9, 0, 4] });
    expect(parseChord(content, 'Bb')).toMatchObject({ root: { step: 'B', alter: -1 }, pitchClasses: [10, 2, 5] });
    expect(parseChord(content, 'f#')).toMatchObject({ quality: 'minor', pitchClasses: [6, 9, 1] });
    expect(parseChord(content, 'G7')).toMatchObject({ quality: 'dominant-seventh', pitchClasses: [7, 11, 2, 5] });
    expect(parseChord(content, 'd7')).toMatchObject({ quality: 'minor-seventh', pitchClasses: [2, 5, 9, 0] });
    expect(parseChord(content, 'Fmaj7')).toMatchObject({ quality: 'major-seventh', pitchClasses: [5, 9, 0, 4] });
  });

  it('labels a chord in the letter naming, with a real flat sign', () => {
    expect(chordLabel(parseChord(content, 'Bb'), 'B')).toBe('B♭');
    expect(chordLabel(parseChord(content, 'Bb'), 'H')).toBe('B');
    expect(chordLabel(parseChord(content, 'b'), 'H')).toBe('h');
    expect(chordLabel(parseChord(content, 'f#'), 'B')).toBe('f#');
    expect(chordLabel(parseChord(content, 'Cmaj7'), 'B')).toBe('Cmaj7');
  });
});

describe('ChordRound (ft_1_29.AC2)', () => {
  it('accepts the chord in any inversion and octave, only once all its notes are held together', () => {
    for (const keys of [[60, 64, 67], [64, 67, 72], [55, 60, 76], [43, 52, 84]]) {
      const round = roundOf(['C']);
      const results = press(round, keys);
      expect(results.slice(0, -1).map((r) => r.verdict)).toEqual(['held', 'held']);
      expect(results.at(-1)!.verdict).toBe('correct');
      expect(round.state()).toMatchObject({ solved: 1, xp: 3 * CHORD_XP_PER_NOTE, lives: CHORD_LIVES });
    }
  });

  it('a note let go before the chord is complete must be pressed again', () => {
    const round = roundOf(['C']);
    press(round, [60, 64]);
    round.press(off(60));
    expect(round.press(on(67)).verdict).toBe('held');
    expect(round.press(on(48)).verdict).toBe('correct');
  });

  it('a doubled note is fine; a seventh chord needs its four notes', () => {
    const round = roundOf(['G7']);
    expect(press(round, [43, 55, 59, 62]).map((r) => r.verdict)).toEqual(['held', 'held', 'held', 'held']);
    expect(round.press(on(65)).verdict).toBe('correct');
  });

  it('a wrong note costs a life and names itself; the third ends the round and keeps the XP', () => {
    const round = roundOf(['C', 'G']);
    press(round, [60, 64, 67]);
    const target = round.target();
    const outside = [61, 63, 66, 68, 70].find((k) => !target.pitchClasses.includes(k % 12))!;
    expect(round.press(on(outside))).toMatchObject({ verdict: 'wrong', midi: outside });
    expect(round.state().lives).toBe(CHORD_LIVES - 1);
    round.press(off(outside));
    round.press(on(outside));
    round.press(off(outside));
    round.press(on(outside));
    expect(round.state()).toMatchObject({ lives: 0, over: true, xp: 3 * CHORD_XP_PER_NOTE });
    expect(round.press(on(target.pitchClasses[0]! + 60)).verdict).toBe('over');
  });

  it('keys still down from the last chord do not count for the next one', () => {
    const round = roundOf(['C', 'a']);
    const first = round.target();
    press(round, first.pitchClasses.map((pc) => 60 + pc));
    const second = round.target();
    expect(second.name).not.toBe(first.name);
    // C major and a minor share C and E: with those still held from the first chord, the new note alone is not the chord
    const fresh = second.pitchClasses.filter((pc) => !first.pitchClasses.includes(pc));
    const shared = second.pitchClasses.filter((pc) => first.pitchClasses.includes(pc));
    expect(press(round, fresh.map((pc) => 72 + pc)).map((r) => r.verdict)).toEqual(['held']);
    expect(press(round, shared.map((pc) => 72 + pc)).map((r) => r.verdict)).toEqual(['held', 'correct']);
  });

  it('never asks the same chord twice in a row when the step has another, and the same seed asks the same chords', () => {
    const names = (seed: string) => {
      const round = roundOf(['C', 'F', 'G'], seed);
      const asked: string[] = [];
      for (let i = 0; i < 12; i++) {
        const chord = round.target();
        asked.push(chord.name);
        const root = chord.pitchClasses.map((pc) => 60 + pc);
        press(round, root);
        for (const k of root) round.press(off(k));
      }
      return asked;
    };
    const asked = names('seed');
    for (let i = 1; i < asked.length; i++) expect(asked[i]).not.toBe(asked[i - 1]);
    expect(names('seed')).toEqual(asked);
  });
});

describe('wrongKeySpelling (ft_1_29.AC2)', () => {
  const spelled = (chord: string, midi: number) => {
    const s = wrongKeySpelling(parseChord(content, chord), midi);
    return `${s.step}${s.alter < 0 ? 'b' : s.alter > 0 ? '#' : ''}`;
  };

  it('ft_1_29.AC2 names a wrong black key with flats for a chord on the flat side of the circle of fifths', () => {
    expect(spelled('F', 61)).toBe('Db');
    expect(spelled('c', 68)).toBe('Ab');
    expect(spelled('d', 61)).toBe('Db');
    expect(spelled('g', 66)).toBe('Gb');
    expect(spelled('Bb', 66)).toBe('Gb');
    expect(spelled('f7', 66)).toBe('Gb');
  });

  it('ft_1_29.AC2 names it with sharps for a chord on the sharp side, and for C and a', () => {
    expect(spelled('G', 61)).toBe('C#');
    expect(spelled('e', 70)).toBe('A#');
    expect(spelled('C', 61)).toBe('C#');
    expect(spelled('a', 63)).toBe('D#');
    expect(spelled('c#', 70)).toBe('A#');
  });

  it('ft_1_29.AC2 a white key keeps its letter', () => {
    expect(spelled('Eb', 62)).toBe('D');
  });
});
