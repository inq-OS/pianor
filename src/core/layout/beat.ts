import { TEMPO_RULES } from '../learn/tempo';

/**
 * The beat ring (core_13 rule 2): a circle with one dot a beat of the bar, the first at the top, going clockwise, and a hand
 * that sweeps round it. Each click lights its dot (`clickRing`); in a learning run each key played lights the dot of its
 * beat and leaves a mark where the hand was at the press, so a key early or late against the student's own pace shows
 * (`pressRing`, ft_1_32 rule 8). Pure: the scene only paints it, and it decides nothing.
 */
export interface BeatRing {
  /** Dots on the ring: the beats of a whole bar. */
  beats: number;
  /** The dot lit: the click just heard or the key just played on a beat; null for none. */
  lit: number | null;
  /** How bright the lit dot is: 1 at its moment, 0 by the next beat. */
  glow: number;
  /** The hand's place in beats from the bar's first beat, 0 up to `beats`; null when it does not sweep. */
  hand: number | null;
  /** The last key against the pace: where the hand was at the press (in beats) and how far off it was. */
  mark: PaceMark | null;
}

export type PaceSide = 'even' | 'early' | 'late';

export interface PaceMark {
  side: PaceSide;
  /** Off by more than `PACE_MARKS.far`: a gap that the run's evenness does not count (d281). */
  far: boolean;
  /** Where the hand was at the press, in beats from the bar's first beat. */
  at: number;
}

/**
 * `AX-3 provisional:` a key is even within `near` of the gap the pace asks (the rushing margin, ft_1_32 rule 12), and far
 * off beyond `far`, the share that makes a gap uneven for the run's verdict (`TEMPO_RULES.tolerance`, d281); between the
 * two it shows early or late but still counts as even.
 */
export const PACE_MARKS = { near: 0.2, far: TEMPO_RULES.tolerance } as const;

/** How long the light of a key played lasts when no pace is known yet, in ms. */
const PRESS_GLOW_MS = 400;

const EMPTY: Omit<BeatRing, 'beats'> = { lit: null, glow: 0, hand: null, mark: null };

/** The dots' centres round (0, 0) at `radius`, the first at the top, clockwise (y grows down). */
export function ringDots(beats: number, radius: number): { x: number; y: number }[] {
  return Array.from({ length: beats }, (_, i) => ringPoint(i, beats, radius));
}

/** The point `place` beats round a ring of `beats` at `radius`. */
export function ringPoint(place: number, beats: number, radius: number): { x: number; y: number } {
  const angle = (2 * Math.PI * place) / beats;
  return { x: radius * Math.sin(angle), y: -radius * Math.cos(angle) };
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * The ring of the metronome's click (core_13.AC1): `beat` the latest click heard (its beat in the bar, its time on the audio
 * clock and the time to the next), lit fully at its moment and fading out by the next, with the hand reaching the next
 * dot exactly when its click is due and waiting there.
 */
export function clickRing(beat: { beatInBar: number; atMs: number; intervalMs: number } | null, beats: number, nowMs: number): BeatRing {
  if (!beat || nowMs < beat.atMs || !(beat.intervalMs > 0)) return { beats, ...EMPTY };
  const phase = clamp01((nowMs - beat.atMs) / beat.intervalMs);
  return { beats, lit: beat.beatInBar % beats, glow: 1 - phase, hand: (beat.beatInBar + phase) % beats, mark: null };
}

/** How far a played gap is off the gap the pace asks, as a share: -0.3 is 30% short (early), 0.3 30% long (late). */
export function paceOff(writtenMs: number, playedMs: number, pace: number): number {
  return playedMs / (writtenMs * pace) - 1;
}

/** Whether a gap `off` (`paceOff`) is even, early or late, and whether it is far off. */
export function paceMark(off: number): Omit<PaceMark, 'at'> {
  const size = Math.abs(off);
  if (size <= PACE_MARKS.near) return { side: 'even', far: false };
  return { side: off < 0 ? 'early' : 'late', far: size > PACE_MARKS.far };
}

/**
 * The ring of a learning run (core_13.AC5): `press` the latest key played (its place in beats in the bar, its time, and
 * its mark against the pace), lit at its press and fading over a beat; the hand sweeps on from it at `beatMs` (a quarter
 * at the student's own pace), once round at most, so a pause shows as the hand running past the next dot. With no pace yet
 * there is no hand and no mark.
 */
export function pressRing(press: { place: number; atMs: number; mark: PaceMark | null } | null, beats: number, beatMs: number | null, nowMs: number): BeatRing {
  if (!press || nowMs < press.atMs) return { beats, ...EMPTY };
  const elapsed = nowMs - press.atMs;
  const onBeat = Math.abs(press.place - Math.round(press.place)) < 1e-6;
  const lit = onBeat ? Math.round(press.place) % beats : null;
  const glow = 1 - clamp01(elapsed / (beatMs ?? PRESS_GLOW_MS));
  const hand = beatMs && beatMs > 0 ? (press.place + Math.min(beats, elapsed / beatMs)) % beats : null;
  return { beats, lit, glow, hand, mark: beatMs ? press.mark : null };
}

/**
 * The room the staff leaves at its right for the beat ring, in staff spaces (core_13 rule 2): the ring stands on the
 * parchment there, as big as the notes are, never over one. `AX-3 provisional:` seven spaces.
 */
export const RING_ROOM = 7;

/** Margins left of the ring (from the staff), right of it (off the sheet's torn edge) and below it, in staff spaces. */
const RING_MARGIN = { left: 0.5, right: 1, foot: 1.2 } as const;

/**
 * Where the ring stands on the screen (`area` the staff's area, screen pixels): a square in the room of `room` staff spaces
 * the staff left at its right, at the foot of the sheet, under a learning run's prize column. null with no room, or a sheet
 * too low for the ring.
 */
export function ringBox(area: { top: number; width: number; height: number }, staffSpace: number, room: number): { x: number; y: number; size: number } | null {
  if (!(room > 0) || !(staffSpace > 0)) return null;
  const size = Math.floor((room - RING_MARGIN.left - RING_MARGIN.right) * staffSpace);
  const bottom = area.top + area.height - RING_MARGIN.foot * staffSpace;
  const y = Math.round(bottom - size);
  if (y < area.top + area.height / 2) return null;
  const x = Math.round(area.width - (room - RING_MARGIN.left) * staffSpace);
  return { x, y, size };
}
