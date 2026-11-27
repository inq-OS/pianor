// Covers ft_1_29.AC2, ft_1_29.AC5.
import { describe, expect, it } from 'vitest';
import chordsJson from '../../../content/trainer/chords.json';
import chordsV1 from '../../../tests/fixtures/content/chords.v1.json';
import type { NoteEvent } from '../judge/types.ts';
import { CHORD_LIVES, CHORD_XP_PER_NOTE, ChordRound, chordLabel, loadChordContent, migrateChordContent, parseChord, wrongKeySpelling, type ChordContent } from './chordTrainer.ts';

const content: ChordContent = loadChordContent(chordsJson);
const on = (midi: number): NoteEvent => ({ kind: 'on', midi, velocity: 90, timeMs: 0, source: 'test' });
const off = (midi: number): NoteEvent => ({ kind: 'off', midi, velocity: 0, timeMs: 0, source: 'test' });
/** A round whose chords are only `names`, in a step of its own. */
const roundOf = (names: string[], seed = 's') => new ChordRound({ ...content, steps: [{ id: 't', nameKey: 'chords.step.c1', chords: names }] }, 0, seed);
/** A round of `names` whose first chord is `first` (the first seed that asks it first). */
const startingWith = (names: string[], first: string) => {
  for (let i = 0; ; i++) {
    const round = roundOf(names, `s${i}`);
    if (round.target().name === first) return round;
  }
};
const press = (round: ChordRound, keys: number[]) => keys.map((k) => round.press(on(k)));

