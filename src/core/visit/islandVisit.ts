/**
 * Visiting Keri (ft_1_17): the room left alone becomes a screensaver that goes round the island's open scenes, like
 * someone who lives on the island. Pure rules: when the room has been idle long
 * enough, how long a scene is looked at, and which scene comes next. The scenes only show them.
 */
export const VISIT = {
  /** The room starts the screensaver after this long without a key, a note or the pointer. AX-3 provisional: two minutes. */
  idleMs: 120_000,
  /** The screensaver looks at each scene this long before it goes on to the next. AX-3 provisional: 45 seconds. */
  stayMs: 45_000,
} as const;

/** True once nothing has been pressed, played or moved for `limitMs`. */
export function idleLongEnough(lastInputMs: number, nowMs: number, limitMs: number = VISIT.idleMs): boolean {
  return nowMs - lastInputMs >= limitMs;
}

/**
 * The scene to visit after `current` (null: the first visit), going round the `open` scenes in their order and starting
 * over after the last. A scene that is not open starts the round again. Null when no scene is open.
 */
export function nextVisit(open: readonly string[], current: string | null): string | null {
  if (open.length === 0) return null;
  const at = current === null ? -1 : open.indexOf(current);
  return open[(at + 1) % open.length]!;
}
