// Covers ft_1_27.AC2 (WP-15): the teacher's galleon comes in to the southern harbour and she goes ashore, on WP-07's interpreter.
import { describe, expect, it } from 'vitest';
import port from '../../../content/scenes/port.json';
import teacherArrives from '../../../content/scripts/teacher-arrives.json';
import { PORT_BERTHS, PORT_MOORED } from '../layout/port';
import { sceneDataSchema } from './scene';
import { scriptSchema } from './script';
import { scriptProblems, scriptView, skipScript, startScript, stepScript, type ScriptRun, type ScriptTiming } from './scriptRunner';

const scene = sceneDataSchema.parse(port);
const script = scriptSchema.parse(teacherArrives);
/** 40 fine pixels a second as in the game; a line lasts 3 s. */
const timing: ScriptTiming = { walkPxPerSecond: 40, sayMs: () => 3000, phraseMs: () => 0 };
const place = (id: string) => scene.places.find((p) => p.id === id)!;
const actor = (run: ScriptRun, id: string) => scriptView(run).actors.find((a) => a.id === id);

/** Runs the script frame by frame (50 ms) to its end, noting the stage after every frame; throws if it never ends. */
function playToEnd(): { run: ScriptRun; frames: ScriptRun[] } {
  let step = startScript(script, scene.places, timing);
  const frames = [step.run];
  for (let i = 0; i < 20000 && !step.run.done; i++) {
    step = stepScript(step.run, 50);
    frames.push(step.run);
  }
  if (!step.run.done) throw new Error('the script never ends');
  return { run: step.run, frames };
}

describe('the teacher arrives at the southern harbour (ft_1_27.AC2, WP-15)', () => {
  it('ft_1_27.AC2 runs clean in the harbour, the southern docks, and not at the north jetty', () => {
    expect(scene.id).toBe('port');
    expect(script.skippable).toBe(true);
    expect(scriptProblems(script, scene.places.map((p) => p.id), [])).toEqual([]);
  });

  it('ft_1_27.AC2 her galleon is not at the quay before she comes, and moors at the berth left free for it', () => {
    expect(PORT_MOORED).not.toContain('galleon');
    expect(PORT_MOORED.length).toBeLessThan(PORT_BERTHS.length);
    // the galleon stands by its middle (240 fine pixels long, its stern 26 in): its stern at the free berth, as a moored boat lies
    const berth = PORT_BERTHS[PORT_MOORED.length]!;
    expect(place('berth-east')).toMatchObject({ x: berth.x - 26 + 120, y: berth.water });
  });

  it('ft_1_27.AC2 Kiur sees the galleon far out, it sails in to its berth, she steps onto the quay and walks off toward the island, and the picture fades out', () => {
    const { run, frames } = playToEnd();
    const first = frames[0]!;
    expect(actor(first, 'galleon')).toMatchObject({ x: place('sea-far').x, y: place('sea-far').y });
    expect(actor(first, 'teacher')).toBeUndefined();
    // Kiur's line is said while the galleon is still far out
    const saying = frames.find((f) => scriptView(f).line !== null);
    expect(scriptView(saying!).line).toMatchObject({ actor: 'kiur', line: 'script.teacher.boatComing' });
    expect(actor(saying!, 'galleon')).toMatchObject({ x: place('sea-far').x });
    // she steps off only once the galleon is at its berth
    const ashore = frames.find((f) => actor(f, 'teacher') !== undefined)!;
    expect(actor(ashore, 'galleon')).toMatchObject({ x: place('berth-east').x, y: place('berth-east').y, state: 'idle' });
    expect(frames.some((f) => (actor(f, 'teacher')?.x ?? Infinity) < place('quay-west').x)).toBe(true);
    // at the end: the galleon moored, the teacher gone toward the island, Kiur where he watched, the picture dark
    expect(actor(run, 'galleon')).toMatchObject({ x: place('berth-east').x, y: place('berth-east').y });
    expect(actor(run, 'teacher')).toBeUndefined();
    expect(actor(run, 'kiur')).toMatchObject({ x: place('quay-west').x });
    expect(scriptView(run).dark).toBe(1);
  });

  it('ft_1_27.AC2 a skip ends where playing it through ends', () => {
    const played = scriptView(playToEnd().run);
    const skipped = scriptView(skipScript(startScript(script, scene.places, timing).run).run);
    expect(skipped).toEqual(played);
  });
});
