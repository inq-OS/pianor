import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import boatArrives from '../../../tests/fixtures/contracts/boat-arrives.script.json';
import type { StandingPlace } from './scene';
import { scriptSchema, type Script, type ScriptCommand } from './script';
import {
  pressScript, readingMs, scriptProblems, scriptView, skipScript, startScript, stepScript,
  type ScriptEvent, type ScriptRun, type ScriptTiming,
} from './scriptRunner';

const places: readonly StandingPlace[] = [
  { id: 'sea-far', x: 0, y: 100, facing: 'right', scale: 0.5 },
  { id: 'pier', x: 100, y: 100, facing: 'right' },
  { id: 'jetty', x: 200, y: 140, facing: 'left' },
];

/** 100 fine pixels a second; a line lasts 1 s; a phrase 2 s, `silent` none. */
const timing: ScriptTiming = {
  walkPxPerSecond: 100,
  sayMs: () => 1000,
  phraseMs: (piece) => (piece === 'silent' ? 0 : 2000),
};

const script = (commands: ScriptCommand[], skippable = true): Script => ({ schemaVersion: 1, id: 'test', commands, skippable });
const start = (commands: ScriptCommand[], skippable = true) => startScript(script(commands, skippable), places, timing);

/** Steps `run` by `ms` in one go, gathering the events. */
function step(run: ScriptRun, ms: number): { run: ScriptRun; events: ScriptEvent[] } {
  const next = stepScript(run, ms);
  return { run: next.run, events: [...next.events] };
}

const actor = (run: ScriptRun, id: string) => scriptView(run).actors.find((a) => a.id === id);

