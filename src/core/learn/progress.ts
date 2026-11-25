import type { DayString } from '../contracts';
import type { BarPlay } from '../progression/practiceLog';
import { z } from 'zod';
import type { Chart } from '../chart';
import { LEARN_RULES, learnUnits, type LearnStep, type LearnStepKind, type LearnStepSize } from './plan';
import { TEMPO_RULES, type RunTempo } from './tempo';
import { defaultLaneLook, LANE_LIMITS, type LaneLook } from '../layout/beatLane';

/**
 * Where a player is in learning one piece (ft_1_32.AC2), and what that has earned (AC4). Pure. Saved per player and piece
 * from slice 2 on; the plan is made again from the chart each time, so the progress keeps only its place in it.
 */
export interface LearnProgress {
  /** Index of the current step of the plan; the plan's length once the piece is learned. */
  step: number;
  /** Perfect runs in a row of the current step (only a step needing more than one run counts them). */
  wholeStreak: number;
  /** The recall check is due: the step before is played once, perfectly, before the current one. */
  recall: boolean;
  /** The last run had note names shown: the next one is played with them hidden. */
  confirm: boolean;
  /** Runs of the current step that did not count (stopped, or with note names): they set its medal. */
  misses: number;
  /** The medal of every finished step, by step index. */
  medals: Medal[];
  /** The day of the last run, or null before the first. */
  lastDay: DayString | null;
  /**
   * The tempo the student kept (BPM) in each measured run that counted, in order: the confirmation plays and the whole runs
   * (`runTempo`). Their median is the piece's baseline tempo (`baselineBpm`). Absent before the first.
   */
  bpm?: number[];
  /** Measured runs of the current step that had every note right but an uneven pace, asked again (`TEMPO_RULES.asks`). Absent: none. */
  unsteady?: number;
  /**
   * What every measured run with all notes right showed (ft_1_32.AC8), oldest first, the latest `MAX_LEARN_TESTS`: also the
   * uneven ones that were asked again, so the stats show the way to an even pace. Absent before the first.
   */
  tests?: LearnTest[];
  /**
   * The bars a step added when this piece's learning began (`LearnSettings.stepBars`): the plan is made with it until the
   * piece is learned, so `step` and `medals` keep pointing at the same steps when the setting changes. Absent: 1, the only
   * step size offered before the field.
   */
  stepBars?: LearnStepSize;
  /**
   * The plan of this piece has hands-apart steps (`learnPlan`'s `handsApart`, ft_1_32 rule 13). Absent: no, as in every
   * piece begun before the field, so its step index keeps pointing at the same steps.
   */
  handsApart?: boolean;
  /** When the piece was learned (ISO 8601): only plays after it raise a bar to gold (`goldenBars`). Absent before, and in progress kept before the field. */
  learnedAt?: string;
  /**
   * The clef the piece had won when its learning began again (`relearn`, ft_1_32.AC24): the book keeps it while the piece is
   * learned again, and the clef never goes lower than it. Absent: the piece was never learned again.
   */
  clef?: Medal;
}

/** The measures of one measured run, as kept: whole numbers, the shares in percent. */
export interface LearnTest {
  day: DayString;
  /** The plan's step that was tested. */
  step: number;
  bpm: number;
  /** The standard deviation of the gaps around the run's own pace, percent (`RunTempo.spread`). */
  sd: number;
  /** The same without the weight of the stops, percent (`RunTempo.robust`). */
  mad: number;
  /** The tempo's change from the run's start to its end, percent: above 0 the student sped up (`RunTempo.drift`). */
  drift: number;
  halts: number;
  /** The pace was even enough to count for the baseline tempo. */
  steady: boolean;
  /** What was tested: a chunk's confirmation play, a join of chunks, or the whole piece. Absent in a record kept before this. */
  kind?: MeasuredKind;
  /** The piece's bar the run began at, and from there each bar's pace against the run's own, percent (0: no gap began in the bar). */
  firstBar?: number;
  bars?: number[];
  /** Each hand's own robust spread, percent, when both hands played (`RunTempo.hands`). */
  hands?: { RH?: number; LH?: number };
}

export type MeasuredKind = Exclude<LearnStepKind, 'grow'>;

/** The most measured runs kept per piece; older ones go first (the save must not grow without end). AX-3 provisional. */
export const MAX_LEARN_TESTS = 60;
/** A kept percent stays within this, either way. */
const MAX_PERCENT = 1000;