describe('chord content (ft_1_29.AC5)', () => {
  it('loads and checks the dictionary and the steps; every chord of every step is a name the dictionary knows', () => {
    for (const step of content.steps) for (const name of step.chords) expect(() => parseChord(content, name)).not.toThrow();
    expect(content.steps.map((s) => s.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('refuses a step with a chord the dictionary does not know, a step name that is no string key, and a file of another version', () => {
    expect(() => loadChordContent({ ...chordsJson, steps: [{ id: 'x', nameKey: 'chords.step.c1', chords: ['Csus9'] }] })).toThrow(/Csus9/);
    expect(() => loadChordContent({ ...chordsJson, steps: [{ id: 'x', nameKey: 'Triads on white keys', chords: ['C'] }] })).toThrow(/string key/);
    expect(() => loadChordContent({ ...chordsJson, schemaVersion: 3 })).toThrow();
  });

  it('every step is named by a string key, so its name is in the player language', () => {
    expect(content.steps.map((s) => s.nameKey)).toEqual(['chords.step.c1', 'chords.step.c2', 'chords.step.c3']);
  });

  it('reads a version 1 file (small letters for minor, step names as text): minor chords become root and m, step names keys', () => {
    const migrated = migrateChordContent(chordsV1) as ChordContent;
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.qualities.map((q) => q.suffix)).toEqual(['', 'm', '7', 'm7', 'maj7', 'dim', '+', 'm7b5', 'dim7', '6', 'm6']);
    expect(migrated.steps[0]).toEqual({ id: 'c1', nameKey: 'chords.step.c1', chords: ['C', 'F', 'G', 'Am', 'Dm', 'Em'] });
    expect(migrated.steps[1]!.chords.slice(12)).toEqual(['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm']);
    expect(migrated.steps[2]!.chords).toContain('Am7');
    // the file as shipped is the version 1 file migrated, but for its note
    const loaded = loadChordContent(chordsV1);
    expect({ qualities: loaded.qualities, steps: loaded.steps }).toEqual({ qualities: content.qualities, steps: content.steps });
  });
});

describe('parseChord', () => {
  it('reads the root, its sign and the quality: a minor chord is its root and m', () => {
    expect(parseChord(content, 'C')).toMatchObject({ root: { step: 'C', alter: 0 }, quality: 'major', pitchClasses: [0, 4, 7] });
    expect(parseChord(content, 'Am')).toMatchObject({ root: { step: 'A', alter: 0 }, quality: 'minor', pitchClasses: [9, 0, 4] });
    expect(parseChord(content, 'Bb')).toMatchObject({ root: { step: 'B', alter: -1 }, pitchClasses: [10, 2, 5] });
    expect(parseChord(content, 'F#m')).toMatchObject({ quality: 'minor', pitchClasses: [6, 9, 1] });
    expect(parseChord(content, 'G7')).toMatchObject({ quality: 'dominant-seventh', pitchClasses: [7, 11, 2, 5] });
    expect(parseChord(content, 'Dm7')).toMatchObject({ quality: 'minor-seventh', pitchClasses: [2, 5, 9, 0] });
    expect(parseChord(content, 'Fmaj7')).toMatchObject({ quality: 'major-seventh', pitchClasses: [5, 9, 0, 4] });
    expect(parseChord(content, 'Bm7b5')).toMatchObject({ quality: 'half-diminished', pitchClasses: [11, 2, 5, 9] });
  });

  it('a small root letter is no chord name: a child reads it as a note name', () => {
    expect(() => parseChord(content, 'a')).toThrow(/unknown chord/);
    expect(() => parseChord(content, 'd7')).toThrow(/unknown chord/);
  });

  it('labels a chord in the letter naming, with a real flat sign, a minor chord as its root and m', () => {
    expect(chordLabel(parseChord(content, 'Bb'), 'B')).toBe('B♭');
    expect(chordLabel(parseChord(content, 'Bb'), 'H')).toBe('B');
    expect(chordLabel(parseChord(content, 'Bm'), 'H')).toBe('Hm');
    expect(chordLabel(parseChord(content, 'Bbm'), 'B')).toBe('B♭m');
    expect(chordLabel(parseChord(content, 'F#m'), 'B')).toBe('F#m');
    expect(chordLabel(parseChord(content, 'Am7'), 'B')).toBe('Am7');
    expect(chordLabel(parseChord(content, 'Bm7b5'), 'B')).toBe('Bm7♭5');
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

  it('a key still held from the last chord that belongs to the next one counts: a common tone may stay down', () => {
    const round = startingWith(['C', 'Am'], 'C');
    // C E G held; Am shares C and E: keep them down, let G go and press A
    press(round, [60, 64, 67]);
    expect(round.target().name).toBe('Am');
    round.press(off(67));
    expect(round.press(on(69))).toMatchObject({ verdict: 'correct' });
    expect(round.state().solved).toBe(2);
  });

  it('a key still held from the last chord that is not in the next one neither counts nor costs a life', () => {
    const round = startingWith(['C', 'F'], 'C');
    press(round, [60, 64, 67]);
    expect(round.target().name).toBe('F');
    // C is kept (it is in F), E and G stay down too; F and A complete the chord
    expect(round.press(on(65)).verdict).toBe('held');
    expect(round.press(on(69)).verdict).toBe('correct');
    expect(round.state().lives).toBe(CHORD_LIVES);
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
    expect(spelled('Cm', 68)).toBe('Ab');
    expect(spelled('Dm', 61)).toBe('Db');
    expect(spelled('Gm', 66)).toBe('Gb');
    expect(spelled('Bb', 66)).toBe('Gb');
    expect(spelled('Fm7', 66)).toBe('Gb');
  });

  it('ft_1_29.AC2 names it with sharps for a chord on the sharp side, and for C and Am', () => {
    expect(spelled('G', 61)).toBe('C#');
    expect(spelled('Em', 70)).toBe('A#');
    expect(spelled('C', 61)).toBe('C#');
    expect(spelled('Am', 63)).toBe('D#');
    expect(spelled('C#m', 70)).toBe('A#');
  });

  it('ft_1_29.AC2 a white key keeps its letter', () => {
    expect(spelled('Eb', 62)).toBe('D');
  });
});
