/**
 * The difficulty estimator (core_08): how hard each bar of a piece is and where the whole piece sits on the one scale of
 * d157: 0 to 100 points in five grades of 20, Beginner to Master, five stars a grade. Its Beginner grade is the ten steps of
 * d138 (1 a few notes in five-finger position, 10 a whole first-year piece in full complexity), two points each. It
 * proposes; a person confirms the `difficulty` in the meta file, counted in half stars (1 to 50). Pure: it reads only ticks, spelled pitches and the chart's maps, so dotted notes,
 * triplets, a second voice in one hand and imported pieces are scored the day the compiler can make them.
 */
import { barIndexAtTick, diatonicIndex, pickupTicks, PPQ, tickToMs, type Chart, type ChartNote } from '../chart';
import { keyAlters } from '../chart/key';
import { tieLinks } from '../chart/ties';
import { sliceChart } from '../chart/section';
import { complexityOf } from '../properties/complexity';

/** What makes one bar hard, measured over the notes the student plays (play tracks; accompaniment is not counted). */
export interface BarFeatures {
  /** Keys pressed: tied-on notes are not pressed again, a grace note is. */
  presses: number;
  /** Moments a hand starts something new, per second at the written tempo (both hands each count). */
  onsetsPerSecond: number;
  /** Different written lengths of notes and rests, each weighted by its kind (plain 1, dotted 1.5, tuplet 2.5), minus 1. */
  rhythm: number;
  /** Melodic jumps beyond a step, in diatonic steps (a third 1, a fifth 3), the jump into the bar included. */
  leapPoints: number;
  /** Times a hand must leave its five-finger position. */
  shifts: number;
  /** Notes whose sharp, flat or natural is not the key signature's. */
  accidentals: number;
  /** Extra keys one hand presses together (a three-note chord is 2). */
  chordNotes: number;
  /** Share of the presses made while the other hand sounds, 0 to 1. */
  handsTogether: number;
  /** Voices in one hand beyond the first, at most over the hands. */
  extraVoices: number;
  /** Grace notes. */
  graces: number;
}

/**
 * The kinds of difficulty a score is made of: what the "why" of a bar or a piece says, and later the axes of the player
 * profile. `parts` of a bar or a piece add up to its score.
 */
export const DIMENSIONS = ['tempo', 'rhythm', 'pitch', 'hands', 'reading', 'texture', 'structure', 'length'] as const;
export type Dimension = (typeof DIMENSIONS)[number];
export type DimensionParts = Record<Dimension, number>;

const round = (x: number) => Math.round(x * 100) / 100;

/** Which dimension each bar feature counts towards. */
const BAR_DIMENSION: Record<keyof typeof DIFFICULTY_WEIGHTS.bar, Dimension> = {
  onsetsPerSecond: 'tempo',
  rhythm: 'rhythm',
  leapPoints: 'pitch',
  shifts: 'hands',
  accidentals: 'reading',
  chordNotes: 'texture',
  handsTogether: 'texture',
  extraVoices: 'texture',
  graces: 'texture',
};

const noParts = (): DimensionParts => ({ tempo: 0, rhythm: 0, pitch: 0, hands: 0, reading: 0, texture: 0, structure: 0, length: 0 });
const sumParts = (parts: DimensionParts) => DIMENSIONS.reduce((sum, d) => sum + parts[d], 0);
const roundParts = (parts: DimensionParts): DimensionParts => Object.fromEntries(DIMENSIONS.map((d) => [d, round(parts[d])])) as DimensionParts;

/** The whole piece's own features, beyond its bars. */
export interface PieceFeatures {
  bars: number;
  meterChanges: number;
  keyChanges: number;
  tempoChanges: number;
  /** Sharps or flats in the first key signature. */
  keySignature: number;
  /** Semitones from the lowest to the highest note the student plays. */
  range: number;
  /** Both clefs are read. */
  bothClefs: boolean;
}

export interface BarDifficulty {
  /** 0-based, as in the chart. */
  index: number;
  /** The bar number as printed: a pick-up is 0, the first full bar 1 (d120). */
  printed: number;
  /** Bigger is harder; 0 for a bar with nothing to play. Only compare with other bars. */
  score: number;
  /** The score split by dimension: what makes this bar hard. */
  parts: DimensionParts;
  features: BarFeatures;
}

