/** Star rating thresholds. Finishing a piece always earns at least one star: there is no failing. */
export const STAR_THRESHOLDS = { three: 0.95, two: 0.75 } as const;

export type Stars = 1 | 2 | 3;

/** Stars from accuracy (the share of notes played right the first time, 0 to 1). Hints do not change stars. */
export function starsFor(accuracy: number): Stars {
  if (accuracy >= STAR_THRESHOLDS.three) return 3;
  if (accuracy >= STAR_THRESHOLDS.two) return 2;
  return 1;
}

/** Every grade the player sees is out of five stars: a pass, a piece's best, a part, the score screen. */
export const GRADE_STARS = 5;

/**
 * The five-star grade the player sees (ft_1_12; everywhere since). Worked out from accuracy,
 * never saved: the saved `stars` of an attempt stay `starsFor`'s three, and the XP rules read those (no save-format bump).
 * AX-3 provisional: thresholds 100 / 95 / 85 / 75 percent, so four and five stars split the three-star band and two and
 * three the two-star band; five means every note right the first time (AX-1).
 */
export const PASS_STAR_THRESHOLDS = [0.75, 0.85, 0.95, 1] as const;

export type PassStars = 1 | 2 | 3 | 4 | 5;

export function passStarsFor(accuracy: number): PassStars {
  return (1 + PASS_STAR_THRESHOLDS.filter((threshold) => accuracy >= threshold).length) as PassStars;
}
