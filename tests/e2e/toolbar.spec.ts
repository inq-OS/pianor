import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { activeScene, clickToolbar, expectNoErrors, openGame, openSettings, toPieceList, waitForScene } from './helpers';
import { TARGET_VIEW } from './targetView';

/**
 * The frame of every screen (d088): the toolbar at the very top with Back, the player's name, rank and XP, the
 * screen's own items and settings (the on-screen keyboard's switch on the settings screen only, d099); one vine line under it; then the screen. Drawn by every
 * scene, so every screen has it.
 */
// only the teacher's screens keep the toolbar (ft_1_20.AC10); the other screens' frame is in strip.spec.ts
const SCREENS = [
  ['teacher', {}],
] as const;

type Box = { x: number; y: number; width: number; height: number };
/** The toolbar's global buttons and the screen's other buttons, in art pixels of the main area (the toolbar is above 0). */
const frame = (page: Page) =>
  page.evaluate(() => {
    const scene = window.__game.scene.getScenes(true)[0] as unknown as {
      px: { width: number; height: number; scale: number };
      buttons: { rect: Box }[];
      toolbarButtons: { back: { rect: Box } | null; settings: { rect: Box } | null; keys: { rect: Box; active: boolean } | null; items: { rect: Box }[] };
    };
    const t = scene.toolbarButtons;
    const onBar = new Set<unknown>([t.back, t.settings, t.keys, ...t.items]);
    return {
      px: scene.px,
      back: t.back?.rect ?? null,
      settings: t.settings?.rect ?? null,
      keys: t.keys?.rect ?? null,
      lit: (t.keys as unknown as { active: boolean } | null)?.active ?? null,
      bar: [t.back, t.settings, t.keys, ...t.items].filter((b) => b !== null).map((b) => b.rect),
      main: scene.buttons.filter((b) => !onBar.has(b)).map((b) => b.rect),
    };
  });
const pianoShown = (page: Page) => page.evaluate(() => getComputedStyle(document.getElementById('keyboard')!).display !== 'none');
const onScreen = (page: Page) => page.evaluate(() => window.__game.registry.get('context').profiles.keyboardSettings.onScreen as boolean);

