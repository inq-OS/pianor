import { describe, expect, it } from 'vitest';
import { CIRCLE_STEPS, chooseKey, circleHit, circleLayout, keyAt, moveStep, otherSpelling, spellingsOf, stepOfFifths, stepOfKey, tonicStep, withFlat } from './circleOfFifths';

const AREA = { cx: 100, cy: 100, radius: 90 };

describe('circleLayout (ft_1_28.AC2)', () => {
  it('has twelve steps clockwise from C at the top, a fifth up each', () => {
    const layout = circleLayout(AREA, 'B');
    expect(layout.steps).toHaveLength(CIRCLE_STEPS);
    expect(layout.steps.map((s) => s.major)).toEqual(['C', 'G', 'D', 'A', 'E', 'B/Cb', 'F#/Gb', 'Db/C#', 'Ab', 'Eb', 'Bb', 'F']);
    expect(layout.steps.map((s) => s.minor)).toEqual(['a', 'e', 'b', 'f#', 'c#', 'g#', 'd#', 'bb', 'f', 'c', 'g', 'd']);
    // C straight up, F# straight down, G to the right of C
    expect(layout.steps[0]!.majorAt.x).toBe(100);
    expect(layout.steps[0]!.majorAt.y).toBeLessThan(100);
    expect(layout.steps[6]!.majorAt.y).toBeGreaterThan(100);
    expect(layout.steps[1]!.majorAt.x).toBeGreaterThan(100);
  });

  it('writes the count of sharps or flats at each step, both at the bottom', () => {
    const signs = circleLayout(AREA, 'B').steps.map((s) => s.signs.map((g) => g.count * g.alter));
    expect(signs).toEqual([[0], [1], [2], [3], [4], [5], [6, -6], [-5], [-4], [-3], [-2], [-1]]);
  });

  it('ft_1_28.AC5 shows both spellings of a two-spelling step, the one with fewer signs first: B or C flat, F sharp or G flat, D flat or C sharp', () => {
    const steps = circleLayout(AREA, 'B').steps;
    expect([5, 6, 7].map((i) => steps[i]!.fifths)).toEqual([[5, -7], [6, -6], [-5, 7]]);
    expect(steps.filter((s) => s.fifths.length > 1).map((s) => s.index)).toEqual([5, 6, 7]);
  });

  it('follows the B or H setting', () => {
    const layout = circleLayout(AREA, 'H');
    expect(layout.steps[5]!.major).toBe('H/Cb');
    expect(layout.steps[10]!.major).toBe('B');
    expect(layout.steps[2]!.minor).toBe('h');
    expect(layout.steps[7]!.minor).toBe('b');
  });

  it('counts and names the minor of a seven-sign step the way the piece or the choice spells it', () => {
    expect(circleLayout(AREA, 'B', [7]).steps[7]!.signs).toEqual([{ count: 7, alter: 1 }]);
    expect(circleLayout(AREA, 'B', [7]).steps[7]!.minor).toBe('a#');
    expect(circleLayout(AREA, 'B', [-7]).steps[5]!.signs).toEqual([{ count: 7, alter: -1 }]);
    expect(circleLayout(AREA, 'B', [3]).steps[7]!.signs).toEqual([{ count: 5, alter: -1 }]);
    expect(circleLayout(AREA, 'B', [-6]).steps[6]!.minor).toBe('eb');
  });

  it('puts the minor ring inside the major ring and the counts outside', () => {
    const layout = circleLayout(AREA, 'B');
    const r = (p: { x: number; y: number }) => Math.hypot(p.x - 100, p.y - 100);
    for (const step of layout.steps) {
      expect(r(step.minorAt)).toBeLessThan(r(step.majorAt));
      expect(r(step.majorAt)).toBeLessThan(r(step.signAt));
      expect(r(step.signAt)).toBeLessThanOrEqual(AREA.radius);
    }
  });
});

