/**
 * A chart as the ABC text of a game piece (ft_Y_04 slice 2, the game importer): everything the game's ABC subset
 * (docs/authoring/au02-abc-subset.md) can hold comes over note for note, so `piece:build` gives the same notes back. Pure.
 *
 * The notes are never changed in silence. What the subset cannot hold in the notes themselves (a triplet, a second voice
 * in one hand, a 6/8 meter, a key change) refuses the piece, with the bar and beat of every place, so a person can fix the
 * score; nothing is written then. A mark the subset cannot hold where it stands (a grace note before a chord, a tie on
 * some notes of a chord, a slur across a repeat sign) is left out with a warning that says where. The voices of one hand
 * are read as one line of chords: two voices that move together are one hand's chords, two that move apart are refused.
 */
import { PPQ } from '../chart/time';
import { printedAccidentals } from '../chart/key';
import { abcPitch } from '../chart/pitch';
import { MAX_GRACE_GROUP, type Chart, type ChartNote } from '../chart/schema';
import { ORNAMENT_DECORATION } from '../chart/ornaments';
import { abcBarLine } from '../editor/repeats';
import { abcKey } from '../editor/key';
import { cleanTitle } from '../editor/abc';
import { beatOf, problemLabel, type ImportProblem } from '../editor/fromChart';
import type { EditorHand } from '../editor/model';

export interface ChartAbcOptions {
  /** The title to write; the chart's title when absent. */
  title?: string;
  /** Which track each hand plays, when the score has more than one part for a hand. */
  tracks?: Partial<Record<EditorHand, string>>;
}

export type ChartAbcResult =
  | { ok: true; abc: string; hands: EditorHand[]; warnings: string[] }
  | { ok: false; reason: string; problems: ImportProblem[] };

/** The note and rest lengths the staff draws (core_09.AC37, AC40), as ABC lengths with `L:1/8`. */
const ABC_LENGTHS: ReadonlyMap<number, string> = new Map([
  [PPQ * 4, '8'], [PPQ * 3, '6'], [PPQ * 2, '4'], [PPQ * 1.5, '3'], [PPQ, '2'],
  [PPQ * 0.75, '3/2'], [PPQ / 2, ''], [PPQ / 4, '/2'],
]);
/** Lengths from the longest, for splitting a gap into rests. */
const REST_LENGTHS = [...ABC_LENGTHS.keys()].sort((a, b) => b - a);
const SIXTEENTH = PPQ / 4;
const METERS = ['4/4', '3/4', '2/4'];
const ACCIDENTALS: Readonly<Record<number, string>> = { [-2]: '__', [-1]: '_', 0: '=', 1: '^', 2: '^^' };
const BARS_PER_LINE = 4;

/** What to call a length the subset cannot write, so the person knows what to look for in the score. */
function lengthProblem(ticks: number): string {
  if (ticks === PPQ * 3.5 || ticks === PPQ * 1.75 || ticks === PPQ * 0.875) return 'a double-dotted note';
  if (ticks === PPQ * 0.375) return 'a dotted sixteenth';
  if (ticks % (PPQ / 16) === 0 && ticks % SIXTEENTH !== 0) return 'a note shorter than a sixteenth (a thirty-second)';
  if (ticks % SIXTEENTH !== 0) return 'a triplet or another tuplet';
  return `a note of ${ticks / PPQ} beats, which the staff does not draw as one note`;
}

/** One onset of a hand: the notes that start together (lowest first), and what is written around them. */
interface Onset {
  tick: number;
  dur: number;
  bar: number;
  notes: ChartNote[];
  tie: boolean;
  /** The grace note or group before it, in playing order (core_09.AC60). */
  graces?: NonNullable<Chart['graces']>[number][];
  /** Its ornament sign (core_09.AC66). */
  ornament?: NonNullable<Chart['ornaments']>[number];
  opens: boolean;
  closes: boolean;
}

/** Where each bar of the chart is written: the rests put in front (a pick-up made whole) and its written length. */
interface BarFrame {
  start: number;
  end: number;
  lead: number;
  length: number;
}

