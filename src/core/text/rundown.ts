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

/**
 * What Kiur says in the bottom bar after each pass of the looping play (the stats the score screen showed
 * per play before ft_1_12), short so they fit the bubble: the pass's share right the first time, its wrong keys, and in Tempo mode its timing score.
 * Only true things (AX-2.1).
 */
export function passLines(result: PieceResult): RundownLine[] {
  const lines: RundownLine[] = [{ key: 'practice.passRight', params: { percent: percent(result.accuracy) }, style: 'line' }];
  lines.push(result.mistakes === 0 ? { key: 'practice.passWrongNone', style: 'line' } : { key: 'practice.passWrong', params: { n: result.mistakes }, style: 'line' });
  if (result.timing) lines.push({ key: 'practice.passTiming', params: { score: Math.round(result.timing.score) }, style: 'line' });
  return lines;
}

