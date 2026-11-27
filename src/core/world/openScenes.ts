/**
 * Which scenes of Keri are open (ft_1_19): a scene opens with the student's level, and a tester sees every scene. Pure: the
 * scenes' levels come from the world model.
 */

/** A scene of the world model, as far as this rule needs it. */
export interface ScenePlace {
  id: string;
  /** The student's level that opens the scene. */
  level: number;
  /** Closed to every player but a tester, until the maintainer opens it (unfinished, or not open yet). */
  closed?: boolean | undefined;
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

/** The scenes open at `level`, in the world model's order, a closed one never; every scene for a tester. */
export function openScenes(scenes: readonly ScenePlace[], level: number, tester = false): string[] {
  return scenes.filter((scene) => tester || (level >= scene.level && scene.closed !== true)).map((scene) => scene.id);
}

/**
 * Whether one scene is open at `level`, and when shut, the level that opens it (ft_1_19.AC2: the map says so in the place's
 * name); null for a scene the maintainer has closed, which no level opens, so the map promises no level (AX-2.1).
 */
export function sceneGate(scene: ScenePlace, level: number, tester = false): { open: true } | { open: false; opensAt: number | null } {
  if (openScenes([scene], level, tester).length > 0) return { open: true };
  return { open: false, opensAt: scene.closed === true ? null : scene.level };
}
