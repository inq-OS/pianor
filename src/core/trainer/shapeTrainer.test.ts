// Covers ft_1_29.AC1.
import { describe, expect, it } from 'vitest';
import { chartSchema } from '../chart/schema.ts';
import { noteName } from '../chart/pitch.ts';
import { buildSteps } from '../judge/steps.ts';
import type { NoteEvent } from '../judge/types.ts';
import { SHAPE_LIVES, SHAPE_XP_PER_NOTE, ShapeRound, nextShapeKey, shapeChart, wrongWordsKey, type ShapeChoice } from './shapeTrainer.ts';

const C_MAJOR: ShapeChoice = { fifths: 0, mode: 'major', shape: 'scale', hand: 'RH' };
let clock = 0;
const on = (midi: number): NoteEvent => ({ kind: 'on', midi, velocity: 90, timeMs: (clock += 300), source: 'test' });
const off = (midi: number): NoteEvent => ({ kind: 'off', midi, velocity: 0, timeMs: (clock += 10), source: 'test' });
/** The keys of each step, in order. */
const stepKeys = (choice: ShapeChoice) => {
  const chart = shapeChart(choice);
  return buildSteps(chart).map((s) => s.noteIndices.map((i) => chart.notes[i]!.midi).sort((a, b) => a - b));
};

describe('shapeChart (ft_1_29.AC1)', () => {
  it('a scale goes one octave up and down again in the key, fifteen notes in four bars, the last one long', () => {
    const chart = chartSchema.parse(shapeChart(C_MAJOR));
    expect(chart.notes.map((n) => noteName(n.spelling))).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4']);
    expect(chart.bars).toHaveLength(4);
    expect(chart.notes.at(-1)!.dur).toBe(2 * chart.ppq);
    expect(chart.keyMap[0]).toMatchObject({ fifths: 0, mode: 'major' });
    expect(chart.tracks).toEqual([expect.objectContaining({ role: 'play', hand: 'RH', clef: 'treble' })]);
  });

  it('spells a scale with its signature, and a minor key as its natural minor', () => {
    const d = shapeChart({ ...C_MAJOR, fifths: 2 });
    expect(d.notes.slice(0, 8).map((n) => noteName(n.spelling))).toEqual(['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C#5', 'D5']);
    const a = shapeChart({ ...C_MAJOR, mode: 'minor' });
    expect(a.notes.slice(0, 8).map((n) => noteName(n.spelling))).toEqual(['A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5']);
  });

  it('the left hand plays it on the bass staff, low enough that it needs few ledger lines', () => {
    const c = shapeChart({ ...C_MAJOR, hand: 'LH' });
    expect(c.tracks[0]).toMatchObject({ hand: 'LH', clef: 'bass' });
    expect(noteName(c.notes[0]!.spelling)).toBe('C3');
    const g = shapeChart({ ...C_MAJOR, fifths: 1, hand: 'LH' });
    expect(noteName(g.notes[0]!.spelling)).toBe('G2');
  });

  it('a triad is its three notes one by one, then the three together', () => {
    const steps = stepKeys({ ...C_MAJOR, shape: 'triad' });
    expect(steps).toEqual([[60], [64], [67], [60, 64, 67]]);
    const chart = chartSchema.parse(shapeChart({ ...C_MAJOR, fifths: -3, mode: 'minor', shape: 'triad' }));
    expect(chart.notes.slice(0, 3).map((n) => noteName(n.spelling))).toEqual(['C4', 'Eb4', 'G4']);
    expect(chart.bars).toHaveLength(2);
  });

  it('every key of the circle, both shapes and both hands make a valid chart inside the keyboard', () => {
    for (let fifths = -7; fifths <= 7; fifths++) {
      for (const mode of ['major', 'minor'] as const) {
        for (const shape of ['scale', 'triad'] as const) {
          for (const hand of ['RH', 'LH'] as const) {
            const chart = chartSchema.parse(shapeChart({ fifths, mode, shape, hand }));
            expect(chart.range.low).toBeGreaterThanOrEqual(36);
            expect(chart.range.high).toBeLessThanOrEqual(96);
          }
        }
      }
    }
  });
});

