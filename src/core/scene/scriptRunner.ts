/**
 * The script interpreter (ft_1_24.AC6, WP-07; contract A.7): steps a `Script` through screen time and says what the stage
 * looks like at every moment. Pure: the scene (`src/game/adventure/`) feeds it the frame's milliseconds and presses, draws
 * `scriptView`, and carries out the events (a phrase to play, an item given). The same total time in any number of steps
 * gives the same stage, so nothing depends on the frame rate.
 */
import type { ActorId, Facing, ItemId, PieceId, PlaceId, StringKey } from '../contracts';
import type { ActorState } from './actor';
import type { StandingPlace } from './scene';
import type { Script, ScriptCommand } from './script';

/** How long the commands that take time last; the scene knows the words and the pieces, the interpreter does not. */
export interface ScriptTiming {
  /** How fast an actor walks (or a boat sails), fine pixels a second. */
  readonly walkPxPerSecond: number;
  /** How long a line stays when no one presses (see `readingMs`). */
  readonly sayMs: (line: StringKey) => number;
  /** How long a phrase sounds; 0 when the game cannot play it (the command then takes no time). */
  readonly phraseMs: (piece: PieceId) => number;
}

/** One actor on the stage as drawn: its feet in the picture's fine pixels, its scale, its facing and the state it shows. */
export interface StageActor {
  readonly id: ActorId;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly facing: Facing;
  readonly state: ActorState;
}

/** What to draw now: the actors back to front (by their feet), how dark the picture is (0 clear, 1 black), the line said. */
export interface ScriptView {
  readonly actors: readonly StageActor[];
  readonly dark: number;
  readonly line: { readonly actor: ActorId; readonly line: StringKey } | null;
}

/** What the scene must do once: start a phrase through the audio output (not judged), hand over an item, or end. */
export type ScriptEvent =
  | { readonly kind: 'playPhrase'; readonly actor: ActorId; readonly piece: PieceId }
  | { readonly kind: 'give'; readonly item: ItemId }
  | { readonly kind: 'done' };

/** A script being run. Treat as opaque; read it through `scriptView` and `done`. */
export interface ScriptRun {
  readonly script: Script;
  readonly done: boolean;
  /** The command running now (one that takes time), or the length of the list when done. */
  readonly index: number;
  /** Milliseconds into that command. */
  readonly at: number;
  /** The stage as the commands before `index` left it, in the order the actors came on. */
  readonly actors: readonly StageActor[];
  readonly dark: number;
  readonly places: ReadonlyMap<PlaceId, StandingPlace>;
  readonly timing: ScriptTiming;
}

export interface ScriptStep {
  readonly run: ScriptRun;
  readonly events: readonly ScriptEvent[];
}

/** An actor standing in the scene before the script starts. */
export interface CastMember { readonly actor: ActorId; readonly place: PlaceId }

/**
 * How long a line of `text` stays unpressed: a floor of 2.5 s, more for a longer line, slow enough for a young student who
 * reads. AX-3 provisional: the numbers.
 */
export function readingMs(text: string): number {
  return Math.max(2500, 1000 + 80 * text.length);
}

/**
 * Starts `script` on a scene with `places`, with `cast` already standing. The commands that take no time at its head are
 * carried out at once. Throws for a place the scene does not have (content is checked by `scriptProblems` before).
 */
export function startScript(script: Script, places: readonly StandingPlace[], timing: ScriptTiming, cast: readonly CastMember[] = []): ScriptStep {
  const byId = new Map(places.map((p) => [p.id, p]));
  for (const id of [...cast.map((c) => c.place), ...script.commands.flatMap(placeOf)]) {
    if (!byId.has(id)) throw new Error(`the script ${script.id} names the place ${id}, which the scene does not have`);
  }
  const actors = cast.map((c) => standing(c.actor, byId.get(c.place)!));
  const run: ScriptRun = { script, done: script.commands.length === 0, index: 0, at: 0, actors, dark: 0, places: byId, timing };
  const events: ScriptEvent[] = [];
  return { run: settle(run, events), events };
}

/** Steps `run` by `ms` milliseconds of screen time. */
export function stepScript(run: ScriptRun, ms: number): ScriptStep {
  const events: ScriptEvent[] = [];
  let now = run;
  let left = Math.max(0, ms);
  while (!now.done) {
    const length = lengthOf(now);
    if (now.at + left < length) {
      now = { ...now, at: now.at + left };
      break;
    }
    left -= length - now.at;
    now = settle(advance(finish(now)), events);
  }
  return { run: now, events };
}

/** A press (a key or the mouse) ends the line being said, as in MI2; anywhere else it does nothing. */
export function pressScript(run: ScriptRun): ScriptStep {
  const command = current(run);
  if (!command || !('say' in command)) return { run, events: [] };
  return stepScript({ ...run, at: lengthOf(run) }, 0);
}

/**
 * Skips the rest of a skippable script: every command is carried out at once, so the actors stand where the script leaves
 * them and every item is given; no phrase is played and no line said. A script that is not skippable is left as it is.
 */
export function skipScript(run: ScriptRun): ScriptStep {
  if (run.done || !run.script.skippable) return { run, events: [] };
  const events: ScriptEvent[] = [];
  let now = run;
  while (!now.done) {
    const command = current(now)!;
    if ('give' in command) events.push({ kind: 'give', item: command.give });
    now = advance(finish(now));
  }
  events.push({ kind: 'done' });
  return { run: now, events };
}

