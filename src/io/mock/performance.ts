import type { Chart } from '../../core/chart';
import { MIDI_MAX, MIDI_VELOCITY_MIN, tieChain, tieLinks, tickToMs } from '../../core/chart';
import { buildSteps, classifyWrongNote } from '../../core/judge';
import { mulberry32 } from '../../core/random';
import { EZ220_HIGH, EZ220_LOW } from '../ez220';
import type { VirtualEz220 } from './VirtualEz220';
import type { Scheduler } from './scheduler';

/** One key event at a time on a performance timeline. */
export interface TimedNoteEvent {
  atMs: number;
  kind: 'on' | 'off';
  midi: number;
  velocity: number;
}

export type MistakeKind = 'wrong-octave' | 'neighbour-key' | 'wrong-letter' | 'skip';

/** A scripted mistake before step `stepIndex`: `count` wrong keys of one kind, or `skip` to never play the step. */
export interface ScriptedMistake {
  stepIndex: number;
  kind: MistakeKind;
  count?: number;
}

export interface PerformanceOptions {
  /** 1 = the chart tempo, 2 = twice as fast. */
  tempoScale?: number;
  /** Time of the first note. */
  startMs?: number;
  /** Constant delay added to every event, like keyboard-to-browser latency. */
  latencyMs?: number;
  /** Each step's onset is moved by a random amount in +/- jitterMs. */
  jitterMs?: number;
  /** Seed for jitter and velocity variation: the same options always give the same performance. */
  seed?: number;
  velocity?: number;
  velocityJitter?: number;
  /**
   * How long a key is held, as a fraction of the time to the next step. Left out (and with no `holdMs`), each key is held
   * for its own written value (a tie chain as one) less a short release gap, and goes up before it is pressed again; with
   * little jitter Tempo mode grades that as held in full (d093).
   */
  holdFraction?: number;
  /** Every key is held exactly this long (ms): a scripted tap or a long hold. Wins over `holdFraction`. */
  holdMs?: number;
  /** Time between keys of a chord. */
  chordSpreadMs?: number;
  /** Order in which chord keys are pressed. */
  chordOrder?: 'ascending' | 'descending' | 'shuffled';
  /**
   * How the hands meet in a step that needs both. 'together' (default) presses every key of the step within
   * `chordSpreadMs`; 'apart' presses one hand, then the other `handGapMs` later. Steps with one hand are unchanged.
   */
  hands?: 'together' | 'apart';
  /** Which hand goes first when the hands are apart, and when together with `handOrder` given. Default left first. */
  handOrder?: 'left-first' | 'right-first';
  /** Time between the two hands when apart. The default (500 ms) is longer than the judge's together window (300 ms). */
  handGapMs?: number;
  /** Gap between a wrong key and the next key. */
  mistakeGapMs?: number;
  mistakes?: readonly ScriptedMistake[];
}

const clampVelocity = (v: number) => Math.max(MIDI_VELOCITY_MIN, Math.min(MIDI_MAX, Math.round(v)));

const handOf = (chart: Chart, noteIndex: number): 'RH' | 'LH' | null =>
  chart.tracks.find((t) => t.id === chart.notes[noteIndex]!.track)?.hand ?? null;

/** A wrong key of the requested kind for the awaited notes. Always really wrong and always on the EZ-220's keys. */
export function wrongKeyFor(kind: Exclude<MistakeKind, 'skip'>, awaiting: readonly number[], attempt: number): number {
  const base = awaiting[0]!;
  const candidates: Record<Exclude<MistakeKind, 'skip'>, number[]> = {
    'wrong-octave': [base + 12, base - 12, base + 24, base - 24],
    'neighbour-key': [base + 1, base - 1, base + 2, base - 2],
    'wrong-letter': [base + 7, base + 4, base - 5, base - 7, base + 9, base - 9],
  };
  const valid = candidates[kind].filter((m) => {
    if (m < EZ220_LOW || m > EZ220_HIGH || awaiting.includes(m)) return false;
    return classifyWrongNote(m, awaiting).reason === kind;
  });
  if (valid.length === 0) throw new Error(`No ${kind} key available next to ${base}`);
  return valid[attempt % valid.length]!;
}

