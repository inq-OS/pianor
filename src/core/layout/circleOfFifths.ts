/**
 * The circle of fifths (ft_1_28): twelve steps clockwise from C at the top, the major key outside, its relative minor inside
 * and the count of sharps or flats beyond them. Where each step and its words stand, which step a point is on, and which
 * step a key or a played tonic belongs to. Pure: the overlay only draws it, and a later trainer reuses it (rule 4).
 */
import { keyNames, type KeyMode } from '../editor/key';
import type { NoteNaming } from '../text/noteName';
import { rectBottom, type Rect } from './rect';

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
 * spelling show only one: the first `prefer`red key spelled on it (the key chosen, then the piece's), else the one with
 * fewer signs.
 */
function shownSpellings(step: number, prefer: readonly number[]): number[] {
  const all = spellingsOf(step);
  if (all.length === 1) return all;
  if (step === 6) return [6, -6];
  const preferred = prefer.find((f) => all.includes(f));
  return [preferred ?? all.reduce((a, b) => (Math.abs(a) <= Math.abs(b) ? a : b))];
}

function signOf(fifths: number): CircleSign {
  return { count: Math.abs(fifths), alter: fifths > 0 ? 1 : fifths < 0 ? -1 : 0 };
}

/** The key a step and ring stand for: a preferred spelling where the step has one (G flat for a piece in G flat), else its first. */
export function keyAt(step: number, ring: CircleRing, prefer: readonly number[] = []): CircleKey {
  const shown = shownSpellings(stepOfFifths(step), prefer);
  return { fifths: prefer.find((f) => shown.includes(f)) ?? shown[0]!, mode: ring };
}

/** Where a click or an arrow lands: a step and ring, and the spelling when the click was on one half of a two-spelling name or count. */
export interface CircleTarget {
  readonly step: number;
  readonly ring: CircleRing;
  readonly fifths?: number;
}

/**
 * The key a click or an arrow chooses, from the key chosen now. The spelling the click picked wins (the G flat half of the
 * bottom name); on the step already chosen, the same ring again switches to its other spelling (B and C flat, F sharp and
 * G flat, D flat and C sharp) and the other ring keeps the spelling; any other step takes `keyAt`, the spelling with fewer
 * signs or the piece's (`prefer`). AX-3 provisional: a second click switches the spelling, so every key can be chosen.
 */
export function chooseKey(current: CircleKey, target: CircleTarget, prefer: readonly number[] = []): CircleKey {
  if (target.fifths !== undefined) return { fifths: target.fifths, mode: target.ring };
  const spellings = spellingsOf(target.step);
  const at = spellings.indexOf(current.fifths);
  if (at < 0 || spellings.length === 1) return keyAt(target.step, target.ring, prefer);
  const fifths = target.ring === current.mode ? spellings[(at + 1) % spellings.length]! : current.fifths;
  return { fifths, mode: target.ring };
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
      // the minor ring is too narrow at the bottom for two names: d sharp, or e flat when the choice or the piece is in G flat (AX-3 provisional)
      minor: (fifths.length > 1 ? [keyNames(prefer.find((f) => fifths.includes(f)) ?? fifths[0]!, naming)] : names).map((n) => n.minor.toLowerCase()).join('/'),
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
 * minor key; the hub and anything outside the circle are none. Where a step shows two major names (one above the other)
 * and two counts (side by side), the half under the point picks its spelling: the upper name or left count the first
 * (sharps), the lower or right the second (flats).
 */
export function circleHit(layout: CircleLayout, x: number, y: number): CircleTarget | null {
  const dx = x - layout.cx;
  const dy = y - layout.cy;
  const r = Math.hypot(dx, dy);
  if (r < layout.radii.hub || r > layout.radii.edge) return null;
  const angle = Math.atan2(dx, -dy); // clockwise from straight up
  const step = stepOfFifths(Math.round((angle * CIRCLE_STEPS) / (2 * Math.PI)));
  if (r < layout.radii.minor) return { step, ring: 'minor' };
  const shown = layout.steps[step]?.fifths ?? [];
  if (shown.length < 2) return { step, ring: 'major' };
  const second = r < layout.radii.major ? y >= layout.steps[step]!.majorAt.y : x >= layout.steps[step]!.signAt.x;
  return { step, ring: 'major', fifths: shown[second ? 1 : 0]! };
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

/** The panel's margin inside the main area, and the room inside the panel, in art pixels. */
const PANEL_MARGIN = 3;
const PANEL_PAD = 5;
/** The scale's staff starts this far under the panel's top, below the key's name (and under the ticks' row when choosing). */
const STAFF_TOP = 30;
/** Room between the wheel and the words beside it, and between two buttons. */
const BESIDE_GAP = 4;
const BUTTON_GAP = 2;

/** What the overlay's panel holds: the wheel on the left; beside it the key's name with Listen, Close, the ticks and the scale's staff. */
export interface CirclePanelLayout {
  readonly panel: Rect;
  readonly wheel: { readonly cx: number; readonly cy: number; readonly radius: number };
  /** The chosen key's name: where it starts, and its scale (2, or 1 where 2 would run into Listen). */
  readonly heading: Rect & { readonly scale: 1 | 2 };
  readonly listen: Rect;
  readonly close: Rect;
  /** The ticks (opened to choose), left to right as their widths were given, on their own row under the name. */
  readonly ticks: readonly Rect[];
  /** The room for the scale's staff: it stands still whatever key is chosen (ft_1_28.AC6). */
  readonly staff: Rect;
}

/**
 * The overlay laid out in a main area `width` art pixels wide and `rows` high. `heading` is the size of the key's name at
 * scale 1, `ticks` the widths of the ticks (none when it only shows), `choosing` whether the ticks' row is kept (so the
 * staff stands at one place for every key), `wheelMargin` the room the painted helm takes past its rim. The name has its
 * own room: Listen stands right after it and Close at the right end, the ticks on a row of their own under them, so no
 * button ever covers the name (a d# minor and its two ticks included).
 */
export function circlePanelLayout(
  main: { width: number; rows: number },
  options: { heading: { w: number; h: number }; ticks: readonly number[]; choosing: boolean; wheelMargin: number; button: { w: number; h: number } },
): CirclePanelLayout {
  const { heading, ticks, choosing, wheelMargin, button } = options;
  const panel: Rect = { x: PANEL_MARGIN, y: PANEL_MARGIN, w: main.width - 2 * PANEL_MARGIN, h: main.rows - 2 * PANEL_MARGIN };
  const radius = Math.floor((panel.h - 2 * PANEL_PAD) / 2) - wheelMargin;
  const cx = panel.x + PANEL_PAD + wheelMargin + radius;
  const cy = panel.y + Math.floor(panel.h / 2);
  const left = cx + radius + wheelMargin + PANEL_PAD + BESIDE_GAP;
  const right = panel.x + panel.w - PANEL_PAD;
  const top = panel.y + PANEL_PAD;
  const close: Rect = { x: right - button.w, y: top + 1, w: button.w, h: button.h };
  // the name at scale 2 where Listen still fits between it and Close, else at scale 1
  const scale: 1 | 2 = left + heading.w * 2 + 6 + button.w + BUTTON_GAP <= close.x ? 2 : 1;
  const name = { x: left, y: top + 2, w: heading.w * scale, h: heading.h * scale, scale };
  const listen: Rect = { x: Math.min(left + name.w + 6, close.x - BUTTON_GAP - button.w), y: close.y, w: button.w, h: button.h };
  // the ticks' row is under the tallest the name can be, so it never moves with the name's scale
  const rowY = Math.max(top + 2 + heading.h * 2, rectBottom(close)) + BUTTON_GAP;
  let x = right;
  const placed = [...ticks].reverse().map((w) => {
    x -= w;
    const rect: Rect = { x, y: rowY, w, h: button.h };
    x -= BUTTON_GAP;
    return rect;
  }).reverse();
  const staffY = choosing ? Math.max(panel.y + STAFF_TOP, rowY + button.h + BUTTON_GAP) : panel.y + STAFF_TOP;
  const staff: Rect = { x: left, y: staffY, w: right - left, h: panel.y + panel.h - PANEL_PAD - staffY };
  return { panel, wheel: { cx, cy, radius }, heading: name, listen, close, ticks: placed, staff };
}
