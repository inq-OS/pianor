import { describe, expect, it } from 'vitest';
import bankJson from '../../../content/curriculum/xpBank.json';
import { bitePercentForLevel, parseXpBankConfig } from './xpBankContent';

describe('xpBank content', () => {
  it('parses the shipped content file', () => {
    const config = parseXpBankConfig(bankJson);
    expect(config.schemaVersion).toBe(1);
    expect(config.floorPercent).toBe(10);
  });

  it('bites 2% of the base at every level', () => {
    const config = parseXpBankConfig(bankJson);
    for (let level = 1; level <= config.bitePercentByLevel.length + 1; level++) expect(bitePercentForLevel(config, level), `level ${level}`).toBe(2);
  });

  it('uses the level bite, and the last one for levels past the table', () => {
    const config = parseXpBankConfig({ schemaVersion: 1, floorPercent: 10, bitePercentByLevel: [1, 2, 3] });
    expect(bitePercentForLevel(config, 1)).toBe(1);
    expect(bitePercentForLevel(config, 2)).toBe(2);
    expect(bitePercentForLevel(config, 3)).toBe(3);
    expect(bitePercentForLevel(config, 9)).toBe(3);
  });

  it('rejects a file that does not match the schema', () => {
    const good = { schemaVersion: 1, floorPercent: 10, bitePercentByLevel: [1] };
    expect(() => parseXpBankConfig({ ...good, schemaVersion: 2 })).toThrow();
    expect(() => parseXpBankConfig({ ...good, floorPercent: 101 })).toThrow();
    expect(() => parseXpBankConfig({ ...good, bitePercentByLevel: [] })).toThrow();
    expect(() => parseXpBankConfig({ ...good, bitePercentByLevel: [-1] })).toThrow();
    expect(() => parseXpBankConfig({ floorPercent: 10, bitePercentByLevel: [1] })).toThrow();
  });

  it('rejects a level below 1', () => {
    const config = parseXpBankConfig({ schemaVersion: 1, floorPercent: 10, bitePercentByLevel: [1] });
    expect(() => bitePercentForLevel(config, 0)).toThrow(RangeError);
  });
});
