import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Random } from '../../src/core/random';
import { loadLevelsFile } from '../piece/levels';
import { join } from 'node:path';
import { allowedBeats, beatsPerBar, composeBar, composeCadence, fitRhythm, handNotes, NoFit, shiftDegrees, walkTo } from './theory';

const { levels } = loadLevelsFile(join(__dirname, '../../content/curriculum/levels.json'));
const level = (n: number) => levels.find((l) => l.level === n)!;

describe('handNotes', () => {
  it('is the hand position the level fingers: C4 to G4 for the right hand, C3 to G3 for the left', () => {
    expect(handNotes(level(1), 'RH', 'position')).toEqual([60, 62, 64, 65, 67]);
    expect(handNotes(level(2), 'LH', 'position')).toEqual([48, 50, 52, 53, 55]);
    expect(handNotes(level(4), 'LH', 'position')).toEqual([48, 50, 52, 53, 55]);
  });

  it('is every natural note of the hand\'s side of middle C within the level range, for a scale', () => {
    expect(handNotes(level(5), 'RH', 'register')).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    expect(handNotes(level(5), 'LH', 'register')).toEqual([48, 50, 52, 53, 55, 57, 59, 60]);
    expect(handNotes(level(1), 'RH', 'register')).toEqual([60, 62, 64, 65, 67]);
  });

  it('uses the register when the level lists no fingering for the hand', () => {
    const bare = { ...level(5), fingerings: {} };
    expect(handNotes(bare, 'RH', 'position')).toEqual(handNotes(bare, 'RH', 'register'));
  });
});

describe('beats and note lengths', () => {
  it('counts quarter notes in a bar', () => {
    expect(beatsPerBar({ num: 4, den: 4 })).toBe(4);
    expect(beatsPerBar({ num: 3, den: 4 })).toBe(3);
    expect(beatsPerBar({ num: 2, den: 4 })).toBe(2);
  });

  it('allows what the level allows and no note longer than the bar', () => {
    expect(allowedBeats(level(1), 4)).toEqual([1, 2, 4]);
    expect(allowedBeats(level(1), 3)).toEqual([1, 2]);
    expect(allowedBeats(level(5), 4)).toEqual([0.5, 1, 2, 4]);
    expect(allowedBeats(level(5), 4, { eighths: false })).toEqual([1, 2, 4]);
    expect(allowedBeats(level(5), 2)).toEqual([0.5, 1, 2]);
  });
});

describe('composeBar', () => {
  it('fills the bar exactly with allowed lengths that start where they should (property)', () => {
    fc.assert(
      fc.property(fc.constantFrom(1, 3, 5), fc.constantFrom(2, 3, 4), fc.integer(), fc.boolean(), (lv, beats, seed, rests) => {
        const allowed = allowedBeats(level(lv), beats, { eighths: true });
        const bar = composeBar(new Random(seed), beats, allowed, { rests: rests && level(lv).rests });
        expect(bar.reduce((sum, s) => sum + s.beats, 0)).toBe(beats);
        let at = 0;
        for (const s of bar) {
          expect(allowed).toContain(s.beats);
          if (s.beats === 2) expect(at % 2 === 0 || (beats === 3 && at === 1)).toBe(true); // a half note starts on a strong beat (in 3/4 also on beat 2)
          if (s.beats === 4) expect(at).toBe(0);
          if (s.beats === 0.5) expect(at % 0.5).toBe(0);
          at += s.beats;
        }
        // eighths come in pairs on a beat
        let run = 0;
        for (const s of bar) {
          if (s.beats === 0.5) run++;
          else {
            expect(run % 2).toBe(0);
            run = 0;
          }
        }
        expect(run % 2).toBe(0);
        if (!rests) expect(bar.every((s) => !s.rest)).toBe(true);
      }),
    );
  });

  it('is the same for the same seed, and never starts a bar with a rest', () => {
    const allowed = allowedBeats(level(3), 4);
    expect(composeBar(new Random(5), 4, allowed, { rests: true })).toEqual(composeBar(new Random(5), 4, allowed, { rests: true }));
    for (let seed = 0; seed < 300; seed++) expect(composeBar(new Random(seed), 4, allowed, { rests: true })[0]!.rest).toBe(false);
  });

  it('can be asked for more rests', () => {
    const allowed = allowedBeats(level(3), 4);
    let rests = 0;
    for (let seed = 0; seed < 300; seed++) rests += composeBar(new Random(seed), 4, allowed, { rests: true }).filter((s) => s.rest).length;
    expect(rests).toBeGreaterThan(20);
  });
});

