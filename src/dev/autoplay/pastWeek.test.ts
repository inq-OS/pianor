import { describe, expect, it } from 'vitest';
import type { Chart } from '../../core/chart';
import { DEFAULT_EVALUATION_RULES } from '../../core/curriculum/evaluate';
import { runScore, wholePiecePlays } from '../../core/curriculum/fromLog';
import { practiceLogSchema } from '../../core/progression/practiceLog';
import littleSteps from '../../../content/dev/charts/little-steps.chart.json';
import { pastWeek } from './pastWeek';

const chart = littleSteps as unknown as Chart;

describe('the demo week\'s past practice (ft_1_27.AC2, synthetic)', () => {
  const today = new Date(1998, 10, 25, 15, 0, 0);
  const bars = pastWeek(chart, today, 6);

  it('one whole play of the piece on each of the days before today, at noon local time, oldest first', () => {
    const log = practiceLogSchema.parse({ bars });
    const runs = wholePiecePlays(log, chart.id, chart.bars.length);
    expect(runs).toHaveLength(6);
    const days = runs.map((r) => new Date(r[0]!.at));
    expect(days.map((d) => d.getDate())).toEqual([19, 20, 21, 22, 23, 24]);
    expect(days.every((d) => d.getHours() === 12)).toBe(true);
    expect(bars.every((b) => b.mode === 'wait' && b.tempoPercent === 100 && b.section === null && b.timing === null)).toBe(true);
    expect(bars.map((b) => b.notes)).toEqual(runs.flat().map((b) => chart.notes.filter((n) => n.bar === b.bar).length));
  });

  it('the plays get cleaner day by day, and the last day is clean', () => {
    const log = practiceLogSchema.parse({ bars });
    const scores = wholePiecePlays(log, chart.id, chart.bars.length).map((r) => runScore(r, DEFAULT_EVALUATION_RULES));
    for (let i = 1; i < scores.length; i++) expect(scores[i]!).toBeGreaterThanOrEqual(scores[i - 1]!);
    expect(scores[0]!).toBeLessThan(scores[5]!);
    expect(scores[5]).toBe(100);
  });

  it('no days, no plays', () => {
    expect(pastWeek(chart, today, 0)).toEqual([]);
  });
});
