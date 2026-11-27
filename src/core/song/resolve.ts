import { partsInOrder } from '../chart/parts.ts';
import type { Chart } from '../chart/schema.ts';
import type { Song, SongKey, SongLink, SongMeter, SongNode, SongValues } from './schema.ts';

/** What the song tree needs to know of one written piece, read from its chart. */
export interface PieceFacts {
  title: string;
  /** Bars of the chart, a pick-up included. */
  bars: number;
  /** The values the piece is written in, at its first bar (rule 4: a piece holds its own numbers). */
  bpm: number;
  key: SongKey;
  meter: SongMeter;
  /** The piece's named parts (core_06), 0-based bars of the piece. */
  phrases: readonly { name: string; startBar: number; endBar: number }[];
}

export function pieceFactsOf(chart: Chart): PieceFacts {
  const key = chart.keyMap[0]!;
  const meter = chart.meterMap[0]!;
  return {
    title: chart.title,
    bars: chart.bars.length,
    bpm: chart.tempoMap[0]!.bpm,
    key: { fifths: key.fifths, mode: key.mode },
    meter: { num: meter.num, den: meter.den },
    phrases: chart.phrases,
  };
}

/** A value of a row (rule 3): `own` when the row sets it, else it follows `parent`, the value it would take from above. */
export interface RowValue<T> {
  value: T;
  own: boolean;
  parent: T;
}

export type SongRowKind = SongNode['kind'] | 'phrase';

/** One row of the song's outline (rule 10), in song order. */
export interface SongRow {
  /** The node's id; a phrase row is `<piece node id>#<phrase index>`. */
  id: string;
  kind: SongRowKind;
  /** 0 for the song's own rows; one more for each group or piece above. */
  depth: number;
  /** Its place in the outline: "1", "1.2", "1.2.1". */
  number: string;
  parent: string | null;
  name: string;
  labels: string[];
  /** Song bars, counted from 1 through the whole song (rule 2); `endBar` is `startBar - 1` for a row of no bars. */
  startBar: number;
  endBar: number;
  bars: number;
  bpm: RowValue<number>;
  key: RowValue<SongKey>;
  meter: RowValue<SongMeter>;
  /** The player's own switch for this row (rule 5); always true for a phrase. */
  switchOn: boolean;
  /** In the song: its switch and every group above it are on. */
  on: boolean;
  /** It has notes: a piece or link whose piece exists, a phrase, or a group holding one of those. */
  written: boolean;
  /** The piece it plays (a piece, a link or a phrase row). */
  piece?: string;
  /** A link's piece node. */
  linkTo?: string;
  /** A piece or link whose piece is not found. */
  missing?: boolean;
}

export interface ResolvedSong {
  id: string;
  title: string;
  values: SongValues;
  /** Bars planned: every part, blanks and parts that are off included. */
  bars: number;
  /** Bars of the written parts (pieces and links), on or off. */
  barsWritten: number;
  rows: SongRow[];
}

const sameKey = (a: SongKey, b: SongKey) => a.fifths === b.fifths && a.mode === b.mode;
const sameMeter = (a: SongMeter, b: SongMeter) => a.num === b.num && a.den === b.den;

function valueOf<T>(set: T | undefined, written: T | undefined, parent: T, same: (a: T, b: T) => boolean): RowValue<T> {
  const value = written ?? set ?? parent;
  return { value, own: set !== undefined || !same(value, parent), parent };
}

/**
 * The song's tree as rows (ft_1_36 rules 1 to 3 and 5): the defaults passed down, the song bars, the switches. `off` holds
 * the ids the player turned off; an id the song no longer has is ignored. A piece's values are those written in it
 * (rule 4); one that differs from its parent's counts as its own. A link takes its piece's values and bars.
 */
