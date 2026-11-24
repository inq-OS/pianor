import { resolveSong, type PieceFacts, type ResolvedSong, type SongRow } from './resolve.ts';
import type { SongKey, SongMeter } from './schema.ts';

/** A row as the song page shows it (ft_1_36 rule 10): folded rows hide what is under them, and say how many. */
export interface ShownRow {
  row: SongRow;
  /** It has rows under it, so it has a fold triangle. */
  folds: boolean;
  /** Folded: how many rows it hides; 0 when open or with nothing under it. */
  hidden: number;
}

/** The rows a song page starts with folded: the pieces, whose phrases are one more level (rule 10, `AX-3 provisional:`). */
export function startFolded(rows: readonly SongRow[]): Set<string> {
  return new Set(rows.filter((r) => r.kind === 'piece' && rows.some((c) => c.parent === r.id)).map((r) => r.id));
}

/** The rows to show, in song order, with the rows under a folded row left out. */
export function shownRows(rows: readonly SongRow[], folded: ReadonlySet<string>): ShownRow[] {
  const under = new Map<string, number>();
  const parentOf = new Map(rows.map((r) => [r.id, r.parent]));
  for (const row of rows) {
    for (let p = row.parent; p !== null; p = parentOf.get(p) ?? null) under.set(p, (under.get(p) ?? 0) + 1);
  }
  const shown: ShownRow[] = [];
  const closed = new Set<string>();
  for (const row of rows) {
    if (row.parent !== null && (closed.has(row.parent) || folded.has(row.parent))) {
      closed.add(row.id);
      continue;
    }
    const count = under.get(row.id) ?? 0;
    shown.push({ row, folds: count > 0, hidden: folded.has(row.id) ? count : 0 });
  }
  return shown;
}

/** What a press on a row's play button plays (rule 6), or null for a row with none (a blank, a part that is off, a missing piece). */
export type RowPlay =
  | { kind: 'song' }
  | { kind: 'group'; node: string }
  | { kind: 'piece'; piece: string }
  | { kind: 'phrase'; piece: string; first: number; last: number };

export function rowPlay(row: SongRow, rows: readonly SongRow[]): RowPlay | null {
  if (!row.on || !row.written || row.missing) return null;
  if (row.kind === 'group') return playsSomething(row, rows) ? { kind: 'group', node: row.id } : null;
  if (row.kind === 'phrase') {
    let piece = rows.find((r) => r.id === row.parent);
    while (piece?.kind === 'phrase') piece = rows.find((r) => r.id === piece!.parent);
    // a lone piece's outline has no piece row: its bars start at 1
    const start = piece?.startBar ?? 1;
    return { kind: 'phrase', piece: row.piece!, first: row.startBar - start, last: row.endBar - start };
  }
  if (row.kind === 'piece' || row.kind === 'link') return { kind: 'piece', piece: row.piece! };
  return null;
}

/**
 * A lone piece's named parts as a song page (ft_1_36.AC13, core_06): the whole piece is the page's first row and its
 * phrases the outline, nested as they nest, numbered from 1.
 */
export function pieceOutline(pieceId: string, facts: PieceFacts): ResolvedSong {
  const values = { bpm: facts.bpm, key: facts.key, meter: facts.meter };
  const song = resolveSong(
    { schemaVersion: 1, id: pieceId, title: facts.title, contentVersion: 1, status: 'approved', source: '', license: '', ...values, nodes: [{ kind: 'piece', id: 'piece', piece: pieceId }] },
    () => facts,
  );
  const rows = song.rows.filter((r) => r.kind === 'phrase').map((r) => ({
    ...r, depth: r.depth - 1, number: r.number.slice(2), parent: r.parent === 'piece' ? null : r.parent,
  }));
  return { ...song, rows };
}

/** A key's name for a row (rule 3): the major or minor key of its signature, "C", "G", "Am", "F#m". */
export function keyName(key: SongKey): string {
  const majors = ['C♭', 'G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
  const minors = ['A♭', 'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'];
  return key.mode === 'major' ? majors[key.fifths + 7]! : `${minors[key.fifths + 7]!}m`;
}

export function meterName(meter: SongMeter): string {
  return `${meter.num}/${meter.den}`;
}

/** Some piece or link under the group is written and on. */
function playsSomething(group: SongRow, rows: readonly SongRow[]): boolean {
  return rows.some((r) => r.parent === group.id && (r.kind === 'piece' || r.kind === 'link' ? r.written && r.on && !r.missing : r.kind === 'group' && playsSomething(r, rows)));
}
