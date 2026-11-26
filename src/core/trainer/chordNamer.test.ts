// Covers ft_1_29.AC4.
import { describe, expect, it } from 'vitest';
import chordsJson from '../../../content/trainer/chords.json';
import { chordLabel, loadChordContent } from './chordTrainer.ts';
import { nameChord, staffChordName } from './chordNamer.ts';
import { parseNoteName } from '../chart/pitch.ts';

const content = loadChordContent(chordsJson);
const SYMMETRIC = new Set(['augmented', 'diminished-seventh']);
/** The seventh chord whose third-in-the-bass inversion is this sixth chord's root position, and back. */
const SIXTH_OF: Record<string, string> = { 'minor-seventh': 'major-sixth', 'half-diminished': 'minor-sixth' };
const SEVENTH_OF: Record<string, string> = { 'major-sixth': 'minor-seventh', 'minor-sixth': 'half-diminished' };
const sameSet = (a: readonly number[], b: readonly number[]) => [...new Set(a)].sort().join() === [...new Set(b)].sort().join();

describe('nameChord (ft_1_29.AC4)', () => {
  it('names every triad and seventh chord of the dictionary, from every root, in every inversion and spread', () => {
    for (const quality of content.qualities) {
      for (let root = 0; root < 12; root++) {
        const pcs = quality.intervals.map((i) => (root + i) % 12);
        for (let inversion = 0; inversion < pcs.length; inversion++) {
          const order = [...pcs.slice(inversion), ...pcs.slice(0, inversion)];
          // close position from octave 3, and an open spread with the notes an octave apart in turn
          const close = order.reduce<number[]>((keys, pc) => {
            const last = keys.at(-1) ?? 47;
            let key = 48 + pc;
            while (key <= last) key += 12;
            return [...keys, key];
          }, []);
          const open = close.map((k, i) => k + (i % 2) * 12);
          // a sixth chord has the notes of a seventh chord a third under it (C6 is a7, c6 is a7b5): it is the sixth chord only
          // over its own root, and the seventh chord with that seventh chord's root or third in the bass
          const sixth = SIXTH_OF[quality.id];
          const expected = sixth && inversion === 1 ? { quality: sixth, root: pcs[1]! } : SEVENTH_OF[quality.id] && inversion > 0 ? { quality: SEVENTH_OF[quality.id]!, root: pcs[3]! } : { quality: quality.id, root };
          for (const keys of [close, open, [...close].reverse()]) {
            const chord = nameChord(content, keys);
            expect(chord, `${quality.id} on ${root}, inversion ${inversion}`).not.toBeNull();
            expect(chord!.quality, `${quality.id} on ${root}, inversion ${inversion}`).toBe(expected.quality);
            expect(sameSet(chord!.pitchClasses, pcs)).toBe(true);
            if (!SYMMETRIC.has(quality.id)) expect((STEP_PC[chord!.root.step]! + chord!.root.alter + 12) % 12).toBe(expected.root);
          }
        }
      }
    }
  });

  it('a symmetric chord is named from its lowest note', () => {
    expect(chordLabel(nameChord(content, [64, 68, 72])!, 'B')).toBe('E+');
    expect(chordLabel(nameChord(content, [57, 60, 63, 66])!, 'B')).toBe('adim7');
  });

  it('spells the names as a teacher writes them: C, a, F# or f#, Bb, e7♭5', () => {
    expect(nameChord(content, [60, 64, 67])!.name).toBe('C');
    expect(nameChord(content, [57, 60, 64])!.name).toBe('a');
    expect(nameChord(content, [58, 62, 65])!.name).toBe('Bb');
    expect(nameChord(content, [54, 57, 61])!.name).toBe('f#');
    expect(chordLabel(nameChord(content, [52, 55, 58, 62])!, 'B')).toBe('e7♭5');
    expect(chordLabel(nameChord(content, [59, 62, 66])!, 'H')).toBe('h');
  });

  it('ft_1_29.AC4 names a sixth chord over its root, and the seventh chord with the same notes over that root', () => {
    expect(nameChord(content, [60, 64, 67, 69])!.name).toBe('C6');
    expect(nameChord(content, [65, 69, 72, 74])!.name).toBe('F6');
    expect(nameChord(content, [60, 63, 67, 69])!.name).toBe('c6');
    expect(nameChord(content, [57, 60, 64, 67])!.name).toBe('a7');
    expect(nameChord(content, [57, 60, 63, 67])!.name).toBe('a7b5');
    expect(nameChord(content, [62, 65, 69, 72])!.name).toBe('d7');
  });

  it('ft_1_29.AC4 spells the root as the chord\'s notes are written', () => {
    const written = (keys: number[], names: string[]) => nameChord(content, keys, { spellings: names.map(parseNoteName) })!.name;
    expect(written([63, 66, 70], ['D#4', 'F#4', 'A#4'])).toBe('d#');
    expect(written([66, 70, 73], ['Gb4', 'Bb4', 'Db5'])).toBe('Gb');
    expect(written([61, 65, 68], ['C#4', 'E#4', 'G#4'])).toBe('C#');
    expect(written([58, 61, 64], ['A#3', 'C#4', 'E4'])).toBe('a#dim');
    expect(written([59, 63, 66], ['Cb4', 'Eb4', 'Gb4'])).toBe('Cb');
    // the spelling of the chord's root counts, whatever order the notes come in
    expect(written([70, 66, 73], ['Bb4', 'Gb4', 'Db5'])).toBe('Gb');
  });

  it('ft_1_29.AC4 spells the root from the key when the notes are not written', () => {
    const inKey = (keys: number[], fifths: number) => nameChord(content, keys, { fifths })!.name;
    expect(inKey([66, 70, 73], -6)).toBe('Gb');
    expect(inKey([59, 63, 66], -7)).toBe('Cb');
    expect(inKey([61, 65, 68], 7)).toBe('C#');
    expect(inKey([63, 66, 70], 6)).toBe('d#');
    expect(inKey([58, 61, 65], 7)).toBe('a#');
    expect(inKey([56, 59, 63], -7)).toBe('ab');
    // a root outside the key's scale leans to the key's side
    expect(inKey([61, 65, 68], -1)).toBe('Db');
    expect(inKey([63, 67, 70], 2)).toBe('D#');
  });

  it('ft_1_29.AC4 keeps the taught spelling when neither the notes nor a key tell it', () => {
    expect(nameChord(content, [66, 70, 73])!.name).toBe('F#');
    expect(nameChord(content, [63, 66, 70])!.name).toBe('eb');
    expect(nameChord(content, [63, 66, 70], { fifths: 0 })!.name).toBe('eb');
    // a root written with two signs has no chord name (F double sharp): the taught spelling stands
    expect(nameChord(content, [67, 70, 73], { spellings: ['F##4', 'A#4', 'C#5'].map(parseNoteName) })!.name).toBe('gdim');
  });

  it('says nothing for a set it does not know, for fewer than three different notes, and for no keys', () => {
    expect(nameChord(content, [60, 61, 62])).toBeNull();
    expect(nameChord(content, [60, 64])).toBeNull();
    expect(nameChord(content, [60, 72, 84])).toBeNull();
    expect(nameChord(content, [])).toBeNull();
    expect(nameChord(content, [60, 64, 67, 69, 71])).toBeNull();
  });
});

const STEP_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

describe('staffChordName (core_09.AC59)', () => {
  const named = (keys: number[], naming: 'B' | 'H' = 'B') => staffChordName(nameChord(content, keys)!, naming);

  it('core_09.AC59 writes the name as the staff labels write notes: b for a flat, a small letter for a minor chord, and the naming setting', () => {
    expect(named([60, 64, 67])).toBe('C');
    expect(named([60, 63, 66, 70])).toBe('c7b5');
    expect(named([63, 67, 70])).toBe('Eb');
    expect(named([58, 62, 65])).toBe('Bb');
    expect(named([58, 62, 65], 'H')).toBe('B');
    expect(named([59, 63, 66], 'H')).toBe('H');
    expect(named([55, 59, 62, 65])).toBe('G7');
  });
});
