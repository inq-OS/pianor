// Covers ft_0_09.AC3, ft_0_15.AC3.
// Covers ft_0_08.AC1 (scripted, property and note-off tests) and ft_0_08.AC2 (the dummy PlayMode), see docs/decisions/workflow.md#d041.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import littleSteps from '../../../tests/fixtures/charts/little-steps.v2.json';
import { chartWith, graceAt } from '../../../tests/helpers/charts';
import { chartSchema, type Chart } from '../chart';
import { JUDGE_EVENT_VERSION, type JudgeEvent, type NoteEvent, type NoteJudged, type PlayMode, type PieceCompleted } from './types';
import { WaitMode } from './wait';

const chart = chartSchema.parse(littleSteps);

const on = (midi: number, timeMs: number, velocity = 80): NoteEvent => ({ kind: 'on', midi, velocity, timeMs, source: 'test' });
const off = (midi: number, timeMs: number): NoteEvent => ({ kind: 'off', midi, velocity: 0, timeMs, source: 'test' });

/** Quarter note at 70 bpm is 857.142.. ms; the fixture has 11 steps. */
const stepMs = (tick: number) => (tick * 60000) / (70 * 480);

function drive(mode: PlayMode, events: NoteEvent[]): JudgeEvent[] {
  return events.flatMap((e) => mode.handle(e));
}

function playAll(mode: PlayMode, c: Chart = chart): JudgeEvent[] {
  return drive(mode, c.notes.flatMap((n) => [on(n.midi, stepMs(n.tick)), off(n.midi, stepMs(n.tick) + 100)]));
}

const judged = (events: JudgeEvent[]) => events.filter((e): e is NoteJudged => e.type === 'NoteJudged');
const piece = (events: JudgeEvent[]) => events.find((e): e is PieceCompleted => e.type === 'PieceCompleted');

describe('WaitMode: a perfect run', () => {
  const mode = new WaitMode(chart);
  const events = playAll(mode);

  it('judges every note correct, then completes bars, the phrase and the piece in order', () => {
    expect(judged(events)).toHaveLength(11);
    expect(judged(events).every((e) => e.verdict === 'correct')).toBe(true);
    expect(events.filter((e) => e.type === 'BarCompleted').map((e) => e.type === 'BarCompleted' && e.result.bar)).toEqual([0, 1, 2, 3]);
    expect(events.filter((e) => e.type === 'PhraseCompleted')).toHaveLength(1);
    expect(events.at(-1)!.type).toBe('PieceCompleted');
    const types = events.map((e) => e.type);
    expect(types.slice(-4)).toEqual(['NoteJudged', 'BarCompleted', 'PhraseCompleted', 'PieceCompleted']);
  });

  it('reports full accuracy, no mistakes and the chart identity', () => {
    expect(piece(events)!.result).toMatchObject({
      chartId: 'little-steps', contentVersion: 1, notes: 11, firstTryCorrect: 11, mistakes: 0, accuracy: 1,
      hints: { noteNames: 0, fingers: 0 },
    });
    expect(events.every((e) => e.v === JUDGE_EVENT_VERSION)).toBe(true);
  });

  it('ends in a done state and ignores everything after', () => {
    const state = mode.getState();
    expect(state).toMatchObject({ done: true, stepIndex: 11, stepCount: 11, awaiting: [] });
    expect(state.noteProgress.every((p) => p === 'correct')).toBe(true);
    expect(mode.handle(on(60, 99999))).toEqual([]);
  });

  it('has perfect timing when played on the beat (rhythm tracked)', () => {
    expect(piece(events)!.result.rhythmErrorMs).toBeCloseTo(0, 6);
  });
});

