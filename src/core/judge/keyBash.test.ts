// Covers ft_1_15.AC1, ft_1_15.AC2.
import { describe, expect, it } from 'vitest';
import littleSteps from '../../../tests/fixtures/charts/little-steps.v2.json';
import { chartWith, graceAt } from '../../../tests/helpers/charts';
import { chartSchema } from '../chart';
import { KEY_BASH_LIMIT, KEY_BASH_SETTLE_MS, KeyBashGuard, passHeldFor } from './keyBash';
import type { NoteEvent } from './types';
import { WaitMode } from './wait';

const on = (midi: number, timeMs: number): NoteEvent => ({ kind: 'on', midi, velocity: 80, timeMs, source: 'test' });
const off = (midi: number, timeMs: number): NoteEvent => ({ kind: 'off', midi, velocity: 0, timeMs, source: 'test' });
const keys = (n: number, from = 48) => Array.from({ length: n }, (_, i) => from + i);

describe('KeyBashGuard: playing passes through', () => {
  it('ft_1_15.AC1 a melody and its legato overlap reach the judge at once, in order', () => {
    const guard = new KeyBashGuard({ passHeld: 2 });
    const out = [on(60, 0), on(62, 100), off(60, 120), off(62, 300)].flatMap((e) => guard.handle(e).pass);
    expect(out.map((e) => `${e.kind}${e.midi}`)).toEqual(['on60', 'on62', 'off60', 'off62']);
    expect(guard.heldBackSince).toBeNull();
  });

  it('ft_1_15.AC1 ten keys held at once are not a bash: the keys past passHeld wait, then all go to the judge', () => {
    const guard = new KeyBashGuard({ passHeld: 2 });
    const results = keys(KEY_BASH_LIMIT).map((m, i) => guard.handle(on(m, i)));
    expect(results.some((r) => r.bash)).toBe(false);
    expect(results.flatMap((r) => r.pass).map((e) => e.midi)).toEqual([48, 49]);
    expect(guard.heldBackSince).toBe(2);
    expect(guard.release(2 + KEY_BASH_SETTLE_MS - 1)).toEqual([]);
    expect(guard.release(2 + KEY_BASH_SETTLE_MS).map((e) => e.midi)).toEqual(keys(8, 50));
    expect(guard.heldBackSince).toBeNull();
  });

  it('ft_1_15.AC1 a note-off waits behind the keys played before it', () => {
    const guard = new KeyBashGuard({ passHeld: 1 });
    expect(guard.handle(on(60, 0)).pass).toHaveLength(1);
    expect(guard.handle(on(64, 5)).pass).toHaveLength(0); // the second key waits
    expect(guard.handle(off(60, 10)).pass).toHaveLength(0); // 60 was judged, but its off goes after 64's on
    expect(guard.handle(off(64, 20)).pass).toHaveLength(0);
    expect(guard.release(100).map((e) => `${e.kind}${e.midi}`)).toEqual(['on64', 'off60', 'off64']);
  });

  it('the judge clock never passes a waiting key (Tempo mode)', () => {
    const guard = new KeyBashGuard({ passHeld: 1 });
    expect(guard.judgeClock(500)).toBe(500);
    guard.handle(on(60, 400));
    guard.handle(on(62, 420));
    expect(guard.judgeClock(450)).toBe(420);
  });
});