export interface Difficulty {
  /** The proposal in half stars, 1 to 50 (d157), as a person confirms it: 1 to 10 is the Beginner grade, the steps of d138. */
  scale: number;
  /**
   * The same on the scale of d157, 1 to 100 points: `scale` is always `points` / 2 rounded up, so an odd proposal is one
   * point below the half stars that confirm it (21 points proposed, 11 half stars, 22 points confirmed).
   */
  points: number;
  /** The number the scale is cut from: bars' mean, the hardest bar, the piece's own features. Bigger is harder. */
  score: number;
  /** The score split by dimension, the piece's own features included: they add up to `score`. */
  parts: DimensionParts;
  bars: BarDifficulty[];
  /** The hardest bars (0-based), in bar order: at most three, clearly above the piece's mean. */
  hardest: number[];
  piece: PieceFeatures;
}

/**
 * AX-3 provisional: the weights are a first guess, set so the curriculum pieces land on the anchors of d138
 * (`docs/architect/cast-and-phrases.md` section 2). They move to a content file once a calibration script fits them to
 * the practice log (core_08 step 4); until then nobody tunes them by hand, so they stay here.
 */
export const DIFFICULTY_WEIGHTS = {
  bar: {
    onsetsPerSecond: 1,
    rhythm: 1,
    leapPoints: 0.5,
    shifts: 1.5,
    accidentals: 0.75,
    chordNotes: 0.5,
    handsTogether: 3,
    extraVoices: 2,
    graces: 1,
  },
  piece: {
    /** How much the hardest bar counts above the mean of the bars. */
    peak: 0.5,
    meterChanges: 1,
    keyChanges: 1.5,
    tempoChanges: 0.5,
    keySignature: 0.4,
    /** Per semitone beyond a five-finger span (7 semitones). */
    range: 0.1,
    bothClefs: 1,
    /** Per doubling of the length beyond 4 bars. */
    length: 1,
  },
  /** Score at which each step of the scale from 2 to 10 starts: the Beginner grade (d138, d157). */
  scaleStarts: [1.7, 2.8, 4.5, 6, 8, 10, 12.5, 15, 18],
  /** Score at which the Beginner grade ends (20 points) and Intermediate starts. */
  beginnerEnd: 21,
  /**
   * How fast the points above Beginner climb towards 100: 20 + 80 (1 - e^(-(score - beginnerEnd) / tail)). AX-3 provisional:
   * a first guess from music21's corpus (Mozart's K545 first movement about 50, a Joplin rag about 55), to be fitted to
   * the Henle levels of CIPI's pieces (core_08 rule 13) before anything above Beginner is shown to a student as a fact.
   */
  tail: 55,
} as const;

const KIND_WEIGHT = { plain: 1, dotted: 1.5, tuplet: 2.5 } as const;

/** A written length is plain (a whole note halved k times), dotted (once or twice) or anything else: a tuplet. */
export function lengthKind(ticks: number): keyof typeof KIND_WEIGHT {
  for (let plain = 8 * PPQ; plain >= PPQ / 16; plain /= 2) {
    if (ticks === plain) return 'plain';
    if (ticks === plain * 1.5 || ticks === plain * 1.75) return 'dotted';
  }
  return 'tuplet';
}