describe('WaitMode: cursor and wrong notes', () => {
  it('waits on the first note and exposes it to views', () => {
    const mode = new WaitMode(chart);
    expect(mode.getState()).toMatchObject({ done: false, stepIndex: 0, awaiting: [0], lastJudged: null });
    expect(mode.id).toBe('wait');
  });

  it('a wrong key does not advance, carries a reason, and is gentle', () => {
    const mode = new WaitMode(chart);
    const events = mode.handle(on(72, 0)); // C5 instead of C4
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'NoteJudged', verdict: 'wrong', midi: 72, expectedMidi: 60, reason: 'wrong-octave', direction: 'higher', stepIndex: 0, bar: 0,
    });
    expect(mode.getState().stepIndex).toBe(0);
    expect(mode.getState().lastJudged).toMatchObject({ verdict: 'wrong' });
  });

  it('reports neighbour keys and wrong letters', () => {
    const mode = new WaitMode(chart);
    expect(mode.handle(on(62, 0))[0]).toMatchObject({ reason: 'neighbour-key' });
    expect(mode.handle(on(67, 10))[0]).toMatchObject({ reason: 'wrong-letter' });
  });

  it('wrong then right: advances, but the note is not first-try and accuracy shows it', () => {
    const mode = new WaitMode(chart);
    const events = [
      ...mode.handle(on(61, 0)), // wrong
      ...mode.handle(on(60, 500)), // right
      ...drive(mode, chart.notes.slice(1).map((n) => on(n.midi, stepMs(n.tick) + 500))),
    ];
    const first = judged(events).find((e) => e.verdict === 'correct')!;
    expect(first).toMatchObject({ verdict: 'correct', firstTry: false });
    const result = piece(events)!.result;
    expect(result).toMatchObject({ notes: 11, firstTryCorrect: 10, mistakes: 1 });
    expect(result.accuracy).toBeCloseTo(10 / 11);
    const bar0 = events.find((e) => e.type === 'BarCompleted')!;
    expect(bar0.type === 'BarCompleted' && bar0.result).toMatchObject({ bar: 0, notes: 4, firstTryCorrect: 3, mistakes: 1, accuracy: 0.75 });
  });

  it('pressing the next note early (a later note) is just a wrong note, not a skip', () => {
    const mode = new WaitMode(chart);
    expect(mode.handle(on(62, 0))[0]).toMatchObject({ verdict: 'wrong' });
    expect(mode.getState().stepIndex).toBe(0);
  });

  it('mashing wrong keys never drops accuracy below the first-try count', () => {
    const mode = new WaitMode(chart);
    for (let i = 0; i < 50; i++) mode.handle(on(90, i));
    const events = [...mode.handle(on(60, 100)), ...drive(mode, chart.notes.slice(1).map((n) => on(n.midi, 200 + n.tick)))];
    const result = piece(events)!.result;
    expect(result.mistakes).toBe(50);
    expect(result.firstTryCorrect).toBe(10);
    expect(result.accuracy).toBeGreaterThan(0.9);
  });
});

describe('WaitMode: note-off and velocity', () => {
  it('a note-on with velocity 0 is a note-off: no judgement, no advance, no mistake', () => {
    const mode = new WaitMode(chart);
    expect(mode.handle(on(60, 0, 0))).toEqual([]);
    expect(mode.handle(on(99, 1, 0))).toEqual([]);
    expect(mode.getState().stepIndex).toBe(0);
  });

  it('note-offs never judge, advance or break anything, even for keys never pressed', () => {
    const mode = new WaitMode(chart);
    expect(mode.handle(off(60, 0))).toEqual([]);
    mode.handle(on(60, 10));
    expect(mode.getState().stepIndex).toBe(1);
    expect(mode.handle(off(60, 20))).toEqual([]);
    expect(mode.handle(off(60, 30))).toEqual([]);
    expect(mode.getState().stepIndex).toBe(1);
  });

  it('tracks held keys for views', () => {
    const mode = new WaitMode(chart);
    mode.handle(on(60, 0));
    mode.handle(on(64, 10));
    expect(mode.getState().heldKeys).toEqual([60, 64]);
    mode.handle(off(60, 20));
    mode.handle(on(0, 30, 0)); // velocity-0 on releases too (key 0 was never held)
    expect(mode.getState().heldKeys).toEqual([64]);
    mode.handle(on(64, 40, 0));
    expect(mode.getState().heldKeys).toEqual([]);
  });

  it('every note-on is a press: a missed note-off cannot block a repeated note', () => {
    const repeated = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 60 }, { tick: 960, dur: 480, midi: 60 }]);
    const mode = new WaitMode(repeated);
    // no note-offs at all
    const events = drive(mode, [on(60, 0), on(60, 500), on(60, 1000)]);
    expect(judged(events).map((e) => e.verdict)).toEqual(['correct', 'correct', 'correct']);
    expect(piece(events)).toBeDefined();
  });
});

