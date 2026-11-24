import { expect, test as base } from '@playwright/test';
import { realPageErrors } from './helpers';

/**
 * The end-to-end tests' own `test` (docs/testing.md section 10): every spec imports `test` and `expect` from here, not from
 * Playwright. Each test still gets a fresh browser context and page, so no test can leave state behind for the next one.
 *
 * - A failed test prints the game's timeline (`TIMELINE_SCRIPT`): what changed on screen, a few times a second, with the
 *   frame rate, so a failure seen only on CI's slower machines can be read from the job's log.
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

/**
 * Runs in the page from its first moment: four times a second it notes the active scenes and what the room shows (a talk,
 * a tug, the stand, the intro), and keeps each change with the time since the page opened and the frame rate.
 */
const TIMELINE_SCRIPT = `(() => {
  const start = performance.now(), log = [];
  window.__timeline = log;
  let last = '';
  setInterval(() => {
    const g = window.__game;
    if (!g) return;
    const parts = g.scene.getScenes(true).map((s) => {
      const r = [s.scene.key];
      if (s.talkState) r.push('talk:' + (s.talkState.who ?? '?'));
      if (s.tugState) r.push('tug:' + (s.tugState.who ?? '?'));
      if (s.standOpen) r.push('stand');
      if (s.introState) r.push('intro:' + s.introState);
      return r.join(' ');
    });
    const now = parts.join(' | ');
    if (now === last) return;
    last = now;
    log.push(Math.round(performance.now() - start) + 'ms ' + Math.round(g.loop.actualFps) + 'fps ' + now);
    if (log.length > 300) log.shift();
  }, 250);
})();`;

export const test = base.extend<E2eOptions & E2eFixtures>({
  allowPageErrors: [false, { option: true }],
  pageErrorGuard: [
    async ({ page, allowPageErrors }, use, testInfo) => {
      await page.addInitScript(TIMELINE_SCRIPT);
      const seen: string[] = [];
      page.on('pageerror', (e) => seen.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') seen.push(`console: ${m.text()}`);
      });
      await use();
      if (testInfo.status !== testInfo.expectedStatus) {
        const timeline = await page.evaluate(() => (window as unknown as { __timeline?: string[] }).__timeline ?? []).catch(() => []);
        console.log(`game timeline (time since the page opened, frame rate, active scenes):\n${timeline.join('\n')}`);
      }
      // a test that already failed keeps its own first error; this only fails one that would have passed
      if (allowPageErrors || testInfo.status !== testInfo.expectedStatus) return;
      const real = realPageErrors(seen);
      expect(real, `the page reported errors:\n${real.join('\n')}`).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
