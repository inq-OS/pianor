// Covers ft_0_05.AC1, ft_0_09.AC2, ft_0_16.AC5, ft_Y_13.AC3.
import { existsSync } from 'node:fs';
import { type Page, type TestInfo } from '@playwright/test';
import { expect, test } from './fixtures';
import { E2E_FIXED_TIME, LITTLE_STEPS, expectE2EPlayer, expectNoErrors, openGame, openPiece, playWithKeys, toScoreScreen, useOneLine, waitForScene, type PageErrors } from './helpers';

/**
 * Screenshot checks of the screens. One baseline per screen serves every machine (d288, d289): it is made by the
 * "Update screenshot baselines" workflow or a local `--update-snapshots` run, and CI, cloud sessions and a local machine
 * compare against the same file. A test without a baseline skips instead of writing an unreviewed one; a local run with
 * `--update-snapshots` still writes them. Commit new ones for the maintainer to review.
 */
function skipWithoutBaselineOnCi(testInfo: TestInfo, name: string): void {
  const writing = testInfo.config.updateSnapshots === 'all' || testInfo.config.updateSnapshots === 'changed';
  test.skip(!writing && !existsSync(testInfo.snapshotPath(name)), 'no screenshot baseline yet');
}

/**
 * Open the game for a picture: a fixed clock, so no picture shows the day it was made, and the one test player
 * (`E2E_PLAYER`), so no baseline holds another name.
 */
async function openForPicture(page: Page, query?: string): Promise<PageErrors> {
  await page.clock.setFixedTime(E2E_FIXED_TIME);
  const errors = await openGame(page, query);
  await expectE2EPlayer(page);
  return errors;
}

// One size (d105): the laptop's full screen, 1920x1080 at Windows 125% scaling (playwright.config.ts).
test.describe('grand staff', () => {
  test('two hands: treble above bass with a brace, aligned notes and one lit note per hand', async ({ page }, testInfo) => {
    skipWithoutBaselineOnCi(testInfo, 'grand-staff.png');
    const errors = await openForPicture(page, '?device=virtual');
    await openPiece(page, 'Both Hands');
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('grand-staff.png');
    expectNoErrors(errors);
  });
});

test.describe('staff', () => {
  test('the shipped staff font is loaded before the game draws, upright and italic (d288)', async ({ page }) => {
    const errors = await openForPicture(page);
    const faces = await page.evaluate(() => [...document.fonts].filter((f) => f.family.replaceAll('"', '') === 'Pianor Mono').map((f) => `${f.style} ${f.weight} ${f.status}`));
    expect(faces.sort()).toEqual(['italic 700 loaded', 'italic 700 loaded', 'normal 700 loaded', 'normal 700 loaded']);
    expectNoErrors(errors);
  });

  test('practice screen with the staff, clef, time signature and the lit first note', async ({ page }, testInfo) => {
    skipWithoutBaselineOnCi(testInfo, 'practice.png');
    const errors = await openForPicture(page);
    await openPiece(page, 'Little Steps');
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('practice.png');
    expectNoErrors(errors);
  });

  test('the staff fits the screen: nothing is cut off and the size is big enough to read', async ({ page }) => {
    const errors = await openForPicture(page);
    await useOneLine(page);
    await openPiece(page, 'Little Steps');
    const layout = await page.evaluate(() => {
      const scene = window.__game.scene.getScene('practice');
      const l = scene.playSession.staffView.layout;
      return { fits: l.fits, staffSpace: l.staffSpace, width: l.width, height: l.height, notes: l.notes.length };
    });
    expect(layout.fits).toBe(true);
    expect(layout.notes).toBe(11);
    // One line of 2 bars: staff lines at least 28 px apart.
    expect(layout.staffSpace).toBeGreaterThanOrEqual(28);
    expectNoErrors(errors);
  });
});

test.describe('practice screen with the on-screen piano off (ft_Y_12)', () => {
  test('no keys are drawn and the game takes the keyboard\'s height', async ({ page }, testInfo) => {
    skipWithoutBaselineOnCi(testInfo, 'practice-keyboard-hidden.png');
    // the virtual piano is connected, which hides the on-screen piano too; the setting off hides it either way
    const errors = await openForPicture(page);
    await page.evaluate(() => window.__game.registry.get('context').profiles.updateKeyboardSettings({ onScreen: false }));
    await openPiece(page, 'Little Steps');
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('practice-keyboard-hidden.png');
    expectNoErrors(errors);
  });
});

