/**
 * The tug of reputation (ft_1_21, WP-10; contract A.10): the student and a character trade the two-bar phrases of the
 * student's piece; each student phrase is an exchange won or lost, and the standing decides at three steps. The practice
 * tug with Kiur (ft_1_21.AC14) runs the same rules with nothing won or lost. Pure: the scene (WP-13, 10x dev) plays the
 * character's phrases, judges the student's, and passes each result in. Numbers in content/challenge/rules.json.
 * AX-3 provisional until the students have played it (d129).
 */
import { z } from 'zod';
import { levelBars } from '../campaign/content';
import type { PieceId } from '../contracts';
import type { ExchangeKind, ExchangeResult, Turn, TurnPlan, TurnResult } from './exchange';

const modeSchema = z.enum(['wait', 'tempo']);
const levelSchema = z.strictObject({ share: z.number().min(0).max(1), mode: modeSchema, prize: z.number().int().min(0) });

export const tugRulesSchema = z.strictObject({
  schemaVersion: z.literal(1),
  note: z.string().optional(),
  /** The student wins at +steps, the character at -steps. */
  steps: z.number().int().min(1),
  /** Kiur the trainer's tug (ft_1_21.AC14) is won and lost at this many steps instead. */
  practiceSteps: z.number().int().min(1),
  /** Bars in a phrase. */
  phraseBars: z.number().int().min(1),
  /** Per level 1, 2, 3: the share of the student's phrase that wins an exchange, the play mode and the XP a won tug pays. */
  levels: z.tuple([levelSchema, levelSchema, levelSchema]),
  /**
   * The stall kill (ft_1_21.AC17): after `after` student phrases with no winner, each further phrase
   * needs `raise` more of its notes right, up to all of them, so a student who keeps winning and losing is overpowered.
   */
  stall: z.strictObject({ after: z.number().int().min(0), raise: z.number().min(0).max(1) }),
});

export type TugRules = z.infer<typeof tugRulesSchema>;

export function parseTugRules(raw: unknown): TugRules {
  return tugRulesSchema.parse(raw);
}

/** The defaults of d129; content/challenge/rules.json holds the same (a test keeps them equal). */
export const DEFAULT_TUG_RULES: TugRules = {
  schemaVersion: 1,
  note: "AX-3 provisional (d129). The tug of ft_1_21: the student wins at +steps, the character at -steps; phraseBars bars per phrase; per level the share of the student's phrase that wins an exchange (the ladder's accuracy, ft_1_06.AC9), the play mode (d100) and the XP a won tug pays (the old battle's 30 at level 1, more for the harder levels).",
  steps: 3,
  practiceSteps: 2,
  phraseBars: 2,
  levels: [
    { share: 0.6, mode: 'wait', prize: 30 },
    { share: 0.8, mode: 'tempo', prize: 45 },
    { share: 0.95, mode: 'tempo', prize: 60 },
  ],
  stall: { after: 4, raise: 0.05 },
};

type Level = 1 | 2 | 3;
type Bars = { readonly from: number; readonly to: number };

/**
 * The bars a tug plays (ft_1_21.AC3, ft_1_06.AC9): level 1 the first half of the piece (rounded up), levels 2 and 3 the
 * whole piece, as the ladder's `levelBars`. Full bars count from 1 as printed (d120); a pick-up is added by `tugPhrases`.
 */
export function tugPart(bars: number, level: Level): Bars {
  if (!Number.isInteger(bars) || bars < 1) throw new RangeError(`a piece has at least one bar, got ${bars}`);
  const [from, to] = levelBars(level, bars);
  return { from, to };
}

/** The part cut into phrases of `phraseBars` bars (2), a pick-up bar 0 joined to the first, a short last phrase alone. */
export function tugPhrases(part: Bars, pickup: boolean, phraseBars = DEFAULT_TUG_RULES.phraseBars): Bars[] {
  const phrases: Bars[] = [];
  for (let from = part.from; from <= part.to; from += phraseBars) {
    phrases.push({ from, to: Math.min(from + phraseBars - 1, part.to) });
  }
  if (pickup && phrases.length > 0) phrases[0] = { from: 0, to: phrases[0]!.to };
  return phrases;
}

export interface TugSetup {
  readonly kind: Extract<ExchangeKind, 'tug' | 'practiceTug'>;
  readonly piece: PieceId;
  readonly level: Level;
  /** Full bars of the piece, without a pick-up. */
  readonly bars: number;
  readonly pickup: boolean;
  /** The pass with the roles swapped starts with the student (ft_1_21.AC4). */
  readonly studentFirst?: boolean;
}

function passTurns(setup: TugSetup, rules: TugRules, studentFirst: boolean): Turn[] {
  const mode = rules.levels[setup.level - 1]!.mode;
  return tugPhrases(tugPart(setup.bars, setup.level), setup.pickup, rules.phraseBars).map((bars, i) => {
    const who = (i % 2 === 0) === studentFirst ? 'student' : 'character';
    // No staff at any level: the part is played from memory (ft_1_21.AC6, d100).
    return { who, bars, judged: who === 'student', mode, hands: 'both', staff: false };
  });
}

