// Covers ft_1_32.AC10.
import { describe, expect, it } from 'vitest';
import type { Focus } from '../learn/stats';
import { TEMPO_RULES } from '../learn/tempo';
import { focusLine, MEANING_PAGES, meaningLine, measureValue } from './learnStatsText';
import { t } from './strings';

const printed = (bar: number) => bar + 1;

describe('focusLine', () => {
  it('says each thing to work on as a measured fact and one thing to do, with printed bar numbers', () => {
    const lines: [Focus, string][] = [
      [{ kind: 'stops', halts: 3, bar: 6 }, 'Stops: 3 in the latest tests, bar 7 is the slowest. Play that bar alone, slowly, until it runs through.'],
      [{ kind: 'stops', halts: 1, bar: null }, 'Stops: 1 in the latest tests. Start slower, so that no note needs a wait.'],
      [{ kind: 'slowBar', bar: 2, pace: 140 }, 'Bar 3 takes 140% of the time it should. Practice it alone until it keeps up with the rest.'],
      [{ kind: 'rushing', drift: 12 }, 'The tempo rises by 12% through a test. Count aloud and keep the speed of the first bars.'],
      [{ kind: 'slowing', drift: 20 }, 'The tempo falls by 20% through a test. The end is less sure than the start: practice the last bars.'],
      [{ kind: 'hand', hand: 'LH', spread: 19, other: 8 }, 'The left hand wobbles more (19%) than the right (8%). Play the left hand alone.'],
      [{ kind: 'hand', hand: 'RH', spread: 19, other: 8 }, 'The right hand wobbles more (19%) than the left (8%). Play the right hand alone.'],
      [{ kind: 'uneven', spread: 22 }, 'The notes wobble by 22% around the beat. Play slower and count evenly.'],
      [{ kind: 'tempoVaries', from: 52, to: 70 }, 'The tempo differs from test to test (52 to 70). Choose one speed and keep it.'],
      [{ kind: 'steady', bpm: 60 }, 'Even and repeatable at tempo 60. Nothing to fix here: go on to the next step.'],
    ];
    for (const [focus, line] of lines) expect(focusLine(focus, printed)).toBe(line);
  });
});

describe('MEANING_PAGES', () => {
  it('explains every measure, the bar strip and the trend, each once', () => {
    const keys = MEANING_PAGES.flat();
    expect([...keys].sort()).toEqual(['bars', 'bpm', 'drift', 'halts', 'hands', 'mad', 'sd', 'trend'].map((name) => `learnStats.meaning.${name}`).sort());
    for (const key of keys) expect(meaningLine(key).length).toBeGreaterThan(20);
  });

  it('ft_1_32.AC10 says a stop is a gap as many times as long as written as the tempo rules count one', () => {
    expect(meaningLine('learnStats.meaning.halts')).toContain(`at least ${TEMPO_RULES.haltFactor} times as long as written`);
    expect(meaningLine('learnStats.meaning.halts')).not.toMatch(/\{\w+\}/);
  });
});

describe('measureValue', () => {
  it('writes the tempo and the stops as plain numbers and the shares in percent, to one decimal, signed for a trend', () => {
    expect(measureValue('bpm', 66)).toBe('66');
    expect(measureValue('halts', 2)).toBe('2');
    expect(measureValue('sd', 11)).toBe('11%');
    expect(measureValue('bpm', 3.24, true)).toBe('+3.2');
    expect(measureValue('mad', -1.96, true)).toBe('-2%');
    expect(measureValue('drift', 0, true)).toBe('0%');
  });
});