export function resolveSong(song: Song, facts: (pieceId: string) => PieceFacts | undefined, off: ReadonlySet<string> = new Set()): ResolvedSong {
  const rows: SongRow[] = [];
  const byId = new Map<string, SongRow>();
  let bar = 1;

  const visit = (nodes: readonly SongNode[], parent: SongRow | null, inherited: SongValues, parentOn: boolean) => {
    nodes.forEach((node, i) => {
      const number = parent ? `${parent.number}.${i + 1}` : `${i + 1}`;
      const depth = parent ? parent.depth + 1 : 0;
      const switchOn = !off.has(node.id);
      const on = parentOn && switchOn;
      const startBar = bar;
      const common: RowStart = { id: node.id, kind: node.kind, depth, number, parent: parent?.id ?? null, labels: node.labels ?? [], switchOn, on, startBar };
      if (node.kind === 'link') {
        const row = linkRow(node, common, byId.get(node.to), facts, inherited);
        bar += row.bars;
        rows.push(row);
        byId.set(row.id, row);
        return;
      }
      const pieceFacts = node.kind === 'piece' ? facts(node.piece) : undefined;
      const row: SongRow = {
        ...common,
        name: node.kind === 'piece' ? node.name ?? pieceFacts?.title ?? node.piece : node.name,
        endBar: startBar - 1, bars: 0,
        bpm: valueOf(node.bpm, pieceFacts?.bpm, inherited.bpm, Object.is),
        key: valueOf(node.key, pieceFacts?.key, inherited.key, sameKey),
        meter: valueOf(node.meter, pieceFacts?.meter, inherited.meter, sameMeter),
        written: pieceFacts !== undefined,
        ...(node.kind === 'piece' ? { piece: node.piece } : {}),
        ...(node.kind === 'piece' && !pieceFacts ? { missing: true } : {}),
      };
      rows.push(row);
      byId.set(row.id, row);
      const values: SongValues = { bpm: row.bpm.value, key: row.key.value, meter: row.meter.value };
      if (node.kind === 'group') {
        visit(node.nodes, row, values, on);
        row.written = rows.some((r) => r.parent === row.id && r.written);
      } else if (node.kind === 'blank') {
        bar += node.bars;
      } else if (pieceFacts) {
        phraseRows(row, pieceFacts, values, rows);
        bar += pieceFacts.bars;
      }
      row.bars = bar - startBar;
      row.endBar = bar - 1;
    });
  };
  visit(song.nodes, null, { bpm: song.bpm, key: song.key, meter: song.meter }, true);

  return {
    id: song.id,
    title: song.title,
    values: { bpm: song.bpm, key: song.key, meter: song.meter },
    bars: bar - 1,
    barsWritten: rows.filter((r) => (r.kind === 'piece' || r.kind === 'link') && r.written).reduce((n, r) => n + r.bars, 0),
    rows,
  };
}

type RowStart = Pick<SongRow, 'id' | 'kind' | 'depth' | 'number' | 'parent' | 'labels' | 'switchOn' | 'on' | 'startBar'>;

/** A link's row: its piece's bars and values, against the values around it. */
function linkRow(node: SongLink, common: RowStart, target: SongRow | undefined, facts: (pieceId: string) => PieceFacts | undefined, inherited: SongValues): SongRow {
  const pieceFacts = target?.piece === undefined ? undefined : facts(target.piece);
  const bars = pieceFacts?.bars ?? 0;
  return {
    ...common, name: node.name ?? target?.name ?? node.to, endBar: common.startBar + bars - 1, bars,
    bpm: valueOf(undefined, target?.bpm.value, inherited.bpm, Object.is),
    key: valueOf(undefined, target?.key.value, inherited.key, sameKey),
    meter: valueOf(undefined, target?.meter.value, inherited.meter, sameMeter),
    written: pieceFacts !== undefined, linkTo: node.to,
    ...(target?.piece === undefined ? {} : { piece: target.piece }),
    ...(pieceFacts ? {} : { missing: true }),
  };
}

/**
 * A piece's named parts as rows under it, nested as they nest (core_06), each following the piece's values. A piece
 * whose one phrase is the whole piece gets none: that row would only say the piece again.
 */
function phraseRows(piece: SongRow, facts: PieceFacts, values: SongValues, rows: SongRow[]): void {
  const ordered = partsInOrder(facts.phrases);
  const only = ordered.length === 1 ? ordered[0]! : undefined;
  if (only && only.startBar <= 0 && only.endBar >= facts.bars - 1) return;
  const stack: { row: SongRow; endBar: number }[] = [];
  const childCount = new Map<string, number>();
  for (const phrase of ordered) {
    while (stack.length > 0 && stack[stack.length - 1]!.endBar < phrase.endBar) stack.pop();
    const parent = stack[stack.length - 1]?.row ?? piece;
    const n = (childCount.get(parent.id) ?? 0) + 1;
    childCount.set(parent.id, n);
    const startBar = piece.startBar + phrase.startBar;
    const bars = phrase.endBar - phrase.startBar + 1;
    const row: SongRow = {
      id: `${piece.id}#${facts.phrases.indexOf(phrase)}`, kind: 'phrase', depth: parent.depth + 1, number: `${parent.number}.${n}`,
      parent: parent.id, name: phrase.name, labels: [], startBar, endBar: startBar + bars - 1, bars,
      bpm: { value: values.bpm, own: false, parent: values.bpm },
      key: { value: values.key, own: false, parent: values.key },
      meter: { value: values.meter, own: false, parent: values.meter },
      switchOn: true, on: piece.on, written: true, piece: piece.piece!,
    };
    rows.push(row);
    stack.push({ row, endBar: phrase.endBar });
  }
}
