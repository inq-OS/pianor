/**
 * The circle of fifths (ft_1_28): twelve steps clockwise from C at the top, the major key outside, its relative minor inside
 * and the count of sharps or flats beyond them. Where each step and its words stand, which step a point is on, and which
 * step a key or a played tonic belongs to. Pure: the overlay only draws it, and a later trainer reuses it (rule 4).
 */
import { keyNames, type KeyMode } from '../editor/key';
import type { NoteNaming } from '../text/noteName';

export const CIRCLE_STEPS = 12;

/** A key on the circle: its fifths count (-7..7) and mode, as the editor and the chart keep it. */
export interface CircleKey {
  readonly fifths: number;
  readonly mode: KeyMode;
}

/** The count of one key signature at a step: `alter` 1 for sharps, -1 for flats, 0 for none (C major, a minor). */
export interface CircleSign {
  readonly count: number;
  readonly alter: 1 | -1 | 0;
}

export interface CirclePoint {
  readonly x: number;
  readonly y: number;
}

export interface CircleStep {
  /** 0 is C at the top; the index grows clockwise, one fifth up at a time. */
  readonly index: number;
  /** The fifths of each spelling shown on this step: one, or two at the bottom (F sharp and G flat) and where a seven-sign key is preferred. */
  readonly fifths: readonly number[];
  /** The major names (two at the bottom, F#/Gb) and the minor name, in the player's letter naming; a minor name is lowercase (e, f#, h). */
  readonly major: string;
  readonly minor: string;
  /** The counts written beyond the major name, one per spelling. */
  readonly signs: readonly CircleSign[];
  /** The middle of the step, in radians clockwise from straight up. */
  readonly angle: number;
  /** Where the major name, the minor name and the count stand (their middles). */
  readonly majorAt: CirclePoint;
  readonly minorAt: CirclePoint;
  readonly signAt: CirclePoint;
}

export interface CircleLayout {
  readonly cx: number;
  readonly cy: number;
  /** The rings, as radii from the middle: the minor ring from `hub` to `minor`, the major ring to `major`, the counts to `edge`. */
  readonly radii: { readonly hub: number; readonly minor: number; readonly major: number; readonly edge: number };
  readonly steps: readonly CircleStep[];
}

export type CircleRing = 'major' | 'minor';

/** Where in the minor ring its names stand, from the hub out: near its outer edge, where the ring is widest. */
const MINOR_NAME = 0.8;
/** The parts of the radius each ring takes: a small hub (the helm's boss), a minor ring wide enough for two letters at its bottom, and the counts on the helm's rim, deep enough for a brass plate. */
const HUB = 0.1;
const MINOR_EDGE = 0.55;
const MAJOR_EDGE = 0.79;

/** The step a fifths count stands on: C# major (7 sharps) shares the step of Db major (5 flats), Cb (7 flats) that of B. */
export function stepOfFifths(fifths: number): number {
  return ((fifths % CIRCLE_STEPS) + CIRCLE_STEPS) % CIRCLE_STEPS;
}

/** The step `by` steps on from `step`, round the circle either way. */
export function moveStep(step: number, by: number): number {
  return stepOfFifths(step + by);
}

/**
 * The fifths counts a step can be spelled with, from -7 to 7: one for most, two for the bottom (6 sharps, 6 flats) and for
 * the two steps a seven-sign key shares (5 sharps or 7 flats; 5 flats or 7 sharps).
 */
export function spellingsOf(step: number): number[] {
  return [step, step - CIRCLE_STEPS, step + CIRCLE_STEPS].filter((f) => f >= -7 && f <= 7);
}

/**
 * The spellings a step shows. The bottom shows both, sharps first (rule 2, AX-3 provisional); the steps with a seven-sign
 * spelling show only the one with fewer signs, unless a `prefer`red key (the piece's key) is spelled the other way.
 */
function shownSpellings(step: number, prefer: readonly number[]): number[] {
  const all = spellingsOf(step);
  if (all.length === 1) return all;
  if (step === 6) return [6, -6];
  const preferred = all.find((f) => prefer.includes(f) && Math.abs(f) === 7);
  return [preferred ?? all.reduce((a, b) => (Math.abs(a) <= Math.abs(b) ? a : b))];
}