test.describe('the toolbar of the teacher\'s screens (d088)', () => {
  test('the teacher\'s screen has the toolbar on top with settings and Back, and its buttons under the vine', async ({ page }) => {
    const errors = await openGame(page);
    // her screens are behind her password (ft_1_26.AC1)
    await page.evaluate(() => window.__game.registry.get('context').teacher.lock.check('pianor'));
    let first: Awaited<ReturnType<typeof frame>> | null = null;
    for (const [key, data] of SCREENS) {
      await page.evaluate(({ k, d }) => {
        const running = window.__game.scene.getScenes(true)[0] as unknown as { scene: { start(key: string, data: unknown): void } };
        running.scene.start(k, d);
      }, { k: key, d: data });
      await waitForScene(page, key);
      const f = await frame(page);
      // the keyboard switch is on the settings screen only (d099)
      expect(f.keys, key).toBeNull();
      // the toolbar is above the main area, inside the screen's width; the screen's own buttons are under it
      for (const r of f.bar) {
        // a button's rect is its top-left corner and its size, in the root's art pixels (the main area starts at y 0)
        expect(r.y + r.height, key).toBeLessThanOrEqual(0);
        expect(r.x, key).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width, key).toBeLessThanOrEqual(f.px.width);
      }
      for (const r of f.main) expect(r.y, key).toBeGreaterThanOrEqual(0);
      // the global items stay where they are from screen to screen
      first ??= f;
      if (f.settings && first.settings) expect(f.settings, key).toEqual(first.settings);
      if (f.back && first.back) expect(f.back, key).toEqual(first.back);
    }
    expectNoErrors(errors);
  });

  test('settings opens from any screen and its Back returns to that screen', async ({ page }) => {
    const errors = await openGame(page);
    await page.evaluate(() => (window.__game.scene.getScenes(true)[0] as unknown as { scene: { start(key: string, data: unknown): void } }).scene.start('results', { chartId: 'little-steps' }));
    await waitForScene(page, 'results');
    await clickToolbar(page, 'settings');
    await waitForScene(page, 'settings');
    expect((await frame(page)).settings).toBeNull(); // no gear on the settings screen itself
    await clickToolbar(page, 'back');
    await waitForScene(page, 'results');
    expect(await activeScene(page)).toBe('results');
    expectNoErrors(errors);
  });

  test('the on-screen keyboard is hidden at first with or without a piano, and only the settings screen has its switch (d099)', async ({ page }) => {
    for (const query of ['', '?device=virtual']) {
      const errors = await openGame(page, query);
      expect(await pianoShown(page), query).toBe(false);
      expect((await frame(page)).keys, query).toBeNull(); // the menu has no switch
      await openSettings(page);
      expect((await frame(page)).keys, query).not.toBeNull();
      expect((await frame(page)).lit, query).toBe(false);
      expectNoErrors(errors);
    }
  });

  test('the settings screen\'s switch shows and hides the keyboard for this visit only, never changing the setting (d099)', async ({ page }) => {
    // no MIDI input: the computer keys play, the on-screen keys are a developer's tool
    const errors = await openGame(page, '');
    await openSettings(page);
    await clickToolbar(page, 'keys');
    await expect.poll(() => pianoShown(page)).toBe(true);
    expect((await frame(page)).lit).toBe(true);
    await clickToolbar(page, 'back');
    await waitForScene(page, 'menu');
    expect(await pianoShown(page)).toBe(true); // the choice lasts on every screen for this visit
    await openSettings(page);
    expect((await frame(page)).lit).toBe(true);
    await clickToolbar(page, 'keys');
    await expect.poll(() => pianoShown(page)).toBe(false);
    expect((await frame(page)).lit).toBe(false);
    await clickToolbar(page, 'keys');
    await expect.poll(() => pianoShown(page)).toBe(true);
    const setting = await onScreen(page);
    await page.reload();
    await openGame(page, '');
    expect(await pianoShown(page)).toBe(false); // a new visit starts hidden again
    expect(await onScreen(page)).toBe(setting);
    expectNoErrors(errors);
  });

  test('`?keys=1` shows the on-screen keyboard from the start, with or without a piano', async ({ page }) => {
    for (const query of ['?keys=1', '?device=virtual&keys=1']) {
      const errors = await openGame(page, query);
      expect(await pianoShown(page), query).toBe(true);
      expectNoErrors(errors);
    }
  });
});

/**
 * The 1920x1080 screen under Windows 125% display scaling (d105): Chrome reports 1536x864 CSS pixels, and the
 * canvas is still drawn one pixel per screen pixel, so the staff stays sharp and every art pixel is a whole number of
 * screen pixels: 6 per layout cell, 3 per fine pixel of the 640 x 360 art canvas (d110).
 */
const size = { ...TARGET_VIEW.viewport, ratio: TARGET_VIEW.deviceScaleFactor, scale: 6 };
test.describe('the 1920x1080 screen at 125% (1536x864 CSS pixels)', () => {

  test(`draws the canvas in screen pixels at ${size.scale}x, and the mouse still hits the buttons`, async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
    const canvas = await page.evaluate(() => {
      const c = document.querySelector('canvas')!;
      const rect = c.getBoundingClientRect();
      return { width: c.width, height: c.height, cssWidth: rect.width, cssHeight: rect.height, ratio: window.devicePixelRatio };
    });
    expect(canvas.ratio).toBe(size.ratio);
    expect(canvas.width).toBe(Math.round(size.width * size.ratio));
    expect(canvas.cssWidth).toBeCloseTo(size.width, 1);
    expect(canvas.height).toBe(Math.round(canvas.cssHeight * size.ratio));
    const f = await frame(page);
    expect(f.px.scale).toBe(size.scale);
    // the art covers the whole canvas, and the vine and the toolbar keep their rows
    expect(f.px.width * f.px.scale).toBeGreaterThanOrEqual(canvas.width);
    const shown = await pianoShown(page);
    await toPieceList(page); // a real click on the player list, then the gear: the switch is on the settings screen (d099)
    await openSettings(page);
    await clickToolbar(page, 'keys');
    await expect.poll(() => pianoShown(page)).toBe(!shown);
    expectNoErrors(errors);
  });
});
