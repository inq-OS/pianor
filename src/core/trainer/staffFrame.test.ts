import { describe, expect, it } from 'vitest';
import stepsJson from '../../../content/trainer/steps.json';
import earJson from '../../../content/trainer/ear-levels.json';
import { staffSpaceLimits } from '../layout/canvasSize.ts';
import type { StaffLayoutOptions } from '../layout/staffTypes.ts';
import { DEFAULT_STAFF_SETTINGS, type StaffSettings } from '../layout/staffSettings.ts';
import { earAnswerChart } from './earChart.ts';
import { loadEarLevels } from './earLevels.ts';
import { circleScaleLayout, earAnswerLayout, noteTrainerLayout } from './staffFrame.ts';
import { loadTrainerSteps, rangeOf } from './steps.ts';

const ranges = loadTrainerSteps(stepsJson).steps.map(rangeOf);
// the note trainer's staff area on the target screen (1920x1080 canvas, zoom 0.8; measured in the game)
const options: StaffLayoutOptions = { viewport: { width: 1920, height: 504 }, ...staffSpaceLimits(0.8) };
const settings: StaffSettings = DEFAULT_STAFF_SETTINGS;
const keys = (low: number, high: number) => Array.from({ length: high - low + 1 }, (_, i) => low + i);
/** Where the staff stands: its size and its top line. */
const place = (l: { staffSpace: number; systems: { topLineY: number; bottomLineY: number }[] }) => ({ staffSpace: l.staffSpace, top: l.systems[0]!.topLineY, bottom: l.systems[0]!.bottomLineY });

describe('the note trainer staff stands still (ft_0_17.AC7)', () => {
  it('every note of a step, in either clef, leaves the staff where it is', () => {
    ranges.forEach((range, index) => {
      const places = keys(range.low, range.high).map((target) => place(noteTrainerLayout(target, ranges, index, options, settings)));
      expect(new Set(places.map((p) => JSON.stringify(p))).size, `step ${index + 1}`).toBe(1);
    });
  });

  it('the steps that fit at the same size share one staff, so cycling them does not move it', () => {
    const at = (index: number) => place(noteTrainerLayout(ranges[index]!.low, ranges, index, options, settings));
    expect(at(1)).toEqual(at(0));
    expect(at(2)).toEqual(at(0));
  });

  it('a step whose notes need a smaller staff gets its own, and keeps the large one for the others', () => {
    const first = noteTrainerLayout(60, ranges, 0, options, settings);
    const whole = noteTrainerLayout(60, ranges, 3, options, settings);
    expect(whole.staffSpace).toBeLessThan(first.staffSpace);
    expect(first.staffSpace).toBe(staffSpaceLimits(0.8).maxStaffSpace);
  });
});

describe('the ear trainer answer staff stands still (ft_1_10.AC12)', () => {
  it('every answer of a row stands on the same staff', () => {
    for (const row of loadEarLevels(earJson).levels) {
      const answers = row.mode === 'single' ? row.keys.map((k) => [k]) : row.keys.flatMap((a) => row.keys.filter((b) => b !== a).map((b) => [a, b]));
      const places = answers.map((notes) => place(earAnswerLayout(earAnswerChart(notes), row.keys, options, settings)));
      expect(new Set(places.map((p) => JSON.stringify(p))).size, JSON.stringify(row.keys)).toBe(1);
    }
  });
});

describe('the circle of fifths scale staff stands still (ft_1_28.AC6)', () => {
  it('every key shows its scale on the same staff, at the same size', () => {
    const circle: StaffLayoutOptions = { viewport: { width: 700, height: 400 }, ...staffSpaceLimits(0.8), barsPerLine: 2 };
    const places = Array.from({ length: 15 }, (_, i) => i - 7).flatMap((fifths) => (['major', 'minor'] as const).map((mode) => {
      const l = circleScaleLayout(fifths, mode, circle);
      return JSON.stringify({ ...place(l), left: l.systems[0]!.left, right: l.systems[0]!.right });
    }));
    expect(new Set(places).size).toBe(1);
  });
});