function signOf(fifths: number): CircleSign {
  return { count: Math.abs(fifths), alter: fifths > 0 ? 1 : fifths < 0 ? -1 : 0 };
}

/** The key a step and ring stand for: a preferred spelling where the step has one (G flat for a piece in G flat), else its first. */
export function keyAt(step: number, ring: CircleRing, prefer: readonly number[] = []): CircleKey {
  const shown = shownSpellings(stepOfFifths(step), prefer);
  return { fifths: shown.find((f) => prefer.includes(f)) ?? shown[0]!, mode: ring };
}

/**
 * The circle laid out in a round area of `radius` about (`cx`, `cy`), with names in `naming` (d087). `prefer` lists fifths
 * counts whose spelling wins where a step has two (the key of the piece on screen, rule 3).
 */
export function circleLayout(area: { cx: number; cy: number; radius: number }, naming: NoteNaming, prefer: readonly number[] = []): CircleLayout {
  const { cx, cy, radius } = area;
  const radii = { hub: radius * HUB, minor: radius * MINOR_EDGE, major: radius * MAJOR_EDGE, edge: radius };
  const at = (angle: number, r: number): CirclePoint => ({ x: Math.round(cx + Math.sin(angle) * r), y: Math.round(cy - Math.cos(angle) * r) });
  const steps = Array.from({ length: CIRCLE_STEPS }, (_, index): CircleStep => {
    const fifths = shownSpellings(index, prefer);
    const names = fifths.map((f) => keyNames(f, naming));
    const angle = (index * 2 * Math.PI) / CIRCLE_STEPS;
    return {
      index,
      fifths,
      major: names.map((n) => n.major).join('/'),
      // the minor ring is too narrow at the bottom for two names: d sharp, or e flat when the piece or the choice is in G flat (AX-3 provisional)
      minor: (fifths.length > 1 ? [keyNames(prefer.includes(-6) ? -6 : fifths[0]!, naming)] : names).map((n) => n.minor.toLowerCase()).join('/'),
      signs: fifths.map(signOf),
      angle,
      majorAt: at(angle, (radii.minor + radii.major) / 2),
      minorAt: at(angle, radii.hub + (radii.minor - radii.hub) * MINOR_NAME),
      signAt: at(angle, (radii.major + radii.edge) / 2),
    };
  });
  return { cx, cy, radii, steps };
}

/**
 * The step and ring under a point, or null: the major ring and the counts beyond it are the major key, the minor ring the
 * minor key; the hub and anything outside the circle are none.
 */
export function circleHit(layout: CircleLayout, x: number, y: number): { step: number; ring: CircleRing } | null {
  const dx = x - layout.cx;
  const dy = y - layout.cy;
  const r = Math.hypot(dx, dy);
  if (r < layout.radii.hub || r > layout.radii.edge) return null;
  const angle = Math.atan2(dx, -dy); // clockwise from straight up
  const step = stepOfFifths(Math.round((angle * CIRCLE_STEPS) / (2 * Math.PI)));
  return { step, ring: r < layout.radii.minor ? 'minor' : 'major' };
}

/**
 * The step whose tonic a played key is, on `ring`: a G played on the major ring is G major (one sharp), on the minor ring g
 * minor (two flats). The tonic of the major key on step i is i fifths above C (7 i semitones), so the step is 7 times the
 * pitch class (7 x 7 = 49 = 1 in twelve); a minor tonic is the major's sixth, 9 semitones above.
 */
export function tonicStep(pitchClass: number, ring: CircleRing): number {
  const majorTonic = ring === 'major' ? pitchClass : pitchClass + 3;
  return stepOfFifths(7 * majorTonic);
}

/** The step a key stands on, so the piece's key is marked (rule 3). */
export function stepOfKey(key: CircleKey): number {
  return stepOfFifths(key.fifths);
}

/** A key's name with its flat written as the flat sign (♭), the same shape as on the staff, so "Bb" never reads as two letters; the letter stays as it is. */
export function withFlat(name: string): string {
  return name.slice(0, 1) + name.slice(1).replaceAll('b', '♭');
}
