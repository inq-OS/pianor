import { formatIssues } from '../issues.ts';
import type { Diagnostic } from '../piece/diagnostics.ts';
import type { PieceFacts } from './resolve.ts';
import { piecesInTwoSongs, songSchema, walkSong, type Song, type SongKey, type SongNode, type SongValues } from './schema.ts';

export interface SongCheck {
  /** The song, or null when its file does not parse. */
  song: Song | null;
  diagnostics: Diagnostic[];
}

const keyName = (k: SongKey) => `${k.fifths >= 0 ? `${k.fifths} sharp(s)` : `${-k.fifths} flat(s)`} ${k.mode}`;

/**
 * Check one song file (ft_1_36 rule 14, AC5): the schema and the tree's rules, every piece found, and every piece that
 * follows the song written in the tempo and key it follows (a piece with its own value written in that value). Label words
 * not on the ready-made list are warnings (rule 16). Each message names the song and the node.
 */
export function checkSong(input: { file: string; text: string }, facts: (pieceId: string) => PieceFacts | undefined, labelWords: readonly string[]): SongCheck {
  const diagnostics: Diagnostic[] = [];
  const error = (message: string) => diagnostics.push({ severity: 'error', file: input.file, message });
  let raw: unknown;
  try {
    raw = JSON.parse(input.text);
  } catch (e) {
    error(`not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    return { song: null, diagnostics };
  }
  const parsed = songSchema.safeParse(raw);
  if (!parsed.success) {
    const id = typeof raw === 'object' && raw !== null && 'id' in raw ? String(raw.id) : '?';
    for (const line of formatIssues(parsed.error)) error(`song "${id}": ${line}`);
    return { song: null, diagnostics };
  }
  const song = parsed.data;
  const where = (node: SongNode) => `song "${song.id}", node "${node.id}"`;

  const visit = (nodes: readonly SongNode[], inherited: SongValues) => {
    for (const node of nodes) {
      if (node.kind === 'link') continue;
      const values: SongValues = { bpm: node.bpm ?? inherited.bpm, key: node.key ?? inherited.key, meter: node.meter ?? inherited.meter };
      if (node.kind === 'group') visit(node.nodes, values);
      if (node.kind !== 'piece') continue;
      const piece = facts(node.piece);
      if (!piece) {
        error(`${where(node)}: piece "${node.piece}" is not found`);
        continue;
      }
      const whose = (set: unknown) => (set === undefined ? 'the tempo it follows is' : 'its own tempo is');
      if (piece.bpm !== values.bpm) error(`${where(node)}: piece "${node.piece}" is written at ${piece.bpm} BPM and ${whose(node.bpm)} ${values.bpm}`);
      if (piece.key.fifths !== values.key.fifths || piece.key.mode !== values.key.mode) {
        error(`${where(node)}: piece "${node.piece}" is written in ${keyName(piece.key)} and ${node.key === undefined ? 'the key it follows is' : 'its own key is'} ${keyName(values.key)}`);
      }
    }
  };
  visit(song.nodes, { bpm: song.bpm, key: song.key, meter: song.meter });

  for (const { node } of walkSong(song.nodes)) {
    for (const word of node.labels ?? []) {
      if (!labelWords.includes(word)) diagnostics.push({ severity: 'warning', file: input.file, message: `${where(node)}: the label "${word}" is not on the ready-made list` });
    }
  }
  return { song, diagnostics };
}

/** Across all songs: a piece may stand in one song only (rule 1). */
export function checkSongsTogether(songs: readonly { file: string; song: Song }[]): Diagnostic[] {
  return piecesInTwoSongs(songs.map((s) => s.song)).map(({ piece, places }) => ({
    severity: 'error' as const,
    file: songs.find((s) => s.song.id === places[1]!.song)!.file,
    message: `piece "${piece}" is in more than one song: ${places.map((p) => `song "${p.song}", node "${p.node}"`).join(' and ')}`,
  }));
}
