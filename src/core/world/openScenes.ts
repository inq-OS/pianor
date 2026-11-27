/**
 * Which scenes of Keri are open (ft_1_19, d113): every scene the maintainer confirmed ready (no `closed` mark), and every scene for a
 * tester. No level opens or locks a scene. Pure: the scenes come from the world model.
 */

/** A scene of the world model, as far as this rule needs it. */
export interface ScenePlace {
  id: string;
  /** Closed to every player but a tester, until the maintainer opens it (unfinished, or not open yet). */
  closed?: boolean | undefined;
}

/**
 * The players who test the game: every scene there is is open to them from the moment it is built, a closed one included
 * (a tester profile). Matched on the player's name, letter case and spaces round it aside.
 */
export const TESTER_NAMES: readonly string[] = ['tester'];

/** Whether the player called `name` is a tester (`TESTER_NAMES`). */
export function isTester(name: string): boolean {
  return TESTER_NAMES.includes(name.trim().toLowerCase());
}

/** The scenes open to a player, in the world model's order: every one not closed; every scene for a tester. */
export function openScenes(scenes: readonly ScenePlace[], tester = false): string[] {
  return scenes.filter((scene) => tester || scene.closed !== true).map((scene) => scene.id);
}