/** Difficulty of the notes and rests the student plays, per bar and for the whole piece. */
export function difficultyOf(chart: Chart): Difficulty {
  const play = new Map(chart.tracks.filter((t) => t.role === 'play').map((t) => [t.id, t]));
  const handOf = (track: string) => play.get(track)!.hand ?? track;
  const notes = chart.notes.filter((n) => play.has(n.track));
  const rests = chart.rests.filter((r) => play.has(r.track));
  const graces = (chart.graces ?? []).filter((g) => play.has(g.track));
  const continued = new Set([...tieLinks(chart, new Set(play.keys())).continuations].map((i) => chart.notes[i]!));
  const pressed = notes.filter((n) => !continued.has(n));

  const bars = chart.bars.map((bar) => ({
    bar,
    seconds: (tickToMs(chart.tempoMap, bar.endTick) - tickToMs(chart.tempoMap, bar.startTick)) / 1000,
    presses: 0,
    onsets: new Set<string>(),
    lengths: new Set<number>(),
    leapPoints: 0,
    shifts: 0,
    accidentals: 0,
    chordNotes: 0,
    together: 0,
    voices: new Map<string, Set<number>>(),
    graces: 0,
  }));

  for (const n of notes) bars[n.bar]!.lengths.add(n.dur);
  for (const r of rests) bars[r.bar]!.lengths.add(r.dur);
  for (const g of graces) {
    const b = bars[barIndexAtTick(chart.bars, g.tick)]!;
    b.graces++;
    b.presses++;
  }

  const keyAt = (tick: number) => [...chart.keyMap].reverse().find((k) => k.tick <= tick)!;
  // O(n^2) over the notes: fine for today's pieces, a sorted sweep before long imports (TODO in core_08).
  const otherHandSounds = (n: ChartNote) => notes.some((m) => handOf(m.track) !== handOf(n.track) && m.tick < n.tick + n.dur && n.tick < m.tick + m.dur);
  for (const n of pressed) {
    const b = bars[n.bar]!;
    b.presses++;
    b.onsets.add(`${handOf(n.track)}|${n.tick}`);
    if (n.spelling.alter !== keyAlters(keyAt(n.tick).fifths)[n.spelling.step]) b.accidentals++;
    if (otherHandSounds(n)) b.together++;
    const voices = b.voices.get(handOf(n.track)) ?? new Set<number>();
    b.voices.set(handOf(n.track), voices.add(n.voice));
  }

  // Groups of keys one hand presses at one moment, in time order: chords, jumps and position shifts are read from them.
  const groupsByHand = new Map<string, Map<number, ChartNote[]>>();
  for (const n of pressed) {
    const hand = groupsByHand.get(handOf(n.track)) ?? new Map<number, ChartNote[]>();
    hand.set(n.tick, [...(hand.get(n.tick) ?? []), n]);
    groupsByHand.set(handOf(n.track), hand);
  }
  for (const groups of groupsByHand.values()) {
    // The notes since the last shift; while they fit five fingers (a span of 4 diatonic steps) the hand need not move.
    let span: { low: number; high: number } | null = null;
    let last: number | null = null;
    for (const tick of [...groups.keys()].sort((a, b) => a - b)) {
      const group = groups.get(tick)!;
      const b = bars[group[0]!.bar]!;
      const steps = group.map((n) => diatonicIndex(n.spelling));
      const min = Math.min(...steps);
      const max = Math.max(...steps);
      b.chordNotes += group.length - 1;
      if (group.length === 1) {
        if (last !== null) b.leapPoints += Math.max(0, Math.abs(steps[0]! - last) - 1);
        last = steps[0]!;
      } else last = null; // a chord is not a melodic jump, and the line after it starts afresh
      const grown: { low: number; high: number } = span ? { low: Math.min(span.low, min), high: Math.max(span.high, max) } : { low: min, high: max };
      if (span && grown.high - grown.low > 4) {
        b.shifts++;
        span = { low: min, high: max };
      } else span = grown;
    }
  }

  const w = DIFFICULTY_WEIGHTS;
  const pickup = pickupTicks(chart.bars, chart.meterMap) > 0;
  const scored = bars.map((b) => {
    const rhythm = Math.max(0, [...b.lengths].reduce((sum, ticks) => sum + KIND_WEIGHT[lengthKind(ticks)], 0) - 1);
    const features: BarFeatures = {
      presses: b.presses,
      onsetsPerSecond: round(b.seconds > 0 ? b.onsets.size / b.seconds : 0),
      rhythm,
      leapPoints: b.leapPoints,
      shifts: b.shifts,
      accidentals: b.accidentals,
      chordNotes: b.chordNotes,
      handsTogether: b.presses > 0 ? round(b.together / b.presses) : 0,
      extraVoices: Math.max(0, ...[...b.voices.values()].map((v) => v.size - 1)),
      graces: b.graces,
    };
    const raw = noParts();
    if (b.presses > 0) for (const key of Object.keys(BAR_DIMENSION) as (keyof typeof BAR_DIMENSION)[]) raw[BAR_DIMENSION[key]] += w.bar[key] * features[key];
    return { bar: { index: b.bar.index, printed: b.bar.index + (pickup ? 0 : 1), score: round(sumParts(raw)), parts: roundParts(raw), features }, raw };
  });
  const barResults = scored.map((s) => s.bar);

  const totalPresses = barResults.reduce((sum, b) => sum + b.features.presses, 0);
  const meanParts = noParts();
  if (totalPresses > 0) for (const { bar, raw } of scored) for (const d of DIMENSIONS) meanParts[d] += (raw[d] * bar.features.presses) / totalPresses;
  const mean = sumParts(meanParts);
  const peakBar = scored.reduce<(typeof scored)[number] | null>((best, s) => (best === null || sumParts(s.raw) > sumParts(best.raw) ? s : best), null);
  const hardest = barResults
    .filter((b) => b.score > 0 && b.score >= mean * 1.25)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .map((b) => b.index)
    .sort((a, b) => a - b);

  const midis = pressed.map((n) => n.midi);
  const piece: PieceFeatures = {
    bars: chart.bars.length,
    meterChanges: chart.meterMap.length - 1,
    keyChanges: chart.keyMap.length - 1,
    tempoChanges: chart.tempoMap.length - 1,
    keySignature: Math.abs(chart.keyMap[0]!.fifths),
    range: midis.length > 0 ? Math.max(...midis) - Math.min(...midis) : 0,
    bothClefs: new Set([...play.values()].map((t) => t.clef)).size > 1 && new Set(pressed.map((n) => play.get(n.track)!.clef)).size > 1,
  };
  const parts = noParts();
  for (const d of DIMENSIONS) parts[d] = meanParts[d] + w.piece.peak * ((peakBar?.raw[d] ?? 0) - meanParts[d]);
  parts.structure +=
    w.piece.meterChanges * piece.meterChanges + w.piece.keyChanges * piece.keyChanges + w.piece.tempoChanges * piece.tempoChanges;
  parts.length += w.piece.length * Math.log2(Math.max(1, piece.bars / 4));
  parts.reading += w.piece.keySignature * piece.keySignature + (piece.bothClefs ? w.piece.bothClefs : 0);
  parts.hands += w.piece.range * Math.max(0, piece.range - 7);
  const score = sumParts(parts);

  return { scale: scaleOf(score), points: pointsOf(score), score: round(score), parts: roundParts(parts), bars: barResults, hardest, piece };
}

