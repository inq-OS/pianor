import { describe, expect, it } from 'vitest';
import { doorNotesNeeded, doorShareFromTempo, doorState, tempoRatioFromOnsets } from './findDoor';

describe('doorState', () => {
  it('ft_1_06.AC3 opens the door at or above the share', () => {
    expect(doorState(0.8, 0.8)).toBe('door-open');
    expect(doorState(1.1, 0.8)).toBe('door-open');
  });
  it('ft_1_06.AC3 breaks the key below the share', () => {
    expect(doorState(0.79, 0.8)).toBe('key-broken');
    expect(doorState(0, 0.5)).toBe('key-broken');
  });
  it('ft_1_06.AC3 treats a non-finite ratio as broken', () => {
    expect(doorState(Number.NaN, 0.5)).toBe('key-broken');
  });
});

describe('tempoRatioFromOnsets', () => {
  it('ft_1_06.AC3 returns null for fewer than 2 onsets', () => {
    expect(tempoRatioFromOnsets([], 500)).toBeNull();
    expect(tempoRatioFromOnsets([100], 500)).toBeNull();
  });
  it('ft_1_06.AC3 is target interval over median interval', () => {
    expect(tempoRatioFromOnsets([0, 500, 1000], 500)).toBe(1);
    expect(tempoRatioFromOnsets([0, 625, 1250], 500)).toBeCloseTo(0.8);
  });
  it('ft_1_06.AC3 uses the median, so one stumble does not matter', () => {
    expect(tempoRatioFromOnsets([0, 500, 1000, 3000, 3500], 500)).toBe(1);
  });
  it('ft_1_06.AC3 averages the middle pair for an even count', () => {
    expect(tempoRatioFromOnsets([0, 400, 1000], 500)).toBeCloseTo(500 / 500);
  });
  it('ft_1_06.AC3 ignores non-positive and non-finite intervals', () => {
    expect(tempoRatioFromOnsets([0, 500, 500, 1000, Number.NaN, 1500], 500)).toBe(1);
    expect(tempoRatioFromOnsets([100, 100], 500)).toBeNull();
  });
});

describe('doorShareFromTempo', () => {
  const timing = (onTime: number, early = 0, late = 0, missed = 0) => ({ played: onTime + early + late, onTime, early, late, missed, meanAbsErrorMs: null, score: 0 });
  it('ft_1_06.AC3 is the share of the part\'s notes played on time in Tempo mode', () => {
    expect(doorShareFromTempo({ notes: 10, timing: timing(8, 1, 0, 1) })).toBeCloseTo(0.8);
    expect(doorShareFromTempo({ notes: 4, timing: timing(4) })).toBe(1);
  });
  it('ft_1_06.AC3 does not count early, late or missed notes, so keeping up only roughly is not enough', () => {
    expect(doorShareFromTempo({ notes: 10, timing: timing(5, 3, 2, 0) })).toBeCloseTo(0.5);
    expect(doorShareFromTempo({ notes: 10, timing: timing(0, 0, 0, 10) })).toBe(0);
  });
  it('ft_1_06.AC3 opens the door with the level\'s share: 8 of 10 on time passes 0.8, 7 of 10 does not', () => {
    expect(doorState(doorShareFromTempo({ notes: 10, timing: timing(8, 0, 0, 2) }), 0.8)).toBe('door-open');
    expect(doorState(doorShareFromTempo({ notes: 10, timing: timing(7, 1, 1, 1) }), 0.8)).toBe('key-broken');
  });
  it('ft_1_06.AC3 counts a part with no notes as on time, and a result with no timing (not Tempo mode) as none on time', () => {
    expect(doorShareFromTempo({ notes: 0, timing: timing(0) })).toBe(1);
    expect(doorShareFromTempo({ notes: 6 })).toBe(0);
  });
});

describe('doorNotesNeeded', () => {
  it('ft_1_06.AC3 is the fewest notes on time that reach the share, so the message and the rule agree', () => {
    expect(doorNotesNeeded(10, 0.8)).toBe(8);
    expect(doorNotesNeeded(16, 0.95)).toBe(16);
    expect(doorNotesNeeded(20, 0.95)).toBe(19);
    expect(doorNotesNeeded(7, 0.6)).toBe(5);
    expect(doorNotesNeeded(0, 0.8)).toBe(0);
  });
  it('ft_1_06.AC3 matches doorState for every count', () => {
    for (const share of [0.6, 0.8, 0.95]) {
      for (let notes = 1; notes <= 40; notes++) {
        const need = doorNotesNeeded(notes, share);
        expect(doorState(need / notes, share)).toBe('door-open');
        expect(doorState((need - 1) / notes, share)).toBe('key-broken');
      }
    }
  });
});
