/**
 * Where the beings are (ft_1_19.AC8, d113): scenes open with the student's level, and every monster the campaign has
 * unlocked turns up in one of the open scenes, drawn at random for a student and a day. Pure: the scenes' levels come
 * from the world model, the unlocked monsters from the campaign state, the day from the caller's clock.
 *
 * AX-3 provisional: one draw a day. A being a student saw is still there on the next visit that day, and may have moved the
 * day after. An unlocked being is never absent (AX-0): nothing has to be searched for before the student may play.
 */

/** A scene of the world model, as far as this rule needs it. */
export interface ScenePlace {
  id: string;
  /** The student's level that opens the scene. */
  level: number;
}

/**
 * The players who test the game: every scene there is is open to them from the moment it is built, whatever their level
 * (a tester profile). Matched on the player's name, letter case and spaces round it aside.
 */
export const TESTER_NAMES: readonly string[] = ['tester'];

/** Whether the player called `name` is a tester (`TESTER_NAMES`). */
export function isTester(name: string): boolean {
  return TESTER_NAMES.includes(name.trim().toLowerCase());
}

/** The scenes open at `level`, in the world model's order; every scene for a tester. */
export function openScenes(scenes: readonly ScenePlace[], level: number, tester = false): string[] {
  return scenes.filter((scene) => tester || level >= scene.level).map((scene) => scene.id);
}

const MS_PER_DAY = 86_400_000;
const MS_PER_MINUTE = 60_000;

/**
 * The number of the student's own day: `instant` in milliseconds since 1970 (UTC) and `offsetMinutes` as JavaScript's
 * `getTimezoneOffset` gives it (minutes behind UTC, so -120 for a place two hours ahead of it). It changes at the student's midnight.
 */
export function localDay(instant: number, offsetMinutes: number): number {
  return Math.floor((instant - offsetMinutes * MS_PER_MINUTE) / MS_PER_DAY);
}

/** A whole number from a text, the same on every machine (FNV-1a). */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Which open scene each unlocked monster is in today: for every id of `open` the monsters there (0-based ladder indexes,
 * in the ladder's order). Every monster of `unlocked` is in exactly one scene; with no open scene nobody is anywhere.
 */
export function beingsInScenes(unlocked: readonly number[], open: readonly string[], student: string, day: number): Record<string, number[]> {
  const where: Record<string, number[]> = Object.fromEntries(open.map((id) => [id, []]));
  if (open.length === 0) return where;
  for (const monster of [...unlocked].sort((a, b) => a - b)) {
    const scene = open[hash(`${student}|${day}|${monster}`) % open.length]!;
    where[scene]!.push(monster);
  }
  return where;
}
