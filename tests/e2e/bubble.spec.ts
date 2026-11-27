import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
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
    // the first slot is the section; clockwise from it the beat dots (core_13 rule 10), then the click
    expect(await focused()).toBe('Section');
    await page.keyboard.press('ArrowRight');
    expect(await focused()).toBe('Beat dots');
    await page.keyboard.press('ArrowRight');
    expect(await focused()).toBe('Click');
    await page.keyboard.press('ArrowLeft');
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
    // fingers: its choices open on the outer ring, a pick sets the finger and closes the bubble
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

  /** Whether practice was started over (the space-bar reset), and the label of the focused button. */
  const restarted = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { startData: { reset?: boolean } }).startData.reset === true);
  const focusedLabel = (page: Page, key = 'practice') => page.evaluate((k) => (window.__game.scene.getScene(k) as unknown as { focusedButton?: { options: { label: string } } }).focusedButton?.options.label ?? null, key);

  test('ft_1_20.AC19 a right click on a button opens the bubble and never presses the button under it', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'practice', { chartId: 'little-steps' });
    await waitForScene(page, 'practice');
    const listening = () => page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { listening: boolean }).listening);
    for (const label of ['Back', 'Listen']) {
      const point = await buttonPoint(page, 'practice', await sceneButton(page, 'practice', label));
      await page.mouse.click(point.x, point.y, { button: 'right' });
      await page.waitForTimeout(200);
      expect(await activeScene(page), label).toBe('practice');
      expect(await listening(), label).toBe(false);
      if (await bubbleOpen(page, 'practice')) await page.keyboard.press('Escape');
      await page.mouse.click(point.x, point.y, { button: 'middle' });
      await page.waitForTimeout(200);
      expect(await activeScene(page), label).toBe('practice');
      expect(await listening(), label).toBe(false);
    }
    expectNoErrors(errors);
  });

  test('ft_1_20.AC19 a right click or a middle click on an option of the open bubble picks nothing', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'practice', { chartId: 'little-steps' });
    await waitForScene(page, 'practice');
    await openBubble(page, 'practice');
    const point = await buttonPoint(page, 'practice', await lastButton(page, 'practice', 'Note names'));
    await page.mouse.click(point.x, point.y, { button: 'right' });
    await page.mouse.click(point.x, point.y, { button: 'middle' });
    await page.waitForTimeout(200);
    expect((await practice(page)).names).toBe(false);
    expectNoErrors(errors);
  });

  test('ft_1_20.AC22 a press that slides off one option of the bubble onto another picks neither', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'practice', { chartId: 'little-steps' });
    await waitForScene(page, 'practice');
    await openBubble(page, 'practice');
    const from = await buttonPoint(page, 'practice', await lastButton(page, 'practice', 'Fingers'));
    const to = await buttonPoint(page, 'practice', await lastButton(page, 'practice', 'Note names'));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    const p = await practice(page);
    expect({ names: p.names, fingers: p.fingers }).toEqual({ names: false, fingers: false });
    expectNoErrors(errors);
  });

  test('ft_1_20.AC22 Space on a focused option of the bubble picks it and does not start the piece over', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'practice', { chartId: 'little-steps' });
    await waitForScene(page, 'practice');
    await page.keyboard.press('Shift+F10');
    await expect.poll(() => bubbleOpen(page, 'practice')).toBe(true);
    await page.keyboard.press('ArrowLeft');
    expect(await focusedLabel(page)).toBe('Fingers');
    await page.keyboard.press('Space');
    await expect.poll(async () => (await practice(page)).fingers).toBe(true);
    expect(await restarted(page)).toBe(false);
    expectNoErrors(errors);
  });

  test('ft_Y_13 closing a bubble opened from the keyboard gives the focus back to what had it, or to nothing', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'practice', { chartId: 'little-steps' });
    await waitForScene(page, 'practice');
    // nothing had the focus: none after Esc
    await page.keyboard.press('Shift+F10');
    await expect.poll(() => bubbleOpen(page, 'practice')).toBe(true);
    await page.keyboard.press('Escape');
    await expect.poll(() => bubbleOpen(page, 'practice')).toBe(false);
    expect(await focusedLabel(page)).toBeNull();
    // a worn option switched with Enter, then Esc: still none
    await page.keyboard.press('Shift+F10');
    await page.keyboard.press('ArrowLeft');
    expect(await focusedLabel(page)).toBe('Fingers');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await practice(page)).fingers).toBe(true);
    await expect.poll(() => bubbleOpen(page, 'practice')).toBe(true);
    await page.keyboard.press('Escape');
    await expect.poll(() => bubbleOpen(page, 'practice')).toBe(false);
    expect(await focusedLabel(page)).toBeNull();
    expectNoErrors(errors);
  });

  test('ft_1_20.AC19 the open bubble stays open when the window changes size, still whole on the screen', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'practice', { chartId: 'little-steps' });
    await waitForScene(page, 'practice');
    const staff = await artPoint(page, 'practice', 300, 80);
    await page.mouse.click(staff.x, staff.y, { button: 'right' });
    await expect.poll(() => bubbleOpen(page, 'practice')).toBe(true);
    const size = page.viewportSize()!;
    await page.setViewportSize({ width: size.width - 200, height: size.height - 100 });
    await page.waitForTimeout(300);
    expect(await bubbleOpen(page, 'practice')).toBe(true);
    const inside = await page.evaluate(() => {
      const s = window.__game.scene.getScene('practice') as unknown as { menu: { buttons: { rect: { x: number; y: number; width: number; height: number } }[] }; px: { width: number }; mainRows: number };
      return s.menu.buttons.every((b) => b.rect.x >= 0 && b.rect.y >= 0 && b.rect.x + b.rect.width <= s.px.width && b.rect.y + b.rect.height <= s.mainRows + 17);
    });
    expect(inside).toBe(true);
    await page.keyboard.press('Escape');
    await expect.poll(() => bubbleOpen(page, 'practice')).toBe(false);
    expectNoErrors(errors);
  });

  /** Whether any button of `key` shows its pressed look. */
  const anyDown = (page: Page, key = 'practice') => page.evaluate((k) => (window.__game.scene.getScene(k) as unknown as { buttons: { down: boolean; options: { label: string } }[] }).buttons.filter((b) => b.down).map((b) => b.options.label), key);
  const isDown = (page: Page, label: string) => page.evaluate((l) => (window.__game.scene.getScene('practice') as unknown as { buttons: { down: boolean; options: { label: string } }[] }).buttons.find((b) => b.options.label === l)?.down ?? null, label);

  test('ft_1_20.AC22 a press that slides off a button loses its pressed look, gets it back on coming back, and a release off it fires nothing', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'practice', { chartId: 'little-steps' });
    await waitForScene(page, 'practice');
    const listen = await buttonPoint(page, 'practice', await sceneButton(page, 'practice', 'Listen'));
    const staff = await artPoint(page, 'practice', 200, 60);
    await page.mouse.move(listen.x, listen.y);
    await page.mouse.down();
    await expect.poll(() => isDown(page, 'Listen')).toBe(true);
    await page.mouse.move(staff.x, staff.y, { steps: 4 });
    await expect.poll(() => isDown(page, 'Listen')).toBe(false);
    await page.mouse.move(listen.x, listen.y, { steps: 4 });
    await expect.poll(() => isDown(page, 'Listen')).toBe(true);
    await page.mouse.move(staff.x, staff.y, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { listening: boolean }).listening)).toBe(false);
    expect(await anyDown(page)).toEqual([]);
    expectNoErrors(errors);
  });

  test('ft_1_20.AC19 a right click on the strip, a strip cell or the door opens the bubble whole on the screen, and never the browser\'s own menu', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'practice', { chartId: 'little-steps' });
    await waitForScene(page, 'practice');
    await page.evaluate(() => {
      const w = window as unknown as { browserMenus: number };
      w.browserMenus = 0;
      window.addEventListener('contextmenu', (e) => { if (!e.defaultPrevented) w.browserMenus += 1; });
    });
    const rows = (await practice(page)).rows;
    const places = [
      { name: 'the strip between its cells', at: await artPoint(page, 'practice', 300, rows + 8) },
      { name: 'a strip cell', at: await buttonPoint(page, 'practice', await sceneButton(page, 'practice', 'Listen')) },
      { name: 'the door', at: await buttonPoint(page, 'practice', await sceneButton(page, 'practice', 'Back')) },
    ];
    for (const { name, at } of places) {
      await page.mouse.click(at.x, at.y, { button: 'right' });
      await expect.poll(() => bubbleOpen(page, 'practice'), name).toBe(true);
      const inside = await page.evaluate(() => {
        const s = window.__game.scene.getScene('practice') as unknown as { menu: { buttons: { rect: { x: number; y: number; width: number; height: number } }[] }; px: { width: number }; mainRows: number };
        return s.menu.buttons.every((b) => b.rect.x >= 0 && b.rect.y >= 0 && b.rect.x + b.rect.width <= s.px.width && b.rect.y + b.rect.height <= s.mainRows + 17);
      });
      expect(inside, name).toBe(true);
      expect(await activeScene(page), name).toBe('practice');
      await page.keyboard.press('Escape');
      await expect.poll(() => bubbleOpen(page, 'practice'), name).toBe(false);
    }
    expect(await page.evaluate(() => (window as unknown as { browserMenus: number }).browserMenus)).toBe(0);
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
  async function twoFingers(page: Page, a: { x: number; y: number }, b: { x: number; y: number }, options: { slide?: number; slideOne?: boolean } = {}): Promise<void> {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', points: { x: number; y: number; id: number }[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    await touch('touchStart', [{ ...a, id: 0 }]);
    await touch('touchStart', [{ ...a, id: 0 }, { ...b, id: 1 }]);
    await page.waitForTimeout(100);
    if (options.slide) {
      await touch('touchMove', [{ x: options.slideOne ? a.x : a.x - options.slide, y: a.y, id: 0 }, { x: b.x + options.slide, y: b.y, id: 1 }]);
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

  /** Where practice starts the play from: a tap on a bar restarts it with a section from that bar. */
  const section = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { startData: { section?: { first: number } } }).startData.section?.first ?? null);

  test('ft_1_20.AC25 a finger tap outside the bubble only closes it: it never starts the play from the bar under it', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'practice', { chartId: 'little-steps' });
    await waitForScene(page, 'practice');
    await twoFingers(page, await artPoint(page, 'practice', 100, 80), await artPoint(page, 'practice', 120, 80));
    await expect.poll(() => bubbleOpen(page, 'practice')).toBe(true);
    const away = await artPoint(page, 'practice', 250, 80);
    await page.touchscreen.tap(away.x, away.y);
    await expect.poll(() => bubbleOpen(page, 'practice')).toBe(false);
    await page.waitForTimeout(300);
    expect(await section(page)).toBeNull();
    expectNoErrors(errors);
  });

  test('ft_1_20.AC25 a pinch of one finger closes the bubble, and the lift of the other finger starts nothing', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'practice', { chartId: 'little-steps' });
    await waitForScene(page, 'practice');
    await twoFingers(page, await artPoint(page, 'practice', 200, 80), await artPoint(page, 'practice', 240, 80), { slide: 60, slideOne: true });
    await expect.poll(() => bubbleOpen(page, 'practice')).toBe(false);
    await page.waitForTimeout(300);
    expect(await section(page)).toBeNull();
    expectNoErrors(errors);
  });

  test('ft_1_20.AC22 a long press on a bar opens the bubble, and the lift of that finger picks nothing nor starts from the bar', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'practice', { chartId: 'little-steps' });
    await waitForScene(page, 'practice');
    const bar = await artPoint(page, 'practice', 230, 60);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...bar, id: 0 }] });
    await page.waitForTimeout(800);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(300);
    expect(await bubbleOpen(page, 'practice')).toBe(true);
    expect(await section(page)).toBeNull();
    expectNoErrors(errors);
  });

  test('ft_1_20.AC22 after a long press opened the bubble and the finger lifted, the next tap picks an option and no button stays pressed', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'practice', { chartId: 'little-steps' });
    await waitForScene(page, 'practice');
    const bar = await artPoint(page, 'practice', 230, 60);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...bar, id: 0 }] });
    await page.waitForTimeout(800);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => bubbleOpen(page, 'practice')).toBe(true);
    const pressed = () => page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { buttons: { down: boolean; options: { label: string } }[] }).buttons.filter((b) => b.down).map((b) => b.options.label));
    expect(await pressed()).toEqual([]);
    const names = await buttonPoint(page, 'practice', await lastButton(page, 'practice', 'Note names'));
    await page.touchscreen.tap(names.x, names.y);
    await expect.poll(async () => (await practice(page)).names).toBe(true);
    await page.waitForTimeout(200);
    expect(await pressed()).toEqual([]);
    expect(await section(page)).toBeNull();
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

