import type { Chart } from '../chart';
import { buildSteps } from '../judge/steps';
import type { JudgeEvent, WrongNoteJudged } from '../judge/types';
import type { BarMiss, BarPlay } from '../progression/practiceLog';
import type { BarPlayInfo } from '../progression/recordBars';
import { rushing } from './tempo';

/**
 * Whether a learning run is perfect (ft_1_32.AC3). Pure; it reads the events of the Wait mode judge, so the judge itself is
 * unchanged. The first wrong key ends the run: the screen stops it and names the mistake, and the same step starts again,
 * so the student never plays on past a mistake. A run with note names shown is `hinted`: it does not count, and the next run
 * hides them (`afterRun`); finger numbers always count. In a run played to the end (`playOn`: the first plays of the whole piece, d300) a
 * wrong key does not end the run: Wait mode waits for the right key, and a run with wrong keys ends `flawed`.
 */
export type LearnRunVerdict =
  | { state: 'going' }
  | { state: 'perfect' }
  | { state: 'hinted' }
  | { state: 'stopped'; wrong: WrongNoteJudged }
  /** A run played to its end with `mistakes` wrong keys, in a step whose runs are played to the end (`playOn`). */
  | { state: 'flawed'; mistakes: number }
  /** The run sped up beyond the piece's baseline tempo (`rushing`, ft_1_32.AC11): it is stopped and asked again. */
  | { state: 'rushed' };

export class LearnRunJudge {
  private current: LearnRunVerdict = { state: 'going' };
  private readonly events: JudgeEvent[] = [];
  private mistakes = 0;
  private readonly playOn: boolean;

  /**
   * `rush`: the chart played and the piece's baseline tempo, when a run that speeds up beyond it is stopped (the rushing
   * stop); without it, or with no baseline yet, the pace never stops a run.
   */
  constructor(private readonly rush?: { chart: Chart; baselineBpm: number | null }, options: { playOn?: boolean } = {}) {
    this.playOn = options.playOn ?? false;
  }

  get verdict(): LearnRunVerdict {
    return this.current;
  }

  /** Read a batch of judge events; once the run has ended its verdict stays. */
  push(events: readonly JudgeEvent[]): LearnRunVerdict {
    for (const event of events) {
      if (this.current.state !== 'going') break;
      this.events.push(event);
      if (event.type === 'NoteJudged' && event.verdict === 'wrong') {
        if (this.playOn) this.mistakes += 1;
        else this.current = { state: 'stopped', wrong: event };
      }
      else if (event.type === 'NoteJudged' && this.rush && rushing(this.rush.chart, this.events, this.rush.baselineBpm)) this.current = { state: 'rushed' };
      else if (event.type === 'PieceCompleted') {
        if (event.result.hints.noteNames > 0) this.current = { state: 'hinted' };
        else this.current = this.mistakes > 0 ? { state: 'flawed', mistakes: this.mistakes } : { state: 'perfect' };
      }
    }
    return this.current;
  }
}

/**
 * The bar a learning run stopped in, as a play of the practice log (core_10): the judge never finished it, so no
 * `BarCompleted` logs it, yet the mistake that ended the run must reach the mistake markers (ft_1_32.AC5). `events` are the
 * judge's events of the run since its last finished bar; `chart` is the played chart. Its misses are the bar's late notes
 * and the note the wrong key was played for; null when that bar is not in the chart.
 */
export function stoppedBarPlay(chart: Chart, events: readonly JudgeEvent[], wrong: WrongNoteJudged, info: BarPlayInfo): BarPlay | null {
  const bar = chart.bars[wrong.bar];
  if (!bar) return null;
  const steps = buildSteps(chart);
  const step = steps[wrong.stepIndex];
  const missed = step?.noteIndices.find((i) => chart.notes[i]!.midi === wrong.expectedMidi) ?? step?.noteIndices[0];
  const inBar = events.filter((e) => e.type === 'NoteJudged' && e.verdict === 'correct' && e.bar === wrong.bar);
  const late = inBar.flatMap((e) => (e.type === 'NoteJudged' && e.verdict === 'correct' && !e.firstTry ? [e.noteIndex] : []));
  const misses: BarMiss[] = [];
  const seen = new Set<string>();
  for (const index of [...late, ...(missed === undefined ? [] : [missed])]) {
    const note = chart.notes[index]!;
    const key = `${note.tick}|${note.track}|${note.midi}`;
    if (seen.has(key)) continue;
    seen.add(key);
    misses.push({ tick: note.tick - bar.startTick, track: note.track, midi: note.midi });
  }
  const notes = steps.filter((s) => s.bar === wrong.bar).reduce((n, s) => n + s.noteIndices.length, 0);
  const firstTry = inBar.filter((e) => e.type === 'NoteJudged' && e.verdict === 'correct' && e.firstTry).length;
  return {
    at: info.at, pieceId: info.pieceId, bar: wrong.bar + (info.section?.first ?? 0), notes, firstTry, timing: null, mode: info.mode,
    tempoPercent: info.tempoPercent, section: info.section, misses,
  };
}