const learnTestSchema = z.object({
  day: z.string().min(1),
  step: z.int().nonnegative(),
  bpm: z.number().positive(),
  sd: z.int().nonnegative(),
  mad: z.int().nonnegative(),
  drift: z.int(),
  halts: z.int().nonnegative(),
  steady: z.boolean(),
  kind: z.enum(['confirm', 'join', 'whole']).exactOptional(),
  firstBar: z.int().nonnegative().exactOptional(),
  bars: z.array(z.int().nonnegative()).exactOptional(),
  hands: z.object({ RH: z.int().nonnegative().exactOptional(), LH: z.int().nonnegative().exactOptional() }).exactOptional(),
});

const medalSchema = z.enum(['gold', 'silver', 'bronze']);

/** The saved form of `LearnProgress` (profile `learning`, optional, no version bump: d069.3). */
export const learnProgressSchema = z.object({
  step: z.int().nonnegative(),
  wholeStreak: z.int().nonnegative(),
  recall: z.boolean(),
  confirm: z.boolean(),
  misses: z.int().nonnegative(),
  medals: z.array(medalSchema),
  lastDay: z.string().min(1).nullable(),
  bpm: z.array(z.number().positive()).exactOptional(),
  unsteady: z.int().nonnegative().exactOptional(),
  tests: z.array(learnTestSchema).exactOptional(),
  stepBars: z.union([z.literal(1), z.literal(2)]).exactOptional(),
  learnedAt: z.string().min(1).exactOptional(),
  handsApart: z.boolean().exactOptional(),
  clef: medalSchema.exactOptional(),
});

/**
 * The player's learning settings (profile `settings.learn`, optional; absent reads as `DEFAULT_LEARN_SETTINGS`): the bars a
 * step adds, and the mistake markers with the miss they appear at.
 */
export const learnSettingsSchema = z.object({
  stepBars: z.union([z.literal(1), z.literal(2)]),
  markers: z.boolean(),
  markersFrom: z.int().min(1).max(5),
  /**
   * Learn a new two-hand piece hands apart (ft_1_32 rule 13): each growing step by the right hand, the left, then both.
   * Absent (saved before it) or false: both hands together, the default. An optional field, no version bump (d069.3).
   */
  handsApart: z.boolean().optional(),
  /**
   * The run's live tempo, spread and wobble in the slim strip at the foot while a piece is learned (ft_1_32 rule 18): a parent's or
   * teacher's tool, off unless turned on. Absent or false: off. An optional field, no version bump (d069.3).
   */
  liveTempo: z.boolean().optional(),
  /**
   * Where the beat lane runs on the staff (core_13 rule 2): between the two staves (one staff: above it), above the staff,
   * or off. Absent: between. An optional field, no version bump (d069.3).
   */
  beatLane: z.enum(['above', 'between', 'off']).optional(),
  /**
   * The beat lanes as the player tuned them (core_13 rule 10), up to `LANE_LIMITS.lanes`; an empty list shows none. Absent:
   * the one lane of `beatLane`. An optional field, no version bump (d069.3).
   */
  beatLanes: z.array(z.object({
    place: z.enum(['above', 'between']),
    offset: z.number().min(-LANE_LIMITS.offset).max(LANE_LIMITS.offset),
    dots: z.object({ ghost: z.number().min(0).max(1), beat: z.number().min(0).max(1), top: z.number().min(0).max(1), bottom: z.number().min(0).max(1) }),
    wave: z.object({ height: z.number().min(0).max(LANE_LIMITS.height), reach: z.number().min(0).max(LANE_LIMITS.reach) }),
    blink: z.boolean().optional(),
  })).max(LANE_LIMITS.lanes).optional(),
  /**
   * A click at the student's own pace in a learning run (core_13 rule 6), started afresh at every key. Absent or false: off,
   * so the pace measured is the student's own (ft_1_32 rule 8). An optional field, no version bump (d069.3).
   */
  paceClick: z.boolean().optional(),
});

/** Whether a learning run shows its live tempo in the top bar: only when the player turned it on (rule 18). */
export function learnLiveTempo(settings: LearnSettings): boolean {
  return settings.liveTempo === true;
}

/** Where the beat lane runs: between the staves unless the player chose otherwise (core_13.AC2). */
export function learnBeatLane(settings: LearnSettings): 'above' | 'between' | 'off' {
  return settings.beatLane ?? 'between';
}