test.describe('menu', () => {
  test('player level and XP, the pieces, stars and locks', async ({ page }, testInfo) => {
    skipWithoutBaselineOnCi(testInfo, 'menu-new-player.png');
    const errors = await openForPicture(page);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('menu-new-player.png');
    expectNoErrors(errors);
  });

  test('ft_Y_13.AC3 the focused button has a gold ring', async ({ page }, testInfo) => {
    skipWithoutBaselineOnCi(testInfo, 'menu-focus.png');
    const errors = await openForPicture(page);
    await page.keyboard.press('ArrowDown');
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('menu-focus.png');
    expectNoErrors(errors);
  });
});

test.describe('settings screen', () => {
  test('lines on the screen and bars on a line, the chosen ones lit', async ({ page }, testInfo) => {
    skipWithoutBaselineOnCi(testInfo, 'settings.png');
    const errors = await openForPicture(page);
    await page.evaluate(() => window.__game.scene.start('settings'));
    await waitForScene(page, 'settings');
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('settings.png');
    expectNoErrors(errors);
  });
});

test.describe('piece editor (preliminary)', () => {
  test('options, a few notes with their names, the preview note under the pointer, and the bottom bar', async ({ page }, testInfo) => {
    skipWithoutBaselineOnCi(testInfo, 'editor.png');
    const errors = await openForPicture(page, '?device=virtual');
    await page.evaluate(() => (window.__game.scene.getScene('menu') as unknown as { scene: { start(key: string, data: unknown): void } }).scene.start('editor', {}));
    await waitForScene(page, 'editor');
    const at = (bar: number, start: number, step: string) => page.evaluate((p) => {
      const scene = window.__game.scene.getScene('editor');
      const point = scene.pointForNote({ hand: 'RH', octave: 4, ...p }) as { x: number; y: number };
      const canvas = document.querySelector('canvas')!;
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + (point.x / canvas.width) * rect.width, y: rect.top + (point.y / canvas.height) * rect.height };
    }, { bar, start, step });
    // C and E quarters, then a G half (each note has the selected length)
    for (const [start, step] of [[0, 'C'], [480, 'E'], [960, 'G']] as const) {
      if (step === 'G') await page.keyboard.press('Digit2');
      const p = await at(0, start, step);
      // the middle button places notes
      await page.mouse.click(p.x, p.y, { button: 'middle' });
    }
    const hover = await at(1, 0, 'A');
    await page.mouse.move(hover.x, hover.y);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('editor.png');
    expectNoErrors(errors);
  });
});

test.describe('results screen', () => {
  test('five stars after a clean run', async ({ page }, testInfo) => {
    skipWithoutBaselineOnCi(testInfo, 'results-five-stars.png');
    const errors = await openForPicture(page);
    await openPiece(page, 'Little Steps');
    await playWithKeys(page, LITTLE_STEPS);
    await toScoreScreen(page);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('results-five-stars.png');
    expectNoErrors(errors);
  });
});

test.describe('tempo mode', () => {
  test('the running line, notes coloured by their timing with their scores, a missed note in red', async ({ page }, testInfo) => {
    skipWithoutBaselineOnCi(testInfo, 'tempo.png');
    const errors = await openForPicture(page, '?device=virtual');
    await page.evaluate(() => window.__game.registry.get('context').profiles.updatePlaySettings({ mode: 'tempo', scoreView: 'number' }));
    await openPiece(page, 'Little Steps');
    // the transport is not started, so the scene does not move the line: set a frozen picture by hand (synthetic timings)
    await page.evaluate(() => {
      const scene = window.__game.scene.getScene('practice');
      const view = scene.playSession.staffView;
      const timing = (errorMs: number, verdict: string, score: number) => ({ errorMs, verdict, score });
      const progress = ['correct', 'correct', 'correct', 'missed', 'correct', ...Array(6).fill('pending')];
      const timings = [timing(0, 'on-time', 100), timing(-90, 'on-time', 83), timing(210, 'late', 52), null, timing(-330, 'early', 13), ...Array(6).fill(null)];
      view.applyTimings(progress, timings, 'number');
      const l = scene.playSession.layout;
      view.setPlayhead({ system: 0, page: 0, x: l.notes[5].x - l.staffSpace * 0.6, y1: l.systems[0].topLineY - l.staffSpace * 1.2, y2: l.systems[0].bottomLineY + l.staffSpace * 1.2 });
    });
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('tempo.png');
    expectNoErrors(errors);
  });
});
