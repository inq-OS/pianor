import { describe, expect, it } from 'vitest';
import { crossValidate, fitRidge, solve, spearman, type Sample } from './fitting';
import { linearPredict } from '../../src/core/piece/learnedModel';

/** synthetic: y = 2 + 3 * x0 - x1, five composers, x2 never varies. */
const line = (n: number): Sample[] =>
  Array.from({ length: n }, (_, i) => {
    const x0 = i % 7;
    const x1 = (i % 3) - 1;
    return { id: `p${i}`, group: `c${i % 5}`, x: [x0, x1, 4], y: 2 + 3 * x0 - x1 };
  });

describe('fitting the Learned model (core_08.AC11)', () => {
  it('solves a linear system', () => {
    expect(solve([[2, 1], [1, 3]], [3, 5]).map((v) => Math.round(v * 1e9) / 1e9)).toEqual([0.8, 1.4]);
  });

  it('refuses a singular system', () => {
    expect(() => solve([[1, 2], [2, 4]], [1, 2])).toThrow('no single solution');
  });

  it('core_08.AC11 ridge with a tiny penalty recovers a linear rule, and a constant feature gets weight 0', () => {
    const samples = line(40);
    const fit = fitRidge(samples, 1e-6);
    expect(fit.scale[2]).toBe(1);
    expect(fit.weights[2]).toBeCloseTo(0, 6);
    for (const s of samples) expect(linearPredict(fit, s.x)).toBeCloseTo(s.y, 3);
  });

  it('a larger penalty shrinks the weights', () => {
    const samples = line(40);
    const small = fitRidge(samples, 0.01);
    const large = fitRidge(samples, 100);
    expect(Math.abs(large.weights[0]!)).toBeLessThan(Math.abs(small.weights[0]!));
  });

  it('refuses an empty set', () => {
    expect(() => fitRidge([])).toThrow('nothing to fit');
  });

  it('ranks with ties', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
    expect(spearman([1, 1, 2, 2], [1, 2, 3, 4])).toBeGreaterThan(0.8);
    expect(spearman([1, 1, 1], [1, 2, 3])).toBe(0);
  });

  it('core_08.AC11 cross-validation holds whole composers out and scores a learnable set well', () => {
    const m = crossValidate(line(40), 5, 1e-3);
    expect(m.folds).toBe(5);
    expect(m.mae).toBeLessThan(0.05);
    expect(m.exact).toBe(1);
    expect(m.withinOne).toBe(1);
    expect(m.spearman).toBeGreaterThan(0.99);
  });

  it('scores predictions clamped to the label scale, as the game shows them', () => {
    const free = crossValidate(line(40), 5, 1e-3);
    const clamped = crossValidate(line(40), 5, 1e-3, { min: 5, max: 10 });
    expect(clamped.mae).toBeGreaterThan(free.mae);
  });

  it('uses fewer folds when there are fewer composers, and needs two', () => {
    const two = line(20).map((s, i) => ({ ...s, group: i % 2 === 0 ? 'a' : 'b' }));
    expect(crossValidate(two).folds).toBe(2);
    expect(() => crossValidate(two.map((s) => ({ ...s, group: 'a' })))).toThrow('at least two groups');
  });
});
