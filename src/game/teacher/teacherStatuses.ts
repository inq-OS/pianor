import type { DayString, PieceId } from '../../core/contracts';
import type { Curriculum } from '../../core/curriculum/curriculum';
import { curriculumStatuses, DEFAULT_EVALUATION_RULES, type EvaluationRules } from '../../core/curriculum/evaluate';
import { playResultsFromLog } from '../../core/curriculum/fromLog';
import type { PieceStatus } from '../../core/curriculum/play';
import type { PracticeLog } from '../../core/progression';

/**
 * Each curriculum piece's status for the teacher's list (ft_1_26.AC2), most urgent first: the player's practice log read as
 * plays (`playResultsFromLog`) and measured by the dev team's query (`curriculumStatuses`, core_12). `barsOf` gives a
 * piece's bar count, or undefined for a piece this build does not have (it then counts no plays). `dayOf` turns a play's
 * ISO time into the player's local day.
 */
export function teacherStatuses(
  curriculum: Curriculum,
  log: PracticeLog,
  barsOf: (piece: PieceId) => number | undefined,
  today: DayString,
  dayOf: (iso: string) => DayString,
  rules: EvaluationRules = DEFAULT_EVALUATION_RULES,
): PieceStatus[] {
  const plays = curriculum.pieces.flatMap((cp) => {
    const bars = barsOf(cp.piece);
    return bars === undefined ? [] : playResultsFromLog(log, cp.piece, bars, dayOf, rules);
  });
  return curriculumStatuses(curriculum, plays, today, rules);
}
