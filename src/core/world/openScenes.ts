/**
 * Which scenes of Keri are open (ft_1_19): a scene opens with the student's level, and a tester sees every scene. Pure: the
 * scenes' levels come from the world model.
 */

/** A scene of the world model, as far as this rule needs it. */
export interface ScenePlace {
  id: string;
  /** The student's level that opens the scene. */
  level: number;
  /** Not finished yet: closed to every player but a tester. */
  unfinished?: boolean | undefined;
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

/** The scenes open at `level`, in the world model's order, an unfinished one never; every scene for a tester. */
export function openScenes(scenes: readonly ScenePlace[], level: number, tester = false): string[] {
  return scenes.filter((scene) => tester || (level >= scene.level && scene.unfinished !== true)).map((scene) => scene.id);
}