/** The half star (1 to 50, d157) for an estimator score; 1 to 10 are the steps of d138. A higher score never gets a lower one. */
export function scaleOf(score: number): number {
  if (score >= DIFFICULTY_WEIGHTS.beginnerEnd) return Math.ceil(pointsOf(score) / 2);
  return 1 + DIFFICULTY_WEIGHTS.scaleStarts.filter((start) => score >= start).length;
}

/**
 * One line for the people who check pieces (the linter and the piece preview, core_08.AC3), never for the student:
 * "difficulty 6/100, beginner 1.5 stars, proposed (confirmed 3 half stars, score 3.1, hardest bars 2, 5)".
 */
export function difficultySummary(d: Difficulty, confirmed?: number): string {
  const hardest = d.hardest.length > 0 ? `, hardest bars ${d.hardest.map((i) => d.bars.find((b) => b.index === i)!.printed).join(', ')}` : '';
  const { grade, stars } = complexityOf(d.points);
  return `difficulty ${d.points}/100, ${grade} ${stars} stars, proposed (${confirmed === undefined ? 'not confirmed' : `confirmed ${confirmed} half stars`}, score ${d.score}${hardest})`;
}

/** The points of a difficulty a person confirmed in half stars (1 to 50, d157): two points each. */
export function confirmedPoints(halfStars: number): number {
  return 2 * halfStars;
}