describe('composeCadence', () => {
  it('ends the piece on one long note that fills the rest of the bar', () => {
    for (const [beats, expected] of [[4, [4]], [3, [1, 2]], [2, [2]]] as const) {
      expect(composeCadence(new Random(1), beats, allowedBeats(level(5), beats, { eighths: true })).map((s) => s.beats).slice(-1)[0]).toBe(expected.at(-1));
    }
  });

  it('fills the bar and ends with the longest note (property)', () => {
    fc.assert(
      fc.property(fc.constantFrom(1, 5), fc.constantFrom(2, 3, 4), fc.integer(), (lv, beats, seed) => {
        const allowed = allowedBeats(level(lv), beats, { eighths: true });
        const bar = composeCadence(new Random(seed), beats, allowed);
        expect(bar.reduce((s, x) => s + x.beats, 0)).toBe(beats);
        expect(bar.at(-1)!.beats).toBe(Math.max(...bar.map((x) => x.beats)));
        expect(bar.every((s) => !s.rest)).toBe(true);
      }),
    );
  });
});

describe('walkTo', () => {
  it('starts and ends where asked, never leaps further than allowed, and stays inside the notes (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 9 }), fc.integer({ min: 2, max: 12 }), fc.integer({ min: 1, max: 4 }), fc.integer(), (size, count, maxLeap, seed) => {
        const end = 0;
        const walk = walkTo(new Random(seed), { size, count, maxLeap, end });
        expect(walk).toHaveLength(count);
        expect(walk.at(-1)).toBe(end);
        for (const i of walk) {
          expect(i).toBeGreaterThanOrEqual(0);
          expect(i).toBeLessThan(size);
        }
        for (let i = 1; i < walk.length; i++) expect(Math.abs(walk[i]! - walk[i - 1]!)).toBeLessThanOrEqual(maxLeap);
      }),
    );
  });

  it('starts at a given note, and continues from a note before it', () => {
    expect(walkTo(new Random(1), { size: 5, count: 4, maxLeap: 1, end: 0, start: 3 })[0]).toBe(3);
    for (let seed = 0; seed < 100; seed++) {
      const walk = walkTo(new Random(seed), { size: 5, count: 4, maxLeap: 1, end: 0, from: 4 });
      expect(Math.abs(walk[0]! - 4)).toBeLessThanOrEqual(1);
    }
  });

  it('does not play one note three times in a row', () => {
    for (let seed = 0; seed < 300; seed++) {
      const walk = walkTo(new Random(seed), { size: 5, count: 12, maxLeap: 1, end: 0 });
      for (let i = 2; i < walk.length; i++) expect(walk[i] === walk[i - 1] && walk[i] === walk[i - 2]).toBe(false);
    }
  });

  it('repeats a note only when asked to (leaps of 0 are weighted by repeat)', () => {
    for (let seed = 0; seed < 100; seed++) {
      const walk = walkTo(new Random(seed), { size: 5, count: 10, maxLeap: 1, end: 0, repeat: 0 });
      for (let i = 1; i < walk.length - 1; i++) expect(walk[i]).not.toBe(walk[i - 1]);
    }
  });

  it('favours runs in one direction in the "runs" style', () => {
    const turns = (style: 'random' | 'runs') => {
      let total = 0;
      for (let seed = 0; seed < 200; seed++) {
        const walk = walkTo(new Random(seed), { size: 5, count: 12, maxLeap: 1, end: 0, repeat: 0, style });
        for (let i = 2; i < walk.length; i++) if (Math.sign(walk[i]! - walk[i - 1]!) !== Math.sign(walk[i - 1]! - walk[i - 2]!)) total++;
      }
      return total;
    };
    expect(turns('runs')).toBeLessThan(turns('random'));
  });

  it('skips by thirds in the "skips" style when the level allows them', () => {
    let skips = 0;
    let steps = 0;
    for (let seed = 0; seed < 200; seed++) {
      const walk = walkTo(new Random(seed), { size: 5, count: 10, maxLeap: 2, end: 0, repeat: 0, style: 'skips' });
      for (let i = 1; i < walk.length; i++) {
        if (Math.abs(walk[i]! - walk[i - 1]!) === 2) skips++;
        else steps++;
      }
    }
    expect(skips).toBeGreaterThan(steps * 0.5);
  });

  it('refuses what cannot be done', () => {
    expect(() => walkTo(new Random(1), { size: 5, count: 0, maxLeap: 1, end: 0 })).toThrow();
    expect(() => walkTo(new Random(1), { size: 5, count: 2, maxLeap: 1, end: 4, start: 0 })).toThrow(/reach/);
    expect(() => walkTo(new Random(1), { size: 5, count: 3, maxLeap: 1, end: 9 })).toThrow();
  });
});

