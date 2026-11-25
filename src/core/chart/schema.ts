import { z } from 'zod';
import { PPQ, barIndexAtTick } from './time.ts';
import { spellingToMidi } from './pitch.ts';
import { MIDI_MAX } from './midi.ts';
import { crossingParts } from './parts.ts';
import { DYNAMICS } from './dynamics.ts';
import { ORNAMENT_KINDS, usesLower, usesUpper } from './ornaments.ts';

/** Canonical format: docs/authoring/au03-chart-format.md. Bars, notes and phrases are 0-based. */
export const CHART_SCHEMA_VERSION = 2;

const tick = z.int().nonnegative();
const midi = z.int().min(0).max(MIDI_MAX);

export const spellingSchema = z.object({
  step: z.enum(['C', 'D', 'E', 'F', 'G', 'A', 'B']),
  alter: z.int().min(-2).max(2),
  octave: z.int().min(-1).max(9),
});

export const trackSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['play', 'accompaniment', 'click']),
  hand: z.enum(['RH', 'LH']).nullable(),
  clef: z.enum(['treble', 'bass']),
});

export const noteSchema = z.object({
  tick,
  dur: z.int().positive(),
  midi,
  spelling: spellingSchema,
  track: z.string().min(1),
  voice: z.int().min(1).max(4),
  bar: z.int().nonnegative(),
  finger: z.int().min(1).max(5).optional(),
  tieNext: z.boolean().optional(),
  dynamic: z.enum(DYNAMICS).optional(),
  articulation: z.string().optional(),
  text: z.string().optional(),
});

export const restSchema = z.object({
  tick,
  dur: z.int().positive(),
  track: z.string().min(1),
  voice: z.int().min(1).max(4),
  bar: z.int().nonnegative(),
});

/**
 * A grace note (core_09.AC31, d121): no length, so it is not a chart note; `tick` is the start of the main note it goes before.
 * Several on one note are a grace group (core_09.AC60, d305), in the order they are played, as they stand in `graces`.
 */
export const graceSchema = z.object({
  track: z.string().min(1),
  voice: z.int().min(1).max(4),
  tick,
  pitch: z.object({ midi, spelling: spellingSchema }),
  /** An acciaccatura: a slash through its stem. */
  slash: z.boolean(),
});

/**
 * An ornament sign on a note (core_09.AC60, d305): `tick` is the start of its note in its track and voice. `upper` and
 * `lower` are the neighbour notes the sign uses (a trill, an upper mordent and a turn the upper one; a lower mordent and
 * a turn the lower one), spelled in the key with the bar's accidentals.
 */
export const ornamentSchema = z.object({
  track: z.string().min(1),
  voice: z.int().min(1).max(4),
  tick,
  kind: z.enum(ORNAMENT_KINDS),
  upper: z.object({ midi, spelling: spellingSchema }).optional(),
  lower: z.object({ midi, spelling: spellingSchema }).optional(),
});

/** The most grace notes before one note (core_09.AC60). AX-3 provisional: TODO(architect, R2) in core_09. */
export const MAX_GRACE_GROUP = 4;

export const barSchema = z.object({ index: z.int().nonnegative(), startTick: tick, endTick: tick });

export const phraseSchema = z.object({
  name: z.string().min(1),
  startBar: z.int().nonnegative(),
  endBar: z.int().nonnegative(),
});

export const slurSchema = z.object({ track: z.string().min(1), voice: z.int().min(1).max(4), startTick: tick, endTick: tick });

/**
 * A tuplet (core_09.AC49, d163): the notes and rests of one track and voice from the one starting at `startTick` to the one
 * starting at `endTick` (both members) are `actual` notes in the time of `normal` (a triplet: 3 in the time of 2), so each
 * plays `normal / actual` of its written length. Only triplets (3:2) are compiled and drawn so far.
 */
export const tupletSchema = z.object({ track: z.string().min(1), voice: z.int().min(1).max(4), startTick: tick, endTick: tick, actual: z.int().min(2), normal: z.int().min(1) });