/** The points the game shows for a piece (d157): those of the half stars a person confirmed, else the estimator's proposal. */
export function shownPoints(confirmed: number | undefined, proposed: Difficulty): number {
  return confirmed === undefined ? proposed.points : confirmedPoints(confirmed);
}

/**
 * The points 1 to 100 of d157 for an estimator score. Below `beginnerEnd` each step N of d138 is the points 2N-1 and 2N (the
 * second for the upper half of its cut-offs), so the Beginner grade is the curriculum; above it they climb towards 100
 * (`tail`, AX-3 provisional). A higher score never gets fewer points.
 */
export function pointsOf(score: number): number {
  const w = DIFFICULTY_WEIGHTS;
  if (score >= w.beginnerEnd) return Math.min(100, 20 + Math.max(1, Math.round(80 * (1 - Math.exp(-(score - w.beginnerEnd) / w.tail)))));
  const starts = [0, ...w.scaleStarts, w.beginnerEnd];
  const step = scaleOf(score);
  const within = (score - starts[step - 1]!) / (starts[step]! - starts[step - 1]!);
  return 2 * step - (within >= 0.5 ? 0 : 1);
}

/** A stretch of written bars, 0-based and inclusive. */
export interface BarRange {
  first: number;
  last: number;
}

/**
 * Difficulty of any passage: written bar ranges played one after the other, in the order given (a part, the tug's turn,
 * a section the loop repeats, or part A straight into part C). The jumps and hand shifts across each seam count, and the
 * bars come back with their written index and printed number; a bar given twice (a loop) is listed once in `hardest`.
 * A note tied into a range from a bar outside it counts as pressed: the passage starts there, so the player presses it.
 * Pure, like `difficultyOf`.
 */
export function difficultyOfPassage(chart: Chart, ranges: readonly BarRange[]): Difficulty {
  if (ranges.length === 0) throw new Error('a passage needs at least one bar range');
  const slices = ranges.map((r) => sliceChart(chart, r.first, r.last));
  const joined: Chart = { ...slices[0]!, notes: [], rests: [], bars: [], tempoMap: [], meterMap: [], keyMap: [], graces: [], repeats: [], phrases: [] };
  const sameAsLast = <T extends { tick: number }>(map: T[], entry: T) => map.length > 0 && JSON.stringify({ ...map.at(-1)!, tick: 0 }) === JSON.stringify({ ...entry, tick: 0 });
  let tick = 0;
  let bar = 0;
  for (const slice of slices) {
    for (const name of ['tempoMap', 'meterMap', 'keyMap'] as const) {
      const map = joined[name] as { tick: number }[];
      for (const entry of slice[name] as { tick: number }[]) if (!sameAsLast(map, entry)) map.push({ ...entry, tick: entry.tick + tick });
    }
    joined.notes.push(...slice.notes.map((n) => ({ ...n, tick: n.tick + tick, bar: n.bar + bar })));
    joined.rests.push(...slice.rests.map((r) => ({ ...r, tick: r.tick + tick, bar: r.bar + bar })));
    joined.graces!.push(...(slice.graces ?? []).map((g) => ({ ...g, tick: g.tick + tick })));
    joined.bars.push(...slice.bars.map((b) => ({ index: b.index + bar, startTick: b.startTick + tick, endTick: b.endTick + tick })));
    tick = joined.bars.at(-1)!.endTick;
    bar = joined.bars.length;
  }
  const d = difficultyOf(joined);
  const written = ranges.flatMap((r) => Array.from({ length: r.last - r.first + 1 }, (_, i) => r.first + i));
  const printedOffset = pickupTicks(chart.bars, chart.meterMap) > 0 ? 0 : 1;
  return { ...d, bars: d.bars.map((b, i) => ({ ...b, index: written[i]!, printed: written[i]! + printedOffset })), hardest: [...new Set(d.hardest.map((i) => written[i]!))] };
}

/** Each named part of the piece (its `phrases`, core_06) with its own difficulty, in the chart's order. */
export function partDifficulties(chart: Chart): { name: string; difficulty: Difficulty }[] {
  return chart.phrases.map((p) => ({ name: p.name, difficulty: difficultyOfPassage(chart, [{ first: p.startBar, last: p.endBar }]) }));
}