interface Frame {
  meter: { num: number; den: number };
  full: number;
  bars: BarFrame[];
  /** The bar numbers as the score prints them: the pick-up is 0. */
  printedOffset: number;
  tracks: Map<EditorHand, Chart['tracks'][number]>;
  repeats: { startBar: number; endBar: number }[];
}

type Place = (hand: EditorHand, bar: number, tick: number, what: string) => ImportProblem;

const handName = (hand: EditorHand) => (hand === 'RH' ? 'right' : 'left');

/** The track each hand plays, or why none can be chosen. */
function pickTracks(chart: Chart, options: ChartAbcOptions, warnings: string[]): Map<EditorHand, Chart['tracks'][number]> | string {
  const withNotes = new Set(chart.notes.map((n) => n.track));
  const picked = new Map<EditorHand, Chart['tracks'][number]>();
  for (const hand of ['RH', 'LH'] as const) {
    const asked = options.tracks?.[hand];
    const candidates = chart.tracks.filter((t) => t.hand === hand && withNotes.has(t.id));
    if (asked !== undefined) {
      const track = chart.tracks.find((t) => t.id === asked && withNotes.has(t.id));
      if (!track) return `there is no part "${asked}" with notes (parts: ${[...withNotes].join(', ')})`;
      picked.set(hand, track);
    } else if (candidates.length > 1) {
      return `more than one part for the ${handName(hand)} hand (${candidates.map((t) => t.id).join(', ')}): choose the one to play`;
    } else if (candidates[0]) picked.set(hand, candidates[0]);
  }
  if (picked.size === 0) return 'no part has notes to play';
  const used = new Set([...picked.values()].map((t) => t.id));
  for (const id of withNotes) if (!used.has(id)) warnings.push(`the part ${id} is left out (only one part for each hand is played)`);
  return picked;
}

/** The latest end of a note in a bar, from the bar's start. */
function latestEnd(notes: readonly ChartNote[], bar: Chart['bars'][number]): number {
  return notes.filter((n) => n.bar === bar.index).reduce((most, n) => Math.max(most, n.tick + n.dur - bar.startTick), 0);
}

/**
 * The written bars. The subset needs whole bars, except a short first bar (a pick-up) when the last bar holds exactly
 * what the pick-up lacks: a last bar with nothing played past that point is cut to it, a short one filled with rests, and
 * when it is full of notes the pick-up becomes a whole bar with rests in front.
 */
function frameBars(chart: Chart, full: number, played: readonly ChartNote[], warnings: string[]): { bars: BarFrame[]; printedOffset: number } | string {
  const bars = chart.bars.map((b) => ({ start: b.startTick, end: b.endTick, lead: 0, length: b.endTick - b.startTick }));
  const n = bars.length;
  const pickup = n > 1 && bars[0]!.length < full ? bars[0]!.length : 0;
  const printedOffset = pickup > 0 ? 0 : 1;
  for (const [i, bar] of bars.entries()) {
    const printed = i + printedOffset;
    if (bar.length > full) return `bar ${printed} is longer than a ${chart.meterMap[0]!.num}/${chart.meterMap[0]!.den} bar`;
    if (bar.length < full && i > 0 && i < n - 1) return `bar ${printed} is shorter than the others (a bar split in two, around a repeat sign perhaps): make it a whole bar`;
  }
  const last = bars[n - 1]!;
  const target = full - pickup;
  if (last.length < target) last.length = target;
  else if (last.length > target) {
    if (latestEnd(played, chart.bars[n - 1]!) <= target) last.length = target;
    else {
      bars[0]!.lead = full - pickup;
      bars[0]!.length = full;
      warnings.push('the pick-up is written as a whole bar with rests in front, because the last bar is whole');
    }
  }
  return { bars, printedOffset };
}

