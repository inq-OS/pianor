import { configDefaults, defineConfig } from 'vitest/config';
import { piecesPlugin } from './tools/vite-pieces.ts';
import { keriPlugin } from './tools/vite-keri.ts';
import { photoPlugin } from './tools/vite-photo.ts';

export default defineConfig({
  // `virtual:pieces` gives the game every compiled and linted piece from content/pieces/; `virtual:keri-pictures` the painted
  // warden's room (with the private portrait where this machine has one, d107) and the painted map of Keri (d111).
  // PIANOR_NO_PRIVATE_PIECES: the end-to-end tests' server leaves out the machine's private pieces (playwright.config.ts)
  plugins: [piecesPlugin(undefined, undefined, process.env['PIANOR_NO_PRIVATE_PIECES'] ? null : 'private/pieces'), keriPlugin(), photoPlugin()],
  // The dev server never serves the gitignored private folder (the private list, private pieces, photos); the plugins read it
  // in Node. Vite's own defaults are kept beside it.
  server: { fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/private/**'] } },
  // Two pages: the game, and the hardware spike page (ft_0_01) so it can be hosted and opened on the target device too.
  build: {
    rolldownOptions: {
      input: { main: 'index.html', spike: 'spike.html' },
      // Phaser (about 1.3 MB, four fifths of the game's code) changes only with a dependency update: in its own chunk it stays
      // in the browser cache when only the game's code changes (docs/architecture/performance.md).
      output: { codeSplitting: { groups: [{ name: 'phaser', test: /node_modules[\\/]phaser[\\/]/ }] } },
    },
    // Phaser's chunk alone is over the 500 kB default: the warning is set just above it, so it still fires when the game's
    // own code or a new dependency grows a chunk past that size.
    chunkSizeWarningLimit: 1400,
  },
  test: {
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    // Unit tests read the English text (ft_0_18): the Estonian default is set by the game, not by the tests.
    setupFiles: ['tools/test/englishText.ts'],
    // The CLI tests start whole programs: on a busy machine five seconds is too tight.
    testTimeout: 30_000,
    // `npm run test:changed` runs only the tests that import a changed file. Many tests read content/ from disk instead of
    // importing it, so a change there (or to the lock file, Vitest's default) runs them all.
    forceRerunTriggers: [...configDefaults.forceRerunTriggers, '**/package-lock.json', '**/content/**'],
    // Warns at the end when the working tree changed during the run (a pull or a checkout): a failure may then come from a mix of two revisions.
    globalSetup: ['tools/test/treeGuard.ts'],
    coverage: {
      provider: 'v8',
      // Coverage gates apply to src/core, src/io and tools/ (docs/testing.md section 5), not to Phaser scene code.
      // src/io is tested through the browser fakes (src/io/mock, fake MIDIAccess and AudioContext). The CLI entry points
      // only read arguments and call tested functions.
      include: ['src/core/**/*.ts', 'src/io/**/*.ts', 'tools/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts', 'tools/piece/build.ts', 'tools/piece/lint.ts', 'tools/generate/cli.ts', 'tools/docs/cli.ts', 'tools/docs/touched-cli.ts', 'tools/docs/privacy-cli.ts', 'tools/docs/merge-driver-cli.ts', 'tools/docs/privacy-ci.ts', 'tools/ci/code-changed-cli.ts', 'tools/vite-pieces.ts', 'tools/vite-keri.ts', 'tools/vite-keri-worker.ts',
        'tools/e2e/affected-cli.ts', 'tools/e2e/runLogReporter.ts', 'tools/start-local/cli.ts', 'tools/art/render-cli.ts', 'tools/art/check-cli.ts', 'tools/art/pictures.ts', 'tools/board/cli.ts', 'tools/board/human-cli.ts', 'tools/analysis/train-cli.ts', 'tools/analysis/fit-grades-cli.ts', 'tools/analysis/calibrate-cli.ts', 'tools/import/photo-cli.ts', 'tools/import/audiveris.ts', 'tools/import/piece-cli.ts'],
      reporter: ['text', 'html'],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
});
