/**
 * A character teaching a phrase (ft_1_22.AC3, WP-12): it plays the phrase, and the student has three tries at it on the
 * staff, each judged as a tug's exchange (ft_1_21.AC5: the share of notes right first try at least the level's share).
 * One try that passes makes the phrase *heard*, kept with the character in the world (`MetRecord.taught`); three missed
 * are no loss: the character sends the student to practise and comes back later. Pure.
 * AX-3 provisional: every try is in Wait mode with the staff shown (learning is reading, d135); the share is the level's.
 */
import type { CharacterDef } from '../character/character';
import type { CharacterId, DayString, PieceId } from '../contracts';
import type { WorldState } from '../island/worldState';
import type { TugRules } from './tug';

type Level = 1 | 2 | 3;

/** The tries a student has at a taught phrase. */
export const TEACH_TRIES = 3;

export interface TeachState {
  readonly piece: PieceId;
  readonly level: Level;
  /** Each try played: passed or not. */
  readonly tries: readonly boolean[];
  /** Set once a try passed (`heard`) or every try was missed (`notYet`). */
  readonly outcome?: 'heard' | 'notYet';
}

export function startTeach(piece: PieceId, level: Level): TeachState {
  return { piece, level, tries: [] };
}

/** One try played with `share` of its notes right first try. */
export function advanceTeach(state: TeachState, share: number, rules: TugRules): TeachState {
  if (state.outcome !== undefined) throw new RangeError(`the teaching of ${state.piece} is over (${state.outcome})`);
  const passed = share >= rules.levels[state.level - 1]!.share;
  const tries = [...state.tries, passed];
  const outcome = passed ? 'heard' : tries.length >= TEACH_TRIES ? 'notYet' : undefined;
  return outcome === undefined ? { ...state, tries } : { ...state, tries, outcome };
}

/**
 * The world after a finished teaching on `day`: a heard phrase goes into the character's `taught` with the day it was
 * taught (`taughtOn`), once; not yet keeps nothing.
 */
export function teachAfter(world: WorldState, character: CharacterId, state: TeachState, day: DayString): WorldState {
  if (state.outcome === undefined) throw new RangeError(`the teaching of ${state.piece} is not over`);
  const met = world.met[character];
  if (met === undefined) throw new RangeError(`a teaching by ${character}, who has not been met`);
  if (state.outcome === 'notYet' || met.taught.includes(state.piece)) return world;
  const taughtOn = { ...met.taughtOn, [state.piece]: day };
  return { ...world, met: { ...world.met, [character]: { ...met, taught: [...met.taught, state.piece], taughtOn } } };
}

/** The level `def` plays `piece` at (the key of its `phrases` that holds it); 1 for a piece not among them. */
export function teachLevelOf(def: Pick<CharacterDef, 'phrases'>, piece: PieceId): Level {
  for (const level of [1, 2, 3] as const) {
    if (def.phrases[String(level) as '1' | '2' | '3']?.includes(piece)) return level;
  }
  return 1;
}
