// The boundaries here are tested in tools/lint/boundaries.test.ts.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const domGlobals = [
  'window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'indexedDB',
  'AudioContext', 'OfflineAudioContext', 'MIDIAccess', 'MIDIInput', 'MIDIOutput',
  'MIDIMessageEvent', 'HTMLElement', 'requestAnimationFrame', 'performance',
].map((name) => ({ name, message: 'src/core must stay pure: no DOM, Web MIDI or Web Audio. Use an io interface.' }));

// `private/` is the maintainer's own local-only code (gitignored): it may use code under licences the project itself cannot
// (GPL and the like). Nothing that is committed or built may import it, so the repository and the game stay MIT.
const PRIVATE = { group: ['**/private/**', '**/private'], message: 'Nothing outside private/ may import private/ (it is local-only and gitignored).' };

export default tseslint.config(
  { ignores: ['dist/**', 'release/**', 'build/**', 'node_modules/**', 'coverage/**', 'private/**', '.claude/worktrees/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // `.then(ok, failed)` only catches a rejection of the original promise, not an error thrown inside `ok`.
      'no-restricted-syntax': ['error', {
        selector: "CallExpression[callee.property.name='then'][arguments.length=2]",
        message: 'Use .then(ok).catch(failed): the two-argument form misses an error thrown inside ok.',
      }],
    },
  },
  {
    // Size limits that flag only the outliers: cyclomatic complexity (the number of paths through a function, as a C
    // metrics tool reports it) and nesting depth. The few functions above them are listed in docs/architecture/static-analysis.md.
    files: ['src/**/*.ts', 'tools/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: { complexity: ['error', 30], 'max-depth': ['error', 5] },
  },
  {
    // Boundary: committed code never imports the private code. (Later blocks that restrict imports repeat this entry.)
    files: ['**/*.ts', '**/*.js'],
    rules: { 'no-restricted-imports': ['error', { patterns: [PRIVATE] }] },
  },
  {
    // Boundary: core is pure TypeScript (ft_0_08.AC3: the judge imports no UI or io code).
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...domGlobals],
      'no-restricted-imports': ['error', {
        patterns: [
          PRIVATE,
          { group: ['phaser', 'phaser/*'], message: 'src/core must not import Phaser.' },
          { group: ['**/io/**', '**/game/**', '**/tools/**'], message: 'src/core must not import io, game or tools.' },
          { regex: String.raw`^(\.\./)+(dev|spike)(/|$)`, message: 'src/core must not import the dev pages or the spike page.' },
          { group: ['node:*', 'fs', 'path'], message: 'src/core is pure: no Node APIs. File access belongs in tools/ (the piece CLIs) or src/io.' },
          { regex: String.raw`^(\.\./)+(appConfig|config|compose|profileSetup|main)$`, message: 'src/core gets its settings as arguments, never from the composition root (src/*.ts).' },
        ],
      }],
    },
  },
  {
    // Seam: the generators take a level and a seed and return ABC text, checked by the piece compiler and linter (src/core/piece,
    // which the core block above keeps free of Node APIs). They stay free of Node APIs too (only the CLI touches the file system),
    // so a page in the browser can reuse them later.
    files: ['tools/generate/model.ts', 'tools/generate/theory.ts', 'tools/generate/abcWriter.ts', 'tools/generate/similarity.ts', 'tools/generate/generators.ts', 'tools/generate/index.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [PRIVATE, { group: ['node:*', 'fs', 'path'], message: 'Keep the generators pure (level and seed in, ABC out); put file access in the CLI.' }],
      }],
    },
  },
  {
    // Boundary: the hardware spike page (ft_0_01) is standalone: raw Web MIDI and Web Audio, the simulated keyboard, no game code.
    files: ['src/spike/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          PRIVATE,
          { group: ['phaser', 'phaser/*', '**/game/**', '**/core/**'], message: 'The spike page tests the hardware on its own: no game code.' },
        ],
      }],
    },
  },
  {
    // Boundary: game depends on io interfaces only, never on implementations, and reads the page address only through
    // the composition root (src/config.ts builds the flags, GameContext carries them).
    files: ['src/game/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', { name: 'location', message: 'Only src/config.ts reads the page address; scenes get the flags from GameContext.' }],
      'no-restricted-properties': ['error', { object: 'window', property: 'location', message: 'Only src/config.ts reads the page address; scenes get the flags from GameContext.' }],
      'no-restricted-imports': ['error', {
        patterns: [
          PRIVATE,
          { group: ['**/io/midi/**', '**/io/audio/**', '**/io/storage/**', '**/io/mock/**', '**/io/files/**'], message: 'src/game may import io interfaces only, not implementations.' },
          { regex: String.raw`^(\.\./)+(dev|spike)(/|$)`, message: 'src/game must not import the dev pages or the spike page: they build on the game, not the other way.' },
          { regex: String.raw`^(\.\./)+(appConfig|config|compose|profileSetup|main)$`, message: 'src/game gets page settings and pieces from GameContext, never from the composition root (src/*.ts).' },
        ],
      }],
    },
  },
  {
    // Boundary: io wraps hardware and browser APIs behind interfaces; it knows nothing of the scenes, the dev pages or Phaser.
    files: ['src/io/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          PRIVATE,
          { group: ['phaser', 'phaser/*'], message: 'src/io must not import Phaser.' },
          { regex: String.raw`^(\.\./)+(game|dev|spike|tools)(/|$)`, message: 'src/io must not import game, dev, spike or tools: put what both need in src/core or in an io interface.' },
          { regex: String.raw`^(\.\./)+(appConfig|compose|profileSetup|main)$`, message: 'src/io gets its settings as arguments from the composition root, never by importing it.' },
        ],
      }],
    },
  },
);
