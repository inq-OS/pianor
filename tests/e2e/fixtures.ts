import { expect, test as base } from '@playwright/test';
import { realPageErrors } from './helpers';

/**
 * The end-to-end tests' own `test` (docs/testing.md section 10): every spec imports `test` and `expect` from here, not from
 * Playwright. Each test still gets a fresh browser context and page, so no test can leave state behind for the next one.
 *
 * - Page errors: every test fails on an error the page throws or logs (Chrome's audio-device noise left out), whether or not
 *   it calls `expectNoErrors`. A test that provokes an error on purpose says so with `test.use({ allowPageErrors: true })`.
 */
export interface E2eOptions {
  /** The test provokes page errors on purpose; they do not fail it. */
  allowPageErrors: boolean;
}

interface E2eFixtures {
  /** Collects the page's errors from its first moment and fails the test on any at its end (automatic). */
  pageErrorGuard: void;
}

export const test = base.extend<E2eOptions & E2eFixtures>({
  allowPageErrors: [false, { option: true }],
  pageErrorGuard: [
    async ({ page, allowPageErrors }, use, testInfo) => {
      const seen: string[] = [];
      page.on('pageerror', (e) => seen.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') seen.push(`console: ${m.text()}`);
      });
      await use();
      // a test that already failed keeps its own first error; this only fails one that would have passed
      if (allowPageErrors || testInfo.status !== testInfo.expectedStatus) return;
      const real = realPageErrors(seen);
      expect(real, `the page reported errors:\n${real.join('\n')}`).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
