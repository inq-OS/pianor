/**
 * The tug as a scene plays it (ft_1_21, WP-13, on WP-10's `tug.ts`): which chart bars a turn plays, the fact said after
 * each exchange, and what a finished tug leaves behind: the character's record and its item in the world (A.8), and the
 * XP kept as a battle record under the old keys until the next shared save round (AC9). Pure.
 */
import { doorShareFromTempo } from '../campaign/findDoor';
import type { Chart } from '../chart';
import type { PlayStats } from '../judge';
import { pickupTicks } from '../chart/time';
import type { CharacterId, ItemId } from '../contracts';
import { applyTalkEffects } from '../dialogue/talkWorld';
import { recordTug } from '../island/presenceRules';
import type { WorldState } from '../island/worldState';
import type { BattleInput } from '../progression/profile';
import { exchangeResult, tugPrize, type TugRules, type TugSetup, type TugState } from './tug';

type Level = 1 | 2 | 3;

/** The tug of `chart` at `level`: its piece, its full bars (a pick-up not counted) and whether it starts with one (d120). */
export function tugSetupOf(chart: Chart, kind: TugSetup['kind'], level: Level): TugSetup {
  const pickup = pickupTicks(chart.bars, chart.meterMap, chart.ppq) > 0;
  return { kind, piece: chart.id, level, bars: chart.bars.length - (pickup ? 1 : 0), pickup };
}

/**
 * A turn's bars as the chart's bar indices from 0, both included (for `sliceChart`): printed bar 1 is index 0, or index 1
 * when a pick-up (printed bar 0, d120) comes first.
 */
export function turnChartBars(bars: { readonly from: number; readonly to: number }, pickup: boolean): { first: number; last: number } {
  if (bars.from < (pickup ? 0 : 1) || bars.to < bars.from) throw new RangeError(`bars ${bars.from} to ${bars.to} of a piece ${pickup ? 'with' : 'without'} a pick-up`);
  const shift = pickup ? 0 : 1;
  return { first: bars.from - shift, last: bars.to - shift };
}

type Timing = { readonly onTime: number; readonly score: number };

/**
 * What the character says after a student's phrase (ft_1_21.AC7): in Wait mode the notes right first try of the notes, in
 * Tempo mode the notes on time; and the first wrong key's reason.
 */
export function tugFact(
  stats: { readonly notes: number; readonly firstTryCorrect: number; readonly timing?: Timing },
  reasons: readonly string[],
  mode: 'wait' | 'tempo' = 'wait',
): { right: number; total: number; reason?: string } {
  const reason = reasons[0];
  const right = mode === 'tempo' ? stats.timing?.onTime ?? 0 : stats.firstTryCorrect;
  return { right, total: stats.notes, ...(reason !== undefined ? { reason } : {}) };
}

/**
 * The share of a student's phrase that is held against the level's share (AC5, AC6): in Wait mode the notes right first
 * try, in Tempo mode the notes on time (`doorShareFromTempo`), the same number the fact says (AX-2.1).
 */
export function studentShare(stats: Pick<PlayStats, 'notes' | 'accuracy' | 'timing'>, mode: 'wait' | 'tempo'): number {
  return mode === 'tempo' ? doorShareFromTempo(stats) : stats.accuracy;
}

/**
 * The level of the tug a talk opens (AC6): one above the best level won with the character (`MetRecord.tugs.bestLevel`),
 * at most 3 and at least the level the talk asks for; a level whose phrase is not in the game (`has`) is passed over,
 * going down. AX-3 provisional: a won level opens the next on the next tug, with no choice offered.
 */
export function tugLevelFor(asked: Level, bestLevel: 0 | Level, has: (level: Level) => boolean): Level {
  for (let level = Math.min(3, Math.max(asked, bestLevel + 1)); level > asked; level--) {
    if (has(level as Level)) return level as Level;
  }
  return asked;
}

/**
 * The world after a finished tug: the character's record (`recordTug`: a won tug raises the best level, a lost one starts
 * the cool-down from its piece), and for a won tug, not a practice one, the character's item by the `give` effect (AC15).
 * A practice tug with Kiur the trainer (AC14) keeps nothing.
 */
export function tugAfter(world: WorldState, character: CharacterId, state: TugState, item: ItemId | undefined, at: string): WorldState {
  const result = exchangeResult(state);
  if (result.outcome !== 'won' && result.outcome !== 'lost' && result.outcome !== 'left') throw new RangeError(`a tug ends won, lost or left, not ${result.outcome}`);
  const { setup } = state;
  // Kiur the trainer's tug keeps nothing (AC14)
  if (setup.kind === 'practiceTug') return world;
  const recorded = recordTug(world, character, { outcome: result.outcome, level: setup.level, piece: setup.piece, at });
  return result.outcome === 'won' && item !== undefined ? applyTalkEffects(recorded, [{ give: item }]) : recorded;
}

/**
 * The level Kiur the trainer tugs a piece at (ft_1_21.AC14: a tug of song for any piece, much like
 * a trainer): the highest level the piece is practised for (`open`, the tug's practice gate), level 1 when none is.
 */
export function trainerLevel(open: (level: Level) => boolean): Level {
  for (const level of [3, 2] as const) if (open(level)) return level;
  return 1;
}

/** Kiur's tug rules (AC14): the tug's own, won and lost at `practiceSteps` ("less pulls per win"). */
export function trainerRules(rules: TugRules): TugRules {
  return { ...rules, steps: rules.practiceSteps };
}

/**
 * The finished tug as the profile's battle record (AC9: the old keys, no save bump): the character as `monsterId`, the
 * standing reached toward the character as the HP taken of `steps`, the student's as the health left, the student's
 * phrases as the rounds, and the XP of `tugPrize` from the level's prize.
 */
export function tugBattle(state: TugState, character: CharacterId, rules: TugRules): BattleInput {
  const result = exchangeResult(state);
  const { steps } = rules;
  const potentialXp = rules.levels[state.setup.level - 1]!.prize;
  const clamp = (n: number) => Math.max(0, Math.min(steps, n));
  return {
    monsterId: character,
    pieceId: state.setup.piece,
    won: result.outcome === 'won',
    hpTaken: clamp(state.best),
    maxHp: steps,
    potentialXp,
    rounds: Math.max(1, state.results.length),
    playerHpLeft: clamp(steps + Math.min(0, state.standing)),
    playerMaxHp: steps,
    xp: tugPrize({ kind: state.setup.kind, outcome: result.outcome, best: state.best }, potentialXp, rules),
  };
}