function frameOf(chart: Chart, options: ChartAbcOptions, warnings: string[]): Frame | string {
  if (chart.meterMap.length > 1) return 'the meter changes inside the piece';
  const meter = chart.meterMap[0]!;
  if (!METERS.includes(`${meter.num}/${meter.den}`)) return `the meter ${meter.num}/${meter.den}: the game reads 4/4, 3/4 and 2/4`;
  if (chart.keyMap.length > 1) return 'the key changes inside the piece';
  if (chart.tempoMap.length > 1) warnings.push(`tempo changes are left out: the whole piece goes at ${Math.round(chart.tempoMap[0]!.bpm)} beats a minute`);
  const tracks = pickTracks(chart, options, warnings);
  if (typeof tracks === 'string') return tracks;
  const ids = new Set([...tracks.values()].map((t) => t.id));
  const full = (meter.num * 4 * PPQ) / meter.den;
  const bars = frameBars(chart, full, chart.notes.filter((n) => ids.has(n.track)), warnings);
  if (typeof bars === 'string') return bars;
  return { meter, full, ...bars, tracks, repeats: chart.repeats ?? [] };
}

/** The written position of a tick in its bar (rests put in front of a pick-up count). */
const offsetIn = (frame: Frame, bar: number, tick: number) => tick - frame.bars[bar]!.start + frame.bars[bar]!.lead;

/** The hand's notes as onsets, or the places where they are not one line of chords. */
function onsetsOf(chart: Chart, frame: Frame, hand: EditorHand, place: Place, problems: ImportProblem[], warnings: string[]): Onset[] {
  const track = frame.tracks.get(hand)!.id;
  const byTick = new Map<number, ChartNote[]>();
  let unison = false;
  for (const n of chart.notes) {
    if (n.track !== track) continue;
    const at = byTick.get(n.tick) ?? [];
    if (at.some((o) => o.midi === n.midi)) unison = true;
    else at.push(n);
    byTick.set(n.tick, at);
  }
  if (unison) warnings.push(`the ${handName(hand)} hand has the same note twice at once (two voices in unison): it is played once`);
  const onsets: Onset[] = [];
  let soundingUntil = 0;
  for (const tick of [...byTick.keys()].sort((a, b) => a - b)) {
    const notes = byTick.get(tick)!.sort((a, b) => a.midi - b.midi);
    const first = notes[0]!;
    const problem = (what: string) => problems.push(place(hand, first.bar, tick, what));
    if (tick < soundingUntil) problem('a note starts while the one before still sounds (two voices in one hand)');
    else if (notes.some((x) => x.dur !== first.dur)) problem('notes that start together end apart (two voices in one hand)');
    else if (!ABC_LENGTHS.has(first.dur)) problem(lengthProblem(first.dur));
    else if (offsetIn(frame, first.bar, tick) % SIXTEENTH !== 0) problem('a note off the sixteenth grid (after a triplet)');
    else if (tick + first.dur > frame.bars[first.bar]!.end) problem('a note across a bar line');
    soundingUntil = Math.max(soundingUntil, tick + first.dur);
    onsets.push({ tick, dur: first.dur, bar: first.bar, notes, tie: false, opens: false, closes: false });
  }
  return onsets;
}

/** True when a bar line between bars `from` and `to` (exclusive, inclusive) is a repeat sign. */
function crossesRepeat(frame: Frame, from: number, to: number): boolean {
  for (let b = from + 1; b <= to; b++) if (abcBarLine(frame.repeats, b, frame.bars.length).includes(':')) return true;
  return false;
}

