/**
 * Who stands where today for a player (ft_1_37 slice 3): the characters presence picks (ft_1_25, with the teacher's cast)
 * in the scenes that are open, and the wanderers sent for today with the piece each asks for; and the wanderer's play heard
 * from the practice log. Pure: the scene reads the save documents and hands them in.
 */
import type { CharacterDef } from '../character/character';
import type { CharacterId, DayString, PieceId } from '../contracts';
import type { Curriculum } from '../curriculum/curriculum';
import { cleanPlaysSince, wholePiecePlays } from '../curriculum/fromLog';
import type { PracticeLog } from '../progression/practiceLog';
import { practiceMinutes } from '../progression/practiceTime';
import { presence, type PresenceRules } from './presenceRules';
import { wandererPiece, wanderersToday, type WandererRules } from './wanderer';
import type { WorldState } from './worldState';

export interface CastTodayInput {
  readonly day: DayString;
  readonly log: PracticeLog;
  /** The player's local calendar day of an ISO time. */
  readonly dayOf: (iso: string) => DayString;
  /** A piece's bar count, or undefined when it is not in the game. */
  readonly barCount: (piece: PieceId) => number | undefined;
  readonly characters: readonly CharacterDef[];
  readonly world: WorldState;
  readonly curriculum: Curriculum;
  /** The scenes open to this player (ft_1_19). */
  readonly openScenes: readonly string[];
  /** The pieces this player has learned (ft_1_32), for a wanderer that asks for one. */
  readonly learned: readonly PieceId[];
}

export interface CastToday {
  /** Each character standing in a scene today, by its scene. */
  readonly characters: Readonly<Record<CharacterId, string>>;
  /** Each wanderer sent for today: its scene and the piece it asks for. */
  readonly wanderers: Readonly<Record<string, { readonly scene: string; readonly piece: PieceId }>>;
}

export function castToday(input: CastTodayInput, rules: { readonly presence: PresenceRules; readonly wanderers: WandererRules }): CastToday {
  const minutes = practiceMinutes(input.log, input.day, input.dayOf);
  const clean: Record<CharacterId, number> = {};
  for (const [id, met] of Object.entries(input.world.met)) {
    const lost = met.lastLostTug;
    const bars = lost ? input.barCount(lost.piece) : undefined;
    if (lost && bars !== undefined) clean[id] = cleanPlaysSince(input.log, lost.piece, bars, lost.at);
  }
  const today = presence({
    day: input.day, practiceMinutes: minutes.total, practiceMinutesToday: minutes.today, characters: input.characters,
    world: input.world, curriculum: input.curriculum, statuses: [], cleanPlaysSinceLostTug: clean,
  }, rules.presence);
  const characters: Record<CharacterId, string> = {};
  for (const [id, c] of Object.entries(today.characters)) {
    if (c.where.at === 'scene' && input.openScenes.includes(c.where.scene)) characters[id] = c.where.scene;
  }
  const wanderers: Record<string, { scene: string; piece: PieceId }> = {};
  for (const [id, scene] of Object.entries(wanderersToday(input.curriculum, input.day, input.openScenes, rules.wanderers))) {
    const piece = wandererPiece(input.curriculum, id, input.day, input.learned);
    if (piece !== undefined) wanderers[id] = { scene, piece };
  }
  return { characters, wanderers };
}

/** The wanderer hears the first whole play of `piece` after `since` (ft_1_37.AC7): notes right first try of its notes; null before one. */
export function wandererPlay(log: PracticeLog, piece: PieceId, barCount: number, since: string): { right: number; notes: number; share: number } | null {
  const from = Date.parse(since);
  const run = wholePiecePlays(log, piece, barCount).find((r) => Date.parse(r[r.length - 1]!.at) > from && Date.parse(r[0]!.at) >= from);
  if (run === undefined) return null;
  const notes = run.reduce((n, b) => n + b.notes, 0);
  const right = run.reduce((n, b) => n + b.firstTry, 0);
  return { right, notes, share: notes > 0 ? right / notes : 0 };
}
