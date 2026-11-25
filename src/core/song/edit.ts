import type { SongRow } from './resolve.ts';
import { MAX_GROUP_DEPTH, SONG_SCHEMA_VERSION, songTreeProblems, walkSong, type Song, type SongNode, type SongValues } from './schema.ts';

/** A new song's defaults (ft_1_36 rule 12, `AX-3 provisional:` 4/4, C major, 80 BPM) and its one blank's bars. */
export const NEW_SONG_VALUES: SongValues = { bpm: 80, key: { fifths: 0, mode: 'major' }, meter: { num: 4, den: 4 } };
export const NEW_BLANK_BARS = 8;

/** A new own song: its title, the defaults and one blank named `blankName`. Kept on this device, never committed (licence `NaN`). */
export function newSong(id: string, title: string, blankName: string): Song {
  return {
    schemaVersion: SONG_SCHEMA_VERSION, id, title, contentVersion: 1, status: 'approved', source: 'own', license: 'NaN', ...NEW_SONG_VALUES,
    nodes: [{ kind: 'blank', id: freeId(new Set(), slug(blankName) || 'part'), name: blankName, bars: NEW_BLANK_BARS }],
  };
}

/** Where a new row goes: after a row, at the end of a group, or at the end of the song. */
export type Place = { after: string } | { inside: string } | 'end';

/** The ways a row moves (rule 12, slot 6). */
export type MoveKind = 'up' | 'down' | 'into' | 'out';