describe('WaitMode: chords', () => {
  const chord = chartWith([
    { tick: 0, dur: 960, midi: 60 }, { tick: 0, dur: 960, midi: 64 }, { tick: 0, dur: 960, midi: 67 },
    { tick: 960, dur: 960, midi: 62 },
  ]);

  it('needs all keys of the chord, in any press order (property over permutations)', () => {
    fc.assert(
      fc.property(fc.shuffledSubarray([60, 64, 67], { minLength: 3, maxLength: 3 }), (order) => {
        const mode = new WaitMode(chord);
        const events = drive(mode, [...order.map((m, i) => on(m, i * 10)), on(62, 1000)]);
        expect(piece(events)).toBeDefined();
        expect(judged(events).filter((e) => e.verdict === 'wrong')).toHaveLength(0);
      }),
    );
  });

  it('keeps waiting while the chord is incomplete and reports what is still awaited', () => {
    const mode = new WaitMode(chord);
    mode.handle(on(64, 0));
    expect(mode.getState()).toMatchObject({ stepIndex: 0 });
    expect(mode.getState().awaiting).toHaveLength(2);
    expect(mode.getState().noteProgress.slice(0, 3).filter((p) => p === 'correct')).toHaveLength(1);
  });

  it('a chord key released before the others still counts, and a duplicate press is ignored', () => {
    const mode = new WaitMode(chord);
    mode.handle(on(60, 0));
    mode.handle(off(60, 50));
    expect(mode.handle(on(60, 60))).toEqual([]); // already satisfied: no verdict, no mistake
    mode.handle(on(64, 100));
    const events = mode.handle(on(67, 120));
    expect(events.some((e) => e.type === 'NoteJudged')).toBe(true);
    expect(mode.getState().stepIndex).toBe(1);
  });

  it('a wrong key in the middle of a chord keeps the keys already pressed', () => {
    const mode = new WaitMode(chord);
    mode.handle(on(60, 0));
    expect(mode.handle(on(61, 10))[0]).toMatchObject({ verdict: 'wrong', expectedMidi: 64 });
    mode.handle(on(64, 20));
    const events = mode.handle(on(67, 30));
    const correct = events.find((e) => e.type === 'NoteJudged');
    expect(correct).toMatchObject({ verdict: 'correct', firstTry: false });
    expect(mode.getState().stepIndex).toBe(1);
  });
});

describe('WaitMode: ties, rests and bars without notes', () => {
  it('does not ask for a new press on a tied note and marks it done with the first', () => {
    const tied = chartWith([
      { tick: 0, dur: 1920, midi: 60, tieNext: true }, { tick: 1920, dur: 1920, midi: 60 }, { tick: 3840, dur: 480, midi: 62 },
    ]);
    const mode = new WaitMode(tied);
    const events = drive(mode, [on(60, 0), on(62, 3000)]);
    expect(piece(events)!.result.notes).toBe(2);
    expect(mode.getState().noteProgress).toEqual(['correct', 'correct', 'correct']);
  });

  it('completes an empty bar together with the bar before it, and trailing empty bars at the end', () => {
    const gap = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 3840, dur: 480, midi: 62 }], {
      bars: [0, 1, 2, 3].map((i) => ({ index: i, startTick: i * 1920, endTick: (i + 1) * 1920 })),
    });
    const events = drive(new WaitMode(gap), [on(60, 0), on(62, 5000)]);
    const bars = events.flatMap((e) => (e.type === 'BarCompleted' ? [e.result] : []));
    expect(bars.map((b) => b.bar)).toEqual([0, 1, 2, 3]);
    expect(bars[1]).toMatchObject({ notes: 0, accuracy: 1 });
    expect(bars[3]).toMatchObject({ notes: 0 });
    expect(events.at(-1)!.type).toBe('PieceCompleted');
  });

  it('is done immediately when there is nothing to play', () => {
    const empty = chartWith([{ tick: 0, dur: 480, midi: 60, track: 'bk' }]);
    const mode = new WaitMode(empty);
    expect(mode.getState().done).toBe(true);
    expect(mode.handle(on(60, 0))).toEqual([]);
  });

  it('emits phrase results that cover only their bars', () => {
    const phrased = chartWith(
      [{ tick: 0, dur: 1920, midi: 60 }, { tick: 1920, dur: 1920, midi: 62 }, { tick: 3840, dur: 1920, midi: 64 }],
      { phrases: [{ name: 'A', startBar: 0, endBar: 1 }, { name: 'B', startBar: 2, endBar: 2 }] },
    );
    const events = drive(new WaitMode(phrased), [on(61, 0), on(60, 10), on(62, 20), on(64, 30)]);
    const phrases = events.flatMap((e) => (e.type === 'PhraseCompleted' ? [e.result] : []));
    expect(phrases.map((p) => [p.name, p.notes, p.firstTryCorrect, p.mistakes])).toEqual([['A', 2, 1, 1], ['B', 1, 1, 0]]);
  });
});