/** Ties, grace notes, ornament signs and slurs where the subset can hold them; the rest left out, each with a warning. */
function placeMarks(chart: Chart, frame: Frame, hand: EditorHand, onsets: Onset[], place: Place, warnings: string[]): void {
  const track = frame.tracks.get(hand)!.id;
  const leftOut = (o: Onset, what: string) => warnings.push(problemLabel(place(hand, o.bar, o.tick, what)));
  const indexAt = new Map(onsets.map((o, i) => [o.tick, i]));
  onsets.forEach((o, i) => {
    if (new Set(o.notes.flatMap((n) => (n.dynamic ? [n.dynamic] : []))).size > 1) leftOut(o, 'a second dynamic on one chord is left out (the first is kept)');
    const tied = o.notes.filter((n) => n.tieNext);
    if (tied.length === 0) return;
    const next = onsets[i + 1];
    if (tied.length < o.notes.length) leftOut(o, 'a tie on some notes of a chord is left out (the game ties a whole chord)');
    else if (!next || next.tick !== o.tick + o.dur || !o.notes.every((n) => next.notes.some((x) => x.midi === n.midi))) leftOut(o, 'a tie with no note of the same pitch after it is left out');
    else if (crossesRepeat(frame, o.bar, next.bar)) leftOut(o, 'a tie across a repeat sign is left out');
    else o.tie = true;
  });
  for (const g of chart.graces ?? []) {
    const i = indexAt.get(g.tick);
    if (g.track !== track || i === undefined) continue;
    const o = onsets[i]!;
    if (o.graces && o.graces.length >= MAX_GRACE_GROUP) leftOut(o, `a grace note past ${MAX_GRACE_GROUP} on one note is left out`);
    else if (o.notes.length > 1) leftOut(o, 'a grace note before a chord is left out');
    else if (onsets[i - 1]?.tie) leftOut(o, 'a grace note on the second note of a tie is left out');
    else if (o.graces?.at(-1)?.pitch.midi === g.pitch.midi) leftOut(o, 'a grace note of the pitch of the grace before it is left out');
    else if (isLastGrace(chart, g) && g.pitch.midi === o.notes[0]!.midi) leftOut(o, "a grace note of its main note's pitch is left out");
    else o.graces = [...(o.graces ?? []), g];
  }
  placeOrnaments(chart, track, onsets, indexAt, leftOut);
  const kept: [number, number][] = [];
  const slurs = (chart.slurs ?? []).filter((s) => s.track === track).sort((a, b) => a.startTick - b.startTick);
  for (const s of slurs) {
    const from = indexAt.get(s.startTick);
    const to = indexAt.get(s.endTick);
    if (from === undefined || to === undefined || to <= from) continue;
    const o = onsets[from]!;
    const chords = new Set(onsets.slice(from, to + 1).map((x) => x.notes.map((n) => n.midi).join(',')));
    if (kept.some(([a, b]) => from <= b && a <= to)) leftOut(o, 'a slur over another slur is left out');
    else if (crossesRepeat(frame, o.bar, onsets[to]!.bar)) leftOut(o, 'a slur across a repeat sign is left out');
    else if (chords.size < 2) leftOut(o, 'a slur over one pitch is left out (it reads as a tie)');
    else {
      kept.push([from, to]);
      o.opens = true;
      onsets[to]!.closes = true;
    }
  }
}

/** Ornament signs (core_09.AC66) on single notes that are not the second note of a tie; the rest left out with a warning. */
function placeOrnaments(chart: Chart, track: string, onsets: Onset[], indexAt: ReadonlyMap<number, number>, leftOut: (o: Onset, what: string) => void): void {
  for (const sign of chart.ornaments ?? []) {
    const i = indexAt.get(sign.tick);
    if (sign.track !== track || i === undefined) continue;
    const o = onsets[i]!;
    if (o.notes.length > 1) leftOut(o, 'an ornament on a chord is left out');
    else if (onsets[i - 1]?.tie) leftOut(o, 'an ornament on the second note of a tie is left out');
    else o.ornament = sign;
  }
}

/** No grace of the chart follows `g` on its note: it is the one played right before the note. */
function isLastGrace(chart: Chart, g: NonNullable<Chart['graces']>[number]): boolean {
  const all = chart.graces ?? [];
  return !all.slice(all.indexOf(g) + 1).some((o) => o.track === g.track && o.voice === g.voice && o.tick === g.tick);
}

/** The accidental written before each note, in the order the notes are written (each grace before its note). */
function accidentalsOf(onsets: readonly Onset[], fifths: number): string[] {
  const written = onsets.flatMap((o) => [
    ...(o.graces ?? []).map((g) => ({ ...g.pitch.spelling, tick: o.tick, bar: o.bar })),
    ...o.notes.map((n) => ({ ...n.spelling, tick: o.tick, bar: o.bar, tieNext: o.tie })),
  ]);
  return printedAccidentals(written, fifths).map((a) => (a === null ? '' : ACCIDENTALS[a]!));
}

/** Rests that fill `ticks`, longest first. */
function restsFor(ticks: number): string[] {
  const out: string[] = [];
  let left = ticks;
  while (left >= SIXTEENTH) {
    const len = REST_LENGTHS.find((l) => l <= left)!;
    out.push(`z${ABC_LENGTHS.get(len)}`);
    left -= len;
  }
  return out;
}

