import type { NoteTiming } from './types';

/**
 * The timing windows of Tempo mode, in ms either side of where a note falls on the clock. Provisional: a beginner's
 * windows are wide, and the real numbers wait for the latency measured on the EZ-220 (docs/features/ft_0_01-hardware-spike.md).
 */
export interface TempoWindows {
  /** Within this a note scores 100. */
  perfectMs: number;
  /** Within this a note counts as on time; beyond it, early or late (shown as mistimed). */
  goodMs: number;
  /** Beyond this a press is not for this note any more: the note is missed. Also capped to half the gap to its neighbours. */
  windowMs: number;
}

export const DEFAULT_TEMPO_WINDOWS: TempoWindows = { perfectMs: 60, goodMs: 150, windowMs: 400 };

/**
 * Tempo mode ignores a press of a grace note's pitch this long (ms) before its main note's time, or less (d121,
 * core_09.AC33). AX-3 provisional: grading the grace waits for the EZ-220's measured timing (spike ft_0_01).
 */
export const GRACE_EARLY_MS = 250;

/** How a press `errorMs` off its time (positive is late) counts: its verdict and a score from 100 down to 0. */
export function timingOf(errorMs: number, windows: TempoWindows = DEFAULT_TEMPO_WINDOWS): NoteTiming {
  const distance = Math.abs(errorMs);
  const verdict = distance <= windows.goodMs ? 'on-time' : errorMs < 0 ? 'early' : 'late';
  const span = Math.max(1, windows.windowMs - windows.perfectMs);
  const score = distance <= windows.perfectMs ? 100 : Math.max(0, Math.round(100 * (1 - (distance - windows.perfectMs) / span)));
  return { errorMs, verdict, score };
}

/**
 * How Tempo mode grades the hold of a note (core_01 slice f, d093). Provisional, like the windows: whether these feel right
 * to the student on the EZ-220 needs a human.
 */
export interface HoldRules {
  /** A hold of this share of the note's value counts as full... */
  fullFraction: number;
  /** ...or of the value less this many ms, whichever is longer (the slack keeps short notes clear of USB jitter). */
  slackMs: number;
  /** The factor on the press score of a tap (a hold of 0 ms); it rises linearly to 1 at a full hold. */
  tapFactor: number;
}

export const DEFAULT_HOLD_RULES: HoldRules = { fullFraction: 0.85, slackMs: 80, tapFactor: 0.5 };

/** How long a note of `valueMs` must be held, from its written start, to count as held in full. */
export function fullHoldMs(valueMs: number, rules: HoldRules = DEFAULT_HOLD_RULES): number {
  return Math.max(0, rules.fullFraction * valueMs, valueMs - rules.slackMs);
}

export interface NoteHold {
  heldMs: number;
  /** The hold that counts as full for this press. */
  fullMs: number;
  /** 0.5 (a tap) to 1 (full): the press score is multiplied by it. */
  factor: number;
  /** 0 to 100, rounded down: how much of the full hold was held (100 only for a full hold). */
  hold: number;
}

/**
 * A note of `valueMs` held for `heldMs`. The full hold is counted from the note's written start, so a press `errorMs` late
 * (negative: early) needs that much less (more): the expected release is where the note ends on the clock.
 */
export function holdOf(heldMs: number, valueMs: number, rules: HoldRules = DEFAULT_HOLD_RULES, errorMs = 0): NoteHold {
  return holdAgainst(heldMs, fullHoldMs(valueMs, rules) - errorMs, rules);
}

/** A key held `heldMs` when `fullMs` from its press counts as full (0 or less: any hold is full). */
export function holdAgainst(heldMs: number, fullMs: number, rules: HoldRules = DEFAULT_HOLD_RULES): NoteHold {
  fullMs = Math.max(0, fullMs);
  const share = fullMs === 0 ? 1 : Math.max(0, Math.min(1, heldMs / fullMs));
  return { heldMs, fullMs, factor: rules.tapFactor + (1 - rules.tapFactor) * share, hold: Math.floor(100 * share) };
}

/**
 * The following clock of Tempo mode (core_01.AC12), like a phase-locked loop: every note played puts the clock on its
 * press (the phase), and the tempo leans toward the pace of the gap just played (the period), inside a band around the
 * tempo that was set. AX-3 provisional numbers, to be set from the student's real runs.
 */
export interface FollowRules {
  /** The tempo may leave the set one by this share either way (0.15: 85% to 115%); 0 keeps the tempo and only waits. */
  band: number;
  /** How much of the difference to the pace just played the tempo takes at each note, 0 to 1. */
  gain: number;
}

export const DEFAULT_FOLLOW_RULES: FollowRules = { band: 0.15, gain: 0.25 };

/** The rate of the clock after a gap played at `played` times the set tempo, from the rate before it. */
export function followRate(rate: number, played: number, rules: FollowRules = DEFAULT_FOLLOW_RULES): number {
  if (!Number.isFinite(played) || played <= 0) return rate;
  return Math.min(1 + rules.band, Math.max(1 - rules.band, rate + rules.gain * (played - rate)));
}
