import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compilePiece } from '../../src/core/piece/compile';
import { listPieceFolders } from './folder';
import { lintPieces } from './lintFiles';
import { loadLevelsFile } from './levels';

const root = join(__dirname, '../..');
const PIECES = join(root, 'content/pieces');
const { levels } = loadLevelsFile(join(root, 'content/curriculum/levels.json'));

/** The bar ranges (1-based, inclusive) the turn battle casts (docs/architect/rpg-battle-mvp.md): Power, Combo, Special (4 or 2), Shield. */
const RANGES: [number, number][] = [[1, 8], [1, 2], [1, 4], [5, 8]];

function starterSongs() {
  return listPieceFolders(PIECES)
    .map((folder) => compilePiece({
      abc: readFileSync(join(PIECES, folder, 'piece.abc'), 'utf-8'),
      meta: readFileSync(join(PIECES, folder, 'piece.meta.json'), 'utf-8'),
    }))
    .filter((c) => c.meta?.tags.includes('starter-song'));
}

describe('starter songs of the turn battle', () => {
  const songs = starterSongs();

  it('there is exactly one starter song per class', () => {
    const classes = songs.map((s) => s.meta!.tags.filter((t) => t.startsWith('class-'))).flat().sort();
    expect(classes).toEqual(['class-knight', 'class-ranger', 'class-wizard']);
  });

  it('each one compiles, is 8 bars, original, CC0 and has a source; no chords, no ties', () => {
    for (const { chart, meta } of songs) {
      expect(chart, meta!.id).not.toBeNull();
      expect(chart!.bars, meta!.id).toHaveLength(8);
      expect(meta!.styles).toContain('original');
      expect(meta!.license).toBe('CC0-1.0');
      expect(meta!.source).toMatch(/original/);
      expect(chart!.notes.some((n) => n.tieNext), `${meta!.id} has a tie`).toBe(false);
      const onsets = chart!.notes.map((n) => `${n.track}@${n.tick}`);
      expect(new Set(onsets).size, `${meta!.id} has a chord`).toBe(onsets.length);
    }
  });

  it('every bar range the battle casts (Power 1-8, Combo 1-2, Special 1-4 or 1-2, Shield 5-8) has notes', () => {
    for (const { chart, meta } of songs) {
      for (const [from, to] of RANGES) {
        const played = new Set(chart!.notes.filter((n) => n.bar >= from - 1 && n.bar <= to - 1).map((n) => n.bar));
        expect(played.size, `${meta!.id} bars ${from}-${to}`).toBe(to - from + 1);
      }
    }
  });

  it('each one lints without errors at its own level', () => {
    const report = lintPieces(PIECES, levels);
    for (const { meta } of songs) {
      const lint = report.linted.find((l) => l.id === meta!.id);
      expect(lint, meta!.id).toBeDefined();
      expect(lint!.diagnostics.filter((d) => d.severity === 'error'), meta!.id).toEqual([]);
      expect(lint!.fitsLevels).toContain(meta!.level);
    }
  });
});