/** The lanes drawn (core_13.AC8): as the player tuned them, else the one lane of `learnBeatLane` (none when it is off). */
export function learnBeatLanes(settings: LearnSettings): LaneLook[] {
  if (settings.beatLanes) return settings.beatLanes;
  const place = learnBeatLane(settings);
  return place === 'off' ? [] : [defaultLaneLook(place)];
}

/** Whether a learning run clicks at the student's own pace: only when the player turned it on (core_13.AC6). */
export function learnPaceClick(settings: LearnSettings): boolean {
  return settings.paceClick === true;
}

export type LearnSettings = z.infer<typeof learnSettingsSchema>;

export const DEFAULT_LEARN_SETTINGS: LearnSettings = { stepBars: 1, markers: true, markersFrom: 2, handsApart: false };

/**
 * The step size to plan a piece with: the player's setting for a piece not started yet, else the size its learning began
 * with, so a change of the setting applies to the next piece and never moves a piece in progress to another step.
 */
export function learnStepBars(progress: LearnProgress, settings: LearnSettings): LearnStepSize {
  return progress.lastDay === null ? settings.stepBars : (progress.stepBars ?? 1);
}

/**
 * Whether to plan a piece with hands-apart steps: the player's setting for a piece not begun yet (both hands together when
 * unset), else as its learning began, so a change of the setting applies to the next piece.
 */
export function learnHandsApart(progress: LearnProgress, settings: LearnSettings): boolean {
  return progress.lastDay === null ? (settings.handsApart ?? false) : (progress.handsApart ?? false);
}

export const START_PROGRESS: LearnProgress = { step: 0, wholeStreak: 0, recall: false, confirm: false, misses: 0, medals: [], lastDay: null };

/**
 * How a run ended: perfect, perfect with note names shown, perfect but a measured run (a confirmation play or a whole run)
 * not kept evenly enough to give a tempo, stopped by a wrong key, or played to its end with wrong keys (`flawed`: a play of
 * a step asked several times, d300).
 */
export type RunOutcome = 'perfect' | 'hinted' | 'unsteady' | 'stopped' | 'flawed';

/**
 * Whether the next run of `step` goes on past a wrong key to the end (d300): every play but the last of a step asked
 * several times (the whole piece). The last play must be perfect; a wrong key starts it again, still the last play.
 */
export const playsOn = (step: LearnStep, progress: LearnProgress): boolean => step.runs > 1 && progress.wholeStreak < step.runs - 1;

/** Whether a run of `step` is measured: its tempo is kept, and it must be played evenly to count. */
export const isMeasured = (run: LearnRun): boolean => run.kind === 'step' && run.step.kind !== 'grow';

/** What the player plays next: a step, the recall check of the step before, or nothing once the piece is learned. */
export type LearnRun = { kind: 'step' | 'recall'; firstBar: number; lastBar: number; step: LearnStep; noteNames: 'allowed' | 'hidden' };

/**
 * How a run played to its end with every note right counts (ft_1_32.AC7). `tempo` is its measured tempo, null for a run that
 * is not measured or too short to measure. An uneven run is asked again, but only `TEMPO_RULES.asks` times for a step:
 * after that it counts with no tempo kept.
 */
export function measuredOutcome(progress: LearnProgress, tempo: RunTempo | null): { outcome: RunOutcome; bpm?: number } {
  if (!tempo) return { outcome: 'perfect' };
  if (tempo.steady) return { outcome: 'perfect', bpm: tempo.bpm };
  return (progress.unsteady ?? 0) >= TEMPO_RULES.asks ? { outcome: 'perfect' } : { outcome: 'unsteady' };
}

/**
 * The progress with the measures of a measured run of the current step kept (ft_1_32.AC8): call it before `afterRun`, for
 * every measured run with all notes right, even or not. Pure.
 */
export function withTest(progress: LearnProgress, tempo: RunTempo, today: DayString, run?: { kind: LearnStepKind; firstBar: number }): LearnProgress {
  // whole and bounded whatever was measured, so a record can never fail the save of the progress it rides on
  const percent = (share: number, least = -MAX_PERCENT) => (Number.isFinite(share) ? Math.max(least, Math.min(MAX_PERCENT, Math.round(100 * share))) : 0);
  const hands = tempo.hands && {
    ...(tempo.hands.RH === undefined ? {} : { RH: percent(tempo.hands.RH, 0) }),
    ...(tempo.hands.LH === undefined ? {} : { LH: percent(tempo.hands.LH, 0) }),
  };
  const test: LearnTest = {
    day: today, step: progress.step, bpm: tempo.bpm, sd: percent(tempo.spread, 0), mad: percent(tempo.robust, 0), drift: percent(tempo.drift),
    halts: tempo.halts, steady: tempo.steady,
    ...(run && run.kind !== 'grow' ? { kind: run.kind, firstBar: run.firstBar, bars: tempo.bars.map((pace) => (pace === null ? 0 : percent(pace, 0))) } : {}),
    ...(hands ? { hands } : {}),
  };
  return { ...progress, tests: [...(progress.tests ?? []), test].slice(-MAX_LEARN_TESTS) };
}