describe('KeyBashGuard: a bash', () => {
  it('ft_1_15.AC1 an eleventh key held at once is a bash, reported once', () => {
    const guard = new KeyBashGuard({ passHeld: 2 });
    const results = keys(KEY_BASH_LIMIT + 3).map((m, i) => guard.handle(on(m, i)));
    expect(results.map((r) => r.bash)).toEqual([...Array<boolean>(KEY_BASH_LIMIT).fill(false), true, false, false]);
  });

  it('ft_1_15.AC2 the held-back keys of a bash never reach the judge, and nothing passes until every key is up', () => {
    const guard = new KeyBashGuard({ passHeld: 2 });
    const passed = keys(12).flatMap((m, i) => guard.handle(on(m, i)).pass);
    expect(passed.map((e) => e.midi)).toEqual([48, 49]); // only the two that could not be told from playing
    expect(guard.release(10_000)).toEqual([]);
    // the two judged keys get their note-offs; the others' are dropped
    const offs = keys(12).flatMap((m) => guard.handle(off(m, 50)).pass);
    expect(offs.map((e) => `${e.kind}${e.midi}`)).toEqual(['off48', 'off49']);
    // all keys up: playing goes on
    expect(guard.handle(on(60, 100)).pass).toHaveLength(1);
  });

  it('ft_1_15.AC2 keys pressed while some bash keys are still down are dropped', () => {
    const guard = new KeyBashGuard({ passHeld: 2 });
    keys(11).forEach((m, i) => guard.handle(on(m, i)));
    keys(10).forEach((m) => guard.handle(off(m, 30))); // one key of the bash still down
    expect(guard.handle(on(72, 40))).toEqual({ pass: [], bash: false });
  });

  it('ft_1_15.AC2 a Wait-mode judge behind the guard judges only the keys down before the bash could be told from playing', () => {
    const chart = chartSchema.parse(littleSteps);
    const mode = new WaitMode(chart);
    const guard = new KeyBashGuard({ passHeld: passHeldFor(chart) });
    const feed = (e: NoteEvent) => guard.handle(e).pass.flatMap((p) => mode.handle(p));
    // the bash starts away from the awaited C4, as palms do: low keys first
    const events = [...keys(12, 36).map((m, i) => on(m, i)), ...keys(12, 36).map((m) => off(m, 40))].flatMap(feed);
    expect(events.filter((e) => e.type === 'NoteJudged')).toHaveLength(2); // passHeld for a melody
    expect(guard.release(10_000).flatMap((e) => mode.handle(e))).toEqual([]);
  });
});

describe('KeyBashGuard: paused', () => {
  it('drops new keys while muted, but lets a judged key go up', () => {
    const guard = new KeyBashGuard({ passHeld: 2 });
    guard.handle(on(60, 0));
    guard.setMuted(true);
    expect(guard.muted).toBe(true);
    expect(guard.handle(on(62, 10)).pass).toEqual([]);
    expect(guard.handle(off(62, 20)).pass).toEqual([]);
    expect(guard.handle(off(60, 30)).pass.map((e) => e.midi)).toEqual([60]);
    guard.setMuted(false);
    expect(guard.handle(on(64, 40)).pass).toHaveLength(1);
  });
});

describe('passHeldFor', () => {
  it('is twice the largest chord, at most the bash limit', () => {
    expect(passHeldFor(chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 62 }]))).toBe(2);
    expect(passHeldFor(chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 0, dur: 480, midi: 64 }, { tick: 0, dur: 480, midi: 67 }]))).toBe(6);
    expect(passHeldFor(chartWith(keys(8, 60).map((midi) => ({ tick: 0, dur: 480, midi }))))).toBe(KEY_BASH_LIMIT);
  });
});

describe('passHeldFor: ornament signs (core_09.AC65, d303)', () => {
  it('core_09.AC65 an ornament adds one key: the note held while its neighbour is played', () => {
    const notes = [{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 64 }];
    const signed = chartWith(notes, { ornaments: [{ track: 'rh', voice: 1, tick: 0, kind: 'trill', upper: graceAt(0, 62).pitch }] });
    expect(passHeldFor(signed)).toBe(passHeldFor(chartWith(notes)) + 1);
  });
});

describe('passHeldFor: grace notes (core_09.AC33, d121)', () => {
  // C, then E with a grace D: legato, C is still down while the grace and E come
  const graced = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 64 }], { graces: [graceAt(480, 62)] });

  it('core_09.AC33 previous note held, grace held, main note pressed: the main note passes at once', () => {
    const guard = new KeyBashGuard({ passHeld: passHeldFor(graced) });
    expect(guard.handle(on(60, 0)).pass).toHaveLength(1);
    expect(guard.handle(on(62, 400)).pass).toHaveLength(1);
    expect(guard.handle(on(64, 440)).pass.map((e) => e.midi)).toEqual([64]); // a right play never waits
    expect(guard.heldBackSince).toBeNull();
  });

  it('core_09.AC33 a grace adds one key, still at most the bash limit', () => {
    expect(passHeldFor(graced)).toBe(3);
    const chord = keys(5, 60).map((midi) => ({ tick: 480, dur: 480, midi }));
    expect(passHeldFor(chartWith([{ tick: 0, dur: 480, midi: 48 }, ...chord], { graces: [graceAt(480, 59)] }))).toBe(KEY_BASH_LIMIT);
  });
});
