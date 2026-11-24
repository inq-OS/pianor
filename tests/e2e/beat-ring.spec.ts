// Covers core_13.AC1, core_13.AC2, core_13.AC5, core_13.AC6, core_13.AC7.
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { clickButton, expectNoErrors, openGame, openPiece, pressPracticeButton as press, sceneButton, waitForScene } from './helpers';

/** The beat ring at the foot of the practice screen: whether it is drawn and shown, and what it shows (core_13 rule 2). */
const ring = (page: Page) => page.evaluate(() => {
  const scene = window.__game.scene.getScene('practice') as unknown as { ringImage: { visible: boolean } | null; ringShows: string };
  return { drawn: scene.ringImage !== null, visible: scene.ringImage?.visible ?? false, shows: scene.ringShows ? JSON.parse(scene.ringShows) as { lit: number | null; hand: number | null; mark: { side: string } | null } : null };
});
const running = (page: Page) => page.evaluate(() => window.__game.registry.get('context').audio.metronome.running as boolean);

/** Kiur's Learn in the room, then the piece: its learning run on the practice screen. */
async function learnPiece(page: Page, title: string): Promise<void> {
  await page.evaluate(() => {
    window.__game.scene.stop('menu');
    window.__game.scene.start('profile');
  });
  await waitForScene(page, 'profile');
  await expect.poll(() => sceneButton(page, 'profile', 'Kiur')).toBeGreaterThanOrEqual(0);
  await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Kiur'));
  await expect.poll(() => sceneButton(page, 'profile', 'Learn')).toBeGreaterThanOrEqual(0);
  await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Learn'));
  await waitForScene(page, 'menu');
  await openPiece(page, title);
}

/** Press keys of the virtual EZ-220 one at a time, `gapMs` apart. */
async function keysApart(page: Page, midis: number[], gapMs: number): Promise<void> {
  for (const [i, midi] of midis.entries()) {
    if (i > 0) await page.waitForTimeout(gapMs);
    await page.evaluate((m) => { window.__virtualDevice!.press(m, 80); window.__virtualDevice!.release(m); }, midi);
  }
}

test.describe('the beat ring (core_13)', () => {
  test('core_13.AC1 core_13.AC7 the ring on the sheet lights each click while the click runs, right of every note, and goes when it stops', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    expect((await ring(page)).drawn).toBe(false);
    await press(page, 'Click');
    await expect.poll(async () => (await ring(page)).visible).toBe(true);
    // on the parchment, in the room the staff left at its right: no note under it
    const place = await page.evaluate(() => {
      const scene = window.__game.scene.getScene('practice') as unknown as { ringImage: { x: number; y: number; displayWidth: number }; playSession: { layout: { notes: { x: number }[] }; staffView: { origin: { x: number; y: number } } }; staffOrigin: number; scale: { height: number } };
      const notesRight = Math.max(...scene.playSession.layout.notes.map((n) => n.x)) + scene.playSession.staffView.origin.x;
      return { left: scene.ringImage.x, top: scene.ringImage.y, size: scene.ringImage.displayWidth, notesRight, staffTop: scene.staffOrigin, height: scene.scale.height };
    });
    expect(place.left).toBeGreaterThan(place.notesRight);
    expect(place.top).toBeGreaterThan(place.staffTop);
    expect(place.size).toBeGreaterThan(place.height / 10); // as large as the notes, not a strip icon
    // the lit dot goes round with the clicks
    const lit = new Set<number>();
    await expect.poll(async () => {
      const shows = (await ring(page)).shows;
      if (shows?.lit !== null && shows?.lit !== undefined) lit.add(shows.lit);
      return lit.size;
    }, { timeout: 8000 }).toBeGreaterThanOrEqual(2);
    await press(page, 'Click');
    await expect.poll(async () => (await ring(page)).drawn).toBe(false);
    expectNoErrors(errors);
  });

  test('core_13.AC5 core_13.AC6 in a learning run the ring follows the student\'s own pace and marks each key; the click at that pace only when turned on', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual&learn=1');
    await learnPiece(page, 'Little Steps');
    // before a key: nothing to show
    expect(await ring(page)).toMatchObject({ drawn: true, visible: false });
    await keysApart(page, [60, 62, 64], 400);
    // three keys: a pace of the student's own, the hand sweeping on from the last key, its mark held against that pace
    await expect.poll(async () => (await ring(page)).shows?.mark?.side ?? null).not.toBeNull();
    expect((await ring(page)).visible).toBe(true);
    expect(await running(page)).toBe(false); // no click while learning unless turned on (ft_1_32 rule 8)
    expectNoErrors(errors);
  });

  test('core_13.AC6 turned on, a learning run clicks at the student\'s pace once three keys are played', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual&learn=1');
    await page.evaluate(() => window.__game.registry.get('context').profiles.updateLearnSettings({ paceClick: true }));
    await learnPiece(page, 'Little Steps');
    await keysApart(page, [60, 62], 400);
    expect(await running(page)).toBe(false); // no pace yet
    await keysApart(page, [64], 0);
    await expect.poll(() => running(page)).toBe(true);
    expectNoErrors(errors);
  });

  test('core_13.AC2 turned off in the settings, the ring is not drawn', async ({ page }) => {
    const errors = await openGame(page);
    await page.evaluate(() => window.__game.registry.get('context').profiles.updateLearnSettings({ beatRing: false }));
    await openPiece(page, 'Little Steps');
    await press(page, 'Click');
    await expect.poll(() => running(page)).toBe(true);
    expect((await ring(page)).drawn).toBe(false);
    expectNoErrors(errors);
  });
});
