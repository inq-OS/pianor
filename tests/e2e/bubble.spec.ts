import { expect, test, type Page } from '@playwright/test';
import { activeScene, bubbleOpen, buttonPoint, clickButton, expectNoErrors, lastButton, openBubble, openGame, pressInBubble, sceneButton, waitForScene } from './helpers';

/**
 * The bubble and the strip in place of the band (ft_1_20, d282) on practice and the piece maker: the strip holds the most
 * used actions and More, the bubble the rest; a right click, More or Shift + F10 opens it, and closing it hits nothing under it.
 */
const startScene = (page: Page, key: string, data: object = {}) =>
  page.evaluate(({ k, d }) => (window.__game.scene.getScenes(true)[0] as unknown as { scene: { start(key: string, data: unknown): void } }).scene.start(k, d), { k: key, d: data });

/** The canvas point of art cell (x, y) of scene `key`'s main area. */
const artPoint = (page: Page, key: string, x: number, y: number) =>
  page.evaluate(({ k, ax, ay }) => {
    const s = window.__game.scene.getScene(k) as unknown as { root: { x: number; y: number }; px: { scale: number } };
    const canvas = document.querySelector('canvas')!;
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + ((s.root.x + ax * s.px.scale) / canvas.width) * rect.width, y: rect.top + ((s.root.y + ay * s.px.scale) / canvas.height) * rect.height };
  }, { k: key, ax: x, ay: y });

const practice = (page: Page) =>
  page.evaluate(() => {
    const s = window.__game.scene.getScene('practice') as unknown as { hints: { noteNames: boolean; fingers: boolean }; mainRows: number; px: { width: number }; playSession: { staffView: { origin: { y: number } } }; buttons: unknown[]; startedFrom?: number };
    return { names: s.hints.noteNames, fingers: s.hints.fingers, rows: s.mainRows };
  });

const stripLabels = (page: Page, key: string) =>
  page.evaluate((k) => (window.__game.scene.getScene(k) as unknown as { toolbarButtons: { items: { options: { label: string } }[] } }).toolbarButtons.items.map((b) => b.options.label), key);