/** Lowercase words joined by dashes, as a node id must be. */
function slug(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function freeId(taken: ReadonlySet<string>, base: string): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** An id for a new row made from `base` (a word or a name), one the song does not have yet. */
export function freeNodeId(song: Song, base: string): string {
  return freeId(new Set(walkSong(song.nodes).map(({ node }) => node.id)), slug(base) || 'part');
}

/** The list a node stands in (the song's or a group's), and its place there. */
function siblingsOf(nodes: SongNode[], id: string): { list: SongNode[]; index: number; parent: SongNode | null } | null {
  const search = (list: SongNode[], parent: SongNode | null): { list: SongNode[]; index: number; parent: SongNode | null } | null => {
    const index = list.findIndex((n) => n.id === id);
    if (index >= 0) return { list, index, parent };
    for (const node of list) {
      if (node.kind !== 'group') continue;
      const found = search(node.nodes, node);
      if (found) return found;
    }
    return null;
  };
  return search(nodes, null);
}

/** A deep copy of the tree, which the edits below change in place and return. */
function copy(song: Song): Song {
  return structuredClone(song);
}

/** The song if its tree keeps the rules (links after their piece, no group too deep, ids once), else null. */
function kept(song: Song): Song | null {
  return songTreeProblems(song.nodes).length === 0 ? song : null;
}

/** The song with `node` added at `place`; a place that is not in the song adds at the end. */
export function addNode(song: Song, place: Place, node: SongNode): Song {
  const next = copy(song);
  if (place !== 'end' && 'after' in place) {
    const at = siblingsOf(next.nodes, place.after);
    if (at) {
      at.list.splice(at.index + 1, 0, node);
      return next;
    }
  }
  if (place !== 'end' && 'inside' in place) {
    const group = walkSong(next.nodes).find(({ node: n }) => n.id === place.inside)?.node;
    if (group?.kind === 'group') {
      group.nodes.push(node);
      return next;
    }
  }
  next.nodes.push(node);
  return next;
}

/** The song with the row renamed (a group's, a blank's or a part's shown name). */
export function renameNode(song: Song, id: string, name: string): Song {
  const next = copy(song);
  const node = walkSong(next.nodes).find(({ node: n }) => n.id === id)?.node;
  if (node) node.name = name;
  return next;
}

/**
 * The song without the row (a group with all it holds); links to a piece taken out go with it. A piece node only leaves
 * the song: the piece stays in the player's pieces. Null when nothing would be left (a song keeps one row).
 */
export function removeNode(song: Song, id: string): Song | null {
  const next = copy(song);
  const at = siblingsOf(next.nodes, id);
  if (!at) return null;
  const [gone] = at.list.splice(at.index, 1);
  const pieces = new Set(walkSong([gone!]).flatMap(({ node }) => (node.kind === 'piece' ? [node.id] : [])));
  const drop = (list: SongNode[]): SongNode[] =>
    list.filter((n) => !(n.kind === 'link' && pieces.has(n.to))).map((n) => (n.kind === 'group' ? { ...n, nodes: drop(n.nodes) } : n));
  next.nodes = drop(next.nodes);
  return next.nodes.length > 0 ? next : null;
}

/**
 * The song with the row moved one step (rule 12, slot 6): up or down among its neighbours, into the group just above it
 * (at that group's end), or out of its group (just after it). Null when the move cannot be made: nothing that way, or a
 * link would come before its piece, or a group would stand too deep.
 */
export function moveNode(song: Song, id: string, kind: MoveKind): Song | null {
  const next = copy(song);
  const at = siblingsOf(next.nodes, id);
  if (!at) return null;
  const { list, index } = at;
  const node = list[index]!;
  if (kind === 'up' || kind === 'down') {
    const to = kind === 'up' ? index - 1 : index + 1;
    if (to < 0 || to >= list.length) return null;
    list.splice(index, 1);
    list.splice(to, 0, node);
    return kept(next);
  }
  if (kind === 'into') {
    const above = list[index - 1];
    if (above?.kind !== 'group') return null;
    list.splice(index, 1);
    above.nodes.push(node);
    return walkSong(next.nodes).every(({ node: n, groupDepth }) => n.kind !== 'group' || groupDepth < MAX_GROUP_DEPTH) ? kept(next) : null;
  }
  if (!at.parent) return null;
  const outer = siblingsOf(next.nodes, at.parent.id)!;
  list.splice(index, 1);
  outer.list.splice(outer.index + 1, 0, node);
  return kept(next);
}

/** The values a row or the song sets (rule 3). */
type ValueField = keyof SongValues;

/**
 * The song with a value set (rule 12, slots 2 to 4): a row's own tempo, key or meter, or with `undefined` the row follows
 * the song (or its group) again. With no row (`id` null) the song's own default is set; `undefined` then changes nothing,
 * as a song always has its defaults. A link sets no values: it plays its piece as it is.
 */
export function setValue<F extends ValueField>(song: Song, id: string | null, field: F, value: SongValues[F] | undefined): Song {
  const next = copy(song);
  if (id === null) {
    if (value !== undefined) (next as SongValues)[field] = value;
    return next;
  }
  const node = walkSong(next.nodes).find(({ node: n }) => n.id === id)?.node;
  if (!node || node.kind === 'link') return next;
  const target = node as unknown as Partial<SongValues>;
  if (value === undefined) delete target[field];
  else target[field] = value;
  return next;
}

/**
 * The song with a written blank (rule 11): the blank becomes a piece node with the same id, so its switch and any link
 * keep working; its name, labels and own values stay. A node that is not a blank is left as it is.
 */
export function writeBlank(song: Song, id: string, pieceId: string): Song {
  const next = copy(song);
  const at = siblingsOf(next.nodes, id);
  const blank = at?.list[at.index];
  if (!at || blank?.kind !== 'blank') return song;
  const piece: SongNode = { kind: 'piece', id: blank.id, piece: pieceId, name: blank.name };
  if (blank.labels) piece.labels = blank.labels;
  if (blank.bpm !== undefined) piece.bpm = blank.bpm;
  if (blank.key) piece.key = blank.key;
  if (blank.meter) piece.meter = blank.meter;
  at.list[at.index] = piece;
  return next;
}

/**
 * The values a new piece takes at a place (rule 17): after a row, what that row would follow (its parent's); inside a
 * group, the group's; at the end, the song's. `rows` is the song resolved.
 */
export function valuesAt(song: Song, rows: readonly SongRow[], place: Place): SongValues {
  const songValues: SongValues = { bpm: song.bpm, key: song.key, meter: song.meter };
  if (place === 'end') return songValues;
  const after = 'after' in place;
  const row = rows.find((r) => r.id === (after ? place.after : place.inside));
  if (!row) return songValues;
  return after ? { bpm: row.bpm.parent, key: row.key.parent, meter: row.meter.parent } : { bpm: row.bpm.value, key: row.key.value, meter: row.meter.value };
}

/**
 * The piece rows a link added at `place` may play again (rule 1: a link comes after its piece): those before the place,
 * a group's own pieces too when the place is after the group or at its end. None for a place that is not in the song.
 */
export function linkTargets(rows: readonly SongRow[], place: Place): SongRow[] {
  let end = rows.length;
  if (place !== 'end') {
    const at = rows.findIndex((r) => r.id === ('after' in place ? place.after : place.inside));
    if (at < 0) return [];
    end = at + 1;
    // after a group or at a group's end: its own rows come before the link
    while (end < rows.length && rows[end]!.depth > rows[at]!.depth) end++;
  }
  return rows.slice(0, end).filter((r) => r.kind === 'piece');
}
