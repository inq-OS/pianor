/**
 * The monster campaign as a pure state machine over the ladder (ft_1_06): which monsters are
 * unlocked, which levels are beaten, and per monster the phase and whether its door is open.
 * Every operation returns a new state and never mutates its input; monsters are indexed in
 * ladder order (0-based), levels are 1, 2 or 3.
 */
import type { Ladder } from './content';
import type { DoorState } from './findDoor';
import type { FindKeyStatus } from './findKey';

export type CampaignLevel = 1 | 2 | 3;
export type CampaignPhase = 'find-key' | 'find-door' | 'battle';

export interface CampaignState {
  /** Per monster: playable. Monster 1 at the start, the rest locked. */
  unlocked: boolean[];
  /** Per monster, per level (index 0 = level 1): beaten. */
  beaten: boolean[][];
  /** Per monster: the door is open (phase 2 passed); it stays open until a battle is won. */
  doorOpen: boolean[];
  /** Per monster: the phase the player is in. */
  phase: CampaignPhase[];
}

/** The starting state for a ladder; only its monster count matters, so a save can start a campaign of a given length. */
export function startCampaign(ladder: Pick<Ladder, 'monsters'> | { readonly monsters: readonly unknown[] }): CampaignState {
  const n = ladder.monsters.length;
  return {
    unlocked: ladder.monsters.map((_, i) => i === 0),
    beaten: ladder.monsters.map(() => [false, false, false]),
    doorOpen: new Array<boolean>(n).fill(false),
    phase: new Array<CampaignPhase>(n).fill('find-key'),
  };
}

export function isUnlocked(state: CampaignState, monster: number): boolean {
  return state.unlocked[monster] === true;
}

/** Copy of the state with one monster's phase and door replaced. */
function withMonster(state: CampaignState, monster: number, phase: CampaignPhase, doorOpen: boolean): CampaignState {
  return {
    ...state,
    phase: state.phase.map((p, i) => (i === monster ? phase : p)),
    doorOpen: state.doorOpen.map((d, i) => (i === monster ? doorOpen : d)),
  };
}

/**
 * Phase 1 result. 'passed' moves to phase 2. A timeout, a broken key or 'in-progress' keeps
 * the player in phase 1 with nothing lost. With the door already open the player is in the battle
 * and phase 1 cannot be replayed, so the state is unchanged.
 */
export function phaseOneResult(state: CampaignState, monster: number, result: FindKeyStatus): CampaignState {
  if (!isUnlocked(state, monster) || state.phase[monster] !== 'find-key') return state;
  return result === 'passed' ? withMonster(state, monster, 'find-door', false) : state;
}

/**
 * Phase 2 result. 'door-open' opens the door and moves to the battle; it stays open.
 * 'key-broken' returns to phase 1 (nothing is lost), unless the door is already open.
 */
export function phaseTwoResult(state: CampaignState, monster: number, result: DoorState): CampaignState {
  if (!isUnlocked(state, monster) || state.phase[monster] !== 'find-door') return state;
  return result === 'door-open'
    ? withMonster(state, monster, 'battle', true)
    : withMonster(state, monster, 'find-key', false);
}

/**
 * Whether a level can be played: the monster is unlocked and the level is next in order.
 * Documented choice: levels are played in order, so level 2 needs level 1 beaten and level 3 needs
 * level 2 beaten. A beaten level stays selectable (to replay it).
 */
export function selectable(state: CampaignState, monster: number, level: CampaignLevel): boolean {
  if (!isUnlocked(state, monster)) return false;
  return level === 1 || state.beaten[monster]?.[level - 2] === true;
}

/**
 * Battle result for a level. A loss changes nothing: the door stays open and the phase stays at
 * the battle, so the player retries without repeating phases 1 and 2 (AC4). A win marks the level
 * beaten and closes the door for the next level (phases 1 and 2 are played again for it); beating
 * level 3 also unlocks the next monster, levels 1 and 2 do not (AC5). A level that is not
 * selectable changes nothing.
 *
 * A beaten level can be replayed any time, but its win gives no new progress
 * and leaves the phase and door of the level being worked on alone. A win outside the battle phase
 * (door not open) changes nothing either, so phases 1 and 2 cannot be skipped.
 */
export function battleResult(state: CampaignState, monster: number, level: CampaignLevel, won: boolean): CampaignState {
  if (!won || !selectable(state, monster, level)) return state;
  if (state.beaten[monster]?.[level - 1] === true || state.phase[monster] !== 'battle') return state;
  const beaten = state.beaten.map((levels, i) => (i === monster ? levels.map((b, l) => b || l === level - 1) : levels));
  const unlocked =
    level === 3 ? state.unlocked.map((u, i) => u || i === monster + 1) : state.unlocked;
  return { ...withMonster(state, monster, 'find-key', false), beaten, unlocked };
}

/**
 * The level the player works on for a monster: the first one not beaten (levels are played in order, so this is
 * also the one the map offers). Null once all three are beaten.
 */
export function levelToPlay(state: CampaignState, monster: number): CampaignLevel | null {
  const beaten = state.beaten[monster] ?? [];
  return ([1, 2, 3] as const).find((level) => beaten[level - 1] !== true) ?? null;
}