test.describe('the bubble and the strip (ft_1_20, d282)', () => {
  test('ft_1_20.AC22 practice draws no band: the strip holds Listen to faster and More, the staff every row above it, and the bubble the rest', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'practice', { chartId: 'little-steps' });
    await waitForScene(page, 'practice');
    // the strip is 17 rows: 163 of the 180 rows are the screen's
    expect((await practice(page)).rows).toBe(163);
    expect(await stripLabels(page, 'practice')).toEqual(['Listen', 'Start again', 'Wait', '-', '100%', '+']);
    expect(await lastButton(page, 'practice', 'Note names')).toBe(-1);
    // a right click on the staff opens the bubble round the pointer
    const staff = await artPoint(page, 'practice', 160, 80);
    await page.mouse.click(staff.x, staff.y, { button: 'right' });
    await expect.poll(() => bubbleOpen(page, 'practice')).toBe(true);
    // a worn option switches and leaves the bubble open, so several can be set in a row
    await clickButton(page, 'practice', await sceneButton(page, 'practice', 'Note names'));
    await expect.poll(async () => (await practice(page)).names).toBe(true);
    expect(await bubbleOpen(page, 'practice')).toBe(true);
    await clickButton(page, 'practice', await sceneButton(page, 'practice', 'Fingers'));
    await expect.poll(async () => (await practice(page)).fingers).toBe(true);
    // Esc closes it; the worn options that are on stand lit in the strip right of More
    await page.keyboard.press('Escape');
    await expect.poll(() => bubbleOpen(page, 'practice')).toBe(false);
    expect(await activeScene(page)).toBe('practice');
    // the strip keeps its cells; the two that are on stand as small lit pictures beside More
    expect(await stripLabels(page, 'practice')).toEqual(['Listen', 'Start again', 'Wait', '-', '100%', '+']);
    expect(await lastButton(page, 'practice', 'Fingers')).toBeGreaterThanOrEqual(0);
    // a press on a lit one beside More turns it off
    await clickButton(page, 'practice', await lastButton(page, 'practice', 'Note names'));
    await expect.poll(async () => (await practice(page)).names).toBe(false);
    expectNoErrors(errors);
  });

  test('ft_1_20.AC22 More opens the bubble, the press that closes it hits nothing under it, and a piano key closes it and still counts', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'practice', { chartId: 'little-steps' });
    await waitForScene(page, 'practice');
    const from = () => page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { markers: Map<number, number> }).markers.size);
    const before = await from();
    await openBubble(page, 'practice');
    // a press on the staff only closes the bubble: no bar is tapped to start from
    const staff = await artPoint(page, 'practice', 200, 60);
    await page.mouse.click(staff.x, staff.y);
    await expect.poll(() => bubbleOpen(page, 'practice')).toBe(false);
    expect(await from()).toBe(before);
    // a piano key closes it and is played: the judge hears the first note (C4 in Little Steps)
    await openBubble(page, 'practice');
    const judged = () => page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { playSession: { controller: { getState(): { stepIndex: number } } } }).playSession.controller.getState().stepIndex);
    const at = await judged();
    await page.evaluate(() => {
      const d = window.__virtualDevice!;
      d.press(60, 80);
      d.release(60);
    });
    await expect.poll(() => bubbleOpen(page, 'practice')).toBe(false);
    await expect.poll(judged).toBeGreaterThan(at);
    expectNoErrors(errors);
  });

  test('ft_1_20.AC22 Shift + F10 opens the bubble at the focus, the arrows walk its slots and Enter picks', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'practice', { chartId: 'little-steps' });
    await waitForScene(page, 'practice');
    await page.keyboard.press('Shift+F10');
    await expect.poll(() => bubbleOpen(page, 'practice')).toBe(true);
    const focused = () => page.evaluate(() => {
      const s = window.__game.scene.getScene('practice') as unknown as { focusedButton?: { options: { label: string } } };
      return s.focusedButton?.options.label ?? null;
    });
    // the first slot is the section; clockwise from it the click (slot 1, the ramp, shows only while a section plays)
    expect(await focused()).toBe('Section');
    await page.keyboard.press('ArrowRight');
    expect(await focused()).toBe('Click');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    expect(await focused()).toBe('Fingers');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await practice(page)).fingers).toBe(true);
    await page.keyboard.press('Escape');
    await expect.poll(() => bubbleOpen(page, 'practice')).toBe(false);
    expect(await activeScene(page)).toBe('practice');
    expectNoErrors(errors);
  });

  test('ft_1_20.AC22 the piece maker draws no band: the strip holds Listen to the writer and More, and a right click on a note selects it and opens what can be done with it', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'editor', {});
    await waitForScene(page, 'editor');
    expect(await stripLabels(page, 'editor')).toEqual(['Listen', 'Try it', 'Undo', 'Redo', 'Notes']);
    const notes = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { history: { present: { notes: { finger?: number }[] } } }).history.present.notes);
    await page.evaluate(() => {
      const d = window.__virtualDevice!;
      d.press(60, 80);
      d.release(60);
    });
    await expect.poll(async () => (await notes()).length).toBe(1);
    // the note's head on the screen
    const head = await page.evaluate(() => {
      const s = window.__game.scene.getScene('editor') as unknown as { layout: { notes: { x: number; y: number }[] }; staffLeft: number; staffTop: number };
      const n = s.layout.notes[0]!;
      const canvas = document.querySelector('canvas')!;
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + ((s.staffLeft + n.x) / canvas.width) * rect.width, y: rect.top + ((s.staffTop + n.y) / canvas.height) * rect.height };
    });
    await page.mouse.click(head.x, head.y, { button: 'right' });
    await expect.poll(() => bubbleOpen(page, 'editor')).toBe(true);
    // the right click removes nothing itself and selects the note
    expect((await notes()).length).toBe(1);
    expect(await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { selected: object | null }).selected !== null)).toBe(true);
    // fingers: its choices open in a row beside the ring, a pick sets the finger and closes the bubble
    await clickButton(page, 'editor', await sceneButton(page, 'editor', 'Fingers'));
    await expect.poll(() => sceneButton(page, 'editor', '3')).toBeGreaterThanOrEqual(0);
    await clickButton(page, 'editor', await sceneButton(page, 'editor', '3'));
    await expect.poll(async () => (await notes())[0]!.finger).toBe(3);
    expect(await bubbleOpen(page, 'editor')).toBe(false);
    // delete is in the bubble now, and Undo in the strip brings the note back
    await pressInBubble(page, 'editor', 'Delete');
    await expect.poll(async () => (await notes()).length).toBe(0);
    await clickButton(page, 'editor', await sceneButton(page, 'editor', 'Undo'));
    await expect.poll(async () => (await notes()).length).toBe(1);
    expect(await activeScene(page)).toBe('editor');
    expectNoErrors(errors);
  });

  test('ft_1_20.AC19 the bubble stays whole on the screen when opened near a corner', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'practice', { chartId: 'little-steps' });
    await waitForScene(page, 'practice');
    const corner = await artPoint(page, 'practice', 2, 160);
    await page.mouse.click(corner.x, corner.y, { button: 'right' });
    await expect.poll(() => bubbleOpen(page, 'practice')).toBe(true);
    const inside = await page.evaluate(() => {
      const s = window.__game.scene.getScene('practice') as unknown as { menu: { buttons: { rect: { x: number; y: number; width: number; height: number } }[] }; px: { width: number }; mainRows: number };
      return s.menu.buttons.every((b) => b.rect.x >= 0 && b.rect.y >= 0 && b.rect.x + b.rect.width <= s.px.width && b.rect.y + b.rect.height <= s.mainRows + 17);
    });
    expect(inside).toBe(true);
    const point = await buttonPoint(page, 'practice', await sceneButton(page, 'practice', 'Close'));
    await page.mouse.click(point.x, point.y);
    await expect.poll(() => bubbleOpen(page, 'practice')).toBe(false);
    expectNoErrors(errors);
  });
});

