import { describe, expect, it } from 'vitest';
import { VISIT, idleLongEnough, nextVisit } from './islandVisit';

describe('visiting the island (ft_1_17)', () => {
  it('ft_1_17.AC4 the room is idle long enough only after the whole limit with no input', () => {
    expect(idleLongEnough(1000, 1000 + VISIT.idleMs - 1)).toBe(false);
    expect(idleLongEnough(1000, 1000 + VISIT.idleMs)).toBe(true);
    expect(idleLongEnough(0, 500, 500)).toBe(true);
    expect(idleLongEnough(400, 500, 500)).toBe(false);
  });

  it('ft_1_17.AC4 the screensaver starts at the first open scene; with none open there is nowhere to go', () => {
    expect(nextVisit(['knoll', 'shore'], null)).toBe('knoll');
    expect(nextVisit([], null)).toBeNull();
    expect(nextVisit([], 'knoll')).toBeNull();
  });

  // ft_1_17.AC2
  it('ft_1_17.AC4 the screensaver goes round the open scenes in order and starts over; one scene is visited again', () => {
    expect(nextVisit(['knoll', 'shore', 'pier'], 'knoll')).toBe('shore');
    expect(nextVisit(['knoll', 'shore', 'pier'], 'pier')).toBe('knoll');
    expect(nextVisit(['knoll'], 'knoll')).toBe('knoll');
    // a scene that is no longer open (or never was) starts the round again
    expect(nextVisit(['knoll', 'shore'], 'gone')).toBe('knoll');
  });

  it('ft_1_17.AC4 a scene is looked at for a while before the next one, never shorter than the wait is long', () => {
    expect(VISIT.stayMs).toBeGreaterThan(0);
    expect(VISIT.stayMs).toBeLessThanOrEqual(VISIT.idleMs);
  });
});
