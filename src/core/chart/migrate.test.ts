// Covers ft_0_02.AC4.
import { describe, expect, it } from 'vitest';
import legacy from '../../../tests/fixtures/charts/legacy-steps.v0.json';
import littleSteps from '../../../tests/fixtures/charts/little-steps.v1.json';
import { CHART_SCHEMA_VERSION } from './schema';
import { MigrationError, migrateChart, parseChart } from './migrate';

describe('chart migration', () => {
  it('the current version is 2 (keyMap carries fifths and mode)', () => {
    expect(CHART_SCHEMA_VERSION).toBe(2);
  });

  // Covers core_09.AC2.
  it('a version-1 chart migrates to the C major key, and parses', () => {
    const result = parseChart(littleSteps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.chart.id).toBe('little-steps');
    expect(result.chart.schemaVersion).toBe(2);
    expect(result.chart.keyMap).toEqual([{ tick: 0, fifths: 0, mode: 'major' }]);
  });

  // Covers core_09.AC2.
  it('refuses a version-1 chart whose key is not C, since only C existed', () => {
    const raw = structuredClone(littleSteps) as { keyMap: { key: string }[] };
    raw.keyMap[0]!.key = 'G';
    const result = parseChart(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/only C existed/);
  });

  // Covers core_09.AC2.
  it('the schema refuses a key outside -7..7 or an unknown mode', () => {
    const v2 = migrateChart(littleSteps) as { keyMap: unknown[] };
    expect(parseChart({ ...v2, keyMap: [{ tick: 0, fifths: 8, mode: 'major' }] }).ok).toBe(false);
    expect(parseChart({ ...v2, keyMap: [{ tick: 0, fifths: 0, mode: 'dorian' }] }).ok).toBe(false);
  });

  it('migrates a synthetic v0 fixture to a valid v1 chart', () => {
    const result = parseChart(legacy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { chart } = result;
    expect(chart.schemaVersion).toBe(2);
    expect(chart.keyMap).toEqual([{ tick: 0, fifths: 0, mode: 'major' }]);
    expect(chart.tempoMap).toEqual([{ tick: 0, bpm: 80 }]);
    expect(chart.notes).toHaveLength(4);
    expect(chart.notes[1]!.spelling).toEqual({ step: 'C', alter: 1, octave: 4 });
    expect(chart.bars).toHaveLength(2);
    expect(chart.range).toEqual({ low: 60, high: 67 });
  });

  it('applies a chain of migrations in order', () => {
    const calls: number[] = [];
    const migrations = {
      1: (raw: Record<string, unknown>) => { calls.push(1); return { ...raw, a: true }; },
      2: (raw: Record<string, unknown>) => { calls.push(2); return { ...raw, b: true }; },
    };
    const out = migrateChart({ schemaVersion: 1 }, migrations, 3);
    expect(calls).toEqual([1, 2]);
    expect(out).toMatchObject({ schemaVersion: 3, a: true, b: true });
  });

  it('reports a malformed legacy chart instead of throwing', () => {
    const result = parseChart({ schemaVersion: 0, id: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/could not migrate/);
  });

  it('refuses a version-0 chart with no notes with a clear reason, not a range of Infinity', () => {
    const empty = { schemaVersion: 0, id: 'x', title: 'X', level: 1, tempo: 80, timeSig: { num: 4, den: 4 }, notes: [] };
    expect(() => migrateChart(empty)).toThrow(MigrationError);
    expect(() => migrateChart(empty)).toThrow(/no notes/);
    const result = parseChart(empty);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/no notes/);
  });

  it('rejects a missing, malformed, newer or unmigratable version without crashing', () => {
    expect(() => migrateChart({})).toThrow(MigrationError);
    expect(() => migrateChart({ schemaVersion: -1 })).toThrow(MigrationError);
    for (const schemaVersion of ['1', 0.5, null]) expect(() => migrateChart({ schemaVersion }), String(schemaVersion)).toThrow(/invalid schemaVersion/);
    expect(() => migrateChart({ schemaVersion: 99 })).toThrow(/newer/);
    expect(() => migrateChart({ schemaVersion: 0 }, {}, 1)).toThrow(/no migration/);
    expect(parseChart({ schemaVersion: 99 }).ok).toBe(false);
  });
});
