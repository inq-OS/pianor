/**
 * Who is where today (ft_1_25, WP-08; contract A.9): one pure function from the player's practice, world document and
 * curriculum to every character's whereabouts, with a seeded daily draw, so the same day gives the same answer. Numbers
 * in content/world/presence.json. AX-3 provisional until the students have played it.
 */
import { z } from 'zod';
import type { CharacterDef } from '../character/character';
import type { CharacterId, DayString, PieceId } from '../contracts';
import { dayNumber } from '../curriculum/evaluate';
import { Random } from '../random';
import type { Presence, PresenceInput, Whereabouts } from './presence';
import { teacherDays } from './teacher';
import type { MetRecord, WorldState } from './worldState';

export const presenceRulesSchema = z.strictObject({
  schemaVersion: z.literal(1),
  note: z.string().optional(),
  /** The chance an eligible character turns up on a day (d132: not at once, not every day). */
  appearChance: z.number().min(0).max(1),
  /** At most this many days in a row away once eligible (ft_1_25.AC2). */
  maxDaysAway: z.int().min(0),
  /** The boat is on the map this many days before a deadline, coming in from 0 to 1 on the day (ft_1_25.AC4). */
  boatDays: z.int().min(1),
});

export type PresenceRules = z.infer<typeof presenceRulesSchema>;

export function parsePresenceRules(raw: unknown): PresenceRules {
  return presenceRulesSchema.parse(raw);
}

/** The defaults; content/world/presence.json holds the same (a test keeps them equal). */
export const DEFAULT_PRESENCE_RULES: PresenceRules = {
  schemaVersion: 1,
  note: 'AX-3 provisional (ft_1_25, WP-08). appearChance: the chance an eligible character turns up on a day; maxDaysAway: at most that many days in a row away once eligible (AC2); boatDays: the teacher\'s boat is on the map that many days before a deadline (AC4).',
  appearChance: 0.5,
  maxDaysAway: 3,
  boatDays: 7,
};

/** The seeded draw of a character on a day: the same everywhere, independent of every other character and day. */
function draw(character: CharacterId, day: number): Random {
  return Random.derive('presence', character, day);
}