describe('shiftDegrees', () => {
  it('moves every note by the same number of steps, or says it cannot', () => {
    expect(shiftDegrees([0, 1, 2], 1, 5)).toEqual([1, 2, 3]);
    expect(shiftDegrees([2, 3, 4], -2, 5)).toEqual([0, 1, 2]);
    expect(shiftDegrees([2, 3, 4], 1, 5)).toBeNull();
    expect(shiftDegrees([0, 1], -1, 5)).toBeNull();
  });
});

describe('fitRhythm', () => {
  const total = (durs: number[]) => durs.reduce((a, b) => a + b, 0);

  it('gives every note a length so that whole bars are filled exactly, with long notes where asked', () => {
    for (const [lv, beats, notes, bars] of [[1, 4, 9, 4], [1, 4, 15, 4], [5, 4, 15, 4], [3, 3, 9, 4], [5, 2, 9, 5]] as const) {
      const allowed = allowedBeats(level(lv), beats);
      const durations = fitRhythm(new Random(3), { notes, beats, bars, allowed, long: [notes - 1] });
      expect(durations).toHaveLength(notes);
      expect(total(durations)).toBe(bars * beats);
      let at = 0;
      for (const d of durations) {
        expect(allowed).toContain(d);
        expect((at % beats) + d).toBeLessThanOrEqual(beats); // never across a bar line
        at += d;
      }
    }
  });

  it('is the same for the same seed', () => {
    const allowed = allowedBeats(level(1), 4);
    expect(fitRhythm(new Random(8), { notes: 9, beats: 4, bars: 4, allowed, long: [4, 8] })).toEqual(fitRhythm(new Random(8), { notes: 9, beats: 4, bars: 4, allowed, long: [4, 8] }));
  });

  it('refuses when no rhythm exists (too many notes for the bars, or too few)', () => {
    const allowed = allowedBeats(level(1), 4);
    expect(() => fitRhythm(new Random(1), { notes: 20, beats: 4, bars: 4, allowed, long: [] })).toThrow(/fit/);
    expect(() => fitRhythm(new Random(1), { notes: 2, beats: 4, bars: 4, allowed: [1], long: [] })).toThrow(/fit/);
    // "no solution" has its own type, so the generators retry on it but never swallow a real bug
    expect(() => fitRhythm(new Random(1), { notes: 20, beats: 4, bars: 4, allowed, long: [] })).toThrow(NoFit);
    expect(() => walkTo(new Random(1), { size: 5, count: 2, maxLeap: 1, end: 4, start: 0 })).toThrow(NoFit);
    expect(() => walkTo(new Random(1), { size: 5, count: 0, maxLeap: 1, end: 0 })).not.toThrow(NoFit);
  });
});