export function isLearned(plan: readonly LearnStep[], progress: LearnProgress): boolean {
  return progress.step >= plan.length;
}

/**
 * What the recall check of plan step `index` plays (left to the builder). AX-3 provisional: at most
 * one chunk. After a join it is the last chunk joined, by that chunk's confirmation step: a check on a later day is a
 * warm-up of what was learned last, never 8 or 16 bars in one perfect run before anything new.
 */
function recallStep(plan: readonly LearnStep[], index: number): LearnStep {
  const step = plan[index]!;
  if (step.kind !== 'join') return step;
  return plan.slice(0, index).reverse().find((s) => s.kind === 'confirm' && s.lastUnit === step.lastUnit) ?? step;
}

export function currentRun(plan: readonly LearnStep[], progress: LearnProgress): LearnRun | null {
  if (isLearned(plan, progress)) return null;
  const recall = progress.recall && progress.step > 0;
  const step = recall ? recallStep(plan, progress.step - 1) : plan[progress.step]!;
  return { kind: recall ? 'recall' : 'step', firstBar: step.firstBar, lastBar: step.lastBar, step, noteNames: progress.confirm ? 'hidden' : 'allowed' };
}

/**
 * The player opens the piece on `today` (an ISO day). AX-3 provisional: on a later day than the last run, once a step is
 * done and the piece is not learned yet, the recall check is due.
 */
export function sitDown(plan: readonly LearnStep[], progress: LearnProgress, today: DayString): LearnProgress {
  const later = progress.lastDay !== null && today > progress.lastDay;
  return later && progress.step > 0 && !isLearned(plan, progress) ? { ...progress, recall: true } : progress;
}

/**
 * A run of the current run's bars ended. Only a perfect run with note names hidden counts. A run with note names shown
 * counts nothing, hides them for the next run and, like a stopped run, breaks a streak of whole runs; a stopped run repeats the step.
 * `at` (ISO 8601, on `today`) is kept as `learnedAt` when the run finishes the piece.
 */
export function afterRun(plan: readonly LearnStep[], progress: LearnProgress, outcome: RunOutcome, today: DayString, bpm?: number, at: string = today): LearnProgress {
  const next = { ...progress, lastDay: today };
  if (isLearned(plan, progress)) return next;
  // every note was right, only the pace wobbled: nothing is lost and nothing counts; the run is asked for again, slower
  if (outcome === 'unsteady') return progress.recall ? next : { ...next, unsteady: (progress.unsteady ?? 0) + 1 };
  // a run that does not count keeps the count of a step asked several times: a mistake never sends it back to its first play (d300)
  if (outcome === 'hinted') return progress.recall ? { ...next, confirm: true } : { ...next, confirm: true, misses: progress.misses + 1 };
  if (outcome === 'stopped' || (outcome === 'flawed' && (progress.recall || !playsOn(plan[progress.step]!, progress)))) {
    return progress.recall ? next : { ...next, misses: progress.misses + 1 };
  }
  // a play of a step asked several times, with mistakes: it counts as a play, and lowers the step's medal (d300)
  if (outcome === 'flawed') return countPlay(plan, { ...next, confirm: false }, { ...progress, misses: progress.misses + 1 }, at);
  if (progress.recall) return { ...next, confirm: false, recall: false };
  const measured = bpm !== undefined && plan[progress.step]!.kind !== 'grow';
  const counted = { ...next, confirm: false, ...(measured ? { bpm: [...(progress.bpm ?? []), bpm] } : {}) };
  return countPlay(plan, counted, progress, at);
}

