// Covers ft_1_10.AC2 (the ear level table is data: each row a mode and its keys; a two-note row needs two keys).
import { describe, expect, it } from 'vitest';
import { loadEarLevels } from './earLevels';

const valid = {
  schemaVersion: 1,
  levels: [
    { mode: 'single', keys: [60, 64, 67] },
    { mode: 'two', keys: [60, 62, 64] },
  ],
};

describe('ear levels table (ft_1_10.AC2)', () => {
  it('loads a valid table', () => {
    expect(loadEarLevels(valid).levels).toHaveLength(2);
  });

  it('rejects a table without rows', () => {
    expect(() => loadEarLevels({ ...valid, levels: [] })).toThrow();
  });

  it('rejects a wrong schemaVersion', () => {
    expect(() => loadEarLevels({ ...valid, schemaVersion: 2 })).toThrow();
  });

  it('rejects keys outside the EZ-220 range (36 to 96)', () => {
    expect(() => loadEarLevels({ schemaVersion: 1, levels: [{ mode: 'single', keys: [35] }] })).toThrow();
    expect(() => loadEarLevels({ schemaVersion: 1, levels: [{ mode: 'single', keys: [97] }] })).toThrow();
  });

  it('rejects repeated keys in a row', () => {
    expect(() => loadEarLevels({ schemaVersion: 1, levels: [{ mode: 'single', keys: [60, 60] }] })).toThrow();
  });

  it('rejects a two-note row with fewer than two keys', () => {
    expect(() => loadEarLevels({ schemaVersion: 1, levels: [{ mode: 'two', keys: [60] }] })).toThrow();
  });

  it('rejects an unknown mode', () => {
    expect(() => loadEarLevels({ schemaVersion: 1, levels: [{ mode: 'chord', keys: [60, 64] }] })).toThrow();
  });
});
