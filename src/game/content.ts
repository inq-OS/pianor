import pieceFiles, { omittedIds } from 'virtual:pieces';
import type { PieceCatalogueSources } from './pieceCatalogue';

export type { Piece } from './pieceList';

/**
 * The hand-written dev samples, in file name order. Dev server only: a production build never shows them, so it leaves
 * them out; `import.meta.env.DEV` is false there and the dead branch, with its imports, is dropped.
 */
const devModules: Record<string, unknown> = import.meta.env.DEV
  ? import.meta.glob('../../content/dev/charts/*.chart.json', { eager: true, import: 'default' })
  : {};

/** What this build ships: the compiled pieces, the ids of the ones it left out and the dev samples (for `PieceCatalogue`). */
export function bundledPieceSources(): Pick<PieceCatalogueSources, 'files' | 'omittedIds' | 'devCharts'> {
  const devCharts = Object.entries(devModules).sort(([a], [b]) => a.localeCompare(b)).map(([, raw]) => raw);
  return { files: pieceFiles, omittedIds, devCharts };
}
