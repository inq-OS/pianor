// Covers core_01.AC6, core_01.AC7, core_01.AC9: Tempo mode grades how long each note is held (d093).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { chartWith, graceAt } from '../../../tests/helpers/charts';
import type { Chart } from '../chart';
import { Transport } from '../transport';
import { TempoMode, type TempoModeOptions } from './tempo';
import { DEFAULT_TEMPO_WINDOWS } from './timing';
import { JUDGE_EVENT_VERSION, type BarCompleted, type CorrectNoteJudged, type JudgeEvent, type NoteEvent, type PieceCompleted } from './types';

// 4/4 at 120 bpm: a quarter is 500 ms, a whole note 2000 ms (full hold 1920 ms)
const on = (midi: number, timeMs: number): NoteEvent => ({ kind: 'on', midi, velocity: 80, timeMs, source: 'test' });
const off = (midi: number, timeMs: number): NoteEvent => ({ kind: 'off', midi, velocity: 0, timeMs, source: 'test' });
const bars = (events: JudgeEvent[]) => events.filter((e): e is BarCompleted => e.type === 'BarCompleted');
const piece = (events: JudgeEvent[]) => events.find((e): e is PieceCompleted => e.type === 'PieceCompleted');
const rights = (events: JudgeEvent[]) => events.filter((e): e is CorrectNoteJudged => e.type === 'NoteJudged' && e.verdict === 'correct');

/** A mode on `c` whose tick 0 is at clock time 0 (no count-in). */
function start(c: Chart, options: TempoModeOptions = {}) {
  const transport = new Transport(c, { countInBars: 0 });
  const mode = new TempoMode(c, transport, options);
  transport.start(0);
  return { mode, transport };
}

const whole = chartWith([{ tick: 0, dur: 1920, midi: 60 }, { tick: 1920, dur: 480, midi: 62 }]);

