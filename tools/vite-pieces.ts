import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { formatDiagnostic, type Diagnostic } from '../src/core/piece/diagnostics.ts';
import { checkPieceFolder, listPieceFolders } from './piece/folder.ts';
import { previewHandler } from './piece/previewApi.ts';
import { loadLevelsFile } from './piece/levels.ts';
import { unlimitedLevels } from '../src/core/piece/levelsTable.ts';
import { shownPoints } from '../src/core/piece/difficulty.ts';

const VIRTUAL_ID = 'virtual:pieces';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

/**
 * Makes `import pieces from "virtual:pieces"` give the game every piece in `content/pieces/`, compiled from ABC and
 * checked by the linter against its level, as `{ meta, chart }`. A piece with any compile or lint error is left out and
 * reported (and fails a production build). A production build also leaves out the drafts, which it never shows,
 * and exports their ids as `omittedIds` so a piece written in the editor cannot take one; the dev server gives every piece
 * and the game decides whether drafts show.
 * The pieces of the gitignored `private/pieces/` (imported scores, ft_Y_04 slice 2) come too, on this machine only: like an
 * own piece they are checked without the level limits on chords, accidentals and keys, and kept when they compile, their
 * lint problems only reported, never failing a build; one with the id of a piece above is left out.
 * The page reloads when a piece file changes. The dev server also answers the preview tool's requests (`previewApi.ts`).
 */
export function piecesPlugin(piecesDir = 'content/pieces', levelsPath = 'content/curriculum/levels.json', privateDir: string | null = 'private/pieces'): Plugin {
  const dir = resolve(piecesDir);
  // the end-to-end tests run without it, so a machine's own pieces never change what they see
  const ownDir = privateDir === null ? null : resolve(privateDir);
  const levelsFile = resolve(levelsPath);
  let isBuild = false;
  // a production build carries the approved pieces only; a build in mode development (the end-to-end tests' bundle,
  // playwright.config.ts) keeps the drafts, as the dev server does
  let approvedOnly = false;

  const collect = (): { pieces: unknown[]; omittedIds: string[]; diagnostics: Diagnostic[] } => {
    const diagnostics: Diagnostic[] = [];
    const pieces: unknown[] = [];
    const omittedIds: string[] = [];
    if (!existsSync(dir)) return { pieces, omittedIds, diagnostics };
    const { levels, diagnostics: levelProblems } = loadLevelsFile(levelsFile);
    diagnostics.push(...levelProblems);
    for (const folder of listPieceFolders(dir)) {
      const check = checkPieceFolder(dir, folder, levels);
      diagnostics.push(...check.diagnostics);
      if (check.ok && check.compiled?.chart && check.compiled.meta) {
        if (approvedOnly && check.compiled.meta.status !== 'approved') {
          omittedIds.push(check.compiled.meta.id);
          continue;
        }
        pieces.push({ meta: check.compiled.meta, chart: check.compiled.chart, ...(check.difficulty ? { difficulty: shownPoints(check.compiled.meta.difficulty, check.difficulty) } : {}) });
      }
    }
    const taken = new Set(listPieceFolders(dir));
    const free = unlimitedLevels(levels);
    for (const folder of ownDir === null ? [] : listPieceFolders(ownDir)) {
      const check = checkPieceFolder(ownDir!, folder, free);
      const { chart, meta } = check.compiled ?? {};
      if (!chart || !meta || meta.id !== folder) {
        // reported, never failing a build: the private folder is this machine's own
        diagnostics.push(...check.diagnostics.filter((d) => d.severity === 'error').map((d) => ({ ...d, severity: 'warning' as const, file: `${privateDir}/${d.file}` })));
        continue;
      }
      if (taken.has(meta.id)) {
        diagnostics.push({ severity: 'warning', file: `${privateDir}/${folder}`, message: `left out: content/pieces has a piece "${meta.id}" too` });
        continue;
      }
      if (approvedOnly && meta.status !== 'approved') {
        omittedIds.push(meta.id);
        continue;
      }
      pieces.push({ meta, chart, ...(check.difficulty ? { difficulty: shownPoints(meta.difficulty, check.difficulty) } : {}) });
    }
    return { pieces, omittedIds, diagnostics };
  };

  const preview = () => previewHandler({ piecesDir: dir, levelsPath: levelsFile, modelsDirs: [resolve('private/models'), resolve('content/models')] });

  return {
    name: 'pianor-pieces',
    configResolved(config) {
      isBuild = config.command === 'build';
      approvedOnly = isBuild && config.mode !== 'development';
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      const { pieces, omittedIds, diagnostics } = collect();
      for (const d of diagnostics) {
        const text = formatDiagnostic(d);
        if (d.severity === 'error' && isBuild) this.error(text);
        else this.warn(text);
      }
      this.addWatchFile(levelsFile);
      return `export default ${JSON.stringify(pieces)};\nexport const omittedIds = ${JSON.stringify(omittedIds)};`;
    },
    configurePreviewServer(server) {
      // the end-to-end tests play a bundle on the preview server (playwright.config.ts) and test these requests there; a
      // student's own build (start:local) never answers them, so nothing can change a piece's status there
      if (process.env['PIANOR_E2E'] === '1') server.middlewares.use(preview());
    },
    configureServer(server) {
      // The preview tool's two requests (piece list, approve or send back to draft). Dev server only (and the end-to-end
      // tests' preview server, above): a production build has no server to ask.
      server.middlewares.use(preview());
      server.watcher.add([dir, ...(ownDir ? [ownDir] : []), levelsFile]);
      const reload = (file: string) => {
        if (!resolve(file).startsWith(dir) && !(ownDir && resolve(file).startsWith(ownDir)) && resolve(file) !== levelsFile) return;
        const module = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: 'full-reload' });
      };
      for (const event of ['add', 'change', 'unlink'] as const) server.watcher.on(event, reload);
    },
  };
}