describe('the script interpreter (ft_1_24.AC6, WP-07)', () => {
  it('ft_1_24.AC6 enters an actor on its place, facing the place\'s way, idle and at the place\'s scale', () => {
    const { run } = start([{ enter: 'boat', place: 'sea-far' }]);
    expect(run.done).toBe(true);
    expect(actor(run, 'boat')).toEqual({ id: 'boat', x: 0, y: 100, scale: 0.5, facing: 'right', state: 'idle' });
  });

  it('ft_1_24.AC6 walks an actor to a place at the walking speed, in the walk state, scale growing on the way', () => {
    let { run } = start([{ enter: 'boat', place: 'sea-far' }, { walkTo: 'boat', place: 'pier' }]);
    expect(run.done).toBe(false);
    ({ run } = step(run, 500));
    expect(actor(run, 'boat')).toEqual({ id: 'boat', x: 50, y: 100, scale: 0.75, facing: 'right', state: 'walk' });
    ({ run } = step(run, 499));
    expect(run.done).toBe(false);
    ({ run } = step(run, 1));
    expect(run.done).toBe(true);
    expect(actor(run, 'boat')).toEqual({ id: 'boat', x: 100, y: 100, scale: 1, facing: 'right', state: 'idle' });
  });

  it('ft_1_24.AC6 a walk to the left faces left, and a walk ends facing the way it went', () => {
    let { run } = start([{ enter: 'kiur', place: 'jetty' }, { face: 'kiur', facing: 'right' }, { walkTo: 'kiur', place: 'pier' }]);
    ({ run } = step(run, 10));
    expect(actor(run, 'kiur')?.facing).toBe('left');
    ({ run } = step(run, 5000));
    expect(actor(run, 'kiur')).toMatchObject({ x: 100, facing: 'left', state: 'idle' });
  });

  it('ft_1_24.AC6 faces, waits, and runs the commands in order across one long step', () => {
    let { run } = start([{ enter: 'kiur', place: 'pier' }, { wait: 300 }, { face: 'kiur', facing: 'front' }]);
    expect(actor(run, 'kiur')?.facing).toBe('right');
    ({ run } = step(run, 299));
    expect(actor(run, 'kiur')?.facing).toBe('right');
    ({ run } = step(run, 1));
    expect(run.done).toBe(true);
    expect(actor(run, 'kiur')?.facing).toBe('front');
  });

  it('ft_1_24.AC6 says a line for its reading time with the speaker talking; a press ends the line at once', () => {
    let { run } = start([{ enter: 'kiur', place: 'pier' }, { say: 'kiur', line: 'script.boat.arrives' }, { wait: 100 }]);
    expect(scriptView(run).line).toEqual({ actor: 'kiur', line: 'script.boat.arrives' });
    expect(actor(run, 'kiur')?.state).toBe('talk');
    ({ run } = step(run, 400));
    expect(scriptView(run).line).not.toBeNull();
    ({ run } = pressScript(run));
    expect(scriptView(run).line).toBeNull();
    expect(actor(run, 'kiur')?.state).toBe('idle');
    ({ run } = step(run, 100));
    expect(run.done).toBe(true);
  });

  it('ft_1_24.AC6 a press outside a line does nothing', () => {
    const { run } = start([{ wait: 500 }]);
    expect(pressScript(run).run).toBe(run);
  });

  it('ft_1_24.AC6 plays a phrase once at its start, the player in the play state for the phrase\'s length', () => {
    const first = start([{ enter: 'kiur', place: 'pier' }, { playPhrase: 'kiur', piece: 'echo-giant' }]);
    let run = first.run;
    expect(first.events).toEqual([{ kind: 'playPhrase', actor: 'kiur', piece: 'echo-giant' }]);
    expect(actor(run, 'kiur')?.state).toBe('play');
    let more: ScriptEvent[];
    ({ run, events: more } = step(run, 1999));
    expect(more).toEqual([]);
    ({ run, events: more } = step(run, 1));
    expect(more).toEqual([{ kind: 'done' }]);
    expect(actor(run, 'kiur')?.state).toBe('idle');
  });

  it('ft_1_24.AC6 a phrase the game cannot play takes no time', () => {
    const { run } = start([{ playPhrase: 'kiur', piece: 'silent' }]);
    expect(run.done).toBe(true);
  });

  it('ft_1_24.AC6 gives an item once, and exits an actor', () => {
    const { run, events } = start([{ enter: 'boat', place: 'pier' }, { give: 'shell' }, { exit: 'boat' }]);
    expect(events).toEqual([{ kind: 'give', item: 'shell' }, { kind: 'done' }]);
    expect(scriptView(run).actors).toEqual([]);
  });

  it('ft_1_24.AC6 fades in from black and out to black over its time, and stays dark after a fade out', () => {
    let { run } = start([{ fade: 'in', ms: 400 }, { fade: 'out', ms: 200 }, { wait: 100 }]);
    expect(scriptView(run).dark).toBe(1);
    ({ run } = step(run, 100));
    expect(scriptView(run).dark).toBeCloseTo(0.75);
    ({ run } = step(run, 300));
    expect(scriptView(run).dark).toBe(0);
    ({ run } = step(run, 100));
    expect(scriptView(run).dark).toBeCloseTo(0.5);
    ({ run } = step(run, 150));
    expect(scriptView(run).dark).toBe(1);
  });

  it('ft_1_24.AC6 starts with a cast already standing, and lists the actors front last (z-order by the feet)', () => {
    const run = startScript(script([{ enter: 'boat', place: 'pier' }]), places, timing, [{ actor: 'kiur', place: 'jetty' }]).run;
    expect(scriptView(run).actors.map((a) => a.id)).toEqual(['boat', 'kiur']);
  });

  it('ft_1_24.AC6 skipping ends the script as if it had run: actors where they end, items given, no phrase played', () => {
    let { run } = start([
      { enter: 'boat', place: 'sea-far' }, { walkTo: 'boat', place: 'pier' },
      { playPhrase: 'boat', piece: 'echo-giant' }, { give: 'shell' }, { enter: 'kiur', place: 'jetty' }, { fade: 'out', ms: 300 },
    ]);
    ({ run } = step(run, 200));
    const skipped = skipScript(run);
    expect(skipped.run.done).toBe(true);
    expect(skipped.events).toEqual([{ kind: 'give', item: 'shell' }, { kind: 'done' }]);
    expect(actor(skipped.run, 'boat')).toMatchObject({ x: 100, y: 100, scale: 1, state: 'idle' });
    expect(actor(skipped.run, 'kiur')).toMatchObject({ x: 200, y: 140 });
    expect(scriptView(skipped.run).dark).toBe(1);
  });

  it('ft_1_24.AC6 a script that is not skippable cannot be skipped', () => {
    const { run } = start([{ wait: 500 }], false);
    expect(skipScript(run).run).toBe(run);
    expect(skipScript(run).events).toEqual([]);
  });

  it('ft_1_24.AC6 a finished script steps no further and says done once', () => {
    let { run, events } = start([{ wait: 10 }]);
    expect(events).toEqual([]);
    ({ run, events } = step(run, 10));
    expect(events).toEqual([{ kind: 'done' }]);
    ({ events } = step(run, 1000));
    expect(events).toEqual([]);
    expect(skipScript(run).events).toEqual([]);
  });

  it('ft_1_24.AC6 refuses to start a script with a place the scene does not have', () => {
    expect(() => start([{ enter: 'boat', place: 'moon' }])).toThrow(/moon/);
  });

  it('ft_1_24.AC6 a step of any length in any number of pieces ends in the same stage (pure, no frame dependence)', () => {
    const commands: ScriptCommand[] = [
      { enter: 'boat', place: 'sea-far' }, { walkTo: 'boat', place: 'pier' }, { say: 'boat', line: 'a.b' },
      { playPhrase: 'boat', piece: 'p' }, { fade: 'out', ms: 250 }, { walkTo: 'boat', place: 'jetty' }, { give: 'x' },
    ];
    fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 900 }), { minLength: 1, maxLength: 40 }), (pieces) => {
      let { run, events } = start(commands);
      const all = [...events];
      for (const ms of pieces) {
        ({ run, events } = step(run, ms));
        all.push(...events);
      }
      const total = pieces.reduce((a, b) => a + b, 0);
      const whole = step(start(commands).run, total);
      expect(scriptView(run)).toEqual(scriptView(whole.run));
      expect(run.done).toBe(whole.run.done);
      expect(all.filter((e) => e.kind === 'give').length).toBe(run.done ? 1 : 0);
      expect(all.filter((e) => e.kind === 'done').length).toBe(run.done ? 1 : 0);
    }));
  });

  it('ft_1_24.AC6 reading time grows with the words and has a floor', () => {
    expect(readingMs('')).toBe(readingMs('a'));
    expect(readingMs('a long line about the boat that is coming')).toBeGreaterThan(readingMs('Hi!'));
  });
});

describe('a script checked against its scene (ft_1_24.AC6)', () => {
  it('ft_1_24.AC6 the boat fixture is clean on a stage with its places and Kiur standing', () => {
    const boat = scriptSchema.parse(boatArrives);
    const stage = [...places, { id: 'pier', x: 1, y: 1, facing: 'left' as const }].map((p) => p.id);
    expect(scriptProblems(boat, stage, ['kiur'])).toEqual([]);
  });

  it('ft_1_24.AC6 names an unknown place and an actor used before it enters or after it leaves', () => {
    const problems = scriptProblems(script([
      { walkTo: 'boat', place: 'pier' }, { enter: 'boat', place: 'moon' }, { exit: 'boat' }, { say: 'boat', line: 'a.b' },
    ]), places.map((p) => p.id), []);
    expect(problems).toEqual([
      'command 1: boat is not on the stage',
      'command 2: no place moon in the scene',
      'command 4: boat is not on the stage',
    ]);
  });
});
