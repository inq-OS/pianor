// Deep static analysis (`npm run analyze`), the slow sibling of `npm run lint`. It loads the TypeScript type checker, so
// it finds what a syntax-only lint cannot: promises nobody waits for, values the compiler only knows as `any`, casts that
// change nothing, string concatenation with `undefined`. About 40 seconds, so it runs in CI and on demand, not in the
// Stop hook. See docs/architecture/static-analysis.md.
import tseslint from 'typescript-eslint';
import base from './eslint.config.js';

const TYPED = ['**/*.ts'];
const TESTS = ['**/*.test.ts', 'tests/**/*.ts'];

export default tseslint.config(
  ...base,
  {
    files: TYPED,
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      // Async mistakes: a promise that is dropped, passed where a plain callback is expected, or awaited when it is not one.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/prefer-promise-reject-errors': 'error',
      '@typescript-eslint/only-throw-error': 'error',
      // Values the type checker cannot see into (`any`, or a type that failed to resolve).
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      // Text built from values that do not print well (`undefined`, `[object Object]`).
      '@typescript-eslint/restrict-plus-operands': 'error',
      '@typescript-eslint/no-base-to-string': 'error',
      // Code that does nothing: casts to the type a value already has, union members that swallow each other.
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-redundant-type-constituents': 'error',
      '@typescript-eslint/no-duplicate-type-constituents': 'error',
      '@typescript-eslint/no-meaningless-void-operator': 'error',
      // A switch over a union must handle every member (or say `default`), so a new event type cannot be missed silently.
      '@typescript-eslint/switch-exhaustiveness-check': ['error', { considerDefaultExhaustiveForUnions: true }],
    },
  },
  {
    // Tests read parsed JSON and poke at fakes on purpose; the `any` rules would only add casts there.
    files: TESTS,
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
);
