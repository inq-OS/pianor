// Covers ft_0_11.AC2, ft_0_12.AC2.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pieceMetaSchema, playbackLengthMs, playbackNotes } from '../../src/core/chart';
import { layoutStaff } from '../../src/core/layout/staff';
import { DEFAULT_STAFF_SETTINGS, layoutForSettings, type StaffSettings } from '../../src/core/layout/staffSettings';

/** One line at a time: the biggest notes, the size the 20 px floor below is for (ft_0_16 AC2). */
const ONE_LINE: StaffSettings = { lines: 1, barsPerLine: 'auto' };
import { checkPieceFolder, listPieceFolders } from '../../tools/piece/folder';
import { GENERATOR_KINDS, regenerate } from '../../tools/generate';
import { loadAvoid } from '../../tools/generate/run';
import { loadLevelsFile } from '../../tools/piece/levels';

/**
 * Quality gate for everything in content/pieces/, drafts included: a piece that fails here would be left out of the game
 * (and fail a production build) or look wrong on the student's screen.
 */
const root = join(__dirname, '../..');
const dir = join(root, 'content/pieces');
const { levels, diagnostics: levelProblems } = loadLevelsFile(join(root, 'content/curriculum/levels.json'));
const folders = listPieceFolders(dir);
const checks = folders.map((folder) => checkPieceFolder(dir, folder, levels));

const VIEWPORTS = [
  { width: 1366, height: 768 }, // the T420 class laptop
  { width: 1280, height: 720 },
  { width: 1024, height: 600 },
];
/** The practice screen's staff area at those sizes: minus the bars above and below the staff (52 art pixels at 4x, 4x, 3x). */
const PRACTICE_AREAS = [
  { width: 1366, height: 768 - 52 * 4 },
  { width: 1280, height: 720 - 52 * 4 },
  { width: 1024, height: 600 - 52 * 3 },
];