test.describe('the bubble\'s pages (ft_1_20 rule 2)', () => {
  test('ft_1_20.AC27 a bubble closed on its second page opens again on its first, from a right click as from More', async ({ page }) => {
    const errors = await openGame(page);
    await startScene(page, 'beat-lanes', {});
    await waitForScene(page, 'beat-lanes');
    // the beat dots' page: a lane's bubble has two pages (its place first, the wave's width on the second)
    const lane = await page.evaluate(() => {
      const s = window.__game.scene.getScene('beat-lanes') as unknown as { laneYs(): number[] };
      const canvas = document.querySelector('canvas')!;
      const rect = canvas.getBoundingClientRect();
      const y = s.laneYs()[0];
      return y === undefined ? null : { x: rect.left + rect.width / 2, y: rect.top + (y / canvas.height) * rect.height };
    });
    expect(lane).not.toBeNull();
    const rightClick = async () => {
      await page.mouse.click(lane!.x, lane!.y, { button: 'right' });
      await expect.poll(() => bubbleOpen(page, 'beat-lanes')).toBe(true);
    };
    await rightClick();
    await expect.poll(() => lastButton(page, 'beat-lanes', 'Where the row runs')).toBeGreaterThanOrEqual(0);
    await clickButton(page, 'beat-lanes', await lastButton(page, 'beat-lanes', 'More'));
    await expect.poll(() => lastButton(page, 'beat-lanes', 'How wide the wave is')).toBeGreaterThanOrEqual(0);
    await page.keyboard.press('Escape');
    await expect.poll(() => bubbleOpen(page, 'beat-lanes')).toBe(false);
    // opened anew, the first option is in its slot again
    await rightClick();
    await expect.poll(() => lastButton(page, 'beat-lanes', 'Where the row runs')).toBeGreaterThanOrEqual(0);
    expect(await lastButton(page, 'beat-lanes', 'How wide the wave is')).toBe(-1);
    await clickButton(page, 'beat-lanes', await lastButton(page, 'beat-lanes', 'More'));
    await expect.poll(() => lastButton(page, 'beat-lanes', 'How wide the wave is')).toBeGreaterThanOrEqual(0);
    await page.keyboard.press('Escape');
    await expect.poll(() => bubbleOpen(page, 'beat-lanes')).toBe(false);
    await openBubble(page, 'beat-lanes');
    await expect.poll(() => lastButton(page, 'beat-lanes', 'The dotted line')).toBeGreaterThanOrEqual(0);
    expect(await lastButton(page, 'beat-lanes', 'How wide the wave is')).toBe(-1);
    expectNoErrors(errors);
  });
});
