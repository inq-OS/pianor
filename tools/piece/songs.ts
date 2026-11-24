import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import labelsFile from '../../content/songs/labels.json';
import { checkSong, checkSongsTogether } from '../../src/core/song/check.ts';
import { songLabelsSchema } from '../../src/core/song/labels.ts';
import type { PieceFacts } from '../../src/core/song/resolve.ts';
import type { Song } from '../../src/core/song/schema.ts';
import type { Diagnostic } from '../../src/core/piece/diagnostics.ts';

/** The ready-made label words (ft_1_36 rule 16). */
export const contentLabelWords: readonly string[] = songLabelsSchema.parse(labelsFile).labels;

/** Folders of `songsDir` that hold a `song.json`, in name order. */
export function listSongFolders(songsDir: string): string[] {
  if (!existsSync(songsDir)) return [];
  return readdirSync(songsDir)
    .filter((name) => statSync(join(songsDir, name)).isDirectory() && existsSync(join(songsDir, name, 'song.json')))
    .sort();
}

/**
 * Check every `<songsDir>/<id>/song.json` against the pieces found (ft_1_36 rule 14): each file alone, its id equal to its
 * folder, then a piece in two songs.
 */
export function lintSongs(songsDir: string, facts: (pieceId: string) => PieceFacts | undefined): { songs: Song[]; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const checked: { file: string; song: Song }[] = [];
  for (const folder of listSongFolders(songsDir)) {
    const file = `${folder}/song.json`;
    const check = checkSong({ file, text: readFileSync(join(songsDir, folder, 'song.json'), 'utf-8') }, facts, contentLabelWords);
    diagnostics.push(...check.diagnostics);
    if (!check.song) continue;
    if (check.song.id !== folder) diagnostics.push({ severity: 'error', file, message: `song "${check.song.id}": the id must match the folder name "${folder}"` });
    checked.push({ file, song: check.song });
  }
  diagnostics.push(...checkSongsTogether(checked));
  return { songs: checked.map((c) => c.song), diagnostics };
}