/** The stage now, the command running carried part way (a walk, a fade) or shown (a line, a phrase). */
export function scriptView(run: ScriptRun): ScriptView {
  const command = current(run);
  let actors = run.actors;
  let dark = run.dark;
  let line: ScriptView['line'] = null;
  if (command) {
    const part = lengthOf(run) > 0 ? run.at / lengthOf(run) : 1;
    if ('walkTo' in command) {
      const to = run.places.get(command.place)!;
      actors = actors.map((a) => (a.id === command.walkTo ? walking(a, to, part) : a));
    } else if ('fade' in command) {
      dark = command.fade === 'in' ? 1 - part : part;
    } else if ('say' in command) {
      actors = withState(actors, command.say, 'talk');
      line = { actor: command.say, line: command.line };
    } else if ('playPhrase' in command) {
      actors = withState(actors, command.playPhrase, 'play');
    }
  }
  return { actors: [...actors].sort((a, b) => a.y - b.y), dark, line };
}

/**
 * What is wrong with `script` on a scene with `places`, with `cast` standing at its start: a place the scene does not have,
 * an actor walked, turned, heard or sent off when it is not on the stage. One line per problem, commands counted from 1.
 */
export function scriptProblems(script: Script, places: readonly PlaceId[], cast: readonly ActorId[]): string[] {
  const known = new Set(places);
  const on = new Set(cast);
  const problems: string[] = [];
  script.commands.forEach((command, i) => {
    const at = `command ${i + 1}`;
    for (const place of placeOf(command)) if (!known.has(place)) problems.push(`${at}: no place ${place} in the scene`);
    const who = actorOf(command);
    if ('enter' in command) on.add(command.enter);
    else if (who !== null && !on.has(who)) problems.push(`${at}: ${who} is not on the stage`);
    if ('exit' in command) on.delete(command.exit);
  });
  return problems;
}

function placeOf(command: ScriptCommand): PlaceId[] {
  return 'place' in command ? [command.place] : [];
}

function actorOf(command: ScriptCommand): ActorId | null {
  if ('walkTo' in command) return command.walkTo;
  if ('face' in command) return command.face;
  if ('say' in command) return command.say;
  if ('playPhrase' in command) return command.playPhrase;
  if ('exit' in command) return command.exit;
  return null;
}

function current(run: ScriptRun): ScriptCommand | undefined {
  return run.done ? undefined : run.script.commands[run.index];
}

function standing(id: ActorId, place: StandingPlace): StageActor {
  return { id, x: place.x, y: place.y, scale: place.scale ?? 1, facing: place.facing, state: 'idle' };
}

/** How long the running command lasts, in milliseconds. */
function lengthOf(run: ScriptRun): number {
  const command = current(run);
  if (!command) return 0;
  if ('wait' in command) return command.wait;
  if ('fade' in command) return command.ms;
  if ('say' in command) return Math.max(0, run.timing.sayMs(command.line));
  if ('playPhrase' in command) return Math.max(0, run.timing.phraseMs(command.piece));
  if ('walkTo' in command) {
    const from = run.actors.find((a) => a.id === command.walkTo);
    const to = run.places.get(command.place)!;
    // an actor not on the stage is put on its place at once (scriptProblems names it)
    return from ? (Math.hypot(to.x - from.x, to.y - from.y) * 1000) / run.timing.walkPxPerSecond : 0;
  }
  return 0;
}

function walking(actor: StageActor, to: StandingPlace, part: number): StageActor {
  const lerp = (a: number, b: number) => a + (b - a) * part;
  const facing: Facing = to.x < actor.x ? 'left' : to.x > actor.x ? 'right' : actor.facing;
  return { ...actor, x: lerp(actor.x, to.x), y: lerp(actor.y, to.y), scale: lerp(actor.scale, to.scale ?? 1), facing, state: 'walk' };
}

function withState(actors: readonly StageActor[], id: ActorId, state: ActorState): readonly StageActor[] {
  return actors.map((a) => (a.id === id ? { ...a, state } : a));
}

/** The running command carried out to its end (the stage as it leaves it); `index` is not moved. */
function finish(run: ScriptRun): ScriptRun {
  const command = current(run)!;
  const place = 'place' in command ? run.places.get(command.place)! : undefined;
  if ('enter' in command) return { ...run, actors: [...run.actors.filter((a) => a.id !== command.enter), standing(command.enter, place!)] };
  if ('exit' in command) return { ...run, actors: run.actors.filter((a) => a.id !== command.exit) };
  if ('face' in command) return { ...run, actors: run.actors.map((a) => (a.id === command.face ? { ...a, facing: command.facing } : a)) };
  if ('fade' in command) return { ...run, dark: command.fade === 'in' ? 0 : 1 };
  if ('walkTo' in command) {
    const on = run.actors.some((a) => a.id === command.walkTo);
    if (!on) return { ...run, actors: [...run.actors, standing(command.walkTo, place!)] };
    return { ...run, actors: run.actors.map((a) => (a.id === command.walkTo ? { ...walking(a, place!, 1), state: 'idle' } : a)) };
  }
  return run;
}

function advance(run: ScriptRun): ScriptRun {
  const index = run.index + 1;
  return { ...run, index, at: 0, done: index >= run.script.commands.length };
}

/**
 * Carries out every command from the current one that takes no time, announcing phrases and items, until one that takes
 * time is running or the script is done.
 */
function settle(run: ScriptRun, events: ScriptEvent[]): ScriptRun {
  let now = run;
  for (;;) {
    if (now.done) {
      events.push({ kind: 'done' });
      return now;
    }
    const command = current(now)!;
    if ('give' in command) events.push({ kind: 'give', item: command.give });
    if (lengthOf(now) > 0) {
      if ('playPhrase' in command) events.push({ kind: 'playPhrase', actor: command.playPhrase, piece: command.piece });
      return now;
    }
    now = advance(finish(now));
  }
}
