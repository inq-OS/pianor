import { CHART_SCHEMA_VERSION, chartSchema, type Chart } from './schema.ts';
import { formatIssues } from '../issues.ts';
import { upgradeToCurrent } from '../upgrade.ts';
import { midiToSpelling } from './pitch.ts';
import { PPQ, barIndexAtTick, buildBars, ticksPerBar } from './time.ts';

type Raw = Record<string, unknown>;
/** Upgrades a chart one schema version: `migrations[n]` turns version n into n + 1. */
export type Migration = (raw: Raw) => Raw;

export class MigrationError extends Error {}

/**
 * Version 0 was the first sketch (docs/architecture.md before the rich format):
 * `{ schemaVersion: 0, id, title, level, tempo, timeSig: { num, den }, notes: [{ tick, dur, midi }] }`.
 * Black keys become sharps; everything goes on one right-hand treble track.
 */
const v0ToV1: Migration = (raw) => {
  const legacy = raw as {
    id: string; title: string; level: number; tempo: number;
    timeSig: { num: number; den: number }; notes: { tick: number; dur: number; midi: number }[];
  };
  // a chart has a range of notes; with none there is nothing to play and no range to give it
  if (Array.isArray(legacy.notes) && legacy.notes.length === 0) throw new MigrationError('a version-0 chart with no notes cannot be migrated: there is nothing to play');
  const end = legacy.notes.reduce((max, n) => Math.max(max, n.tick + n.dur), 0);
  const meterMap = [{ tick: 0, ...legacy.timeSig }];
  const barLength = ticksPerBar(legacy.timeSig);
  const bars = buildBars(meterMap, Math.max(1, Math.ceil(end / barLength)));
  const midis = legacy.notes.map((n) => n.midi);
  return {
    schemaVersion: 1,
    id: legacy.id,
    contentVersion: 1,
    title: legacy.title,
    level: legacy.level,
    ppq: PPQ,
    tempoMap: [{ tick: 0, bpm: legacy.tempo }],
    meterMap,
    keyMap: [{ tick: 0, key: 'C' }],
    tracks: [{ id: 'rh', role: 'play', hand: 'RH', clef: 'treble' }],
    notes: legacy.notes.map((n) => ({
      tick: n.tick, dur: n.dur, midi: n.midi, spelling: midiToSpelling(n.midi),
      track: 'rh', voice: 1, bar: barIndexAtTick(bars, n.tick),
    })),
    rests: [],
    bars,
    phrases: [],
    range: { low: Math.min(...midis), high: Math.max(...midis) },
  };
};

/**
 * Version 1 kept the key as a free string (`key: "C"`). Version 2 stores it the MusicXML way (`fifths`, `mode`).
 * Only C existed in version 1, so any other string is refused rather than guessed. Writes fixed values only (d064).
 */
const v1ToV2: Migration = (raw) => {
  const legacy = raw as { keyMap: { tick: number; key: string }[] };
  const keyMap = legacy.keyMap.map((entry) => {
    if (entry.key !== 'C') throw new MigrationError(`a version-1 chart with key "${entry.key}" cannot be migrated: only C existed`);
    return { tick: entry.tick, fifths: 0, mode: 'major' };
  });
  return { ...raw, keyMap };
};

export const chartMigrations: Record<number, Migration> = { 0: v0ToV1, 1: v1ToV2 };

/** Applies migrations until the raw chart reaches `current`. Throws `MigrationError` for unknown versions. */
export function migrateChart(
  raw: unknown,
  migrations: Record<number, Migration> = chartMigrations,
  current: number = CHART_SCHEMA_VERSION,
): Raw {
  return upgradeToCurrent(raw, (version) => migrations[version], current, {
    noVersion: 'chart has no schemaVersion',
    newer: (version, supported) => `chart version ${version} is newer than supported ${supported}`,
    noStep: (version) => `no migration from chart version ${version}`,
  }, (message) => new MigrationError(message));
}

export type ParseResult = { ok: true; chart: Chart } | { ok: false; errors: string[] };

/** Migrate then validate. Never throws on bad data: returns readable errors. */
export function parseChart(raw: unknown): ParseResult {
  let migrated: Raw;
  try {
    migrated = migrateChart(raw);
  } catch (e) {
    if (e instanceof MigrationError) return { ok: false, errors: [e.message] };
    return { ok: false, errors: [`could not migrate: ${String(e)}`] };
  }
  const result = chartSchema.safeParse(migrated);
  if (result.success) return { ok: true, chart: result.data };
  return { ok: false, errors: formatIssues(result.error) };
}
