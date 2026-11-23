// Covers ft_1_29.AC4.
import { describe, expect, it } from 'vitest';
import chordsJson from '../../../content/trainer/chords.json';
import { chordLabel, loadChordContent } from './chordTrainer.ts';
import { nameChord } from './chordNamer.ts';

const content = loadChordContent(chordsJson);
const SYMMETRIC = new Set(['augmented', 'diminished-seventh']);
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
          for (const keys of [close, open, [...close].reverse()]) {
            const chord = nameChord(content, keys);
            expect(chord, `${quality.id} on ${root}, inversion ${inversion}`).not.toBeNull();
            expect(chord!.quality).toBe(quality.id);
            expect(sameSet(chord!.pitchClasses, pcs)).toBe(true);
            if (!SYMMETRIC.has(quality.id)) expect((STEP_PC[chord!.root.step]! + chord!.root.alter + 12) % 12).toBe(root);
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

  it('says nothing for a set it does not know, for fewer than three different notes, and for no keys', () => {
    expect(nameChord(content, [60, 61, 62])).toBeNull();
    expect(nameChord(content, [60, 64])).toBeNull();
    expect(nameChord(content, [60, 72, 84])).toBeNull();
    expect(nameChord(content, [])).toBeNull();
    expect(nameChord(content, [60, 64, 67, 69, 71])).toBeNull();
  });
});

const STEP_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
