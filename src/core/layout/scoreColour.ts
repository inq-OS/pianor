import type { NoteTiming } from '../judge/types';
import { DEFAULT_TEMPO_WINDOWS, type TempoWindows } from '../judge/timing';

/** The ink of the staff: notes, staff lines and the played-key line. One value, shared by the score colours and the staff view. */
export const STAFF_INK = 0x1b1b2f;

/** The colours of the score view of Tempo mode (red missed, black to grey fine, yellow to orange mistimed). */
export const SCORE_COLOURS = {
  missed: 0xd7263d,
  good: STAFF_INK, // the ink of the staff, so a perfect note looks like any note
  goodFaded: 0x8c8c9c, // grey: still fine, but not dead on
  mistimed: 0xffc83d, // yellow
  mistimedWorst: 0xff7a00, // orange
} as const;

const channel = (from: number, to: number, shift: number, t: number) => {
  const a = (from >> shift) & 0xff;
  const b = (to >> shift) & 0xff;
  return Math.round(a + (b - a) * t) << shift;
};

/** `from` to `to` by `t` (0 to 1, clamped), channel by channel. */
export function mixColour(from: number, to: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return channel(from, to, 16, k) | channel(from, to, 8, k) | channel(from, to, 0, k);
}

/**
 * The colour of a note after it was played or missed: `null` for a note not decided yet (it keeps the staff's colour).
 * On time: black fading to grey the further from dead on, up to the on-time window. Beyond it (early or late): yellow
 * turning orange up to the edge of the playing window. Missed: red.
 * With hold grading: a note let go before its full hold is yellow turning orange by how early it was let go
 * (`hold` 99 is almost yellow, 0 is orange). When the press was early or late too, the worse of the two shows.
 * A hold of 100, or none, leaves the colour as it was without hold grading.
 */
export function scoreColour(timing: NoteTiming | null, missed: boolean, windows: TempoWindows = DEFAULT_TEMPO_WINDOWS): number | null {
  if (missed) return SCORE_COLOURS.missed;
  if (timing === null) return null;
  const distance = Math.abs(timing.errorMs);
  const pressT = (distance - windows.goodMs) / Math.max(1, windows.windowMs - windows.goodMs);
  if (timing.hold === undefined || timing.hold >= 100) {
    if (timing.verdict === 'on-time') return mixColour(SCORE_COLOURS.good, SCORE_COLOURS.goodFaded, distance / Math.max(1, windows.goodMs));
    return mixColour(SCORE_COLOURS.mistimed, SCORE_COLOURS.mistimedWorst, pressT);
  }
  const holdT = 1 - timing.hold / 100;
  const t = timing.verdict === 'on-time' ? holdT : Math.max(pressT, holdT);
  return mixColour(SCORE_COLOURS.mistimed, SCORE_COLOURS.mistimedWorst, t);
}
