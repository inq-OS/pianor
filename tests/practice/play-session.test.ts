// The play session: one component that wires the staff, the judge and Kiur's bubble for Practice and the tug.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import littleSteps from '../fixtures/charts/little-steps.v2.json';
import { chartSchema, sliceChart } from '../../src/core/chart';
import { defaultLaneLook } from '../../src/core/layout/beatLane';
import type { NoteJudged, PieceResult } from '../../src/core/judge';
import { composePerformance } from '../../src/io/mock/performance';
import { ScriptedKeyboard } from '../../src/io/mock/ScriptedKeyboard';

// The views need Phaser and a screen: stand-ins record what the session asks of them.
const views: FakeStaff[] = [];
const bubbles: FakeBubble[] = [];
class FakeStaff {
  progress: unknown[] = [];
  timings: unknown[] = [];
  flashes: unknown[] = [];
  playheads: unknown[] = [];
  following = false;
  destroyed = false;
  constructor(_scene: unknown, readonly layout: { pageCount: number; staffSpace: number }, _theme: unknown, readonly hints: unknown, readonly origin: { x: number; y: number }, readonly numbers: unknown[]) {
    views.push(this);
  }
  applyProgress(progress: unknown, awaiting: unknown) { this.progress.push({ progress, awaiting }); }
  applyTimings(...args: unknown[]) { this.timings.push(args); }
  flashWrong(notes: unknown) { this.flashes.push(notes); }
  played: { mark: unknown; name: string | undefined }[] = [];
  setPlayed(mark: unknown, name?: string) { this.played.push({ mark, name }); }
  setPlayhead(playhead: unknown) { this.playheads.push(playhead); }
  followPlayhead(on: boolean) { this.following = on; }
  durationMarks: { bands: unknown[]; ghosts: unknown[] }[] = [];
  setDurationMarks(marks: { bands: unknown[]; ghosts: unknown[] }) { this.durationMarks.push(marks); }
  handShifts: ReadonlyMap<number, 'up' | 'down'>[] = [];
  setHandShifts(shifts: ReadonlyMap<number, 'up' | 'down'>) { this.handShifts.push(shifts); }
  veiled: unknown[] = [];
  veil(ranges: unknown) { this.veiled.push(ranges); }
  lane: unknown[] = [];
  waves: (number | null)[] = [];
  setLanes(lanes: { dots: unknown[] }[]) { this.lane = lanes.flatMap((l) => l.dots); }
  moveLane(wave: number | null) { this.waves.push(wave); }
  destroy() { this.destroyed = true; }
}
class FakeBubble {
  shown: string[] = [];
  constructor(_scene: unknown, _root: unknown, readonly spot: unknown, readonly first: string) {
    bubbles.push(this);
  }
  show(message: string) {
    this.shown.push(message);
    return message === '' ? 0 : message.length > 20 ? 2 : 1;
  }
}
vi.mock('../../src/game/ui/staff/StaffView', () => ({ StaffView: FakeStaff }));
vi.mock('../../src/game/ui/pixel/SpeechBubble', () => ({ SpeechBubble: FakeBubble }));
const { PlaySession } = await import('../../src/game/practice/PlaySession');

const chart = chartSchema.parse(littleSteps);
const prefs = { staffSettings: { lines: 1, barsPerLine: 'auto' }, staffGap: 'wide', noteNaming: 'B', barNumberSettings: { mode: 'every' }, durationHelp: { RH: 'off', LH: 'off' } } as const;
const area = { top: 50, width: 1280, height: 500 };

/** A scene clock with timers that run when the time is moved on. */
function fakeScene() {
  const timers: { at: number; run: () => void; removed: boolean }[] = [];
  const time = {
    now: 0,
    delayedCall(ms: number, run: () => void) {
      const timer = { at: time.now + ms, run, removed: false };
      timers.push(timer);
      return { remove: () => { timer.removed = true; } };
    },
  };
  const advance = (ms: number) => {
    time.now += ms;
    for (const timer of timers) if (!timer.removed && timer.at <= time.now) { timer.removed = true; timer.run(); }
  };
  return { scene: { time, scale: { zoom: 1 } } as never, advance, pending: () => timers.filter((t) => !t.removed).length };
}

