// Covers ft_0_12.AC3.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chartSchema } from '../../src/core/chart';
import { melodiesOf, referenceWindows, sharesWindow, windowKeys, type MelodyNote } from './similarity';

const golden = (name: string) => chartSchema.parse(JSON.parse(readFileSync(join(__dirname, `../../tests/golden/${name}.chart.json`), 'utf-8')));

const melody = (pitches: number[], beats: number | number[] = 1): MelodyNote[] =>
  pitches.map((midi, i) => ({ midi, beats: Array.isArray(beats) ? beats[i]! : beats }));

describe('windowKeys', () => {
  it('makes one key for each run of eight notes', () => {
    expect(windowKeys(melody([60, 62, 64, 65, 67, 65, 64, 62]))).toHaveProperty('size', 1);
    expect(windowKeys(melody([60, 62, 64, 65, 67, 65, 64, 62, 60]))).toHaveProperty('size', 2);
    expect(windowKeys(melody([60, 62, 64]))).toHaveProperty('size', 0);
    expect(windowKeys(melody([60, 62, 64, 62]), 3)).toHaveProperty('size', 2);
  });

  it('is the same for the same tune in another place on the scale, since only the steps between notes count', () => {
    const up = melody([60, 62, 64, 65, 67, 65, 64, 62]);
    const moved = melody([62, 64, 65, 67, 69, 67, 65, 64]); // the same steps of the scale, a step higher
    expect([...windowKeys(up)]).toEqual([...windowKeys(moved)]);
    const octave = melody(up.map((n) => n.midi - 12));
    expect([...windowKeys(up)]).toEqual([...windowKeys(octave)]);
  });

  it('is different when a step differs or a note length differs', () => {
    const base = melody([60, 62, 64, 65, 67, 65, 64, 62]);
    expect([...windowKeys(melody([60, 62, 64, 65, 67, 65, 64, 64]))]).not.toEqual([...windowKeys(base)]);
    expect([...windowKeys(melody([60, 62, 64, 65, 67, 65, 64, 62], [1, 1, 1, 1, 1, 1, 1, 2]))]).not.toEqual([...windowKeys(base)]);
  });
});

describe('sharesWindow', () => {
  const tune = melody([64, 64, 65, 67, 67, 65, 64, 62, 60, 60]);

  it('finds a run of eight notes that also appears in a known melody', () => {
    const avoid = windowKeys(tune);
    expect(sharesWindow(melody([64, 64, 65, 67, 67, 65, 64, 62]), avoid)).toBe(true);
    expect(sharesWindow(melody([60, 60, 61 + 1, 64, 64, 62, 60, 59 + 1, 62, 64]), avoid)).toBe(false);
  });

  it('finds it in the middle of a longer piece, and not when the pieces only share seven notes', () => {
    const avoid = windowKeys(tune);
    expect(sharesWindow(melody([60, 60, 60, ...tune.map((n) => n.midi)]), avoid)).toBe(true);
    expect(sharesWindow(melody([64, 64, 65, 67, 67, 65, 64, 64, 60, 60]), avoid)).toBe(false);
  });

  it('is false when there is nothing to avoid', () => {
    expect(sharesWindow(tune, new Set())).toBe(false);
  });
});

describe('melodiesOf and referenceWindows', () => {
  it('gives one melody for each hand the player plays, in time order', () => {
    const melodies = melodiesOf(golden('hands-together'));
    expect(melodies).toHaveLength(2);
    expect(melodies.map((m) => m.length).sort()).toEqual([5, 6]);
    expect(melodies[0]!.every((n) => n.beats > 0)).toBe(true);
  });

  it('collects the windows of every melody of every chart', () => {
    const windows = referenceWindows([golden('little-steps'), golden('hands-together')], 4);
    expect(windows.size).toBeGreaterThan(3);
    const little = melodiesOf(golden('little-steps'))[0]!;
    expect(sharesWindow(little.slice(2, 8), windows, 4)).toBe(true);
  });
});
