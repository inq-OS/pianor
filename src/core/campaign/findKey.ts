import { PPQ, tieChain, tieLinks, type Chart } from '../chart';
import type { PlayStep } from '../judge/steps';

/** One key press: time in ms since phase 1 started, and the MIDI note. */
export interface FindKeyPress {
  timeMs: number;
  midi: number;
}

/** What phase 1 needs of one step: the keys to press (a chord needs all, in any order), its length and its bar. */
export interface KeyStep {
  pitches: readonly number[];
  /** Length in quarter notes, ties added; for a chord the longest note. */
  beats: number;
  bar: number;
}

/** The numbers of the mistake score. The defaults are content (`content/campaign/ladder.json`); these are its fallback. */
export interface CrackRules {
  /** A part of this many notes gets one crack per plain slip. */
  crackNotes: number;
  /** Extra weight per beat beyond a quarter note. */
  lengthStep: number;
  /** Extra weight per earlier note of the same pitch in the bar. */
  repeatStep: number;
  /** Most a slip can weigh, in plain slips. */
  weightCap: number;
}

export const DEFAULT_CRACK_RULES: CrackRules = { crackNotes: 16, lengthStep: 0.25, repeatStep: 0.25, weightCap: 2.5 };
export const DEFAULT_FIND_KEY_WINDOW_MS = 120000;
/** Mistake score per crack. */
const CRACK_POINTS = 100;
/** Rounding guard: 18 slips of 1600 / 96 must be 3 cracks, not 2.999... */
const EPSILON = 1e-9;

export interface FindKeyOptions {
  /** Window length in ms (default 120000). */
  windowMs?: number;
  /** Cracks that break the key: the level's difficulty. */
  cracks: number;
  rules?: CrackRules;
}

export type FindKeyStatus = 'in-progress' | 'passed' | 'key-broken' | 'window-expired';

/** The state of one attempt. Treat as read-only: every function returns a new one. */
export interface FindKeyState {
  readonly status: FindKeyStatus;
  /** Index of the step being looked for. */
  readonly step: number;
  /** Mistake score Y so far. */
  readonly score: number;
  /** Cracks shown on the key: one per 100 points of Y. */
  readonly cracks: number;
  readonly maxCracks: number;
  /** Keys of the current step still to press. */
  readonly remaining: readonly number[];
  /** The current step already got its slip. */
  readonly slipped: boolean;
  readonly steps: readonly KeyStep[];
  /** Score each step adds when it slips (`slipWeights`). */
  readonly weights: readonly number[];
  readonly windowMs: number;
}

/** Phase 1 steps from a chart's play steps: each step's pitches, its bar and its length with ties. */
export function keyStepsOf(chart: Chart, steps: readonly PlayStep[]): KeyStep[] {
  const playTracks = new Set(chart.tracks.filter((t) => t.role === 'play').map((t) => t.id));
  const links = tieLinks(chart, playTracks);
  // each note's length with its own tie chain; the step is as long as its longest note
  const lengthOf = (i: number) => tieChain(links, i).reduce((sum, j) => sum + chart.notes[j]!.dur, chart.notes[i]!.dur);
  return steps.map((s) => ({
    pitches: s.noteIndices.map((i) => chart.notes[i]!.midi),
    beats: Math.max(...s.noteIndices.map(lengthOf)) / PPQ,
    bar: s.bar,
  }));
}

/**
 * What one slip of each step adds to Y: `base × L × R`, with `base = 100 × crackNotes / n`,
 * `L = 1 + lengthStep × (beats − 1)` above a quarter note, `R = 1 + repeatStep × k` for k earlier steps
 * with the same set of pitches in the bar, and `L × R` capped at `weightCap`. n counts steps, so a chord
 * is one note, the same unit a slip is counted in.
 */
export function slipWeights(steps: readonly KeyStep[], rules: CrackRules): number[] {
  if (steps.length === 0) return [];
  const base = (CRACK_POINTS * rules.crackNotes) / steps.length;
  const seen = new Map<string, number>();
  return steps.map((s) => {
    const id = `${s.bar}:${[...s.pitches].sort((a, b) => a - b).join(',')}`;
    const k = seen.get(id) ?? 0;
    seen.set(id, k + 1);
    const length = s.beats > 1 ? 1 + rules.lengthStep * (s.beats - 1) : 1;
    const repeat = 1 + rules.repeatStep * k;
    return base * Math.min(length * repeat, rules.weightCap);
  });
}

/** A fresh attempt: no cracks, the first step to find. */
export function startFindKey(steps: readonly KeyStep[], options: FindKeyOptions): FindKeyState {
  return {
    status: steps.length === 0 ? 'passed' : 'in-progress',
    step: 0,
    score: 0,
    cracks: 0,
    maxCracks: options.cracks,
    remaining: steps[0]?.pitches ?? [],
    slipped: false,
    steps,
    weights: slipWeights(steps, options.rules ?? DEFAULT_CRACK_RULES),
    windowMs: options.windowMs ?? DEFAULT_FIND_KEY_WINDOW_MS,
  };
}

/**
 * The time is `nowMs` since the attempt started: at the window's end an unfinished attempt expires,
 * with nothing added to Y (the caller starts a new attempt). A finished attempt stays as it is.
 */
export function advanceTime(state: FindKeyState, nowMs: number): FindKeyState {
  if (state.status !== 'in-progress' || nowMs < state.windowMs) return state;
  return { ...state, status: 'window-expired' };
}

/**
 * One press. The right key moves on (a chord step when all its keys are down); a wrong key slips the
 * step, which adds its weight to Y the first time only, and the key breaks at once on its last crack.
 * A late press costs nothing. Pure: time comes only from the press.
 */
export function pressKey(state: FindKeyState, press: FindKeyPress): FindKeyState {
  const timed = advanceTime(state, press.timeMs);
  if (timed.status !== 'in-progress') return timed;

  if (state.remaining.includes(press.midi)) {
    const remaining = state.remaining.filter((m) => m !== press.midi);
    if (remaining.length > 0) return { ...state, remaining };
    const step = state.step + 1;
    const done = step >= state.steps.length;
    return {
      ...state,
      step,
      remaining: done ? [] : state.steps[step]!.pitches,
      slipped: false,
      status: done ? 'passed' : 'in-progress',
    };
  }

  if (state.slipped) return state;
  const score = state.score + state.weights[state.step]!;
  const cracks = Math.floor(score / CRACK_POINTS + EPSILON);
  return { ...state, score, cracks, slipped: true, status: cracks >= state.maxCracks ? 'key-broken' : 'in-progress' };
}

/** A whole attempt from a list of presses (any order), then the time `nowMs` if given. */
export function evaluateFindKey(
  steps: readonly KeyStep[],
  presses: readonly FindKeyPress[],
  options: FindKeyOptions & { nowMs?: number },
): FindKeyState {
  const ordered = [...presses].sort((a, b) => a.timeMs - b.timeMs);
  const played = ordered.reduce(pressKey, startFindKey(steps, options));
  return options.nowMs === undefined ? played : advanceTime(played, options.nowMs);
}