function setup(mistakes: Parameters<typeof composePerformance>[1] = {}, options: { tempo?: boolean } = {}) {
  const { scene, advance, pending } = fakeScene();
  const keyboard = new ScriptedKeyboard(composePerformance(chart, mistakes));
  const judged: NoteJudged[] = [];
  const completed: PieceResult[] = [];
  const changes: number[] = [];
  const session = new PlaySession(scene, {
    chart, keyboard,
    ...(options.tempo ? { tempo: { percent: 100, scoreView: 'number' as const } } : {}),
    callbacks: {
      onChange: (s) => changes.push(s.stepIndex),
      onJudged: (e, s) => { judged.push(e); session.feedback(e, s); },
      onCompleted: (r) => completed.push(r),
    },
  });
  return { session, keyboard, judged, completed, changes, advance, pending };
}

beforeEach(() => {
  views.length = 0;
  bubbles.length = 0;
});

describe('PlaySession', () => {
  it('draws the staff for the player settings and keeps it up to date with the judge', () => {
    const { session, keyboard, completed, changes } = setup();
    const view = session.drawStaff(area, prefs) as unknown as FakeStaff;
    expect(view.origin).toEqual({ x: 0, y: 50 });
    expect(session.layout?.pageCount).toBeGreaterThan(1); // one line at a time
    expect(view.numbers.length).toBeGreaterThan(0);
    expect(view.following).toBe(false); // Wait mode has no playhead
    keyboard.flush();
    expect(completed).toHaveLength(1);
    expect(view.progress.length).toBeGreaterThan(1);
    expect(changes.at(-1)).toBe(session.getState().stepIndex);
    expect(view.timings).toEqual([]); // timings are Tempo mode's
    expect(view.handShifts).toHaveLength(1); // ft_1_30.AC10: the hand-shift arrows are given with every drawn staff
  });

  it('ft_1_11.AC4: gives the staff the duration helper\'s marks the player chose, none when it is off', () => {
    const off = setup().session.drawStaff(area, prefs) as unknown as FakeStaff;
    expect(off.durationMarks).toEqual([{ bands: [], ghosts: [] }]);
    const on = setup().session.drawStaff(area, { ...prefs, durationHelp: { RH: 'both', LH: 'band' } }) as unknown as FakeStaff;
    expect(on.durationMarks[0]!.bands.length).toBeGreaterThan(0); // little steps has notes longer than a beat
  });

  it('lays out a section at the size of the whole piece, numbered from its first bar', () => {
    const { scene } = fakeScene();
    const section = sliceChart(chart, 1, 2);
    const whole = new PlaySession(scene, { chart, keyboard: new ScriptedKeyboard([]), callbacks: { onJudged: () => undefined, onCompleted: () => undefined } });
    const part = new PlaySession(scene, { chart: section, section: { whole: chart, first: 1 }, keyboard: new ScriptedKeyboard([]), callbacks: { onJudged: () => undefined, onCompleted: () => undefined } });
    whole.drawStaff(area, prefs);
    const view = part.drawStaff(area, prefs) as unknown as FakeStaff;
    expect(part.layout!.staffSpace).toBe(whole.layout!.staffSpace);
    expect((view.numbers as { number: number }[])[0]!.number).toBe(2);
  });

  it('ft_1_32.AC20 draws the whole piece for a learning step, the other bars faint, and leaves room for the prizes at the right', () => {
    const { scene } = fakeScene();
    const step = sliceChart(chart, 0, 0);
    const callbacks = { onJudged: () => undefined, onCompleted: () => undefined };
    const plain = new PlaySession(scene, { chart: step, section: { whole: chart, first: 0 }, keyboard: new ScriptedKeyboard([]), callbacks });
    plain.drawStaff(area, prefs);
    const learning = new PlaySession(scene, { chart: step, section: { whole: chart, first: 0 }, shown: { chart, faint: [{ from: 1, to: chart.bars.length - 1 }] }, roomRight: 12, keyboard: new ScriptedKeyboard([]), callbacks });
    const view = learning.drawStaff(area, prefs) as unknown as FakeStaff;
    expect(view.veiled).toEqual([[{ from: 1, to: chart.bars.length - 1 }]]);
    expect(learning.layout!.bars).toHaveLength(chart.bars.length);
    // the judge still plays only the step
    expect(learning.chart.bars).toHaveLength(1);
    expect(learning.layout!.width).toBeLessThan(plain.layout!.width);
  });

  it('ft_1_12.AC7: a wrong note shows the key played on the staff, no sentence, flashes the awaited notes and clears the flash', () => {
    const { session, keyboard, advance, judged } = setup({ mistakes: [{ stepIndex: 1, kind: 'wrong-octave' }] });
    const view = session.drawStaff(area, prefs) as unknown as FakeStaff;
    const mascot = { setMood: vi.fn() };
    session.setMascot(mascot as never);
    const bubble = session.drawBubble({} as never, { x: 0, y: 0, width: 100 }) as unknown as FakeBubble;
    for (let i = 0; i < 3; i++) keyboard.step(); // C on, C off, the wrong octave
    expect(judged.at(-1)).toMatchObject({ verdict: 'wrong' });
    expect(session.message).toBe('');
    expect(bubble.shown.filter((m) => m !== '')).toEqual([]);
    expect(view.played.at(-1)).toMatchObject({ mark: expect.objectContaining({ spelling: expect.any(Object) }), name: expect.stringMatching(/^[A-H]/) });
    expect(mascot.setMood).toHaveBeenCalledWith('hmm', expect.any(Number));
    expect(view.flashes).toEqual([[1]]);
    advance(700);
    expect(view.flashes.at(-1)).toBeNull();
  });

  it('a right note clears the bubble, unless a held message is still on', () => {
    const { session, keyboard, advance } = setup();
    session.say('Round 2!', 2000, true);
    keyboard.step(); // a right note
    expect(session.message).toBe('Round 2!');
    advance(2000);
    expect(session.message).toBe('');
    session.say('Hello');
    keyboard.step();
    keyboard.step();
    expect(session.message).toBe('');
  });

  it('tells the scene how many lines the bubble shows after every change', () => {
    const { session } = setup();
    const lines: number[] = [];
    session.say('Hi');
    session.drawBubble({} as never, { x: 0, y: 0, width: 100 }, (n) => lines.push(n));
    session.say('A message long enough for two lines');
    session.say('');
    expect(lines).toEqual([1, 2, 0]);
  });

  it('restart gives the same chart a fresh judge; the old one no longer listens', () => {
    const { session, keyboard } = setup();
    keyboard.step();
    keyboard.step();
    const first = session.controller;
    expect(session.getState().stepIndex).toBe(1);
    session.restart();
    expect(session.controller).not.toBe(first);
    expect(session.getState().stepIndex).toBe(0);
  });

  it('core_13.AC1 core_13.AC5 the beat lane: its dots where the player set it, and in Wait mode a wave running on from the latest right key', () => {
    const { session, keyboard, judged } = setup();
    expect((session.drawStaff(area, prefs) as unknown as FakeStaff).lane).toEqual([]); // off until set
    session.setLanes([defaultLaneLook('above')]);
    const view = session.drawStaff(area, prefs) as unknown as FakeStaff;
    expect(view.lane.length).toBeGreaterThan(16);
    session.moveLane(0, 500, new Map());
    expect(view.waves.at(-1)).toBeNull(); // no key yet
    keyboard.step();
    const at = judged[0]!.timeMs;
    session.moveLane(at + 250, 500, new Map()); // half a quarter at 500 ms a quarter
    expect(view.waves.at(-1)).toBeCloseTo(240);
    session.moveLane(at + 60_000, 500, new Map());
    expect(view.waves.at(-1)).toBe(1920); // a bar on, waiting for the next key
    session.moveLane(at + 250, null, new Map());
    expect(view.waves.at(-1)).toBeNull(); // no tempo: no wave
  });

  it('Tempo mode: a transport, timings on the staff, the playhead follows the clock, and no restart', () => {
    const { session } = setup({}, { tempo: true });
    expect(session.transport).not.toBeNull();
    const view = session.drawStaff(area, prefs) as unknown as FakeStaff;
    expect(view.following).toBe(true);
    expect(view.timings.length).toBe(1);
    session.movePlayhead(0);
    expect(view.playheads).toEqual([]); // the transport has not started
    expect(() => session.restart()).toThrow();
  });

  it('clearView drops the staff for a redraw; destroy stops the judge and the timers', () => {
    const { session, keyboard, pending, judged } = setup({ mistakes: [{ stepIndex: 1, kind: 'wrong-octave' }] });
    const view = session.drawStaff(area, prefs) as unknown as FakeStaff;
    session.clearView();
    expect(view.destroyed).toBe(true);
    expect(session.staffView).toBeNull();
    session.drawStaff(area, prefs);
    for (let i = 0; i < 3; i++) keyboard.step();
    expect(pending()).toBe(1); // the flash (no sentence any more, ft_1_12.AC7)
    session.destroy();
    expect(pending()).toBe(0);
    const count = judged.length;
    keyboard.flush();
    expect(judged.length).toBe(count);
  });
});
