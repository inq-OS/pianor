import { msToTick, tickToMs, type Chart } from '../chart';
import type { BarCompleted, CorrectNoteJudged, JudgeEvent, NoteMissed } from '../judge';
import { MAX_BAR_PLAYS_PER_PIECE, type BarMiss, type BarPlay, type HandBar, type PracticeLog } from './practiceLog';

/** What a play is, for the bar plays it makes (core_10). */
export interface BarPlayInfo {
  /** When the bars were finished (ISO 8601). */
  at: string;
  pieceId: string;
  mode: 'wait' | 'tempo';
  /** The speed as a percent of the written tempo. */
  tempoPercent: number;
  /** null for a whole-piece play; for a section play its first and last bar of the piece (0-based, inclusive). */
  section: { first: number; last: number } | null;
}

/** A note that was not right the first time: a late correct press, or a note that ran out of time (Tempo mode). */
type MissEvent = (CorrectNoteJudged & { firstTry: false }) | NoteMissed;
/** Every note's end in a play: pressed right (first try or later), or run out of time (Tempo mode). */
type NoteEvent = CorrectNoteJudged | NoteMissed;

/**
 * One `BarPlay` per `BarCompleted` event (core_10). Pure.
 *
 * `events` may be everything of the play so far or any chunk of it, as long as the chunk starts after the last bar it
 * records: the note events of a bar come before its `BarCompleted`, and a chunk that begins with them works. Each bar
 * takes the notes of its own bar number only; note events of bars already completed are dropped as they go by.
 *
 * `chart` is the chart that was played (the section chart for a section), so its bar numbers are the event bars and a note's
 * tick in the bar is `note.tick` minus the start of its bar. Misses are read from the chart by `noteIndex`.
 */
export function barPlaysFromEvents(events: readonly JudgeEvent[], chart: Chart, info: BarPlayInfo): BarPlay[] {
  const plays: BarPlay[] = [];
  let pending: NoteEvent[] = [];

  for (const event of events) {
    if (event.type === 'NoteMissed' || (event.type === 'NoteJudged' && event.verdict === 'correct')) {
      pending.push(event);
    } else if (event.type === 'BarCompleted') {
      plays.push(barPlayOf(event, pending, chart, info));
      // Notes of this bar and of earlier bars are used up; the rest belong to later bars.
      pending = pending.filter((note) => note.bar > event.result.bar);
    }
  }
  return plays;
}

const isMiss = (e: NoteEvent): e is MissEvent => e.type === 'NoteMissed' || !e.firstTry;

/**
 * The bar's notes per hand (core_12.AC2), by the hand of each note's track. In Tempo mode also the notes on time and the
 * onset deviation of every note pressed in time, turned from played milliseconds into ticks at the written tempo (the
 * played clock runs at `tempoPercent`), rounded to whole ticks.
 */
function handsOf(notes: readonly NoteEvent[], chart: Chart, info: BarPlayInfo): NonNullable<BarPlay['hands']> {
  const hands: { LH?: HandBar; RH?: HandBar } = {};
  const speed = info.tempoPercent / 100;
  const seen = new Set<number>();
  for (const e of notes) {
    // One end per note: a second event for the same note (none is expected) is not counted twice.
    if (seen.has(e.noteIndex)) continue;
    seen.add(e.noteIndex);
    const note = chart.notes[e.noteIndex];
    const hand = chart.tracks.find((t) => t.id === note?.track)?.hand;
    if (note === undefined || hand === undefined || hand === null) continue;
    const h = hands[hand] ?? (info.mode === 'tempo' ? { notes: 0, firstTry: 0, onTime: 0, onsets: { n: 0, sum: 0, sumSq: 0 } } : { notes: 0, firstTry: 0 });
    const timing = e.type === 'NoteJudged' ? e.timing : undefined;
    let onTime = h.onTime;
    let onsets = h.onsets;
    if (info.mode === 'tempo' && timing !== undefined && onsets !== undefined) {
      const at = tickToMs(chart.tempoMap, note.tick, chart.ppq);
      const ticks = Math.round(msToTick(chart.tempoMap, at + timing.errorMs * speed, chart.ppq) - note.tick);
      onsets = { n: onsets.n + 1, sum: onsets.sum + ticks, sumSq: onsets.sumSq + ticks * ticks };
      if (timing.verdict === 'on-time') onTime = (onTime ?? 0) + 1;
    }
    hands[hand] = {
      notes: h.notes + 1,
      firstTry: h.firstTry + (isMiss(e) ? 0 : 1),
      ...(onTime !== undefined ? { onTime } : {}),
      ...(onsets !== undefined ? { onsets } : {}),
    };
  }
  return hands;
}

function barPlayOf(event: BarCompleted, pending: readonly NoteEvent[], chart: Chart, info: BarPlayInfo): BarPlay {
  const { result } = event;
  const local = result.bar;
  const start = chart.bars[local]?.startTick;
  if (start === undefined) throw new Error(`bar ${local} is not in the chart (${chart.bars.length} bars)`);

  const seen = new Set<string>();
  const misses: BarMiss[] = [];
  const inBar = pending.filter((e) => e.bar === local);
  for (const miss of inBar.filter(isMiss)) {
    const note = chart.notes[miss.noteIndex];
    if (!note) throw new Error(`note ${miss.noteIndex} is not in the chart`);
    const key = `${note.tick}|${note.track}|${note.midi}`;
    if (seen.has(key)) continue;
    seen.add(key);
    misses.push({ tick: note.tick - start, track: note.track, midi: note.midi });
  }

  return {
    at: info.at,
    pieceId: info.pieceId,
    bar: local + (info.section?.first ?? 0),
    notes: result.notes,
    firstTry: result.firstTryCorrect,
    timing: info.mode === 'tempo' && result.timing ? Math.round(result.timing.score) : null,
    mode: info.mode,
    tempoPercent: info.tempoPercent,
    section: info.section,
    misses,
    ...(info.mode === 'tempo' && result.timing?.holds ? { short: result.timing.holds.short } : {}),
    hands: handsOf(inBar, chart, info),
  };
}

/**
 * The log with `plays` added at the end. Returns a new log and never changes the given one. Then each piece keeps only its
 * newest `MAX_BAR_PLAYS_PER_PIECE` plays (the oldest go first); the order of what is kept is unchanged.
 */
export function appendBarPlays(log: PracticeLog, plays: readonly BarPlay[]): PracticeLog {
  const all = [...log.bars, ...plays];
  const kept: BarPlay[] = [];
  const keptPerPiece = new Map<string, number>();
  for (let i = all.length - 1; i >= 0; i--) {
    const play = all[i]!;
    const count = keptPerPiece.get(play.pieceId) ?? 0;
    if (count >= MAX_BAR_PLAYS_PER_PIECE) continue;
    keptPerPiece.set(play.pieceId, count + 1);
    kept.push(play);
  }
  return { bars: kept.reverse() };
}