describe('TempoMode: how long a note is held (core_01 slice f)', () => {
  it('core_01.AC6: a whole note held to its end scores 100; a tap on the beat about 50', () => {
    const held = start(whole);
    held.mode.handle(on(60, 0));
    held.mode.handle(off(60, 1950));
    expect(held.mode.getState().timings![0]).toMatchObject({ score: 100, pressScore: 100, hold: 100 });

    const tapped = start(whole);
    tapped.mode.handle(on(60, 0));
    tapped.mode.handle(off(60, 50));
    expect(tapped.mode.getState().timings![0]).toMatchObject({ score: 51, pressScore: 100, hold: 2, verdict: 'on-time' });
    expect(tapped.mode.getState().noteProgress[0]).toBe('correct'); // never missed for its length
  });

  it('core_01.AC6: the press score is multiplied by the hold factor', () => {
    const { mode } = start(whole);
    mode.handle(on(60, 200)); // late: press score below 100
    const press = mode.getState().timings![0]!.score;
    expect(press).toBeLessThan(100);
    mode.handle(off(60, 200 + 860)); // needs 1920 - 200 = 1720 ms from the press: half of it
    expect(mode.getState().timings![0]).toMatchObject({ pressScore: press, hold: 50, score: Math.floor(press * 0.75) });
  });

  it('core_01.AC6: a tie chain is one value', () => {
    const tied = chartWith([{ tick: 0, dur: 960, midi: 60, tieNext: true }, { tick: 960, dur: 960, midi: 60 }, { tick: 1920, dur: 480, midi: 62 }]);
    const { mode } = start(tied);
    mode.handle(on(60, 0));
    mode.handle(off(60, 1100)); // past the first half note, short of the whole chain
    expect(mode.getState().timings![0]).toMatchObject({ hold: 57 });
    expect(mode.getState().timings![0]!.score).toBeLessThan(100);
  });

  it('core_01.AC6: legato overlap is right playing', () => {
    const c = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 62 }]);
    const { mode } = start(c);
    mode.handle(on(60, 0));
    mode.handle(on(62, 480)); // the next key goes down first
    mode.handle(off(60, 560));
    mode.handle(off(62, 1000));
    expect(mode.getState().timings!.map((t) => t?.score)).toEqual([100, 100]);
  });

  it('core_01.AC6: a lost note-off counts as held in full once the hold is due', () => {
    const { mode } = start(whole);
    mode.handle(on(60, 0));
    expect(bars(mode.advance(1919))).toHaveLength(0);
    const events = mode.advance(1920);
    expect(bars(events).map((b) => b.result.bar)).toEqual([0]);
    expect(mode.getState().timings![0]).toMatchObject({ score: 100, hold: 100 });
    expect(mode.handle(off(60, 1990))).toEqual([]); // the late note-off changes nothing
    expect(mode.getState().timings![0]!.score).toBe(100);
  });

  it('core_01.AC6: the same key again releases first, so both notes are held in full', () => {
    const c = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 60 }]);
    const { mode } = start(c);
    mode.handle(on(60, 0));
    mode.handle(off(60, 450));
    mode.handle(on(60, 500));
    mode.handle(off(60, 950));
    expect(mode.getState().timings!.map((t) => t?.hold)).toEqual([100, 100]);
  });

  it('core_01.AC6: a re-press with no note-off between counts the first note as held to then', () => {
    const c = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 60 }]);
    const { mode } = start(c);
    mode.handle(on(60, 0));
    mode.handle(on(60, 380)); // note-off lost, the next one pressed early: held 380 of 425 ms
    expect(mode.getState().timings![0]).toMatchObject({ hold: 89 });
    expect(mode.getState().timings![1]).toHaveProperty('pressScore');
  });

  it('core_01.AC6: chords are graded per key', () => {
    const c = chartWith([{ tick: 0, dur: 1920, midi: 60 }, { tick: 0, dur: 1920, midi: 64 }, { tick: 1920, dur: 480, midi: 62 }]);
    const { mode } = start(c);
    mode.handle(on(60, 0));
    mode.handle(on(64, 5));
    mode.handle(off(64, 100));
    mode.handle(off(60, 1950));
    const [a, b] = mode.getState().timings!;
    expect(a).toMatchObject({ hold: 100, score: 100 });
    expect(b!.score).toBeLessThan(60);
  });

  it('core_01.AC6: while the hold is open the note shows its press score and no hold', () => {
    const { mode } = start(whole);
    mode.handle(on(60, 0));
    const timing = mode.getState().timings![0]!;
    expect(timing).toMatchObject({ score: 100, pressScore: 100 });
    expect(timing.hold).toBeUndefined();
  });

  // Covers core_09.AC33.
  it('core_09.AC33 a grace pressed and let go while the note before is held leaves that hold alone (d121)', () => {
    // a half note C (1000 ms, full hold 920 ms), then D with a grace E (64) before it
    const c = chartWith([{ tick: 0, dur: 960, midi: 60 }, { tick: 960, dur: 960, midi: 62 }], { graces: [graceAt(960, 64)] });
    const { mode } = start(c);
    mode.handle(on(60, 0));
    expect(mode.handle(on(64, 900))).toEqual([]);
    expect(mode.handle(off(64, 910))).toEqual([]);
    expect(mode.getState().timings![0]!.hold).toBeUndefined(); // still open: the grace's release is not the C's
    mode.handle(off(60, 1000));
    mode.handle(on(62, 1000));
    mode.handle(off(62, 2000));
    expect(mode.getState().timings!.map((t) => [t?.score, t?.hold])).toEqual([[100, 100], [100, 100]]);
  });
});

