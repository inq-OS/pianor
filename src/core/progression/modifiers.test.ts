// Covers core_07 (the difficulty factor table as validated content; the values are proposals, to be tuned after playtests).
import { describe, expect, it } from 'vitest';
import modifiersJson from '../../../content/curriculum/modifiers.json';
import { HELP_IDS, factorFor, loadModifierTable } from './modifiers';

const entry = (factor: number) => ({ factor, note: 'test' });
const helps = (over: Record<string, unknown> = {}) => ({
  noteNames: entry(0.8),
  fingerNumbers: entry(0.9),
  litKey: entry(0.85),
  onScreenKeyboard: entry(0.95),
  metronome: entry(0.95),
  ...over,
});
const table = (over: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  full: { factor: 1 },
  helps: helps(),
  ...over,
});

describe('core_07 difficulty factor table (content/curriculum/modifiers.json)', () => {
  it('loads and validates the shipped table', () => {
    expect(() => loadModifierTable(modifiersJson)).not.toThrow();
  });

  it('has a schemaVersion of 1', () => {
    expect(modifiersJson.schemaVersion).toBe(1);
  });

  it('full difficulty (clef reading, no helps) has factor 1.0', () => {
    const t = loadModifierTable(modifiersJson);
    expect(t.full.factor).toBe(1);
    expect(factorFor(t, [])).toBe(1);
  });

  it('every help factor is strictly between 0 and 1 (never 0)', () => {
    const t = loadModifierTable(modifiersJson);
    for (const id of HELP_IDS) {
      const f = t.helps[id].factor;
      expect(f, id).toBeGreaterThan(0);
      expect(f, id).toBeLessThan(1);
    }
  });

  it('the table names every help: note names, finger numbers, lit key, on-screen keyboard, metronome', () => {
    expect([...HELP_IDS].sort()).toEqual(['fingerNumbers', 'litKey', 'metronome', 'noteNames', 'onScreenKeyboard']);
    const t = loadModifierTable(modifiersJson);
    expect(Object.keys(t.helps).sort()).toEqual([...HELP_IDS].sort());
  });

  it('marks the values as proposals with a note', () => {
    expect(typeof modifiersJson.note).toBe('string');
    const helpsJson: Record<string, { note?: string }> = modifiersJson.helps;
    for (const id of HELP_IDS) {
      expect(typeof helpsJson[id]?.note).toBe('string');
    }
  });

  it('a help turned on multiplies the factor; several helps multiply together', () => {
    const t = loadModifierTable(table());
    expect(factorFor(t, ['noteNames'])).toBeCloseTo(0.8);
    expect(factorFor(t, ['noteNames', 'metronome'])).toBeCloseTo(0.8 * 0.95);
  });

  it('a repeated help counts once', () => {
    const t = loadModifierTable(table());
    expect(factorFor(t, ['noteNames', 'noteNames'])).toBeCloseTo(0.8);
  });

  it('accepts a minimal valid table', () => {
    expect(loadModifierTable(table()).full.factor).toBe(1);
  });

  it('rejects a wrong schemaVersion', () => {
    expect(() => loadModifierTable(table({ schemaVersion: 2 }))).toThrow();
  });

  it('rejects a missing schemaVersion', () => {
    const t: Record<string, unknown> = table();
    delete t.schemaVersion;
    expect(() => loadModifierTable(t)).toThrow();
  });

  it('rejects a help factor of 0', () => {
    expect(() => loadModifierTable(table({ helps: helps({ noteNames: entry(0) }) }))).toThrow();
  });

  it('rejects a help factor above 1', () => {
    expect(() => loadModifierTable(table({ helps: helps({ metronome: entry(1.2) }) }))).toThrow();
  });

  it('rejects a help factor of exactly 1 (a help must cost something)', () => {
    expect(() => loadModifierTable(table({ helps: helps({ litKey: entry(1) }) }))).toThrow();
  });

  it('rejects a full factor other than 1.0', () => {
    expect(() => loadModifierTable(table({ full: { factor: 1.1 } }))).toThrow();
  });

  it('rejects an unknown help id', () => {
    expect(() => loadModifierTable(table({ helps: helps({ confuser: entry(0.9) }) }))).toThrow();
  });

  it('rejects a missing help', () => {
    const h: Record<string, unknown> = helps();
    delete h.metronome;
    expect(() => loadModifierTable(table({ helps: h }))).toThrow();
  });
});