test.describe('the two-finger tap on a touch screen (ft_1_20.AC25)', () => {
  test.use({ hasTouch: true });

  /** Two fingers land on the page (the second `gapMs` after the first) and, unless `slide`, lift where they landed. */
  async function twoFingers(page: Page, a: { x: number; y: number }, b: { x: number; y: number }, options: { slide?: number } = {}): Promise<void> {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', points: { x: number; y: number; id: number }[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    await touch('touchStart', [{ ...a, id: 0 }]);
    await touch('touchStart', [{ ...a, id: 0 }, { ...b, id: 1 }]);
    await page.waitForTimeout(100);
    if (options.slide) {
      await touch('touchMove', [{ x: a.x - options.slide, y: a.y, id: 0 }, { x: b.x + options.slide, y: b.y, id: 1 }]);
      await page.waitForTimeout(100);
    }
    await touch('touchEnd', []);
    await page.waitForTimeout(100);
  }

  test('ft_1_20.AC25 two fingers tapped together on the staff open the bubble at once, midway between them, and their lift picks nothing', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'practice', { chartId: 'little-steps' });
    await waitForScene(page, 'practice');
    const hints = () => practice(page).then((p) => ({ names: p.names, fingers: p.fingers }));
    const before = await hints();
    await twoFingers(page, await artPoint(page, 'practice', 140, 80), await artPoint(page, 'practice', 180, 80));
    await expect.poll(() => bubbleOpen(page, 'practice')).toBe(true);
    // the bubble's centre is midway between the fingers (clamped only to stay whole on the screen)
    const centre = await page.evaluate(() => {
      const s = window.__game.scene.getScene('practice') as unknown as { menu: { buttons: { options: { label: string }; rect: { x: number; y: number; width: number; height: number } }[] } };
      const close = s.menu.buttons.find((b) => b.options.label === 'Close')!.rect;
      return { x: close.x + close.width / 2, y: close.y + close.height / 2 };
    });
    expect(Math.abs(centre.x - 160)).toBeLessThanOrEqual(1);
    expect(Math.abs(centre.y - 80)).toBeLessThanOrEqual(1);
    expect(await hints()).toEqual(before);
    expectNoErrors(errors);
  });

  test('ft_1_20.AC25 two fingers that slide apart are a pinch: the bubble closes again', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'practice', { chartId: 'little-steps' });
    await waitForScene(page, 'practice');
    await twoFingers(page, await artPoint(page, 'practice', 140, 80), await artPoint(page, 'practice', 180, 80), { slide: 60 });
    await expect.poll(() => bubbleOpen(page, 'practice')).toBe(false);
    expect(await activeScene(page)).toBe('practice');
    expectNoErrors(errors);
  });
});
