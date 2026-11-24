// Covers core_13.AC1, core_13.AC2, core_13.AC5, core_13.AC6, core_13.AC7.
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { clickButton, expectNoErrors, openGame, openPiece, pressPracticeButton as press, sceneButton, waitForScene } from './helpers';

/** The beat lane on the staff (core_13 rule 2): its dots on the page, how many the wave lifts now, how many keys are coloured. */
const lane = (page: Page) => page.evaluate(() => {
  const scene = window.__game.scene.getScene('practice') as unknown as { playSession: { staffView: { laneShown(): { dots: number; lifted: number; coloured: number } } | null } };
  return scene.playSession.staffView?.laneShown() ?? { dots: 0, lifted: 0, coloured: 0 };
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

test.describe('the beat lane (core_13)', () => {
  test('core_13.AC1 core_13.AC7 a row of dots runs above a one-hand staff, clear of the notes, and a wave runs along it while the click runs', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    expect((await lane(page)).dots).toBeGreaterThan(16);
    expect((await lane(page)).lifted).toBe(0); // Wait mode with no click: no wave
    const place = await page.evaluate(() => {
      const scene = window.__game.scene.getScene('practice') as unknown as { playSession: { layout: { notes: { y: number; headRy: number; system: number }[]; systems: { topLineY: number }[] } } };
      const layout = scene.playSession.layout;
      return { top: layout.systems[0]!.topLineY, highest: Math.min(...layout.notes.filter((n) => n.system === 0).map((n) => n.y - n.headRy)) };
    });
    expect(place.highest).toBeGreaterThan(place.top - 1); // the piece's notes sit on the staff: the lane above is clear of them
    await press(page, 'Click');
    await expect.poll(() => running(page)).toBe(true);
    await keysApart(page, [60], 0);
    await expect.poll(async () => (await lane(page)).lifted, { timeout: 4000 }).toBeGreaterThan(0);
    expectNoErrors(errors);
  });

  test('core_13.AC5 core_13.AC6 in a learning run the wave follows the student\'s own pace and each key keeps a colour; the click at that pace only when turned on', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual&learn=1');
    await learnPiece(page, 'Little Steps');
    expect(await lane(page)).toMatchObject({ lifted: 0, coloured: 0 });
    await keysApart(page, [60, 62, 64], 400);
    // three keys: a pace of the student's own, the wave running on from the last key, the keys coloured against that pace
    await expect.poll(async () => (await lane(page)).coloured).toBeGreaterThan(0);
    await expect.poll(async () => (await lane(page)).lifted).toBeGreaterThan(0);
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

  test('core_13.AC2 turned off in the settings, the lane is not drawn', async ({ page }) => {
    const errors = await openGame(page);
    await page.evaluate(() => window.__game.registry.get('context').profiles.updateLearnSettings({ beatLane: 'off' }));
    await openPiece(page, 'Little Steps');
    await press(page, 'Click');
    await expect.poll(() => running(page)).toBe(true);
    expect((await lane(page)).dots).toBe(0);
    expectNoErrors(errors);
  });
});
