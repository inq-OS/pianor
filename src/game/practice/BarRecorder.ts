import type { Chart } from '../../core/chart';
import { barPlaysFromEvents, type BarPlayInfo } from '../../core/progression/recordBars';
import type { BarPlay } from '../../core/progression/practiceLog';
import type { JudgeEvent, WrongNoteJudged } from '../../core/judge';
import { stoppedBarPlay } from '../../core/learn/run';

/**
 * Turns the judge's events of one play into bar plays as the bars are finished (core_10). Events are pushed as they come;
 * a push that finishes one or more bars returns their plays, otherwise nothing. The events kept between pushes are the
 * ones after the last finished bar and the notes of later bars judged before it, so a bar's notes never leak into the next
 * one and none is lost. Plain TypeScript: the scene pushes the
 * events and saves the plays.
 */
export class BarRecorder {
  private pending: JudgeEvent[] = [];

  constructor(
    private readonly chart: Chart,
    private readonly info: Omit<BarPlayInfo, 'at'>,
    private readonly now: () => Date,
    /** For each bar of `chart` (the played chart), its written bar: records are kept by the bar on the page (core_09.AC20). */
    private readonly writtenBar?: readonly number[],
  ) {}

  push(events: readonly JudgeEvent[]): BarPlay[] {
    this.pending.push(...events);
    let last = -1;
    this.pending.forEach((event, i) => {
      if (event.type === 'BarCompleted') last = i;
    });
    if (last < 0) return [];

    const plays = barPlaysFromEvents(this.pending, this.chart, { ...this.info, at: this.now().toISOString() });
    // Keep what comes after the last finished bar, and a later bar's note judged before it (an early legato start in Tempo
    // mode with hold grading: a bar completes only once its last hold is decided), so that note stays with its bar.
    let done = -1;
    for (const event of this.pending) if (event.type === 'BarCompleted') done = Math.max(done, event.result.bar);
    this.pending = this.pending.filter((event, i) =>
      i > last || ((event.type === 'NoteJudged' || event.type === 'NoteMissed') && event.bar > done));
    return plays.map((p) => this.mapBar(p));
  }

  /**
   * A learning run stopped at `wrong` (ft_1_32): the play of the bar it stopped in, with the miss that ended it, from the
   * events kept since the last finished bar; nothing is kept after it. null when there is no such bar.
   */
  stop(wrong: WrongNoteJudged): BarPlay | null {
    const play = stoppedBarPlay(this.chart, this.pending, wrong, { ...this.info, at: this.now().toISOString() });
    this.pending = [];
    if (!play) return null;
    return this.mapBar(play);
  }

  /** A play's bar of the played chart as its written bar (core_09.AC20). */
  private mapBar(p: BarPlay): BarPlay {
    const map = this.writtenBar;
    if (!map) return p;
    const first = this.info.section?.first ?? 0;
    return { ...p, bar: (map[p.bar - first] ?? p.bar - first) + first };
  }
}
