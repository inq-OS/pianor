/**
 * Whether the decorative scenery moves: the grass, the sea, the clouds, the smoke and the embers of the painted places,
 * the pulse of an aura, the room's screensaver. On unless the page is opened with `?motion=still` (`config.theme.reducedMotion`,
 * set once at start by `src/main.ts`). The operating system's "reduce motion" or "animation effects" setting is not read
 * (d127: an operating system's animation setting may be off for other reasons, and the scenes still move). Decoration only:
 * nothing the student has to read or play depends on it.
 */
let still = false;

/** Stands the scenery still on its first frame (true) or lets it move (false). */
export function setSceneryStill(on: boolean): void {
  still = on;
}

/** False when the scenery is to stand still on its first frame. */
export function motionAllowed(): boolean {
  return !still;
}