/** Optional titles per locale (ft_0_18.AC4). Only Estonian is given so far; the English `title` is the fallback. */
export const pieceTitlesSchema = z.object({ et: z.string().min(1).optional() }).strict();

/** Bars `startBar` to `endBar`, 0-based, both included. */
const barSpanSchema = z.object({ startBar: z.int().nonnegative(), endBar: z.int().nonnegative() });

export const chartSchema = z
  .object({
    schemaVersion: z.literal(CHART_SCHEMA_VERSION),
    id: z.string().min(1),
    contentVersion: z.int().positive(),
    title: z.string().min(1),
    /** Titles per locale (ft_0_18.AC4). */
    titles: pieceTitlesSchema.optional(),
    level: z.int().positive(),
    ppq: z.literal(PPQ),
    tempoMap: z.array(z.object({ tick, bpm: z.number().positive() })).min(1),
    meterMap: z.array(z.object({ tick, num: z.int().positive(), den: z.int().positive() })).min(1),
    keyMap: z.array(z.object({ tick, fifths: z.int().min(-7).max(7), mode: z.enum(['major', 'minor']) })).min(1),
    tracks: z.array(trackSchema).min(1),
    notes: z.array(noteSchema),
    rests: z.array(restSchema).default([]),
    bars: z.array(barSchema).min(1),
    phrases: z.array(phraseSchema),
    /**
     * Written repeats (core_09.AC17): bars `startBar` to `endBar` (0-based) are played twice. Absent means none. With
     * `endings` (core_09.AC45, d269) the first ending is the last bars of the repeat (it ends at `endBar`) and the second
     * follows right after it: the second pass skips the first ending and plays the second in its place.
     */
    repeats: z.array(z.object({
      startBar: z.int().nonnegative(),
      endBar: z.int().nonnegative(),
      endings: z.object({ first: barSpanSchema, second: barSpanSchema }).optional(),
    })).optional(),
    /** Written slurs (core_09.AC26, d120): legato from the note starting at `startTick` to the one at `endTick`, in one track and voice. Absent means none. */
    slurs: z.array(slurSchema).optional(),
    /** Grace notes (core_09.AC31, d121). Absent means none; no schema version change. */
    graces: z.array(graceSchema).optional(),
    /** Ornament signs (core_09.AC60, d305). Absent means none; no schema version change. */
    ornaments: z.array(ornamentSchema).optional(),
    /** Tuplets (core_09.AC49, d163). Absent means none; no schema version change. */
    tuplets: z.array(tupletSchema).optional(),
    range: z.object({ low: midi, high: midi }),
  })
  .superRefine((chart, ctx) => {
    const issue = (message: string, path: (string | number)[] = []) =>
      ctx.addIssue({ code: 'custom', message, path });

    for (const mapName of ['tempoMap', 'meterMap', 'keyMap'] as const) {
      const map = chart[mapName];
      if (map[0]!.tick !== 0) issue(`${mapName} must start at tick 0`, [mapName, 0, 'tick']);
      for (let i = 1; i < map.length; i++) {
        if (map[i]!.tick <= map[i - 1]!.tick) issue(`${mapName} ticks must strictly increase`, [mapName, i, 'tick']);
      }
    }

    const trackIds = new Set(chart.tracks.map((t) => t.id));
    if (trackIds.size !== chart.tracks.length) issue('track ids must be unique', ['tracks']);

    let expectedStart = 0;
    chart.bars.forEach((bar, i) => {
      if (bar.index !== i) issue(`bar index must be ${i}`, ['bars', i, 'index']);
      if (bar.startTick !== expectedStart) issue('bars must be contiguous from tick 0', ['bars', i, 'startTick']);
      if (bar.endTick <= bar.startTick) issue('bar must have positive length', ['bars', i, 'endTick']);
      expectedStart = bar.endTick;
    });
    for (const [i, m] of chart.meterMap.entries()) {
      if (!chart.bars.some((b) => b.startTick === m.tick)) issue('meter change must fall on a bar line', ['meterMap', i, 'tick']);
    }

    const total = expectedStart;
    chart.notes.forEach((n, i) => {
      const at = (field: string) => ['notes', i, field];
      if (!trackIds.has(n.track)) issue(`unknown track "${n.track}"`, at('track'));
      if (spellingToMidi(n.spelling) !== n.midi) issue('midi does not match spelling', at('midi'));
      if (n.tick + n.dur > total) issue('note extends past the last bar', at('dur'));
      const bar = barIndexAtTick(chart.bars, n.tick);
      if (bar !== n.bar) issue(`bar should be ${bar}`, at('bar'));
      if (n.midi < chart.range.low || n.midi > chart.range.high) issue('note outside chart range', at('midi'));
    });
    chart.rests.forEach((r, i) => {
      if (!trackIds.has(r.track)) issue(`unknown track "${r.track}"`, ['rests', i, 'track']);
      if (r.tick + r.dur > total) issue('rest extends past the last bar', ['rests', i, 'dur']);
      if (barIndexAtTick(chart.bars, r.tick) !== r.bar) issue('rest bar does not match tick', ['rests', i, 'bar']);
    });
    chart.phrases.forEach((p, i) => {
      if (p.endBar < p.startBar || p.endBar >= chart.bars.length) issue('phrase outside the bars', ['phrases', i]);
    });
    (chart.repeats ?? []).forEach((r, i) => {
      const before = chart.repeats![i - 1];
      if (r.endBar < r.startBar || r.endBar >= chart.bars.length) issue('repeat outside the bars', ['repeats', i]);
      if (before && r.startBar <= (before.endings?.second.endBar ?? before.endBar)) issue('repeats must follow each other without overlapping', ['repeats', i]);
      const e = r.endings;
      if (!e) return;
      if (e.first.startBar < r.startBar || e.first.endBar !== r.endBar || e.first.endBar < e.first.startBar) issue('a first ending must be the last bars of its repeat', ['repeats', i, 'endings']);
      if (e.second.startBar !== r.endBar + 1 || e.second.endBar < e.second.startBar || e.second.endBar >= chart.bars.length) issue('a second ending must follow the first ending, inside the bars', ['repeats', i, 'endings']);
    });
    const slurs = chart.slurs ?? [];
    slurs.forEach((s, i) => {
      const noteAt = (t: number) => chart.notes.some((n) => n.track === s.track && n.voice === s.voice && n.tick === t);
      if (s.endTick <= s.startTick) issue('slur must span two or more different onsets', ['slurs', i]);
      else if (!noteAt(s.startTick) || !noteAt(s.endTick)) issue('slur must start and end on notes of its own track and voice', ['slurs', i]);
      slurs.forEach((o, j) => {
        if (j < i && o.track === s.track && o.voice === s.voice && s.startTick <= o.endTick && o.startTick <= s.endTick) issue('slurs of one voice must not overlap', ['slurs', i]);
      });
    });
    (chart.graces ?? []).forEach((g, i) => {
      const at = (field: string) => ['graces', i, field];
      if (!trackIds.has(g.track)) issue(`unknown track "${g.track}"`, at('track'));
      if (spellingToMidi(g.pitch.spelling) !== g.pitch.midi) issue('midi does not match spelling', at('pitch'));
      const main = chart.notes.find((n) => n.track === g.track && n.voice === g.voice && n.tick === g.tick);
      const group = chart.graces!.filter((o) => o.track === g.track && o.voice === g.voice && o.tick === g.tick);
      const next = group[group.indexOf(g) + 1];
      if (!main) issue('a grace tick must be a note start in its track and voice', at('tick'));
      else if (!next && main.midi === g.pitch.midi) issue('a grace cannot have the same pitch as its main note', at('pitch'));
      if (next && next.pitch.midi === g.pitch.midi) issue('two graces in a row cannot have one pitch', at('pitch'));
      if (group.length > MAX_GRACE_GROUP && group[0] === g) issue(`a note takes at most ${MAX_GRACE_GROUP} grace notes`, at('tick'));
    });
    (chart.ornaments ?? []).forEach((o, i) => {
      const at = (field: string) => ['ornaments', i, field];
      if (!trackIds.has(o.track)) issue(`unknown track "${o.track}"`, at('track'));
      const mains = chart.notes.filter((n) => n.track === o.track && n.voice === o.voice && n.tick === o.tick);
      if (mains.length !== 1) issue('an ornament goes on a single note: its tick must be the start of one note in its track and voice', at('tick'));
      const main = mains[0];
      for (const side of ['upper', 'lower'] as const) {
        const aux = o[side];
        const wanted = side === 'upper' ? usesUpper(o.kind) : usesLower(o.kind);
        if (wanted !== (aux !== undefined)) issue(wanted ? `a ${o.kind} needs its ${side} note` : `a ${o.kind} has no ${side} note`, at(side));
        if (!aux) continue;
        if (spellingToMidi(aux.spelling) !== aux.midi) issue('midi does not match spelling', at(side));
        if (main && (side === 'upper' ? aux.midi <= main.midi : aux.midi >= main.midi)) issue(`the ${side} note must be ${side === 'upper' ? 'above' : 'below'} the main note`, at(side));
      }
      if (chart.ornaments!.findIndex((p) => p.track === o.track && p.voice === o.voice && p.tick === o.tick) !== i) issue('a note takes one ornament', at('tick'));
    });
    const tuplets = chart.tuplets ?? [];
    tuplets.forEach((t, i) => {
      const startsAt = (tk: number) =>
        chart.notes.some((n) => n.track === t.track && n.voice === t.voice && n.tick === tk) || chart.rests.some((r) => r.track === t.track && r.voice === t.voice && r.tick === tk);
      if (!trackIds.has(t.track)) issue(`unknown track "${t.track}"`, ['tuplets', i, 'track']);
      if (t.endTick <= t.startTick) issue('a tuplet must span two or more onsets', ['tuplets', i]);
      else if (!startsAt(t.startTick) || !startsAt(t.endTick)) issue('a tuplet must start and end on notes or rests of its own track and voice', ['tuplets', i]);
      tuplets.forEach((o, j) => {
        if (j < i && o.track === t.track && o.voice === t.voice && t.startTick <= o.endTick && o.startTick <= t.endTick) issue('tuplets of one voice must not overlap', ['tuplets', i]);
      });
    });
    for (const [a, b] of crossingParts(chart.phrases)) issue(`phrases "${a.name}" and "${b.name}" cross; parts may nest but not cross`, ['phrases']);
    if (chart.range.low > chart.range.high) issue('range low is above high', ['range']);
  });

