import { z } from 'zod';
import { pieceTitlesSchema } from '../chart/schema.ts';

/** Song file format (ft_1_36 rule 14): `content/songs/<id>/song.json`. */
export const SONG_SCHEMA_VERSION = 1;

/** At most this many levels of groups under the song (ft_1_36 rule 1, `AX-3 provisional:`). */
export const MAX_GROUP_DEPTH = 4;

export interface SongKey {
  /** Key signature as MusicXML `fifths` (-7 to 7), as in a chart's key map. */
  fifths: number;
  mode: 'major' | 'minor';
}

export interface SongMeter {
  num: number;
  den: number;
}

/** The values a song passes down (rule 3); a node may set any of them as its own. */
export interface SongValues {
  /** Quarter notes a minute, as in a chart's tempo map. */
  bpm: number;
  key: SongKey;
  meter: SongMeter;
}

interface NodeBase {
  /** Never changes: saves and links point at it. */
  id: string;
  /** Words from the ready-made list or the author's own (rule 16). */
  labels?: string[] | undefined;
}

interface OwnValues {
  bpm?: number | undefined;
  key?: SongKey | undefined;
  meter?: SongMeter | undefined;
}

export interface SongGroup extends NodeBase, OwnValues {
  kind: 'group';
  name: string;
  nodes: SongNode[];
}

export interface SongPiece extends NodeBase, OwnValues {
  kind: 'piece';
  /** The piece's id (its folder in `content/pieces/`, or an own piece). */
  piece: string;
  /** Shown in place of the piece's title. */
  name?: string | undefined;
}

export interface SongLink extends NodeBase {
  kind: 'link';
  /** The id of a piece node earlier in the same song. */
  to: string;
  name?: string | undefined;
}

export interface SongBlank extends NodeBase, OwnValues {
  kind: 'blank';
  name: string;
  /** Planned number of bars. */
  bars: number;
}

export type SongNode = SongGroup | SongPiece | SongLink | SongBlank;

export interface Song extends SongValues {
  schemaVersion: typeof SONG_SCHEMA_VERSION;
  id: string;
  title: string;
  titles?: { et?: string | undefined } | undefined;
  /** Bump when the song file is edited so saves can tell versions apart. */
  contentVersion: number;
  status: 'draft' | 'approved';
  source: string;
  license: string;
  nodes: SongNode[];
}

const idSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'use lowercase words joined by dashes');
const keySchema = z.strictObject({ fifths: z.int().min(-7).max(7), mode: z.enum(['major', 'minor']) });
const meterSchema = z.strictObject({ num: z.int().positive(), den: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8), z.literal(16)]) });
const bpmSchema = z.number().min(30).max(500);
const labelsSchema = z.array(z.string().min(1)).optional();
const base = { id: idSchema, labels: labelsSchema };
const own = { bpm: bpmSchema.optional(), key: keySchema.optional(), meter: meterSchema.optional() };

const nodeSchema: z.ZodType<SongNode> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('group'), ...base, ...own, name: z.string().min(1), nodes: z.array(nodeSchema) }),
    z.strictObject({ kind: z.literal('piece'), ...base, ...own, piece: idSchema, name: z.string().min(1).optional() }),
    z.strictObject({ kind: z.literal('link'), ...base, to: idSchema, name: z.string().min(1).optional() }),
    z.strictObject({ kind: z.literal('blank'), ...base, ...own, name: z.string().min(1), bars: z.int().positive() }),
  ]),
);

/** Every node of the tree in song order (a group before what it holds), with its depth in groups and its parent. */
export function walkSong(nodes: readonly SongNode[]): { node: SongNode; groupDepth: number; parent: SongGroup | null }[] {
  const out: { node: SongNode; groupDepth: number; parent: SongGroup | null }[] = [];
  const visit = (list: readonly SongNode[], groupDepth: number, parent: SongGroup | null) => {
    for (const node of list) {
      out.push({ node, groupDepth, parent });
      if (node.kind === 'group') visit(node.nodes, groupDepth + 1, node);
    }
  };
  visit(nodes, 0, null);
  return out;
}

/** The tree's own rules that a plain schema cannot say (AC1); each message names the node. */
export function songTreeProblems(nodes: readonly SongNode[]): string[] {
  const problems: string[] = [];
  const seen = new Map<string, SongNode>();
  const pieces = new Map<string, string>();
  for (const { node, groupDepth } of walkSong(nodes)) {
    if (seen.has(node.id)) problems.push(`node "${node.id}": the id is used twice`);
    if (node.kind === 'group' && groupDepth + 1 > MAX_GROUP_DEPTH) problems.push(`node "${node.id}": more than ${MAX_GROUP_DEPTH} levels of groups`);
    if (node.kind === 'piece') {
      const other = pieces.get(node.piece);
      if (other) problems.push(`node "${node.id}": piece "${node.piece}" is already node "${other}"; repeat it with a link`);
      else pieces.set(node.piece, node.id);
    }
    if (node.kind === 'link') {
      const target = seen.get(node.to);
      if (!target) problems.push(`node "${node.id}": a link must point at a piece node before it, and "${node.to}" is not one`);
      else if (target.kind !== 'piece') problems.push(`node "${node.id}": a link must point at a piece, and "${node.to}" is a ${target.kind}`);
    }
    if (!seen.has(node.id)) seen.set(node.id, node);
  }
  return problems;
}

export const songSchema: z.ZodType<Song, unknown> = z
  .strictObject({
    schemaVersion: z.literal(SONG_SCHEMA_VERSION),
    id: idSchema,
    title: z.string().min(1),
    titles: pieceTitlesSchema.optional(),
    contentVersion: z.int().positive().default(1),
    status: z.enum(['draft', 'approved']),
    source: z.string().min(1),
    license: z.string().min(1),
    bpm: bpmSchema,
    key: keySchema,
    meter: meterSchema,
    nodes: z.array(nodeSchema).min(1),
  })
  .superRefine((song, ctx) => {
    for (const message of songTreeProblems(song.nodes)) ctx.addIssue({ code: 'custom', message, path: ['nodes'] });
  });

/**
 * The pieces that stand in more than one song (AC1: a piece belongs to one song at most), each with every song and node
 * that holds it.
 */
export function piecesInTwoSongs(songs: readonly Song[]): { piece: string; places: { song: string; node: string }[] }[] {
  const places = new Map<string, { song: string; node: string }[]>();
  for (const song of songs) {
    for (const { node } of walkSong(song.nodes)) {
      if (node.kind !== 'piece') continue;
      const list = places.get(node.piece) ?? [];
      if (!list.some((p) => p.song === song.id)) list.push({ song: song.id, node: node.id });
      places.set(node.piece, list);
    }
  }
  return [...places].filter(([, list]) => list.length > 1).map(([piece, list]) => ({ piece, places: list }));
}