function dayString(n: number): DayString {
  return new Date(n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Whether a character may be met today: enough practice minutes in total (d132) and, after a lost tug, the tug's
 * piece played clean `meet.cooldownCleanPlays` times since (d132, ft_1_25.AC3, contract A.8 `lastLostTug`).
 */
export function eligible(def: CharacterDef, met: MetRecord | undefined, practiceMinutes: number, cleanPlaysSinceLostTug = 0): boolean {
  if (def.kind === 'teacher') return false;
  if (practiceMinutes < def.meet.practiceMinutes) return false;
  if (met?.lastLostTug !== undefined && cleanPlaysSinceLostTug < def.meet.cooldownCleanPlays) return false;
  return true;
}

/**
 * Whether an eligible character turns up on day `n`: its draw comes up, or it came up on none of the `maxDaysAway` days
 * before (so it is never away longer, ft_1_25.AC2). Eligibility of the days before is not known here and not needed: the
 * rule only ever adds a day.
 */
export function turnsUp(character: CharacterId, n: number, rules: Pick<PresenceRules, 'appearChance' | 'maxDaysAway'>): boolean {
  if (draw(character, n).chance(rules.appearChance)) return true;
  for (let back = 1; back <= rules.maxDaysAway; back++) {
    if (draw(character, n - back).chance(rules.appearChance)) return false;
  }
  return true;
}

/** The teacher's boat from the next deadline (or asked-for test day, `teacherDays`) on or after today: null with none within `boatDays`, 1 on the day (AC4). */
export function teacherBoat(day: DayString, deadlines: readonly DayString[], rules: Pick<PresenceRules, 'boatDays'>): Presence['teacherBoat'] {
  const today = dayNumber(day);
  const ahead = deadlines.map(dayNumber).filter((d) => d >= today);
  if (ahead.length === 0) return null;
  const until = Math.min(...ahead) - today;
  if (until > rules.boatDays) return null;
  return { progress: (rules.boatDays - until) / rules.boatDays };
}

/** The teacher's id in heads-ups (ft_1_27.AC1: only one exists). */
export const TEACHER_ID: CharacterId = 'teacher';

/** Kiur's heads-up about a character in a scene (ft_1_25.AC5): one string key per character and scene. */
export function headsUpKey(character: CharacterId, scene: string): string {
  return `kiur.headsUp.${character}.${scene}`;
}

/**
 * Kiur's heads-ups today (ft_1_25.AC5, WP-15): the teacher's boat first when it is on the map (coming, or landed on the
 * day), then each character in a scene, in the order of the characters.
 */
export function headsUps(characters: Presence['characters'], boat: Presence['teacherBoat']): Presence['headsUps'] {
  const out: { character: CharacterId; line: string }[] = [];
  if (boat !== null) out.push({ character: TEACHER_ID, line: boat.progress >= 1 ? 'kiur.headsUp.teacher.landed' : 'kiur.headsUp.teacher.boat' });
  for (const [id, c] of Object.entries(characters)) {
    if (c.where.at === 'scene') out.push({ character: id, line: headsUpKey(id, c.where.scene) });
  }
  return out;
}

/**
 * Presence today (contract A.9). A character turns up in one of its scenes, drawn per day; until scenes are data (WP-05)
 * its place is named after the scene. Every character is `present` (arriving and leaving come with the walkers, WP-06).
 * Kiur's heads-ups name who is in which scene and the teacher's boat (WP-15). AX-3 provisional.
 */
export function presence(input: PresenceInput, rules: PresenceRules): Presence {
  const n = dayNumber(input.day);
  const characters: Record<CharacterId, { where: Whereabouts; phase: 'arriving' | 'present' | 'leaving' }> = {};
  for (const def of input.characters) {
    let where: Whereabouts = { at: 'away' };
    if (def.scenes.length > 0 && eligible(def, input.world.met[def.id], input.practiceMinutes, input.cleanPlaysSinceLostTug[def.id]) && turnsUp(def.id, n, rules)) {
      // its own stream: the appearance draw must not decide the scene
      const scene = Random.derive('presence-scene', def.id, n).pick(def.scenes);
      where = { at: 'scene', scene, place: scene };
    }
    characters[def.id] = { where, phase: 'present' };
  }
  const boat = teacherBoat(input.day, teacherDays(input.curriculum, input.day), rules);
  return { day: input.day, characters, teacherBoat: boat, headsUps: headsUps(characters, boat) };
}

/** The first time a character is seen, and every later day (A.8 `firstDay`, `lastDay`). */
export function meetCharacter(world: WorldState, character: CharacterId, day: DayString): WorldState {
  const met = world.met[character];
  const record: MetRecord = met
    ? { ...met, lastDay: day > met.lastDay ? day : met.lastDay }
    : { firstDay: day, lastDay: day, taught: [], tugs: { won: 0, lost: 0, bestLevel: 0 } };
  return { ...world, met: { ...world.met, [character]: record } };
}

/**
 * A finished tug in the world (A.8 `tugs`): a won one raises the best level; a lost one starts the cool-down from its piece
 * and time (`lastLostTug`). A left tug changes nothing. The character must have been met.
 */
export function recordTug(
  world: WorldState,
  character: CharacterId,
  tug: { readonly outcome: 'won' | 'lost' | 'left'; readonly level: 1 | 2 | 3; readonly piece: PieceId; readonly at: string },
): WorldState {
  const met = world.met[character];
  if (met === undefined) throw new RangeError(`a tug with ${character}, who has not been met`);
  if (tug.outcome === 'left') return world;
  const tugs = tug.outcome === 'won'
    ? { ...met.tugs, won: met.tugs.won + 1, bestLevel: Math.max(met.tugs.bestLevel, tug.level) as 0 | 1 | 2 | 3 }
    : { ...met.tugs, lost: met.tugs.lost + 1 };
  const record: MetRecord = tug.outcome === 'lost' ? { ...met, tugs, lastLostTug: { piece: tug.piece, at: tug.at } } : { ...met, tugs };
  return { ...world, met: { ...world.met, [character]: record } };
}

/** The days from `from` to `to`, both included, as day strings (for the simulator). */
export function daysBetween(from: DayString, to: DayString): DayString[] {
  const out: DayString[] = [];
  for (let n = dayNumber(from); n <= dayNumber(to); n++) out.push(dayString(n));
  return out;
}
