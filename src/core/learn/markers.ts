import type { Chart } from '../chart';
import type { BarMiss, BarPlay } from '../progression/practiceLog';

/**
 * Mistake markers (ft_1_32.AC5): a small circle over a note that was missed again and again, from the practice log's misses,
 * which keep every note not right the first time by its musical address. Pure; no save change.
 *
 * A marker appears at the `from`th miss (the player's setting, default 2: one slip not repeated is ignored) and is full red
 * two misses later (the 3rd miss, or the 4th when the first is forgiven): every miss is a mistake
 * practised. AX-3 provisional: only the misses in the bar's last `window` plays count, so a note played right again cools down.
 */
export const MARKER_RULES = { from: 2, fullAfter: 2, window: 10 } as const;

export interface NoteAddress extends BarMiss {
  /** Bar of the whole piece, 0-based. */
  bar: number;
}

export const markerKey = (a: NoteAddress): string => `${a.bar}:${a.tick}:${a.track}:${a.midi}`;

/** The address of chart note `index`, as the practice log keeps a miss of it; `firstBar` is the piece's bar of a section chart's first. */
export function markerKeyOfNote(chart: Chart, index: number, firstBar = 0): string {
  const note = chart.notes[index]!;
  return markerKey({ bar: note.bar + firstBar, tick: note.tick - chart.bars[note.bar]!.startTick, track: note.track, midi: note.midi });
}

/** 0 for fewer than `from` misses, else rising in even steps to 1 at `from + fullAfter` misses. */
export function markerShade(misses: number, from: number, fullAfter: number): number {
  if (misses < from) return 0;
  return Math.min(1, (misses - from + 1) / (Math.max(0, fullAfter) + 1));
}

/** The markers of a piece: address key to shade (above 0 only). `log` is in the order the bars were played. */
export function mistakeMarkers(
  log: readonly BarPlay[], pieceId: string, rules: { from?: number; fullAfter?: number; window?: number } = {},
): Map<string, number> {
  const { from, fullAfter, window } = { ...MARKER_RULES, ...rules };
  const byBar = new Map<number, BarPlay[]>();
  for (const play of log) {
    if (play.pieceId !== pieceId) continue;
    const plays = byBar.get(play.bar) ?? [];
    plays.push(play);
    byBar.set(play.bar, plays);
  }
  const counts = new Map<string, number>();
  for (const [bar, plays] of byBar) {
    for (const play of plays.slice(-window)) {
      for (const miss of play.misses) {
        const key = markerKey({ bar, ...miss });
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  const markers = new Map<string, number>();
  for (const [key, misses] of counts) {
    const shade = markerShade(misses, from, fullAfter);
    if (shade > 0) markers.set(key, shade);
  }
  return markers;
}

/** The markers of a chart (the piece, or a section of it from `firstBar`) by note index, for the staff. */
export function markersByNote(chart: Chart, markers: ReadonlyMap<string, number>, firstBar = 0): Map<number, number> {
  const byNote = new Map<number, number>();
  if (markers.size === 0) return byNote;
  chart.notes.forEach((_, index) => {
    const shade = markers.get(markerKeyOfNote(chart, index, firstBar));
    if (shade !== undefined) byNote.set(index, shade);
  });
  return byNote;
}