describe('WaitMode: rhythm is tracked, never punished', () => {
  it('reports the interval error of each step against the chart tempo', () => {
    const mode = new WaitMode(chart);
    const base = stepMs(480); // one quarter at 70 bpm
    const e1 = mode.handle(on(60, 1000)); // first step: no interval
    const e2 = mode.handle(on(62, 1000 + base + 100)); // 100 ms late
    const e3 = mode.handle(on(64, 1000 + 2 * base + 100)); // back on the beat relative to the previous note
    expect(e1[0]).toMatchObject({ intervalErrorMs: null });
    expect((e2[0] as { intervalErrorMs: number }).intervalErrorMs).toBeCloseTo(100, 6);
    expect((e3[0] as { intervalErrorMs: number }).intervalErrorMs).toBeCloseTo(0, 6);
  });

  it('very slow play still completes with full accuracy', () => {
    const mode = new WaitMode(chart);
    const events = drive(mode, chart.notes.map((n, i) => on(n.midi, i * 60000)));
    expect(piece(events)!.result).toMatchObject({ accuracy: 1, mistakes: 0 });
    expect(piece(events)!.result.rhythmErrorMs).toBeGreaterThan(1000);
  });
});

describe('WaitMode: hints are recorded for the reward', () => {
  it('counts correct notes played with each hint on', () => {
    const mode = new WaitMode(chart, { hints: { noteNames: true, fingers: false } });
    const first = mode.handle(on(60, 0));
    expect(first[0]).toMatchObject({ hints: { noteNames: true, fingers: false } });
    mode.setHints({ noteNames: true, fingers: true });
    const rest = drive(mode, chart.notes.slice(1, 5).map((n) => on(n.midi, 100 * n.tick)));
    mode.setHints({ noteNames: false, fingers: false });
    const events = [...first, ...rest, ...drive(mode, chart.notes.slice(5).map((n) => on(n.midi, 100000 + n.tick)))];
    expect(piece(events)!.result.hints).toEqual({ noteNames: 5, fingers: 4 });
  });
});

describe('WaitMode: invariants (property)', () => {
  const melody = fc.array(fc.integer({ min: 55, max: 79 }), { minLength: 1, maxLength: 12 });

  const chartFor = (midis: number[]) => chartWith(midis.map((midi, i) => ({ tick: i * 480, dur: 480, midi })));

  it('a correct sequence always completes, whatever wrong presses and releases are mixed in', () => {
    fc.assert(
      fc.property(melody, fc.array(fc.tuple(fc.integer({ min: 0, max: 127 }), fc.boolean()), { maxLength: 40 }), (midis, noise) => {
        const c = chartFor(midis);
        const mode = new WaitMode(c);
        let t = 0;
        const events: JudgeEvent[] = [];
        for (const [i, midi] of midis.entries()) {
          for (const [key, isOn] of noise.filter((_, k) => k % midis.length === i)) {
            // Noise must not accidentally be the awaited key, or it would be a correct press.
            if (key === midi) continue;
            events.push(...mode.handle(isOn ? on(key, t++) : off(key, t++)));
          }
          events.push(...mode.handle(on(midi, t++)));
        }
        expect(mode.getState().done).toBe(true);
        expect(piece(events)).toBeDefined();
        expect(judged(events).filter((e) => e.verdict === 'correct')).toHaveLength(midis.length);
      }),
    );
  });

  it('the same input always gives the same output', () => {
    fc.assert(
      fc.property(melody, fc.array(fc.integer({ min: 40, max: 90 }), { maxLength: 30 }), (midis, presses) => {
        const run = () => {
          const mode = new WaitMode(chartFor(midis));
          return drive(mode, presses.map((m, i) => on(m, i * 17)));
        };
        expect(run()).toEqual(run());
      }),
    );
  });

  it('stats stay consistent: first-try never exceeds notes, accuracy in [0,1], counts add up', () => {
    fc.assert(
      fc.property(melody, fc.array(fc.integer({ min: 40, max: 90 }), { maxLength: 60 }), (midis, presses) => {
        const mode = new WaitMode(chartFor(midis));
        const events = drive(mode, [...presses.map((m, i) => on(m, i)), ...midis.map((m, i) => on(m, 1000 + i))]);
        const result = piece(events)!.result;
        expect(result.notes).toBe(midis.length);
        expect(result.firstTryCorrect).toBeLessThanOrEqual(result.notes);
        expect(result.accuracy).toBeGreaterThanOrEqual(0);
        expect(result.accuracy).toBeLessThanOrEqual(1);
        const wrong = judged(events).filter((e) => e.verdict === 'wrong').length;
        expect(result.mistakes).toBe(wrong);
      }),
    );
  });
});