describe('the step of a key (ft_1_28.AC3)', () => {
  it('puts every one of the fifteen signatures on its step', () => {
    const tonics = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
    for (let fifths = -7; fifths <= 7; fifths++) {
      const step = stepOfKey({ fifths, mode: 'major' });
      const names = circleLayout(AREA, 'B', [fifths]).steps[step]!.major.split('/');
      expect(names).toContain(tonics[fifths + 7]);
      expect(stepOfKey({ fifths, mode: 'minor' })).toBe(step);
    }
  });

  it('gives the key of a step, with the preferred spelling where there are two', () => {
    expect(keyAt(1, 'major')).toEqual({ fifths: 1, mode: 'major' });
    expect(keyAt(11, 'minor')).toEqual({ fifths: -1, mode: 'minor' });
    expect(keyAt(6, 'major')).toEqual({ fifths: 6, mode: 'major' });
    expect(keyAt(7, 'major')).toEqual({ fifths: -5, mode: 'major' });
    expect(keyAt(7, 'major', [7])).toEqual({ fifths: 7, mode: 'major' });
    expect(keyAt(5, 'minor', [-7])).toEqual({ fifths: -7, mode: 'minor' });
    expect(keyAt(6, 'major', [-6])).toEqual({ fifths: -6, mode: 'major' });
  });

  it('moves round the circle both ways', () => {
    expect(moveStep(0, -1)).toBe(11);
    expect(moveStep(11, 1)).toBe(0);
    expect(stepOfFifths(-13)).toBe(11);
  });
});

describe('tonicStep (ft_1_28.AC5)', () => {
  it('finds the major key a played tonic starts', () => {
    // C, G, D, F, B flat, F sharp
    expect([0, 7, 2, 5, 10, 6].map((pc) => tonicStep(pc, 'major'))).toEqual([0, 1, 2, 11, 10, 6]);
  });

  it('finds the minor key a played tonic starts', () => {
    // a, e, d, c, f sharp
    expect([9, 4, 2, 0, 6].map((pc) => tonicStep(pc, 'minor'))).toEqual([0, 1, 11, 9, 3]);
  });
});

describe('circleHit (ft_1_28.AC5)', () => {
  const layout = circleLayout(AREA, 'B');

  it('finds the step and ring under each name', () => {
    for (const step of layout.steps) {
      expect(circleHit(layout, step.majorAt.x, step.majorAt.y)).toMatchObject({ step: step.index, ring: 'major' });
      expect(circleHit(layout, step.minorAt.x, step.minorAt.y)).toMatchObject({ step: step.index, ring: 'minor' });
      expect(circleHit(layout, step.signAt.x, step.signAt.y)).toMatchObject({ step: step.index, ring: 'major' });
    }
  });

  it('ft_1_28.AC5 a click on the flat half of a two-spelling name or count chooses the flat key, the sharp half the sharp key', () => {
    const bottom = layout.steps[6]!;
    // F# stands above G flat in the name, 6 sharps left of 6 flats on the plate
    expect(circleHit(layout, bottom.majorAt.x, bottom.majorAt.y - 3)).toEqual({ step: 6, ring: 'major', fifths: 6 });
    expect(circleHit(layout, bottom.majorAt.x, bottom.majorAt.y + 3)).toEqual({ step: 6, ring: 'major', fifths: -6 });
    expect(circleHit(layout, bottom.signAt.x - 3, bottom.signAt.y)).toEqual({ step: 6, ring: 'major', fifths: 6 });
    expect(circleHit(layout, bottom.signAt.x + 3, bottom.signAt.y)).toEqual({ step: 6, ring: 'major', fifths: -6 });
    // one name shown, no spelling picked by where the click is
    expect(circleHit(layout, bottom.minorAt.x, bottom.minorAt.y)!.fifths).toBeUndefined();
    expect(circleHit(layout, layout.steps[4]!.majorAt.x, layout.steps[4]!.majorAt.y)!.fifths).toBeUndefined();
  });

  it('ft_1_28.AC5 the whole upper or lower half of a two-spelling cell picks its spelling: B over C flat, D flat over C sharp', () => {
    const b = layout.steps[5]!;
    const dflat = layout.steps[7]!;
    expect(circleHit(layout, b.majorAt.x, b.majorAt.y - 3)).toEqual({ step: 5, ring: 'major', fifths: 5 });
    expect(circleHit(layout, b.majorAt.x, b.majorAt.y + 3)).toEqual({ step: 5, ring: 'major', fifths: -7 });
    expect(circleHit(layout, dflat.majorAt.x, dflat.majorAt.y - 3)).toEqual({ step: 7, ring: 'major', fifths: -5 });
    expect(circleHit(layout, dflat.majorAt.x, dflat.majorAt.y + 3)).toEqual({ step: 7, ring: 'major', fifths: 7 });
    // their plates hold one count (two would run into the bottom plate): no spelling picked there
    expect(circleHit(layout, b.signAt.x + 3, b.signAt.y)!.fifths).toBeUndefined();
  });

  it('finds nothing in the hub or outside the circle', () => {
    expect(circleHit(layout, 100, 100)).toBeNull();
    expect(circleHit(layout, 100, 5)).toBeNull();
    expect(circleHit(layout, 300, 100)).toBeNull();
  });
});

