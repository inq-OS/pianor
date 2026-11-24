import { CHART_SCHEMA_VERSION, type Chart, type ChartPhrase } from '../chart/schema.ts';
import { PPQ } from '../chart/time.ts';
import type { Song, SongNode } from './schema.ts';

/** Where a part was left out of the joined chart (rule 7): a thin fold in the staff carries its name and song bars. */
export interface SongFold {
  node: string;
  name: string;
  /** Song bars, from 1 (rule 2). */
  startBar: number;
  endBar: number;
  reason: 'blank' | 'off' | 'missing';
  /** The chart bar (0-based) the fold stands before; the chart's bar count when it is at the end. */
  beforeBar: number;
}

/** A part of the joined chart: a node's bars in it, 0-based chart bars like a phrase. */
export interface SongPart {
  node: string;
  startBar: number;
  endBar: number;
}

export interface SongChart {
  chart: Chart;
  /** Every node that plays, in song order, with its chart bars. */
  parts: SongPart[];
  folds: SongFold[];
  /** For each chart bar, its song bar (from 1). */
  songBars: number[];
}

/** The piece nodes of a song by id, so a link finds the piece it repeats. */
function pieceNodes(nodes: readonly SongNode[], into = new Map<string, string>()): Map<string, string> {
  for (const node of nodes) {
    if (node.kind === 'piece') into.set(node.id, node.piece);
    if (node.kind === 'group') pieceNodes(node.nodes, into);
  }
  return into;
}

/** The node `id` and the ids of the groups above it, or undefined when the song has no such node. */
function findNode(nodes: readonly SongNode[], id: string, above: string[] = []): { node: SongNode; above: string[] } | undefined {
  for (const node of nodes) {
    if (node.id === id) return { node, above };
    if (node.kind === 'group') {
      const found = findNode(node.nodes, id, [...above, node.id]);
      if (found) return found;
    }
  }
  return undefined;
}

function plannedBars(node: SongNode, chartOf: (pieceId: string) => Chart | undefined, pieceOf: Map<string, string>): number {
  if (node.kind === 'blank') return node.bars;
  if (node.kind === 'group') return node.nodes.reduce((n, child) => n + plannedBars(child, chartOf, pieceOf), 0);
  const pieceId = node.kind === 'piece' ? node.piece : pieceOf.get(node.to);
  return (pieceId === undefined ? undefined : chartOf(pieceId))?.bars.length ?? 0;
}

/**
 * The whole song, or one group of it (`groupId`), as one chart (ft_1_36 rule 7): its written parts that are on, joined in
 * song order, a link repeating its piece's notes. Each chart's own tempo, key and meter come along, so the maps change
 * where a part sets its own. Every part is a phrase, a group's around its children's and a piece's around its own named
 * parts. A blank, a part that is off or a missing piece is a fold. Null when nothing is left to play.
 */
