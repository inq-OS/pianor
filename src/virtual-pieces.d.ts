/**
 * Provided by `tools/vite-pieces.ts`: every piece in content/pieces/ that compiles and passes the linter. A production
 * build leaves the drafts out of the default list and gives their ids in `omittedIds`.
 */
declare module 'virtual:pieces' {
  // An ambient module cannot `import` a relative path (TypeScript resolves it to an error type, which turns every field
  // into `any`), so the types come in through `import()` type queries.
  type Chart = import('./core/chart').Chart;
  type PieceMeta = import('./core/chart').PieceMeta;
  /** `difficulty` is in points 0 to 100 (d157): from the meta file's confirmed half stars, else the estimator's proposal (core_08). */
  const pieces: { meta: PieceMeta; chart: Chart; difficulty?: number }[];
  /** Ids of the pieces this build left out (the drafts, in a production build). */
  export const omittedIds: string[];
  export default pieces;
}