describe('content/pieces', () => {
  it('has a first set of pieces covering the first levels', () => {
    expect(folders.length).toBeGreaterThanOrEqual(10);
    const byLevel = (n: number) => checks.filter((c) => c.compiled?.meta?.level === n).length;
    expect([byLevel(1), byLevel(2), byLevel(3), byLevel(4), byLevel(5)].every((count) => count >= 1)).toBe(true);
    expect(byLevel(1)).toBeGreaterThanOrEqual(3);
  });

  it('is checked against a level table without problems', () => {
    expect(levelProblems).toEqual([]);
  });

  it('gives every piece its own id and its own title', () => {
    const metas = checks.map((c) => c.compiled!.meta!);
    expect(new Set(metas.map((m) => m.id)).size).toBe(metas.length);
    expect(new Set(metas.map((m) => m.title)).size).toBe(metas.length);
  });

  describe.each(checks.map((c) => [c.folder, c] as const))('%s', (_folder, check) => {
    const chart = check.compiled?.chart;
    const meta = check.compiled?.meta;

    it('compiles and passes the linter for its level, with no error of any kind', () => {
      const errors = check.diagnostics.filter((d) => d.severity === 'error').map((d) => `${d.file}: ${d.message}`);
      expect(errors).toEqual([]);
      expect(check.ok).toBe(true);
    });

    it('says where it comes from and under which licence, and is original or public domain', () => {
      expect(meta!.source.length).toBeGreaterThan(3);
      expect(['CC0-1.0', 'CC-BY-4.0', 'public-domain']).toContain(meta!.license);
    });

    it('is drawn on the staff at every supported screen size, big enough to read', () => {
      // A two-hand song of more than 16 bars (the 32-bar character song) cannot show all its grand staves at once
      // at 10 px: the student reads it a line at a time (the tests below); the whole-piece view (the preview) must fit the laptop.
      const twoHands = new Set(chart!.notes.map((n) => n.track)).size > 1;
      if (twoHands && chart!.bars.length > 16) {
        const layout = layoutStaff(chart!, { viewport: VIEWPORTS[0]! });
        expect(layout.fits).toBe(true);
        expect(layout.notes).toHaveLength(chart!.notes.length);
        return;
      }
      // A classic arranged for level 6 keeps its dotted sixteenths, which need room: 9 px on the smallest screen.
      const smallest = meta!.level >= 6 ? 9 : 10;
      for (const viewport of VIEWPORTS) {
        const layout = layoutStaff(chart!, { viewport });
        expect(layout.fits, `${viewport.width}x${viewport.height}`).toBe(true);
        expect(layout.notes).toHaveLength(chart!.notes.length);
        expect(layout.staffSpace).toBeGreaterThanOrEqual(viewport.width > 1024 ? 10 : smallest);
      }
    });

    it('with one line at a time fits the practice screen at every size, 20 px or more between lines on the laptop', () => {
      for (const area of PRACTICE_AREAS) {
        const layout = layoutForSettings(chart!, { viewport: area }, ONE_LINE);
        expect(layout.fits, `${area.width}x${area.height}`).toBe(true);
        expect(layout.linesPerPage).toBe(1);
        expect(layout.notes).toHaveLength(chart!.notes.length);
        expect(layout.staffSpace).toBeGreaterThanOrEqual(area.width >= 1366 ? 20 : 16);
      }
    });

    it('with the default settings (two lines) fits the practice screen at every size, 9 px or more between lines, as the default', () => {
      for (const area of PRACTICE_AREAS) {
        const layout = layoutForSettings(chart!, { viewport: area }, DEFAULT_STAFF_SETTINGS);
        expect(layout.fits, `${area.width}x${area.height}`).toBe(true);
        // A short phrase that fits on one line (a 4-bar minuet, WP-11) shows that one line.
        expect(layout.linesPerPage).toBe(Math.min(2, layout.systems.length));
        expect(layout.notes).toHaveLength(chart!.notes.length);
        expect(layout.staffSpace).toBeGreaterThanOrEqual(9);
      }
    });


    it('plays back: every note sounds once and the piece has a length', () => {
      const notes = playbackNotes(chart!);
      expect(notes.flatMap((n) => n.noteIndexes).sort((a, b) => a - b)).toEqual(chart!.notes.map((_, i) => i));
      expect(playbackLengthMs(chart!)).toBeGreaterThan(1000);
    });

    it('has phrases that sit inside the piece', () => {
      expect(meta!.phrases.length).toBeGreaterThan(0);
      for (const phrase of meta!.phrases) expect(phrase.bars[1]).toBeLessThanOrEqual(chart!.bars.length);
    });
  });
});

describe('generated pieces in content/pieces', () => {
  const generated = folders.filter((folder) => GENERATOR_KINDS.includes(JSON.parse(readFileSync(join(dir, folder, 'piece.meta.json'), 'utf-8')).generator?.kind));

  it('exist, so the generators are shown to produce real content', () => {
    expect(generated.length).toBeGreaterThanOrEqual(5);
  });

  // A generator that changes silently would change what `--regenerate` makes of an approved piece. If this fails after a
  // change to tools/generate, the files on disk are still what was approved: decide whether to run
  // `npm run piece:generate -- --regenerate <id> --force` (which makes the piece a draft again) or to undo the change.
  it.each(generated)('%s is what its generator still makes from the seed in its meta file', (folder) => {
    const meta = pieceMetaSchema.parse(JSON.parse(readFileSync(join(dir, folder, 'piece.meta.json'), 'utf-8')));
    const again = regenerate(meta, { levels, avoid: loadAvoid(dir, levels) });
    expect(again.id).toBe(folder);
    expect(readFileSync(join(dir, folder, 'piece.abc'), 'utf-8')).toBe(again.abc);
    const onDisk = JSON.parse(readFileSync(join(dir, folder, 'piece.meta.json'), 'utf-8'));
    // the status is the human's to change; everything else must match
    expect({ ...onDisk, status: 'draft' }).toEqual({ ...JSON.parse(again.metaJson), status: 'draft' });
  });
});