export function songChart(song: Song, chartOf: (pieceId: string) => Chart | undefined, off: ReadonlySet<string> = new Set(), groupId?: string): SongChart | null {
  const pieceOf = pieceNodes(song.nodes);
  const found = groupId === undefined ? undefined : findNode(song.nodes, groupId);
  const root = found?.node;
  if (groupId !== undefined && root?.kind !== 'group') return null;
  // A group that is off, or inside a group that is off, is not in the song, so it does not play (rule 5).
  if (found && [...found.above, found.node.id].some((id) => off.has(id))) return null;

  const out = {
    tempoMap: [] as Chart['tempoMap'], meterMap: [] as Chart['meterMap'], keyMap: [] as Chart['keyMap'],
    tracks: [] as Chart['tracks'], notes: [] as Chart['notes'], rests: [] as Chart['rests'], bars: [] as Chart['bars'],
    phrases: [] as ChartPhrase[], repeats: [] as NonNullable<Chart['repeats']>, slurs: [] as NonNullable<Chart['slurs']>,
    graces: [] as NonNullable<Chart['graces']>, tuplets: [] as NonNullable<Chart['tuplets']>,
  };
  const parts: SongPart[] = [];
  const folds: SongFold[] = [];
  const songBars: number[] = [];
  let level = 1;
  let low = Infinity;
  let high = -Infinity;
  let tick = 0;
  let songBar = 1;

  const pushChange = <T extends { tick: number }>(map: T[], entry: T, same: (a: T, b: T) => boolean) => {
    const last = map[map.length - 1];
    if (!last || !same(last, entry)) map.push(entry);
  };

  const append = (chart: Chart) => {
    const t0 = tick;
    const b0 = out.bars.length;
    for (const e of chart.tempoMap) pushChange(out.tempoMap, { ...e, tick: e.tick + t0 }, (a, b) => a.bpm === b.bpm);
    for (const e of chart.meterMap) pushChange(out.meterMap, { ...e, tick: e.tick + t0 }, (a, b) => a.num === b.num && a.den === b.den);
    for (const e of chart.keyMap) pushChange(out.keyMap, { ...e, tick: e.tick + t0 }, (a, b) => a.fifths === b.fifths && a.mode === b.mode);
    for (const track of chart.tracks) if (!out.tracks.some((t) => t.id === track.id)) out.tracks.push(track);
    for (const n of chart.notes) out.notes.push({ ...n, tick: n.tick + t0, bar: n.bar + b0 });
    for (const r of chart.rests) out.rests.push({ ...r, tick: r.tick + t0, bar: r.bar + b0 });
    for (const b of chart.bars) {
      out.bars.push({ index: b.index + b0, startTick: b.startTick + t0, endTick: b.endTick + t0 });
      songBars.push(songBar++);
    }
    for (const p of chart.phrases) out.phrases.push({ ...p, startBar: p.startBar + b0, endBar: p.endBar + b0 });
    for (const r of chart.repeats ?? []) {
      const shift = (s: { startBar: number; endBar: number }) => ({ startBar: s.startBar + b0, endBar: s.endBar + b0 });
      out.repeats.push({ ...shift(r), ...(r.endings ? { endings: { first: shift(r.endings.first), second: shift(r.endings.second) } } : {}) });
    }
    for (const s of chart.slurs ?? []) out.slurs.push({ ...s, startTick: s.startTick + t0, endTick: s.endTick + t0 });
    for (const g of chart.graces ?? []) out.graces.push({ ...g, tick: g.tick + t0 });
    for (const u of chart.tuplets ?? []) out.tuplets.push({ ...u, startTick: u.startTick + t0, endTick: u.endTick + t0 });
    level = Math.max(level, chart.level);
    low = Math.min(low, chart.range.low);
    high = Math.max(high, chart.range.high);
    tick = chart.bars[chart.bars.length - 1]!.endTick + t0;
  };

  const fold = (node: SongNode, name: string, reason: SongFold['reason']) => {
    const bars = plannedBars(node, chartOf, pieceOf);
    if (bars === 0 && reason !== 'missing') return;
    folds.push({ node: node.id, name, startBar: songBar, endBar: songBar + bars - 1, reason, beforeBar: out.bars.length });
    songBar += bars;
  };

  /** Adds the node; true when it put bars into the chart. */
  const visit = (node: SongNode): boolean => {
    const pieceId = node.kind === 'piece' ? node.piece : node.kind === 'link' ? pieceOf.get(node.to) : undefined;
    const chart = pieceId === undefined ? undefined : chartOf(pieceId);
    const name = node.kind === 'group' || node.kind === 'blank' ? node.name : node.name ?? chart?.title ?? pieceId ?? node.id;
    if (off.has(node.id)) {
      fold(node, name, 'off');
      return false;
    }
    if (node.kind === 'blank') {
      fold(node, name, 'blank');
      return false;
    }
    if (node.kind === 'group') {
      const startBar = out.bars.length;
      const at = out.phrases.length;
      const foldsBefore = folds.length;
      const songBarBefore = songBar;
      const played = node.nodes.map(visit).some(Boolean);
      if (!played) {
        const reasons = new Set(folds.splice(foldsBefore).map((f) => f.reason));
        songBar = songBarBefore;
        fold(node, name, reasons.has('off') ? 'off' : reasons.has('missing') ? 'missing' : 'blank');
        return false;
      }
      out.phrases.splice(at, 0, { name, startBar, endBar: out.bars.length - 1 });
      parts.push({ node: node.id, startBar, endBar: out.bars.length - 1 });
      return true;
    }
    if (!chart) {
      fold(node, name, 'missing');
      return false;
    }
    const startBar = out.bars.length;
    out.phrases.push({ name, startBar, endBar: startBar + chart.bars.length - 1 });
    append(chart);
    parts.push({ node: node.id, startBar, endBar: out.bars.length - 1 });
    return true;
  };

  const nodes = root?.kind === 'group' ? root.nodes : song.nodes;
  if (root) songBar = startSongBar(song.nodes, root.id, chartOf, pieceOf) ?? 1;
  const played = nodes.map(visit).some(Boolean);
  if (!played) return null;
  parts.sort((a, b) => a.startBar - b.startBar || b.endBar - a.endBar);

  const { repeats, slurs, graces, tuplets, ...rest } = out;
  const chart: Chart = {
    schemaVersion: CHART_SCHEMA_VERSION,
    id: root ? `song:${song.id}/${root.id}` : `song:${song.id}`,
    contentVersion: song.contentVersion,
    title: root?.kind === 'group' ? root.name : song.title,
    ...(root || !song.titles ? {} : { titles: song.titles }),
    level,
    ppq: PPQ,
    ...rest,
    ...(repeats.length > 0 ? { repeats } : {}),
    ...(slurs.length > 0 ? { slurs } : {}),
    ...(graces.length > 0 ? { graces } : {}),
    ...(tuplets.length > 0 ? { tuplets } : {}),
    range: { low, high },
  };
  return { chart, parts, folds, songBars };
}

/** The song bar (from 1) where node `id` starts. */
function startSongBar(nodes: readonly SongNode[], id: string, chartOf: (pieceId: string) => Chart | undefined, pieceOf: Map<string, string>): number | undefined {
  let bar = 1;
  const find = (list: readonly SongNode[]): boolean => {
    for (const node of list) {
      if (node.id === id) return true;
      if (node.kind === 'group' && find(node.nodes)) return true;
      if (node.kind !== 'group') bar += plannedBars(node, chartOf, pieceOf);
    }
    return false;
  };
  return find(nodes) ? bar : undefined;
}