describe('PlayMode is not Wait-specific', () => {
  /** A free-play mode: any key is fine, nothing waits. Lives in the test to prove the interface needs no Wait internals. */
  class FreeMode implements PlayMode {
    readonly id = 'free';
    private count = 0;
    handle(event: NoteEvent): JudgeEvent[] {
      if (event.kind !== 'on' || event.velocity === 0) return [];
      this.count++;
      return [{
        type: 'NoteJudged', v: 1, verdict: 'correct', midi: event.midi, noteIndex: -1, stepIndex: this.count - 1, bar: 0,
        firstTry: true, intervalErrorMs: null, hints: { noteNames: false, fingers: false }, timeMs: event.timeMs,
      }];
    }
    getState() {
      return { done: false, stepIndex: this.count, stepCount: Infinity, awaiting: [], noteProgress: [], heldKeys: [], lastJudged: null };
    }
  }

  it('the same driver code runs both modes through the PlayMode interface', () => {
    const run = (mode: PlayMode) => judged(drive(mode, [on(60, 0), on(99, 10), on(0, 20, 0)]));
    expect(run(new WaitMode(chart)).map((e) => e.verdict)).toEqual(['correct', 'wrong']);
    expect(run(new FreeMode()).map((e) => e.verdict)).toEqual(['correct', 'correct']);
    expect(new FreeMode().id).not.toBe(new WaitMode(chart).id);
  });
});

describe('WaitMode with moveOnWrong: a tug from memory (level 1)', () => {
  const chord = chartWith([
    { tick: 0, dur: 960, midi: 60 }, { tick: 0, dur: 960, midi: 64 }, { tick: 0, dur: 960, midi: 67 },
    { tick: 960, dur: 960, midi: 62 },
  ]);

  it('a wrong key is judged wrong with its reason, the note is missed and the cursor moves on', () => {
    const mode = new WaitMode(chart, { moveOnWrong: true });
    const events = mode.handle(on(72, 0));
    expect(events[0]).toMatchObject({ type: 'NoteJudged', verdict: 'wrong', reason: 'wrong-octave', stepIndex: 0 });
    expect(mode.getState()).toMatchObject({ stepIndex: 1 });
    expect(mode.getState().noteProgress[0]).toBe('missed');
    // the next note is judged as the next note
    expect(mode.handle(on(chart.notes[1]!.midi, 900))[0]).toMatchObject({ verdict: 'correct', stepIndex: 1, firstTry: true });
  });

  it('a wrong key in a chord ends the chord: keys already pressed stay right, the rest are missed', () => {
    const mode = new WaitMode(chord, { moveOnWrong: true });
    mode.handle(on(60, 0));
    mode.handle(on(61, 10));
    expect(mode.getState().stepIndex).toBe(1);
    expect(mode.getState().noteProgress.slice(0, 3)).toEqual(['correct', 'missed', 'missed']);
  });

  it('the piece always ends after one press per step, and its result counts each wrong key once', () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 11, maxLength: 11 }), (rightOrWrong) => {
        const mode = new WaitMode(chart, { moveOnWrong: true });
        const events = drive(mode, chart.notes.map((n, i) => on(rightOrWrong[i] ? n.midi : n.midi + 1, i * 500)));
        const result = piece(events)!.result;
        const wrong = rightOrWrong.filter((r) => !r).length;
        expect(mode.getState().done).toBe(true);
        expect(result.mistakes).toBe(wrong);
        expect(result.firstTryCorrect).toBe(11 - wrong);
      }),
    );
  });

  it('without the option a wrong key still waits (the default Wait mode)', () => {
    const mode = new WaitMode(chart);
    mode.handle(on(72, 0));
    expect(mode.getState().stepIndex).toBe(0);
  });
});