/** A run of the current step that counts: the step's count goes on, and the step is done after its last run. */
function countPlay(plan: readonly LearnStep[], counted: LearnProgress, progress: LearnProgress, at: string): LearnProgress {
  const streak = progress.wholeStreak + 1;
  if (streak < plan[progress.step]!.runs) return { ...counted, wholeStreak: streak, misses: progress.misses };
  const advanced: LearnProgress = { ...counted };
  delete advanced.unsteady;
  const step = progress.step + 1;
  return {
    ...advanced, step, wholeStreak: 0, misses: 0, medals: [...progress.medals, medalOf(progress.misses + (progress.unsteady ?? 0))],
    ...(step >= plan.length ? { learnedAt: at } : {}),
  };
}

/**
 * How well a bar, chunk or piece was taken in: gold, silver or bronze. AX-3 provisional: a step
 * finished with no run that did not count is gold, with one or two silver, with more bronze; a measured run asked again for
 * its uneven pace is such a run too (left to the axioms: AX-1, the harder option, so gold is clean and
 * even at the first try, and nothing is taken away). A chunk or the piece takes the
 * lowest of its parts. The player can always raise it to gold by playing it perfectly three plays in a row (`goldenBars`).
 */
export type Medal = 'gold' | 'silver' | 'bronze';

export const MEDAL_RULES = { silverMisses: 2, goldenPlays: 3 } as const;

export function medalOf(misses: number): Medal {
  return misses === 0 ? 'gold' : misses <= MEDAL_RULES.silverMisses ? 'silver' : 'bronze';
}

const RANK: Record<Medal, number> = { bronze: 0, silver: 1, gold: 2 };
const lowest = (medals: readonly Medal[]): Medal => medals.reduce((a, b) => (RANK[b] < RANK[a] ? b : a), 'gold');

/**
 * The bars of a piece whose last `MEDAL_RULES.goldenPlays` plays in the practice log after `learnedAt` (the piece's
 * `LearnProgress.learnedAt`; null while it is not learned) were all perfect (every note right the first time): they shine
 * gold, whatever their learning medal was. The learning runs themselves never count: every one of them that moved on was
 * perfect, so the first bars of a chunk would shine for free.
 */
export function goldenBars(log: readonly BarPlay[], pieceId: string, learnedAt: string | null): Set<number> {
  const byBar = new Map<number, boolean[]>();
  if (learnedAt === null) return new Set();
  const since = Date.parse(learnedAt);
  for (const play of log) {
    if (play.pieceId !== pieceId || play.notes === 0 || !(Date.parse(play.at) > since)) continue;
    const plays = byBar.get(play.bar) ?? [];
    plays.push(play.firstTry === play.notes);
    byBar.set(play.bar, plays);
  }
  const golden = new Set<number>();
  for (const [bar, plays] of byBar) {
    const last = plays.slice(-MEDAL_RULES.goldenPlays);
    if (last.length === MEDAL_RULES.goldenPlays && last.every(Boolean)) golden.add(bar);
  }
  return golden;
}

/** The note a finished chunk becomes: its units as quarters of a whole note (four bars a whole note). */
export type ChunkNote = 'quarter' | 'half' | 'dotted-half' | 'whole';

const NOTE_OF_UNITS: Record<number, ChunkNote> = { 1: 'quarter', 2: 'half', 3: 'dotted-half', 4: 'whole' };

/** The note a chunk of `units` units merges into: four bars a whole note, three a dotted half, two a half, one a quarter. */
export const chunkNoteOf = (units: number): ChunkNote => NOTE_OF_UNITS[Math.max(1, Math.min(4, units))]!;

export interface ChunkReward {
  /** The medal of each secured unit (its quarter note), in order; the rest are not secured yet. */
  quarters: Medal[];
  /** Units in the chunk. */
  units: number;
  /** Once every unit is secured, the one note its quarters merged into, and the lowest of their medals; null before. */
  merged: { note: ChunkNote; medal: Medal } | null;
}

export interface LearnRewards {
  chunks: ChunkReward[];
  /** The golden-clef moment: the learned piece, with the lowest medal of its chunks. */
  piece: Medal | null;
}

/**
 * The rewards of AC4: a quarter note per secured unit, merged into one note per finished chunk, and the clef for the learned
 * piece, each with its medal. `golden` (chart bars, from `goldenBars`) raises a unit, and so its chunk and piece, to gold.
 */
