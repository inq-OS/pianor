/**
 * Wanderers (ft_1_37): visitors the teacher sends, who teach nothing and have no tug. One stands in an open scene on the day
 * it was sent and asks the student to play one piece with the staff; a play that reaches its neediness's share gives a plain
 * keepsake into the backpack, one a wanderer a day; one that does not gives none and takes nothing (AX-1, AX-2). Numbers in
 * content/world/wanderers.json. Pure. AX-3 provisional.
 */
import { z } from 'zod';
import { idSchema, stringKeySchema, type DayString, type ItemId, type PieceId } from '../contracts';
import type { Curriculum } from '../curriculum/curriculum';
import { dayNumber } from '../curriculum/evaluate';
import { Random } from '../random';
import { DEFAULT_NEEDINESS, neededShare } from './cast';
import type { WorldState } from './worldState';

const wandererSchema = z.strictObject({
  id: idSchema,
  /** Its generic name (ft_1_21: a role, never a real person). */
  name: stringKeySchema,
  actor: idSchema,
  /** The scenes it may stand in; an open one is drawn for the day. */
  scenes: z.array(idSchema).min(1),
});

export const wandererRulesSchema = z.strictObject({
  schemaVersion: z.literal(1),
  note: z.string().optional(),
  /** The share of notes right first try a play needs at neediness 3. */
  share: z.number().min(0).max(1),
  keepsakes: z.array(idSchema).min(1),
  wanderers: z.array(wandererSchema).min(1),
});

export type WandererRules = z.infer<typeof wandererRulesSchema>;

export function parseWandererRules(raw: unknown): WandererRules {
  return wandererRulesSchema.parse(raw);
}

/** The defaults; content/world/wanderers.json holds the same (a test keeps them equal). */
export const DEFAULT_WANDERER_RULES: WandererRules = {
  schemaVersion: 1,
  note: 'AX-3 provisional (ft_1_37). share: the share of notes right first try a wanderer\'s play needs at neediness 3 (each step 10 points, src/core/island/cast.ts); keepsakes: what a wanderer may give, drawn per wanderer and day; wanderers: who the teacher can send, each with the scenes it may stand in (an open one is drawn for the day).',
  share: 0.8,
  keepsakes: ['copper-coin', 'silver-coin', 'glass-bead', 'brass-button'],
  wanderers: [
    { id: 'traveller', name: 'wanderer.traveller.name', actor: 'traveller', scenes: ['knoll', 'docks', 'port', 'crossroads', 'terrace'] },
  ],
};

/** The curriculum with `wanderer` sent for `day` (ft_1_37.AC6), replacing one already sent for that day. */
export function sendWanderer(curriculum: Curriculum, wanderer: string, day: DayString, piece?: PieceId): Curriculum {
  const others = (curriculum.cast?.sent ?? []).filter((s) => !(s.wanderer === wanderer && s.day === day));
  const entry = piece === undefined ? { wanderer, day } : { wanderer, day, piece };
  return { ...curriculum, cast: { ...(curriculum.cast ?? {}), sent: [...others, entry] } };
}

/** The curriculum with the sending of `wanderer` for `day` taken back. */
export function recallWanderer(curriculum: Curriculum, wanderer: string, day: DayString): Curriculum {
  const sent = (curriculum.cast?.sent ?? []).filter((s) => !(s.wanderer === wanderer && s.day === day));
  return { ...curriculum, cast: { ...(curriculum.cast ?? {}), sent } };
}

function sentToday(curriculum: Curriculum, wanderer: string, day: DayString) {
  return curriculum.cast?.sent?.find((s) => s.wanderer === wanderer && s.day === day);
}

/**
 * Where each wanderer sent for today stands: one of its scenes that is open, drawn for the day (the same all day). A
 * wanderer the teacher switched off, or with no open scene, does not come.
 */
export function wanderersToday(curriculum: Curriculum, day: DayString, openScenes: readonly string[], rules: WandererRules): Record<string, string> {
  const out: Record<string, string> = {};
  for (const def of rules.wanderers) {
    if (sentToday(curriculum, def.id, day) === undefined) continue;
    if (curriculum.cast?.characters?.[def.id]?.on === false) continue;
    const scenes = def.scenes.filter((s) => openScenes.includes(s));
    if (scenes.length === 0) continue;
    out[def.id] = Random.derive('wanderer-scene', def.id, dayNumber(day)).pick(scenes);
  }
  return out;
}

/**
 * The piece a wanderer sent for today asks for (ft_1_37.AC6): the one the teacher named when sending it, else its piece in
 * the cast, else one of the student's learned
 * pieces drawn for the day (the same whatever their order); none when it was not sent or nothing is learned.
 */
export function wandererPiece(curriculum: Curriculum, wanderer: string, day: DayString, learned: readonly PieceId[]): PieceId | undefined {
  const sent = sentToday(curriculum, wanderer, day);
  if (sent === undefined) return undefined;
  const named = sent.piece ?? curriculum.cast?.characters?.[wanderer]?.piece;
  if (named !== undefined) return named;
  if (learned.length === 0) return undefined;
  return Random.derive('wanderer-piece', wanderer, dayNumber(day)).pick([...new Set(learned)].sort());
}

/** A play's verdict (ft_1_37.AC7, AC8): the share its neediness needs, and whether `share` reached it. */
export function wandererVerdict(curriculum: Curriculum, wanderer: string, share: number, rules: Pick<WandererRules, 'share'>): { needed: number; kept: boolean } {
  const needed = neededShare(rules.share, curriculum.cast?.characters?.[wanderer]?.neediness ?? DEFAULT_NEEDINESS);
  return { needed, kept: share >= needed };
}

/** Whether `wanderer` already gave a keepsake on `day`. */
export function keptToday(world: WorldState, wanderer: string, day: DayString): boolean {
  return (world.wandererGifts ?? []).some((g) => g.wanderer === wanderer && g.day === day);
}

/** The world with one keepsake from `wanderer` for `day` (ft_1_37.AC9), drawn per wanderer and day; unchanged if it gave one already. */
export function giveKeepsake(world: WorldState, wanderer: string, day: DayString, rules: Pick<WandererRules, 'keepsakes'>): WorldState {
  if (keptToday(world, wanderer, day)) return world;
  const item: ItemId = Random.derive('wanderer-keepsake', wanderer, dayNumber(day)).pick(rules.keepsakes);
  return { ...world, items: [...world.items, item], wandererGifts: [...(world.wandererGifts ?? []), { day, wanderer, item }] };
}