describe('WaitMode: an ornament is optional, never wrong (core_09.AC65, d303)', () => {
  // C, G with a turn (upper A 69, lower F 65), E
  const pitch = (midi: number) => graceAt(0, midi).pitch;
  const turned = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 67 }, { tick: 960, dur: 960, midi: 64 }], {
    ornaments: [{ track: 'rh', voice: 1, tick: 480, kind: 'turn', upper: pitch(69), lower: pitch(65) }],
  });

  it('core_09.AC65 the turn played as written (A G F G) is no mistake: the G is judged once, the rest ignored', () => {
    const events = drive(new WaitMode(turned), [on(60, 0), off(60, 100), on(69, 500), off(69, 550), on(67, 560), off(67, 600), on(65, 620), off(65, 660), on(67, 680), off(67, 720), on(64, 1000), off(64, 1500)]);
    expect(judged(events).map((e) => [e.midi, e.verdict])).toEqual([[60, 'correct'], [67, 'correct'], [64, 'correct']]);
    expect(piece(events)!.result).toMatchObject({ notes: 3, firstTryCorrect: 3, mistakes: 0 });
  });

  it('core_09.AC65 skipping the turn scores the same; a key the turn does not use is still wrong', () => {
    expect(piece(playAll(new WaitMode(turned), turned))!.result).toMatchObject({ notes: 3, firstTryCorrect: 3, mistakes: 0 });
    const mode = new WaitMode(turned);
    drive(mode, [on(60, 0), off(60, 100), on(67, 500), off(67, 600)]);
    expect(judged(mode.handle(on(62, 700))).map((e) => e.verdict)).toEqual(['wrong']);
  });
});

describe('WaitMode: grace notes are never required and never wrong (core_09.AC33, d121)', () => {
  // C D E, with a grace F (65) before the E: F is no note of the piece
  const graced = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 62 }, { tick: 960, dur: 960, midi: 64 }], {
    graces: [graceAt(960, 65)],
  });
  const toTheE: NoteEvent[] = [on(60, 0), off(60, 100), on(62, 500), off(62, 600)];

  // Covers core_09.AC33.
  it('core_09.AC33 ignores a press of the grace pitch while its main note is awaited: no wrong note, no mistake', () => {
    const mode = new WaitMode(graced);
    const events = drive(mode, [...toTheE, on(65, 940), off(65, 990), on(64, 1000), off(64, 1500)]);
    expect(judged(events).map((e) => [e.midi, e.verdict])).toEqual([[60, 'correct'], [62, 'correct'], [64, 'correct']]);
    const last = judged(events).at(-1)!;
    expect(last.verdict === 'correct' && last.firstTry).toBe(true);
    expect(piece(events)!.result).toMatchObject({ notes: 3, firstTryCorrect: 3, mistakes: 0, accuracy: 1 });
  });

  it('core_09.AC33 the grace press leaves the cursor and the last judged note as they were; its key is held and let go', () => {
    const mode = new WaitMode(graced);
    drive(mode, toTheE);
    const before = mode.getState();
    expect(mode.handle(on(65, 940))).toEqual([]);
    expect(mode.getState()).toMatchObject({ stepIndex: before.stepIndex, awaiting: before.awaiting, lastJudged: before.lastJudged, heldKeys: [65] });
    expect(mode.handle(off(65, 990))).toEqual([]);
    expect(mode.getState().heldKeys).toEqual([]);
  });

  it('core_09.AC33 a grace never needs a press: skipping it scores the same as playing it', () => {
    const skipped = playAll(new WaitMode(graced), graced);
    expect(piece(skipped)!.result).toMatchObject({ notes: 3, firstTryCorrect: 3, mistakes: 0, accuracy: 1 });
  });

  it('core_09.AC33 the grace pitch is still wrong while another note is awaited', () => {
    const mode = new WaitMode(graced);
    drive(mode, [on(60, 0), off(60, 100)]);
    expect(judged(mode.handle(on(65, 300))).map((e) => e.verdict)).toEqual(['wrong']); // the D is awaited, not the E
  });

  it('core_09.AC33 the same press without the grace in the chart is a wrong note (the baseline)', () => {
    const plain = chartWith(graced.notes.map((n) => ({ tick: n.tick, dur: n.dur, midi: n.midi })));
    const mode = new WaitMode(plain);
    drive(mode, toTheE);
    expect(judged(mode.handle(on(65, 940))).map((e) => e.verdict)).toEqual(['wrong']);
  });

  it('core_09.AC33 a tug from memory (moveOnWrong) does not move on for a grace press', () => {
    const mode = new WaitMode(graced, { moveOnWrong: true });
    drive(mode, toTheE);
    expect(mode.handle(on(65, 940))).toEqual([]);
    expect(mode.getState().stepIndex).toBe(2);
  });
});