/** One pass of the tug: the character's phrase first (unless `studentFirst`), then alternating (ft_1_21.AC4, AC6). */
export function tugPlan(setup: TugSetup, rules: TugRules): TurnPlan {
  return { kind: setup.kind, piece: setup.piece, level: setup.level, turns: passTurns(setup, rules, setup.studentFirst ?? false) };
}

export interface TugState {
  readonly setup: TugSetup;
  /** Every pass played so far, appended; `ExchangeResult.turns[].turn` indexes it. */
  readonly plan: TurnPlan;
  /** The turn to play next. */
  readonly turn: number;
  /** 0 for the first pass, 1 when the roles were swapped once, ... */
  readonly pass: number;
  /** -steps to +steps; + is toward the character (the student winning). */
  readonly standing: number;
  /** The furthest standing reached toward the character, at least 0 (ft_1_21.AC8). */
  readonly best: number;
  readonly results: readonly TurnResult[];
  readonly outcome?: 'won' | 'lost' | 'left';
}

export function startTug(setup: TugSetup, rules: TugRules): TugState {
  return { setup, plan: tugPlan(setup, rules), turn: 0, pass: 0, standing: 0, best: 0, results: [] };
}

/**
 * The share the student's next phrase needs to win its exchange (ft_1_21.AC5): the level's share for the first
 * `stall.after` phrases, then `stall.raise` more for each phrase after them, never more than all its notes (AC17).
 */
export function tugShare(state: TugState, rules: TugRules): number {
  const over = Math.max(0, state.results.length - rules.stall.after + 1);
  // rounded to whole tenths of a per cent, so 0.6 + 0.05 is 0.65 and not 0.6499999
  return Math.min(1, Math.round((rules.levels[state.setup.level - 1]!.share + over * rules.stall.raise) * 1000) / 1000);
}

/** What the scene measured in a student's phrase: the share of notes right first try (Wait) or on time (Tempo). */
export type TugTurnInput = Omit<TurnResult, 'turn' | 'passed'>;

/**
 * Plays the next turn: a character's turn takes no input; a student's turn takes its measured share, won when at least
 * the level's share (ft_1_21.AC5), moving the standing a step toward the character, else a step toward the student. At
 * +steps or -steps the tug is decided; at the end of the part undecided it starts over with the roles swapped (AC4).
 */
export function advanceTug(state: TugState, rules: TugRules, input?: TugTurnInput): TugState {
  if (state.outcome !== undefined) throw new RangeError(`the tug is over (${state.outcome})`);
  const turn = state.plan.turns[state.turn]!;
  let { standing, best, results } = state;
  if (turn.who === 'character') {
    if (input !== undefined) throw new RangeError("the character's turn is never judged");
  } else {
    if (input === undefined) throw new RangeError("the student's turn needs its result");
    const passed = input.share >= tugShare(state, rules);
    standing += passed ? 1 : -1;
    best = Math.max(best, standing);
    results = [...results, { ...input, turn: state.turn, passed }];
  }
  const decided = standing >= rules.steps ? 'won' : standing <= -rules.steps ? 'lost' : undefined;
  const next = state.turn + 1;
  if (decided !== undefined) return { ...state, standing, best, results, turn: next, outcome: decided };
  if (next < state.plan.turns.length) return { ...state, standing, best, results, turn: next };
  // The part ended undecided: another pass, the roles swapped.
  const pass = state.pass + 1;
  const turns = passTurns(state.setup, rules, (state.setup.studentFirst ?? false) !== (pass % 2 === 1));
  return { ...state, standing, best, results, pass, turn: next, plan: { ...state.plan, turns: [...state.plan.turns, ...turns] } };
}

/** The student leaves the tug (Back or Esc). */
export function leaveTug(state: TugState): TugState {
  if (state.outcome !== undefined) throw new RangeError(`the tug is over (${state.outcome})`);
  return { ...state, outcome: 'left' };
}

/** The finished tug as the contract's `ExchangeResult` (A.10): the passes played, every student turn, outcome, standing. */
export function exchangeResult(state: TugState): ExchangeResult {
  if (state.outcome === undefined) throw new RangeError('the tug is still going');
  return { plan: state.plan, turns: state.results, outcome: state.outcome, standing: state.standing };
}

/**
 * What a tug pays (ft_1_21.AC8): a won tug the full prize; a lost one half the prize times the furthest standing reached
 * toward the character over `steps`, rounded down, never taking anything away; leaving nothing. A practice tug with Kiur
 * pays nothing either way (AC14).
 */
export function tugPrize(
  result: { readonly kind: ExchangeKind; readonly outcome: ExchangeResult['outcome']; readonly best: number },
  prize: number,
  rules: Pick<TugRules, 'steps'>,
): number {
  if (result.kind === 'practiceTug') return 0;
  if (result.outcome === 'won') return prize;
  if (result.outcome === 'lost') return Math.floor(((prize / 2) * Math.max(0, Math.min(result.best, rules.steps))) / rules.steps);
  return 0;
}