describe('TempoMode: results wait for the holds (core_01.AC7)', () => {
  it('core_01.AC7: a bar completes when its last note is released, not when it is pressed', () => {
    const { mode } = start(whole);
    expect(bars(mode.handle(on(60, 0)))).toHaveLength(0);
    const released = mode.handle(off(60, 1000));
    expect(bars(released)).toHaveLength(1);
    expect(bars(released)[0]!.timeMs).toBe(1000);
    expect(bars(released)[0]!.result.timing).toMatchObject({ played: 1, holds: { full: 0, short: 1 } });
  });

  it('core_01.AC7: a long note in the other hand keeps its bar open after the last step', () => {
    const c = chartWith([
      { tick: 0, dur: 1920, midi: 48, track: 'lh' },
      { tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 62 }, { tick: 960, dur: 480, midi: 64 }, { tick: 1440, dur: 480, midi: 65 },
      { tick: 1920, dur: 480, midi: 67 },
    ]);
    const { mode } = start(c);
    const events: JudgeEvent[] = [];
    events.push(...mode.handle(on(48, 0)));
    for (const [i, midi] of [60, 62, 64, 65].entries()) {
      events.push(...mode.handle(on(midi, i * 500)));
      events.push(...mode.handle(off(midi, i * 500 + (i === 3 ? 200 : 450)))); // the last one let go early
    }
    expect(bars(events)).toHaveLength(0); // every step of bar 0 is played, the left hand still holds
    const after = mode.handle(off(48, 1930)); // past its full hold: decided when that fell due
    expect(bars(after).map((b) => b.result.bar)).toEqual([0]);
    expect(bars(after)[0]!.result.timing).toMatchObject({ played: 5, holds: { full: 4, short: 1 } });
  });

  it('core_01.AC7: the piece completes after the last hold, carrying the new event version', () => {
    const { mode } = start(whole);
    mode.handle(on(60, 0));
    mode.handle(off(60, 1950));
    expect(piece(mode.handle(on(62, 2000)))).toBeUndefined();
    const done = mode.handle(off(62, 2300));
    expect(piece(done)).toMatchObject({ v: 2, timeMs: 2300, result: { timing: { played: 2, holds: { full: 1, short: 1 } } } });
    expect(JUDGE_EVENT_VERSION).toBe(2);
  });

  it('core_01.AC7: a missed note needs no hold', () => {
    const { mode } = start(whole);
    const events = mode.advance(2000 + DEFAULT_TEMPO_WINDOWS.windowMs + 1);
    expect(piece(events)!.result.timing).toMatchObject({ missed: 2, played: 0, holds: { full: 0, short: 0 } });
  });

  it('core_01.AC7: a looped section decides its last hold before the next lap opens', () => {
    const c = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 62 }, { tick: 960, dur: 480, midi: 64 }, { tick: 1440, dur: 480, midi: 65 }]);
    const { mode } = start(c, { loop: true });
    for (const [i, midi] of [60, 62, 64].entries()) {
      mode.handle(on(midi, i * 500));
      mode.handle(off(midi, i * 500 + 480));
    }
    mode.handle(on(65, 1500)); // held through the wrap: its full hold (1925) would come after the next lap's window (1750)
    expect(piece(mode.advance(1749))).toBeUndefined();
    expect(piece(mode.advance(1750))).toBeDefined();
    expect(mode.getState().timings![3]).toMatchObject({ hold: 100 });
  });

  it('core_01.AC7: with a gap before the next lap, the last hold is decided a little before that lap opens', () => {
    const c = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 62 }, { tick: 960, dur: 960, midi: 64 }]);
    const { mode } = start(c, { loop: true });
    mode.handle(on(60, 0));
    mode.handle(off(60, 480));
    mode.handle(on(62, 500));
    mode.handle(off(62, 980));
    mode.handle(on(64, 1000)); // a half note held on: due at 1920, the next lap opens at 1600
    expect(piece(mode.advance(1549))).toBeUndefined();
    expect(piece(mode.advance(1550))).toBeDefined();
  });

  it('core_01.AC6: a looped last note let go before the wrap is graded against the wrap, with no jump', () => {
    const c = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 62 }, { tick: 960, dur: 480, midi: 64 }, { tick: 1440, dur: 480, midi: 65 }]);
    const lastAt = (releaseMs: number | null) => {
      const { mode } = start(c, { loop: true });
      for (const [i, midi] of [60, 62, 64].entries()) {
        mode.handle(on(midi, i * 500));
        mode.handle(off(midi, i * 500 + 480));
      }
      mode.handle(on(65, 1500)); // due at the wrap, 1750
      if (releaseMs === null) mode.advance(1750);
      else mode.handle(off(65, releaseMs));
      return mode.getState().timings![3]!;
    };
    expect(lastAt(null)).toMatchObject({ hold: 100, score: 100 });
    expect(lastAt(1749).score).toBeGreaterThanOrEqual(99);
    expect(lastAt(1625)).toMatchObject({ hold: 50 });
  });

  it('core_01.AC6: a hold just short of full never shows the full score', () => {
    const { mode } = start(whole);
    mode.handle(on(60, 0));
    mode.handle(off(60, 1915)); // 99.7% of the full hold
    expect(mode.getState().timings![0]).toMatchObject({ hold: 99, score: 99 });
  });

  it('how often the scene calls advance changes nothing, with holds', () => {
    const c = chartWith([
      { tick: 0, dur: 960, midi: 60 }, { tick: 0, dur: 1920, midi: 48, track: 'lh' }, { tick: 960, dur: 480, midi: 62 },
      { tick: 1440, dur: 480, midi: 64 }, { tick: 1920, dur: 1920, midi: 65 },
    ]);
    fc.assert(fc.property(
      fc.array(fc.option(fc.integer({ min: 0, max: 2500 })), { minLength: 5, maxLength: 5 }), fc.array(fc.boolean(), { minLength: 5, maxLength: 5 }),
      fc.integer({ min: 7, max: 300 }),
      (holds, play, every) => {
        const timeline: { at: number; e: NoteEvent }[] = [];
        c.notes.forEach((n, k) => {
          if (!play[k]) return;
          const at = (n.tick / 480) * 500;
          timeline.push({ at, e: on(n.midi, at) });
          const h = holds[k];
          if (h !== null && h !== undefined) timeline.push({ at: at + h, e: off(n.midi, at + h) });
        });
        timeline.sort((a, b) => a.at - b.at || (a.e.kind === 'off' ? -1 : 1));
        const run = (frameMs: number | null) => {
          const { mode } = start(c);
          const events: JudgeEvent[] = [];
          let clock = 0;
          for (const { at, e } of timeline) {
            if (frameMs !== null) for (; clock < at; clock += frameMs) events.push(...mode.advance(clock));
            events.push(...mode.handle(e));
          }
          events.push(...mode.advance(10_000));
          return [events.map((e) => [e.type, e.timeMs]), JSON.stringify(mode.getState().timings)];
        };
        expect(run(every)).toEqual(run(null));
      },
    ));
  });

  it('every right note ends with a hold and the piece completes once, whatever the holds', () => {
    const c = chartWith([
      { tick: 0, dur: 960, midi: 60 }, { tick: 0, dur: 1920, midi: 48, track: 'lh' }, { tick: 960, dur: 480, midi: 62 },
      { tick: 1440, dur: 480, midi: 64 }, { tick: 1920, dur: 1920, midi: 65 },
    ]);
    fc.assert(fc.property(fc.array(fc.option(fc.integer({ min: 0, max: 2500 })), { minLength: 5, maxLength: 5 }), (holds) => {
      const { mode } = start(c);
      const order = [...c.notes.keys()].sort((a, b) => c.notes[a]!.tick - c.notes[b]!.tick);
      const timeline: { at: number; e: NoteEvent }[] = [];
      order.forEach((n, k) => {
        const at = (c.notes[n]!.tick / 480) * 500;
        timeline.push({ at, e: on(c.notes[n]!.midi, at) });
        const h = holds[k];
        if (h !== null && h !== undefined) timeline.push({ at: at + h, e: off(c.notes[n]!.midi, at + h) });
      });
      timeline.sort((a, b) => a.at - b.at || (a.e.kind === 'off' ? -1 : 1));
      const events = timeline.flatMap(({ e }) => mode.handle(e)).concat(mode.advance(10_000));
      const timings = mode.getState().timings!;
      return events.filter((e) => e.type === 'PieceCompleted').length === 1
        && rights(events).length === 5
        && timings.every((t) => t !== null && t.hold !== undefined && t.score <= t.pressScore!)
        && bars(events).length === 2;
    }));
  });
});

describe('TempoMode: hold grading off (core_01.AC9)', () => {
  it('core_01.AC9: off, a tapped whole note scores 100 and the bar completes on its press, as before slice f', () => {
    const { mode } = start(whole, { gradeHold: false });
    const pressed = mode.handle(on(60, 0));
    expect(bars(pressed)).toHaveLength(1);
    mode.handle(off(60, 50));
    const timing = mode.getState().timings![0]!;
    expect(timing).toEqual({ errorMs: 0, verdict: 'on-time', score: 100 });
    expect(bars(pressed)[0]!.result.timing).not.toHaveProperty('holds');
  });
});
