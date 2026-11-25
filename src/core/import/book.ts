/**
 * A book of pages read as one score, made into the parts of an own song (ft_Y_04 slice 6). Each movement Audiveris found is
 * cut into parts (`songParts.ts`); each part's bars become a piece of the piece maker (`sliceChart`, `fromChart`), or a
 * blank of the song with the reason when the piece maker cannot hold it (a 6/8 part, a part with no notes). The song
 * takes its tempo, key and meter from its first written part; a part that differs sets its own. Pure.
 */
import { sliceChart } from '../chart/section';
import type { Chart } from '../chart/schema';
import { fromChart, type ImportProblem } from '../editor/fromChart';
import { BPM_DEFAULT, type EditorPiece } from '../editor/model';
import { SONG_SCHEMA_VERSION, type Song, type SongNode, type SongValues } from '../song/schema';
import type { ScoreMarks } from './musicxml';
import { partsOf, type Layout, type PartRange } from './songParts';

/** One movement of the book: its chart and its printed marks. */
export interface BookMovement {
  readonly chart: Chart;
  readonly marks: ScoreMarks;
}

/** The bar of a tick (the bar it starts in). */
function barAt(chart: Chart, tick: number): number {
  const i = chart.bars.findIndex((b) => tick >= b.startTick && tick < b.endTick);
  return i < 0 ? chart.bars.length : i;
}

/** What the splitter needs of a movement: its key and meter changes, repeats, and the bars a tie or slur reaches into. */
export function layoutOf(movement: BookMovement): Layout {
  const { chart, marks } = movement;
  const mustStarts = [...chart.keyMap.slice(1), ...chart.meterMap.slice(1)].map((m) => barAt(chart, m.tick));
  const inRepeat = (chart.repeats ?? []).flatMap((r) => Array.from({ length: r.endBar - r.startBar }, (_, k) => r.startBar + 1 + k));
  const tiedInto = new Set<number>();
  for (const n of chart.notes) if (n.tieNext && barAt(chart, n.tick + n.dur) > n.bar) tiedInto.add(barAt(chart, n.tick + n.dur));
  for (const s of chart.slurs ?? []) for (let b = barAt(chart, s.startTick) + 1; b <= barAt(chart, s.endTick); b++) tiedInto.add(b);
  return { bars: chart.bars.length, mustStarts, marks, inRepeat, tiedInto: [...tiedInto].sort((a, b) => a - b) };
}

/** A part as it will be saved: a piece with the places to fill by hand, or the reason it stays a blank. */
export type BookPart = PartRange & { readonly movement: number; readonly name: string } & (
  | { readonly piece: EditorPiece; readonly problems: ImportProblem[]; readonly warnings: string[] }
  | { readonly reason: string }
);

/**
 * The parts of the book, from each movement's part starts: each named by its rehearsal mark or `nameOf(n)` (n counts the
 * book's parts from 1), its piece titled "<title>: <name>".
 */
export function bookParts(movements: readonly BookMovement[], starts: readonly (readonly number[])[], title: string, nameOf: (n: number) => string): BookPart[] {
  const parts: BookPart[] = [];
  movements.forEach((movement, m) => {
    for (const range of partsOf(layoutOf(movement), starts[m] ?? [0])) {
      const name = range.name ?? nameOf(parts.length + 1);
      const made = fromChart(sliceChart(movement.chart, range.firstBar, range.lastBar), { title: `${title}: ${name}` });
      parts.push(made.ok
        ? { ...range, movement: m, name, piece: made.piece, problems: made.problems, warnings: made.warnings }
        : { ...range, movement: m, name, reason: made.reason });
    }
  });
  return parts;
}

/** The values a written part plays in. */
function valuesOf(piece: EditorPiece): SongValues {
  return { bpm: piece.bpm ?? BPM_DEFAULT, key: { fifths: piece.fifths, mode: piece.mode }, meter: { num: piece.beats, den: 4 } };
}

/** Lowercase words joined by dashes, for a node id. */
function slug(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/, '') || 'part';
}

/**
 * The own song of the book: one row per part in order (a piece, or a blank of its bars), inside a group per movement when
 * there are several (`movementName(m)`, m from 1). `pieceIds[i]` is the id part `i` was saved under (undefined: a blank).
 */
export function bookSong(id: string, title: string, parts: readonly BookPart[], pieceIds: readonly (string | undefined)[], movementName: (m: number) => string): Song {
  const written = parts.flatMap((p, i) => ('piece' in p && pieceIds[i] ? [p.piece] : []));
  const values: SongValues = written[0] ? valuesOf(written[0]) : { bpm: 80, key: { fifths: 0, mode: 'major' }, meter: { num: 4, den: 4 } };
  const taken = new Set<string>();
  const freeId = (name: string): string => {
    const base = slug(name);
    let nodeId = base;
    for (let n = 2; taken.has(nodeId); n++) nodeId = `${base}-${n}`;
    taken.add(nodeId);
    return nodeId;
  };
  const rowOf = (part: BookPart, i: number): SongNode => {
    const pieceId = pieceIds[i];
    if (!('piece' in part) || !pieceId) return { kind: 'blank', id: freeId(part.name), name: part.name, bars: part.lastBar - part.firstBar + 1 };
    const own = valuesOf(part.piece);
    return {
      kind: 'piece', id: freeId(part.name), piece: pieceId, name: part.name,
      ...(own.bpm !== values.bpm ? { bpm: own.bpm } : {}),
      ...(own.key.fifths !== values.key.fifths || own.key.mode !== values.key.mode ? { key: own.key } : {}),
      ...(own.meter.num !== values.meter.num ? { meter: own.meter } : {}),
    };
  };
  const movements = [...new Set(parts.map((p) => p.movement))];
  const nodes: SongNode[] = movements.length <= 1
    ? parts.map(rowOf)
    : movements.map((m, k) => ({ kind: 'group' as const, id: freeId(movementName(k + 1)), name: movementName(k + 1), nodes: parts.flatMap((p, i) => (p.movement === m ? [rowOf(p, i)] : [])) }));
  return { schemaVersion: SONG_SCHEMA_VERSION, id, title, contentVersion: 1, status: 'approved', source: 'own', license: 'NaN', ...values, nodes };
}