/** One onset as ABC: dynamic, slur start, grace, fingerings and accidentals, the length, tie and slur end. */
function onsetText(o: Onset, marks: () => string): string {
  let grace = '';
  if (o.graces) grace = `{${o.graces[0]!.slash ? '/' : ''}${o.graces.map((g) => `${marks()}${abcPitch(g.pitch.spelling.step, g.pitch.spelling.octave)}`).join('')}}`;
  const sign = o.ornament ? `!${ORNAMENT_DECORATION[o.ornament.kind]}!` : '';
  const pitches = o.notes.map((n) => `${n.finger === undefined ? '' : `!${n.finger}!`}${marks()}${abcPitch(n.spelling.step, n.spelling.octave)}`);
  const dynamic = o.notes.find((n) => n.dynamic !== undefined)?.dynamic;
  const body = pitches.length > 1 ? `[${pitches.join('')}]` : pitches[0]!;
  return `${dynamic ? `!${dynamic}!` : ''}${o.opens ? '(' : ''}${grace}${sign}${body}${ABC_LENGTHS.get(o.dur)}${o.tie ? '-' : ''}${o.closes ? ')' : ''}`;
}

function voiceText(frame: Frame, onsets: readonly Onset[], fifths: number): string {
  const accidentals = accidentalsOf(onsets, fifths);
  let next = 0;
  const marks = () => accidentals[next++]!;
  const bars = frame.bars.map((bar, b) => {
    const inBar = onsets.filter((o) => o.bar === b);
    if (inBar.length === 0 && bar.length === frame.full && bar.lead === 0) return 'Z';
    const tokens: string[] = [];
    let at = 0;
    for (const o of inBar) {
      const start = offsetIn(frame, b, o.tick);
      tokens.push(...restsFor(start - at), onsetText(o, marks));
      at = start + o.dur;
    }
    tokens.push(...restsFor(bar.length - at));
    return tokens.join(' ');
  });
  const n = bars.length;
  const parts: string[] = [];
  bars.forEach((text, b) => {
    const line = abcBarLine(frame.repeats, b, n);
    parts.push(b > 0 && b % BARS_PER_LINE === 0 ? `${line}\n` : line === '' ? '' : `${line} `, `${text} `);
  });
  return `${parts.join('')}${abcBarLine(frame.repeats, n, n)}`;
}

/** The chart as the ABC text of a game piece, or why it cannot be one and every place to fix in the score. */
export function chartToAbc(chart: Chart, options: ChartAbcOptions = {}): ChartAbcResult {
  const warnings: string[] = [];
  const frame = frameOf(chart, options, warnings);
  if (typeof frame === 'string') return { ok: false, reason: frame, problems: [] };
  const place: Place = (hand, bar, tick, what) => ({ bar: bar + frame.printedOffset, beat: beatOf(offsetIn(frame, bar, tick) - frame.bars[bar]!.lead), hand, what });
  const problems: ImportProblem[] = [];
  const hands = (['RH', 'LH'] as const).filter((h) => frame.tracks.has(h));
  const onsets = new Map(hands.map((h) => [h, onsetsOf(chart, frame, h, place, problems, warnings)]));
  if (problems.length > 0) {
    const count = problems.length === 1 ? 'one place' : `${problems.length} places`;
    return { ok: false, reason: `${count} the game cannot write yet`, problems: problems.sort((a, b) => a.bar - b.bar || a.beat - b.beat) };
  }
  for (const hand of hands) placeMarks(chart, frame, hand, onsets.get(hand)!, place, warnings);
  const key = chart.keyMap[0]!;
  const lines = [
    'X:1', `T:${cleanTitle(options.title ?? chart.title)}`, `M:${frame.meter.num}/${frame.meter.den}`, 'L:1/8',
    `Q:1/4=${Math.max(1, Math.round(chart.tempoMap[0]!.bpm))}`, `K:${abcKey(key.fifths, key.mode)}`,
  ];
  for (const hand of hands) lines.push(`V:${hand} clef=${frame.tracks.get(hand)!.clef}`);
  for (const hand of hands) lines.push(`V:${hand}`, voiceText(frame, onsets.get(hand)!, key.fifths));
  return { ok: true, abc: `${lines.join('\n')}\n`, hands, warnings };
}
