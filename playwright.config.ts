import { existsSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { defineConfig, devices } from '@playwright/test';
import { E2E_AREAS } from './tools/e2e/areas.ts';
import { E2E_GPU, TARGET_VIEW } from './tests/e2e/targetView.ts';

// Claude Code cloud sessions ship one Chromium build in /opt/pw-browsers and cannot download the build this Playwright version
// expects, so it would fail with "Executable doesn't exist". Use that browser when it is there; PW_CHROMIUM_PATH points at any
// other Chromium. Elsewhere (Windows, CI) Playwright uses its own download as before.
const CLOUD_CHROMIUM = '/opt/pw-browsers/chromium';
const CHROMIUM_PATH = process.env.PW_CHROMIUM_PATH || (existsSync(CLOUD_CHROMIUM) ? CLOUD_CHROMIUM : undefined);

// Not the usual dev port, so a running `npm run dev` never gets mixed up with the test server.
// Set PW_PORT to run on another port (e.g. when another worktree holds 5180).
const PORT = Number(process.env.PW_PORT) || 5180;

// Headless Chromium draws WebGL on the CPU (SwiftShader): the game then reaches about 25 fps and every test competes for the
// processor (a full run took 28 minutes). On Windows the real GPU is used through Direct3D 11 (60 fps, about 8 minutes).
// CI runners have no GPU and keep SwiftShader; `E2E_GPU=0` turns it off here too, e.g. to compare a screenshot. Without a GPU
// the tests open the game with `?loop=timer` (tests/e2e/helpers.ts `openGame`), which made a cloud run about twice as fast.
const GPU_ARGS = E2E_GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : [];

export default defineConfig({
  testDir: 'tests/e2e',
  // The target laptop is slow under load: generous limits, so a busy machine is not a failure.
  timeout: 90_000,
  fullyParallel: true,
  // Each test runs a WebGL game with audio; too many at once on a laptop makes them time out, so two with a GPU. Without one
  // each browser's software GPU keeps about one core busy: one browser per core but one (three on a 4-core cloud session,
  // 20.5 to about 16 minutes), never fewer than two and, until more is measured, never more than four.
  workers: E2E_GPU ? 2 : Math.min(4, Math.max(2, availableParallelism() - 1)),
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // The run log (tools/e2e/runLogReporter.ts) writes test-logs/runs/<start>_<areas>/ and test-logs/history.jsonl.
  reporter: [['list'], ...(process.env.CI ? [['html', { open: 'never' }] as const] : []), ['./tools/e2e/runLogReporter.ts']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // The one size (d105): the 1920x1080 full screen at Windows 125% scaling, as Chrome sees it.
    ...TARGET_VIEW,
    trace: 'retain-on-failure',
    launchOptions: {
      ...(CHROMIUM_PATH ? { executablePath: CHROMIUM_PATH } : {}),
      // No hinting and no LCD (coloured) smoothing of letters (d288): the staff font's edges then come out the same on
      // Windows and Linux, so one baseline serves both.
      args: ['--autoplay-policy=no-user-gesture-required', '--font-render-hinting=none', '--disable-lcd-text', ...GPU_ARGS],
    },
  },
  // One baseline per screen for every system (d288): no text asks the computer for a font, and CI and the baseline workflow draw WebGL in
  // software (SwiftShader; a local Windows run with its GPU may differ), so Windows and Linux make the same pixels; the 2 percent tolerance covers what is left.
  // PW_EXPECT_TIMEOUT: the baseline workflow's slow Windows runner, where one screenshot of the software-drawn page takes over 20 s
  expect: { timeout: Number(process.env['PW_EXPECT_TIMEOUT']) || 20_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
  // The baselines were named for the single project `chromium`; keep that name now that every area is a project. No
  // platform in the name (d288): the same file is checked on Windows and on Linux.
  snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}-chromium{ext}',
  // One project per area (tools/e2e/areas.ts): `--project=editor` runs one area, `npm run test:e2e:affected` the changed ones.
  projects: E2E_AREAS.map((area) => ({
    name: area.name,
    testMatch: area.specs.map((spec) => `**/${spec}.spec.ts`),
    use: { ...devices['Desktop Chrome'], ...TARGET_VIEW },
  })),
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Off by default: a server already on the port may be another worktree's code, and the tests would
    // silently run against it. Playwright then fails with "port already used". Set PW_REUSE_SERVER=1 to
    // reuse a server you started yourself on purpose.
    reuseExistingServer: process.env.PW_REUSE_SERVER === '1',
    // the pieces in the machine's gitignored private/pieces/ would change the piece lists the tests see
    env: { PIANOR_NO_PRIVATE_PIECES: '1' },
    // A cold start paints Keri's pictures first (tools/vite-keri.ts): over a minute on a slow machine since the
    // room's set grew (82 s in a cloud session); the painting is cached after that.
    timeout: 180_000,
  },
});