/** The last step has no next onset to measure its slot to, so it gets this long (ms). */
const LAST_SLOT_MS = 400;
/** With no hold given, a key goes up this long (ms) before its note ends, at most this share of the note. */
const RELEASE_GAP_MS = 30;
const RELEASE_GAP_SHARE = 0.1;
/** A key let go so it can be pressed again goes up at least this long (ms) before that press. */
const REPRESS_GAP_MS = 5;
/** A key is held at least this long (ms), however short its slot, so a fast run still sends a real press. */
const MIN_HOLD_MS = 20;
/** A planned mistake is a quick wrong key: held at most this long (ms) before the right one. */
const MISTAKE_HOLD_MAX_MS = 80;

/**
 * Compose a performance of a chart: what a (scripted) player does on the keyboard. Pure and deterministic.
 * Use with `ScriptedKeyboard` (events only) or `playThroughDevice` (through the virtual EZ-220's MIDI bytes).
 */
export function composePerformance(chart: Chart, options: PerformanceOptions = {}): TimedNoteEvent[] {
  const {
    tempoScale = 1, startMs = 0, latencyMs = 0, jitterMs = 0, seed = 1, velocity = 80, velocityJitter = 0,
    holdFraction, holdMs, chordSpreadMs = 15, chordOrder = 'ascending', mistakeGapMs = 150, mistakes = [],
    hands = 'together', handGapMs = 500,
  } = options;
  const random = mulberry32(seed);
  const steps = buildSteps(chart);
  const playTracks = new Set(chart.tracks.filter((t) => t.role === 'play').map((t) => t.id));
  const links = tieLinks(chart, playTracks);
  /** A note's written value in ms (its tie chain as one), less the release gap. */
  const valueHold = (note: number) => {
    const last = tieChain(links, note).at(-1) ?? note;
    const end = chart.notes[last]!;
    const value = (tickToMs(chart.tempoMap, end.tick + end.dur, chart.ppq) - tickToMs(chart.tempoMap, chart.notes[note]!.tick, chart.ppq)) / tempoScale;
    return value - Math.min(RELEASE_GAP_MS, value * RELEASE_GAP_SHARE);
  };
  const out: TimedNoteEvent[] = [];
  const keyPresses: { down: TimedNoteEvent; up: TimedNoteEvent }[] = [];

  const vel = () => clampVelocity(velocity + (random() * 2 - 1) * velocityJitter);
  const press = (at: number, midi: number, holdMs: number) => {
    const v = vel();
    const down: TimedNoteEvent = { atMs: at, kind: 'on', midi, velocity: v };
    const up: TimedNoteEvent = { atMs: at + holdMs, kind: 'off', midi, velocity: 0 };
    out.push(down, up);
    keyPresses.push({ down, up });
  };

  steps.forEach((step, i) => {
    const onset = tickToMs(chart.tempoMap, step.tick, chart.ppq) / tempoScale;
    const next = steps[i + 1];
    const slot = next ? tickToMs(chart.tempoMap, next.tick, chart.ppq) / tempoScale - onset : LAST_SLOT_MS;
    const hold = Math.max(MIN_HOLD_MS, holdMs ?? slot * (holdFraction ?? 0.7));
    /** How long the key of `midi` in this step is held. */
    const holdOf = (midi: number) => {
      if (holdMs !== undefined || holdFraction !== undefined) return hold;
      const note = step.noteIndices.find((n) => chart.notes[n]!.midi === midi)!;
      return Math.max(MIN_HOLD_MS, valueHold(note));
    };
    const at = startMs + latencyMs + onset + (random() * 2 - 1) * jitterMs;
    const midis = step.noteIndices.map((n) => chart.notes[n]!.midi);

    for (const mistake of mistakes.filter((m) => m.stepIndex === i)) {
      if (mistake.kind === 'skip') continue;
      const count = mistake.count ?? 1;
      for (let k = 0; k < count; k++) {
        press(Math.max(0, at - mistakeGapMs * (count - k)), wrongKeyFor(mistake.kind, midis, k), Math.min(hold, MISTAKE_HOLD_MAX_MS));
      }
    }
    if (mistakes.some((m) => m.stepIndex === i && m.kind === 'skip')) return;

    const order = (keys: number[]) => {
      const ordered = [...keys].sort((a, b) => a - b);
      if (chordOrder === 'descending') ordered.reverse();
      if (chordOrder === 'shuffled') ordered.sort(() => random() - 0.5);
      return ordered;
    };

    // The keys of each hand, left hand first unless asked otherwise (the left hand is the lower one in a normal piece).
    const byHand = (['LH', 'RH'] as const)
      .map((hand) => step.noteIndices.filter((n) => handOf(chart, n) === hand).map((n) => chart.notes[n]!.midi))
      .filter((keys) => keys.length > 0);
    if (options.handOrder === 'right-first' && byHand.length === 2) byHand.reverse();

    if (byHand.length === 2 && byHand[0]!.length + byHand[1]!.length === midis.length && (hands === 'apart' || options.handOrder !== undefined)) {
      const gap = hands === 'apart' ? handGapMs : chordSpreadMs;
      const second = order(byHand[1]!);
      if (next && gap + (second.length - 1) * chordSpreadMs >= slot) {
        throw new Error(`The gap of ${gap} ms between the hands does not fit in the ${Math.round(slot)} ms before the next step; slow the performance down or shorten the gap`);
      }
      order(byHand[0]!).forEach((midi, k) => press(at + k * chordSpreadMs, midi, holdOf(midi)));
      second.forEach((midi, k) => press(at + gap + k * chordSpreadMs, midi, holdOf(midi)));
      return;
    }
    order(midis).forEach((midi, k) => press(at + k * chordSpreadMs, midi, holdOf(midi)));
  });

  // A key goes up before it is pressed again: a hold that would run past the key's next press (jitter, an early next
  // note) ends REPRESS_GAP_MS before it, as on a real keyboard.
  const byKey = new Map<number, { down: TimedNoteEvent; up: TimedNoteEvent }[]>();
  for (const press of keyPresses) byKey.set(press.down.midi, [...(byKey.get(press.down.midi) ?? []), press]);
  for (const presses of byKey.values()) {
    presses.sort((a, b) => a.down.atMs - b.down.atMs);
    presses.forEach(({ down, up }, k) => {
      const next = presses[k + 1];
      if (next && up.atMs > next.down.atMs - REPRESS_GAP_MS) up.atMs = Math.max(down.atMs + 1, next.down.atMs - REPRESS_GAP_MS);
    });
  }

  // Stable sort by time; a release at the same instant as a press goes first so repeated notes retrigger cleanly.
  return out
    .map((event, order) => ({ event, order }))
    .sort((a, b) => a.event.atMs - b.event.atMs || (a.event.kind === b.event.kind ? a.order - b.order : a.event.kind === 'off' ? -1 : 1))
    .map(({ event }) => event);
}

/** Send a performance through the virtual keyboard as raw MIDI bytes, with `atMs` as the message timestamp. */
export function playThroughDevice(device: Pick<VirtualEz220, 'isConnected' | 'press' | 'release'>, events: readonly TimedNoteEvent[], scheduler: Scheduler): void {
  for (const e of events) {
    scheduler.at(e.atMs, () => {
      if (!device.isConnected) return;
      if (e.kind === 'on') device.press(e.midi, e.velocity, e.atMs);
      else device.release(e.midi, e.atMs);
    });
  }
}
