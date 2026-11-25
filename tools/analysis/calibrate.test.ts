import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DIFFICULTY_WEIGHTS, difficultyOf } from '../../src/core/piece/difficulty';
import type { BarPlay } from '../../src/core/progression/practiceLog';
import { WEIGHT_KEYS, barSamples, calibrationReport, fitBarWeights, practiceLogOfExport, type BarSample } from './calibrate';
import { readScore } from './labelledSet';

const chartOf = (id: string) => {
  const read = readScore(join('tests/fixtures/anchors', id));
  if (!read.ok) throw new Error(`${id}: ${read.reason}`);
  return read.chart;
};

/** synthetic: a bar that a player found harder the more hand shifts it has, and nothing else. */
function shiftsOnly(n: number): BarSample[] {
  return Array.from({ length: n }, (_, i) => {
    const raw = WEIGHT_KEYS.map((k, j) => (k === 'shifts' ? i % 5 : ((i * (j + 3)) % 7) / 3));
    return { pieceId: `p${i % 4}`, bar: i, raw, x: raw.map((v) => v - 1), y: 0.06 * ((i % 5) - 2) };
  });
}

describe('calibrating the weights to the measured bars (core_08.AC14)', () => {
  it('core_08.AC14 turns every measured bar of every piece into a sample: its features, centred on its piece, and its gap', () => {
    const chart = chartOf('ode-to-joy');
    const prior = difficultyOf(chart);
    const bars = prior.bars.filter((b) => b.features.presses > 0).map((b) => b.index);
    let t = 0;
    const play = (bar: number, right: number): BarPlay => ({ at: new Date(Date.UTC(2000, 0, 1) + t++ * 1000).toISOString(), pieceId: 'ode-to-joy', bar, notes: 10, firstTry: right, timing: null, mode: 'wait', tempoPercent: 100, section: null, misses: [] });
    const log = bars.flatMap((bar, i) => [0, 1, 2].map(() => play(bar, i % 2 === 0 ? 10 : 6)));
    const { samples, skipped } = barSamples(log, (id) => (id === 'ode-to-joy' ? chart : null));
    expect(skipped).toEqual([]);
    expect(samples.length).toBe(bars.length);
    for (let j = 0; j < WEIGHT_KEYS.length; j++) expect(samples.reduce((s, p) => s + p.x[j]!, 0)).toBeCloseTo(0);
    expect(samples.find((s) => s.bar === bars[1])!.y).toBeGreaterThan(0);
    expect(barSamples([play(0, 1)], () => null).skipped).toEqual(['ode-to-joy']);
  });

  it('core_08.AC14 finds the feature that made the bars hard and keeps the mean bar score where it was', () => {
    const samples = shiftsOnly(60);
    const fit = fitBarWeights(samples);
    expect(fit.ok).toBe(true);
    if (!fit.ok) return;
    const shifts = WEIGHT_KEYS.indexOf('shifts');
    expect(Math.max(...fit.suggested.map((w, j) => (j === shifts ? 0 : w)))).toBeLessThan(fit.suggested[shifts]! / 5);
    const meanScore = (w: readonly number[]) => samples.reduce((s, p) => s + p.raw.reduce((a, v, j) => a + v * w[j]!, 0), 0);
    expect(meanScore(fit.suggested)).toBeCloseTo(meanScore(WEIGHT_KEYS.map((k) => DIFFICULTY_WEIGHTS.bar[k])), 6);
    expect(fit.rankSuggested).toBeGreaterThan(fit.rankToday);
    expect(fit.suggested.every((w) => w >= 0)).toBe(true);
  });

  it('core_08.AC14 refuses with too few measured bars, and reports a fit for a person to accept', () => {
    expect(fitBarWeights(shiftsOnly(10))).toMatchObject({ ok: false });
    const fit = fitBarWeights(shiftsOnly(60));
    const lines = calibrationReport(fit, 60, ['gone-piece']).join('\n');
    expect(lines).toContain('shifts');
    expect(lines).toContain('DIFFICULTY_WEIGHTS.bar');
    expect(lines).toContain('gone-piece');
    expect(calibrationReport(fitBarWeights(shiftsOnly(10)), 10, []).join('\n')).toContain('too few');
  });

  it('core_08.AC14 reads the practice log from a player export, and refuses anything else', () => {
    const log = { bars: [] };
    expect(practiceLogOfExport({ format: 'pianor-profile', exportVersion: 2, documents: { practiceLog: log } })).toEqual(log);
    expect(() => practiceLogOfExport({ format: 'other' })).toThrow(/player export/);
    expect(() => practiceLogOfExport({ format: 'pianor-profile', exportVersion: 1, profile: {} })).toThrow(/export it again/);
  });
});
