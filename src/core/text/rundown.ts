import type { PieceResult } from '../judge/types';
import type { FreePlaySummary } from '../scoring/freePlay';
import type { StringKey } from './strings';

export interface RundownLine {
  key: StringKey;
  params?: Record<string, string | number>;
  /** How the screen shows it: the headline big, a detail dimmer and indented. */
  style: 'headline' | 'line' | 'detail';
}

const percent = (accuracy: number) => Math.round(accuracy * 100);

/**
 * The session lines of the score screen (ft_1_12), in order: how often the
 * piece was played to the end, how well (the one pass, or the best and the last), and the wrong keys by reason (only the
 * reasons that happened). Only true things (AX-2.1); a session with no pass finished still gets a friendly first line.
 * Fewer lines than the rundown had (less text); the XP and level lines follow on the screen.
 */
export function scoreLines(summary: FreePlaySummary): RundownLine[] {
  const lines: RundownLine[] = [];
  const { rounds } = summary;
  if (rounds === 0) lines.push({ key: 'rundown.roundsNone', style: 'headline' });
  else if (rounds === 1) lines.push({ key: 'rundown.roundsOne', style: 'headline' });
  else lines.push({ key: 'rundown.roundsMany', params: { n: rounds }, style: 'headline' });

  if (rounds === 1 && summary.lastAccuracy !== null) {
    lines.push({ key: 'rundown.round', params: { percent: percent(summary.lastAccuracy) }, style: 'line' });
  } else if (rounds > 1 && summary.bestAccuracy !== null && summary.lastAccuracy !== null) {
    lines.push({ key: 'rundown.best', params: { percent: percent(summary.bestAccuracy) }, style: 'line' });
    lines.push({ key: 'rundown.last', params: { percent: percent(summary.lastAccuracy) }, style: 'detail' });
  }

  const { wrong } = summary;
  if (wrong.total === 0) {
    lines.push({ key: 'rundown.wrongNone', style: 'line' });
  } else {
    lines.push({ key: 'rundown.wrong', params: { n: wrong.total }, style: 'line' });
    if (wrong['wrong-octave'] > 0) lines.push({ key: 'rundown.octave', params: { n: wrong['wrong-octave'] }, style: 'detail' });
    if (wrong['neighbour-key'] > 0) lines.push({ key: 'rundown.neighbour', params: { n: wrong['neighbour-key'] }, style: 'detail' });
    if (wrong['wrong-letter'] > 0) lines.push({ key: 'rundown.letter', params: { n: wrong['wrong-letter'] }, style: 'detail' });
  }
  return lines;
}

/** The numbers of a pass shown beside its stars past the last bar (ft_1_12.AC3, d312): no sentence, the staff's marks. */
export interface PassNumbers {
  /** The share right the first time, in percent. */
  percent: number;
  /** The wrong keys, shown beside the wrong key's ghost notehead. */
  wrong: number;
  /** Tempo mode: the timing score, beside the tempo gauge. */
  timing?: number;
}

/**
 * The numbers of a pass of the looping play (the stats the score screen showed per play before ft_1_12): its share right
 * the first time, its wrong keys, and in Tempo mode its timing score. Only true things (AX-2.1).
 */
export function passNumbers(result: PieceResult): PassNumbers {
  return { percent: percent(result.accuracy), wrong: result.mistakes, ...(result.timing ? { timing: Math.round(result.timing.score) } : {}) };
}