describe('chooseKey (ft_1_28.AC5)', () => {
  const major = (fifths: number) => ({ fifths, mode: 'major' as const });

  it('takes the spelling the click picked', () => {
    expect(chooseKey(major(0), { step: 6, ring: 'major', fifths: -6 })).toEqual(major(-6));
    expect(chooseKey(major(-6), { step: 6, ring: 'major', fifths: 6 })).toEqual(major(6));
  });

  it('ft_1_28.AC5 a second click on the chosen step switches its spelling, so G flat, C flat and C sharp can be chosen', () => {
    expect(chooseKey(major(-5), { step: 7, ring: 'major' })).toEqual(major(7));
    expect(chooseKey(major(7), { step: 7, ring: 'major' })).toEqual(major(-5));
    expect(chooseKey(major(5), { step: 5, ring: 'major' })).toEqual(major(-7));
    expect(chooseKey({ fifths: 6, mode: 'minor' }, { step: 6, ring: 'minor' })).toEqual({ fifths: -6, mode: 'minor' });
    expect(chooseKey({ fifths: -5, mode: 'minor' }, { step: 7, ring: 'minor' })).toEqual({ fifths: 7, mode: 'minor' });
    // a step with one spelling is chosen again as it is
    expect(chooseKey(major(1), { step: 1, ring: 'major' })).toEqual(major(1));
  });

  it('keeps the spelling when only the ring changes on the same step', () => {
    expect(chooseKey(major(7), { step: 7, ring: 'minor' })).toEqual({ fifths: 7, mode: 'minor' });
  });

  it('takes the spelling with fewer signs on another step, the piece\'s spelling winning', () => {
    expect(chooseKey(major(0), { step: 7, ring: 'major' })).toEqual(major(-5));
    expect(chooseKey(major(0), { step: 7, ring: 'major' }, [7])).toEqual(major(7));
  });
});

describe('otherSpelling (ft_1_28.AC5)', () => {
  it('ft_1_28.AC5 gives the other spelling of a two-spelling key, in the same mode, and none for a key with one', () => {
    expect(otherSpelling({ fifths: 6, mode: 'major' })).toEqual({ fifths: -6, mode: 'major' });
    expect(otherSpelling({ fifths: -7, mode: 'minor' })).toEqual({ fifths: 5, mode: 'minor' });
    expect(otherSpelling({ fifths: -5, mode: 'major' })).toEqual({ fifths: 7, mode: 'major' });
    expect(otherSpelling({ fifths: 2, mode: 'major' })).toBeNull();
    expect(otherSpelling({ fifths: 0, mode: 'minor' })).toBeNull();
  });
});

describe('a key\'s name with the flat sign (ft_1_28, the painter)', () => {
  it('writes a flat after the letter as ♭ and keeps the letter, a b minor included', () => {
    expect(withFlat('Bb')).toBe('B♭');
    expect(withFlat('bb')).toBe('b♭');
    expect(withFlat('b')).toBe('b');
    expect(withFlat('F#')).toBe('F#');
    expect(withFlat('Gb')).toBe('G♭');
  });
});

describe('the spellings a key can be set with (ft_1_28.AC7)', () => {
  it('ft_1_28.AC7 every one of the fifteen signatures is a spelling of one step, two on the three shared steps', () => {
    const all = Array.from({ length: CIRCLE_STEPS }, (_, step) => spellingsOf(step));
    expect(all.flat().sort((a, b) => a - b)).toEqual(Array.from({ length: 15 }, (_, i) => i - 7));
    expect(all.map((s, step) => (s.length > 1 ? step : -1)).filter((s) => s >= 0)).toEqual([5, 6, 7]);
  });
});