export type Chart = z.infer<typeof chartSchema>;
export type ChartNote = z.infer<typeof noteSchema>;
export type ChartTrack = z.infer<typeof trackSchema>;
export type ChartRest = z.infer<typeof restSchema>;
/** @public A grace note; read by the staff layout from slice 2 of d121 on. */
export type ChartGrace = z.infer<typeof graceSchema>;
export type ChartTuplet = z.infer<typeof tupletSchema>;
export type ChartOrnament = z.infer<typeof ornamentSchema>;
/** @public Part of the chart model, for readers of chart files. */
export type ChartBar = z.infer<typeof barSchema>;
/** @public */
export type ChartPhrase = z.infer<typeof phraseSchema>;

/** Sidecar `piece.meta.json`. Phrase bars are 1-based and inclusive for humans; the compiler converts to 0-based. */
/** The licence of pieces written in the game's editor (ft_1_02): they stay private, never committed. */
export const OWN_PIECE_LICENSE = 'NaN';

export const pieceMetaSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'use lowercase words joined by dashes'),
  title: z.string().min(1),
  /** Titles per locale (ft_0_18.AC4); copied into the chart. Optional and additive: no schema version change. */
  titles: pieceTitlesSchema.optional(),
  /** Bump when a piece is edited so saves can tell versions apart. */
  contentVersion: z.int().positive().default(1),
  level: z.int().positive(),
  /** Player level needed to play it. Defaults to `level`; lower it for a piece the student should meet early. */
  unlockLevel: z.int().positive().optional(),
  status: z.enum(['draft', 'approved']),
  /**
   * How hard it is, in half stars of d157: 1 to 50, two points each, so 1 to 10 is the Beginner grade (the steps of d138).
   * A person confirms it. Optional and additive: widened from 1 to 10 without a schema version change (d157).
   */
  difficulty: z.int().min(1).max(50).optional(),
  hands: z.array(z.enum(['RH', 'LH'])).min(1),
  /** Bars as printed: the first full bar is 1, a pick-up is 0 (d120); the compiler refuses 0 without a pick-up. */
  phrases: z.array(z.object({ name: z.string().min(1), bars: z.tuple([z.int().nonnegative(), z.int().nonnegative()]) })),
  /** Style ids from the closed list in `content/pieces/styles.json` (core_05); the linter checks them. */
  styles: z.array(z.string()).default([]),
  /** Free words for technique and provenance (`c-position`, `generated`); not a style, not shown on the info card. */
  tags: z.array(z.string()).default([]),
  source: z.string().min(1),
  license: z.string().min(1),
  generator: z.object({
    kind: z.string().min(1),
    seed: z.union([z.string(), z.number()]).optional(),
    params: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type PieceMeta = z.infer<typeof pieceMetaSchema>;

const noteValueSchema = z.enum(['whole', 'dottedHalf', 'half', 'dottedQuarter', 'quarter', 'dottedEighth', 'eighth', 'sixteenth']);

/** One row of `content/curriculum/levels.json`. The piece linter applies it. */
export const levelSchema = z.object({
  level: z.int().positive(),
  name: z.string().min(1),
  hands: z.array(z.enum(['RH', 'LH'])).min(1),
  clefs: z.array(z.enum(['treble', 'bass'])).min(1),
  range: z.object({ low: midi, high: midi }),
  noteValues: z.array(noteValueSchema).min(1),
  rests: z.boolean(),
  meters: z.array(z.object({ num: z.int().positive(), den: z.int().positive() })).min(1),
  /** Largest melodic jump in diatonic steps: 0 repeated note, 1 a step, 2 a third, 4 a fifth. */
  maxLeapSteps: z.int().nonnegative(),
  /** Accidentals that are not in the key signature (a sharp in C major, a natural in G major). */
  accidentals: z.boolean(),
  /** Key signatures the level allows, as `fifths` (0 = C or A minor, 1 = G or E minor, -1 = F or D minor). */
  keys: z.array(z.int().min(-7).max(7)).min(1).default([0]),
  /** May the right and left hand sound at the same time? (The two-hands bonus applies to these pieces.) */
  handsTogether: z.boolean().default(false),
  /** Several notes of one hand at once. The staff renderer cannot draw them yet. */
  chords: z.boolean().default(false),
  /** Ties across notes or bar lines. The staff renderer cannot draw them yet. */
  ties: z.boolean().default(false),
  /** How many voices one hand may play at once: 2 is a melody and a held note in one hand, ABC `&` (core_09.AC54, d164). */
  voices: z.int().min(1).max(2).default(1),
  /** Triplets (core_09.AC51, d163): a note value inside a triplet is allowed only with this switch on. Absent means off. */
  tuplets: z.boolean().default(false),
  /**
   * Ornament signs (core_09.AC64, d305): a trill, mordent or turn is allowed only with this switch on. Absent means off;
   * on at every level (a level never switches notation off), kept for a teacher's own curriculum. Grace groups need no switch.
   */
  ornaments: z.boolean().default(false),
  /** Allowed number of bars in a whole piece. */
  bars: z.object({ min: z.int().positive(), max: z.int().positive() }).default({ min: 4, max: 16 }),
  /** Finger for each note name, per hand, e.g. RH C position: C4 1, D4 2, E4 3, F4 4, G4 5. Notes not listed are unchecked. */
  fingerings: z.record(z.string(), z.record(z.string(), z.int().min(1).max(5))).default({}),
});
export type LevelDefinition = z.infer<typeof levelSchema>;

export const levelsFileSchema = z.object({
  schemaVersion: z.literal(1),
  /** For humans: where the table comes from and whether it is final. */
  note: z.string().optional(),
  levels: z.array(levelSchema).min(1),
});