describe('nextShapeKey', () => {
  it('goes round the circle of fifths a fifth at a time, from seven flats to seven sharps and back', () => {
    expect(nextShapeKey(0, 1)).toBe(1);
    expect(nextShapeKey(7, 1)).toBe(-7);
    expect(nextShapeKey(-7, -1)).toBe(7);
  });
});

describe('ShapeRound (ft_1_29.AC1)', () => {
  it('waits for each note, gives XP for each right one, and is won at the last note', () => {
    const round = new ShapeRound(shapeChart(C_MAJOR));
    for (const key of [60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62]) {
      round.press(on(key));
      round.press(off(key));
    }
    expect(round.state().outcome).toBe('playing');
    const last = round.press(on(60));
    expect(last.verdict).toBe('correct');
    expect(round.state()).toMatchObject({ outcome: 'won', lives: SHAPE_LIVES, xp: 15 * SHAPE_XP_PER_NOTE, right: 15 });
  });

  it('a wrong key costs a life, says why, and the cursor stays; the third ends the round and keeps the XP', () => {
    const round = new ShapeRound(shapeChart(C_MAJOR));
    round.press(on(60));
    const wrong = round.press(on(63));
    expect(wrong).toMatchObject({ verdict: 'wrong', reason: expect.any(String) });
    expect(round.state()).toMatchObject({ lives: SHAPE_LIVES - 1, outcome: 'playing', xp: SHAPE_XP_PER_NOTE });
    expect(round.play().awaiting).toHaveLength(1);
    round.press(on(48)); // C3 for D4: a wrong letter one octave off
    round.press(on(61));
    expect(round.state()).toMatchObject({ lives: 0, outcome: 'lost', xp: SHAPE_XP_PER_NOTE, right: 1 });
    // after the round nothing is judged
    expect(round.press(on(62)).verdict).toBe('over');
    expect(round.state().xp).toBe(SHAPE_XP_PER_NOTE);
  });

  it('a wrong octave of the awaited note says so', () => {
    const round = new ShapeRound(shapeChart(C_MAJOR));
    expect(round.press(on(72))).toMatchObject({ verdict: 'wrong', reason: 'wrong-octave' });
  });

  it('ft_1_29.AC1 every wrong key says why in words: the wrong octave, the key next door or a wrong letter, too high or too low', () => {
    const round = new ShapeRound(shapeChart(C_MAJOR));
    const words = (key: number) => {
      const result = round.press(on(key));
      round.press(off(key));
      return result.verdict === 'wrong' ? wrongWordsKey(result.reason, result.direction) : null;
    };
    // C4 is awaited
    expect(words(72)).toBe('theory.wrongOctave');
    expect(words(61)).toBe('shapes.neighbourHigher');
    expect(words(66)).toBe('shapes.letterHigher');
  });

  it('a key next door below, or a wrong letter below, says too low', () => {
    expect(wrongWordsKey('neighbour-key', 'lower')).toBe('shapes.neighbourLower');
    expect(wrongWordsKey('wrong-letter', 'lower')).toBe('shapes.letterLower');
  });

  it('the chord of a triad counts once all three keys are down, in any order, and a key held again costs nothing', () => {
    const round = new ShapeRound(shapeChart({ ...C_MAJOR, shape: 'triad' }));
    for (const key of [60, 64, 67]) {
      round.press(on(key));
      round.press(off(key));
    }
    round.press(on(67));
    round.press(on(60));
    expect(round.press(on(60)).verdict).toBe('ignored');
    expect(round.state().outcome).toBe('playing');
    round.press(on(64));
    expect(round.state()).toMatchObject({ outcome: 'won', lives: SHAPE_LIVES, xp: 6 * SHAPE_XP_PER_NOTE });
  });

  it('a key let go judges nothing', () => {
    const round = new ShapeRound(shapeChart(C_MAJOR));
    expect(round.press(off(60)).verdict).toBe('ignored');
  });
});
