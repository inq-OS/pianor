import { passStarsFor, type PassStars } from '../scoring/stars';
import type { BarPlay } from '../progression/practiceLog';

/** One play of a part: its notes and how many were right first time, summed over the part's bars. */
export interface PartPlay {
  notes: number;
  firstTry: number;
}

/**
 * The plays that went through the whole part (`first` to `last`, 0-based, inclusive), one entry per play, in log order. A play
 * is a run of consecutive bars in the log with the same mode, tempo and section: `at` is not shared between its bars (the
 * recorder stamps each push), and a new play of the same kind starts again at its first bar, never at the next one. A play
 * that stopped before the part's last bar does not count: a part is only rated when it was played in full, whole piece or
 * section alike (core_06.AC7).
 */
export function partPlays(plays: readonly BarPlay[], first: number, last: number): PartPlay[] {
  const runs: BarPlay[][] = [];
  plays.forEach((p, i) => {
    const before = plays[i - 1];
    const continues = before !== undefined && before.bar + 1 === p.bar && sameKind(before, p);
    if (continues) runs[runs.length - 1]!.push(p);
    else runs.push([p]);
  });
  const result: PartPlay[] = [];
  for (const run of runs) {
    const inPart = run.filter((b) => b.bar >= first && b.bar <= last);
    if (!run.some((b) => b.bar === first) || !run.some((b) => b.bar === last)) continue;
    result.push({ notes: inPart.reduce((sum, b) => sum + b.notes, 0), firstTry: inPart.reduce((sum, b) => sum + b.firstTry, 0) });
  }
  return result;
}

/** Two bar plays belong to the same play kind: the same mode, tempo and section. */
function sameKind(a: BarPlay, b: BarPlay): boolean {
  return a.mode === b.mode && a.tempoPercent === b.tempoPercent && JSON.stringify(a.section) === JSON.stringify(b.section);
}

/**
 * The best stars a part has earned: 0 when no full play of it exists, otherwise its best full play's five-star grade, as a
 * piece's (`passStarsFor`, accuracy = notes right first time over notes). Part plays earn stars only, never XP (core_06).
 */
export function partStars(plays: readonly BarPlay[], first: number, last: number): 0 | PassStars {
  let best: 0 | PassStars = 0;
  for (const { notes, firstTry } of partPlays(plays, first, last)) {
    const stars = passStarsFor(notes === 0 ? 1 : firstTry / notes);
    if (stars > best) best = stars;
  }
  return best;
}