export function learnRewards(
  plan: readonly LearnStep[], progress: LearnProgress, chart: Chart, golden: ReadonlySet<number> = new Set(),
): LearnRewards {
  const whole = plan.at(-1);
  if (!whole) return { chunks: [], piece: null };
  const learned = isLearned(plan, progress);
  const units = learnUnits(chart);
  // a unit shines gold when every bar of it with something to play has three perfect plays; a bar of rests is never played
  const playTracks = new Set(chart.tracks.filter((t) => t.role === 'play').map((t) => t.id));
  const played = new Set(chart.notes.filter((n) => playTracks.has(n.track)).map((n) => n.bar));
  const shines = (u: number): boolean => {
    for (let bar = units[u]!.first; bar <= units[u]!.last; bar++) if (played.has(bar) && !golden.has(bar)) return false;
    return true;
  };
  const done = plan.slice(0, Math.min(progress.step, plan.length));
  // each unit's medal: that of the first finished step that reached it with both hands (a one-hand step earns nothing, rule 13)
  const unitMedal = (u: number): Medal | null => {
    const at = done.findIndex((s) => s.hand === undefined && s.firstUnit <= u && s.lastUnit >= u);
    if (at < 0) return null;
    return shines(u) ? 'gold' : progress.medals[at] ?? 'bronze';
  };
  const chunks: ChunkReward[] = [];
  for (let start = 0; start <= whole.lastUnit; start += LEARN_RULES.chunkUnits) {
    const end = Math.min(start + LEARN_RULES.chunkUnits - 1, whole.lastUnit);
    const quarters: Medal[] = [];
    for (let u = start; u <= end; u++) {
      const medal = unitMedal(u);
      if (medal === null) break;
      quarters.push(medal);
    }
    const count = end - start + 1;
    // the quarters merge once the chunk's confirmation play is done (a chunk of rests has none)
    const confirm = plan.findIndex((s) => s.kind === 'confirm' && s.firstUnit === start);
    const confirmed = confirm < 0 || confirm < done.length;
    chunks.push({ quarters, units: count, merged: confirmed && quarters.length === count ? { note: NOTE_OF_UNITS[count]!, medal: lowest(quarters) } : null });
  }
  // the piece also takes the medals of its measured steps (confirmation plays, joins, the whole run), unless every bar shines gold
  const measured = done.flatMap((s, i) => (s.kind === 'grow' ? [] : [progress.medals[i] ?? 'bronze']));
  const allGolden = units.every((_, u) => shines(u));
  const piece = learned ? (allGolden ? 'gold' : lowest([...chunks.map((c) => c.merged?.medal ?? 'bronze'), ...measured])) : null;
  return { chunks, piece };
}

/** Whether a piece's learning has begun and is past its first step: reopening it asks to continue or start over (ft_1_32.AC16). */
export function halfLearned(progress: LearnProgress): boolean {
  return progress.lastDay !== null && progress.step > 0;
}

/**
 * The learning of a piece started over on `today` (ft_1_32.AC16): the first step again with no medals, planned with the
 * player's settings now; the measured paces and runs stay, as they are true numbers of what was played.
 */
export function startOver(progress: LearnProgress, settings: LearnSettings, today: DayString): LearnProgress {
  return {
    ...START_PROGRESS, lastDay: today, stepBars: settings.stepBars, handsApart: settings.handsApart ?? false,
    ...(progress.bpm ? { bpm: progress.bpm } : {}), ...(progress.tests ? { tests: progress.tests } : {}),
    // a piece learned before and being learned again stays learned, with its clef (ft_1_32.AC24)
    ...(progress.learnedAt === undefined ? {} : { learnedAt: progress.learnedAt }), ...(progress.clef ? { clef: progress.clef } : {}),
  };
}

/**
 * A learned piece learned again from the first step on `today` (ft_1_32.AC24, rule 23), the player asked Kiur for it: planned
 * with the player's settings now, as `startOver`. The piece stays learned (`learnedAt`, the day of its last run when it was
 * learned before that was kept) and keeps `clef`, the clef it had won: nothing earned is taken away (AX-2).
 */
export function relearn(progress: LearnProgress, clef: Medal, settings: LearnSettings, today: DayString): LearnProgress {
  const learnedAt = progress.learnedAt ?? progress.lastDay ?? today;
  return { ...startOver(progress, settings, today), learnedAt, clef: progress.clef ? best(progress.clef, clef) : clef };
}

const MEDAL_RANK: Record<Medal, number> = { bronze: 0, silver: 1, gold: 2 };

/** The better of two medals. */
export function best(a: Medal, b: Medal): Medal {
  return MEDAL_RANK[a] >= MEDAL_RANK[b] ? a : b;
}
