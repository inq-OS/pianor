/**
 * How hard a piece is, as the player sees it (d157, core_08.AC5): 0 to 100 points in five grades of 20, Beginner to
 * Master, each with five stars of 4 points that fill partly. Pure.
 */

/** The five grades, easiest first; their names are the string keys `grade.<id>`. */
export const GRADES = ['beginner', 'intermediate', 'advanced', 'expert', 'master'] as const;
export type Grade = (typeof GRADES)[number];
export const GRADE_POINTS = 20;
/** Stars shown for a grade. */
export const COMPLEXITY_STARS = 5;

export interface Complexity {
  grade: Grade;
  /** Stars inside the grade, 0 to `COMPLEXITY_STARS`, in quarter stars (one point each). */
  stars: number;
}

/**
 * The grade and its stars for points 0 to 100. A grade's top is its own, so 20 points is Beginner with five stars and 21
 * Intermediate with a quarter star (the top of one grade is the bottom of the next). A harder piece
 * is never in a lower grade, nor fewer stars in the same grade.
 */
export function complexityOf(points: number): Complexity {
  const p = Math.min(100, Math.max(0, points));
  const index = p <= 0 ? 0 : Math.min(GRADES.length - 1, Math.ceil(p / GRADE_POINTS) - 1);
  const stars = Math.round(((p - index * GRADE_POINTS) / (GRADE_POINTS / COMPLEXITY_STARS)) * 4) / 4;
  return { grade: GRADES[index]!, stars };
}
