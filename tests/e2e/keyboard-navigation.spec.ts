// Covers ft_Y_13.AC2, ft_Y_13.AC3, ft_Y_13.AC5.
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { activeScenes, clickButton, expectNoErrors, openAdminPage, openGame, profileButton, sceneButton, sceneTexts, showMenuPageWith, waitForScene } from './helpers';

/** The index of the button of a scene that shows the focus ring, or -1. */
const focused = (page: Page, scene: string) =>
  page.evaluate((key) => (window.__game.scene.getScene(key).focusables() as { focused: boolean }[]).findIndex((b) => b.focused), scene);

const labelOf = (page: Page, scene: string, index: number) =>
  page.evaluate(
    ([key, i]) => (window.__game.scene.getScene(key).focusables()[i] as { objects: { text?: string }[] }).objects.find((o) => o.text !== undefined)?.text ?? '',
    [scene, index] as const,
  );

/** Press arrow keys until the focused button of the scene has this label; false after a few tries. */
async function tryFocusByKeys(page: Page, scene: string, label: string, keys = ['ArrowDown', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft']): Promise<boolean> {
  for (const key of keys) {
    for (let step = 0; step < 8; step++) {
      const index = await focused(page, scene);
      if (index >= 0 && (await labelOf(page, scene, index)) === label) return true;
      await page.keyboard.press(key);
    }
  }
  return false;
}

/**
 * Walk the focus to the button with this label with arrow keys, as a player would: each press goes the way the target
 * lies (the farther axis first, the other when a press does not move the ring). Needs no fixed path, so it survives a
 * change of layout. False when the label is not on the screen or the ring cannot get there.
 */
async function walkFocusTo(page: Page, scene: string, label: string): Promise<boolean> {
  const where = () => page.evaluate(([key, text]) => {
    const list = window.__game.scene.getScene(key).focusables() as { focused: boolean; rect: { x: number; y: number; width: number; height: number }; objects: { text?: string }[] }[];
    const labelOf = (b: (typeof list)[number]) => b.objects.find((o) => o.text !== undefined)?.text ?? '';
    const centre = (b: (typeof list)[number]) => ({ x: b.rect.x + b.rect.width / 2, y: b.rect.y + b.rect.height / 2 });
    const target = list.find((b) => labelOf(b) === text);
    const at = list.findIndex((b) => b.focused);
    if (!target || at < 0) return null;
    const from = centre(list[at]!), to = centre(target);
    return { done: list[at] === target, at, dx: to.x - from.x, dy: to.y - from.y };
  }, [scene, label] as const);
  // a button already passed through is a loop (up from one card's button lands on the same button of the card above,
  // down comes back): then the other direction is taken
  const seen = new Set<number>();
  for (let step = 0; step < 40; step++) {
    const now = await where();
    if (now === null) return false;
    if (now.done) return true;
    seen.add(now.at);
    const vertical = now.dy > 0 ? 'ArrowDown' : 'ArrowUp';
    const horizontal = now.dx > 0 ? 'ArrowRight' : 'ArrowLeft';
    const [first, second] = Math.abs(now.dy) >= Math.abs(now.dx) ? [vertical, horizontal] : [horizontal, vertical];
    await page.keyboard.press(Math.abs(first === vertical ? now.dy : now.dx) > 2 ? first : second);
    const after = await where();
    if (after !== null && (after.at === now.at || seen.has(after.at))) await page.keyboard.press(second);
  }
  return false;
}

/** Press arrow keys until the focused button of the scene has this label; gives up after a few tries. */
async function focusByKeys(page: Page, scene: string, label: string, keys?: string[]): Promise<void> {
  if (!(await tryFocusByKeys(page, scene, label, keys))) throw new Error(`could not focus "${label}" with the arrow keys`);
}

test.describe('keyboard navigation', () => {
  test('ft_Y_13.AC2 ft_Y_13.AC3 from the menu a piece is chosen and the practice screen opened and left with keys only @smoke', async ({ page }) => {
    const errors = await openGame(page);
    expect(await focused(page, 'menu')).toBe(-1); // no ring for a mouse user
    await page.keyboard.press('ArrowDown'); // the first key only shows the focus
    expect(await focused(page, 'menu')).toBeGreaterThanOrEqual(0);

    // across the cards towards Little Steps until it has the ring; its place moves whenever a piece is added or sorted differently, and
    // it may be on a later page: then Next, with the keys too
    for (let turn = 0; !(await walkFocusTo(page, 'menu', 'Little Steps')); turn++) {
      expect(turn, 'Little Steps is on one of the first pages').toBeLessThan(5);
      expect(await walkFocusTo(page, 'menu', 'Next'), 'Next is reached with the arrow keys').toBe(true);
      await page.keyboard.press('Enter');
    }
    const at = await focused(page, 'menu');
    expect(await labelOf(page, 'menu', at)).toBe('Little Steps');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'practice');
    expect(await page.evaluate(() => window.__game.scene.getScene('practice').chart.id)).toBe('little-steps');

    await page.keyboard.press('Escape');
    await waitForScene(page, 'menu');
    expectNoErrors(errors);
  });

  test('ft_Y_13.AC2 Space presses the focused button and Escape goes back from the credits', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
    await focusByKeys(page, 'profiles', 'Settings', ['ArrowRight', 'ArrowDown']); // the gear, the last on the sheet: Credits is the first choice under it
    await page.keyboard.press(' ');
    await focusByKeys(page, 'profiles', 'Credits', ['ArrowUp', 'ArrowDown']);
    await page.keyboard.press(' ');
    await waitForScene(page, 'credits');
    await page.keyboard.press('Escape');
    await waitForScene(page, 'profiles');
    expectNoErrors(errors);
  });

  test('ft_Y_13.AC2 Escape leaves the name box while its field has the focus, and the arrows show the focus there', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
    await clickButton(page, 'profiles', await profileButton(page, 'New player'));
    await waitForScene(page, 'name');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('name-field');
    await page.keyboard.press('ArrowDown');
    expect(await focused(page, 'name')).toBeGreaterThanOrEqual(0);
    await page.keyboard.press('Escape');
    await waitForScene(page, 'profiles');
    expectNoErrors(errors);
  });

  test('ft_Y_13.AC2 Escape goes back from the admin pages to the admin hub', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
    await openAdminPage(page);
    await clickButton(page, 'admin', await sceneButton(page, 'admin', 'Pages'));
    await waitForScene(page, 'adminPages');
    await page.keyboard.press('Escape');
    await waitForScene(page, 'admin');
    expectNoErrors(errors);
  });

  test('ft_Y_13.AC2 with a piece info card open the keys reach only its Close button, and Escape closes it', async ({ page }) => {
    const errors = await openGame(page);
    await showMenuPageWith(page, 'Au Clair de la Lune');
    const open = () => page.evaluate(() => window.__game.scene.getScene('menu').infoButtons.get('au-clair-de-la-lune').press());
    await open();
    expect(await sceneTexts(page, 'menu')).toContain('How hard: Beginner');

    await page.keyboard.press('ArrowDown'); // shows the focus
    await page.keyboard.press('ArrowDown'); // nothing else to reach behind the card
    await page.keyboard.press('Enter'); // presses Close, never a piece behind the card
    await expect.poll(async () => (await sceneTexts(page, 'menu')).includes('How hard: Beginner')).toBe(false);
    expect(await activeScenes(page)).toEqual(['menu']);

    await open();
    expect(await sceneTexts(page, 'menu')).toContain('How hard: Beginner');
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await sceneTexts(page, 'menu')).includes('How hard: Beginner')).toBe(false);
    expect(await activeScenes(page)).toEqual(['menu']);
    expectNoErrors(errors);
  });

  test('ft_Y_13.AC5 in the book the wheel moves along the pieces, Ctrl + wheel and Page Down / Page Up turn the pages', async ({ page }) => {
    const errors = await openGame(page);
    /** The book's page, and which piece on it has the ring (-1 for none). */
    const where = () => page.evaluate(() => {
      const menu = window.__game.scene.getScene('menu') as unknown as { page: number; pieceButtons: { focused: boolean }[] };
      return { page: menu.page, piece: menu.pieceButtons.findIndex((b) => b.focused), count: menu.pieceButtons.length };
    });
    const middle = await page.evaluate(() => {
      const r = document.querySelector('canvas')!.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.move(middle.x, middle.y);
    expect(await where()).toMatchObject({ page: 0, piece: -1 });
    await page.mouse.wheel(0, 100); // the first notch shows the ring on the first piece
    await expect.poll(where).toMatchObject({ page: 0, piece: 0 });
    await page.mouse.wheel(0, 100);
    await expect.poll(where).toMatchObject({ page: 0, piece: 1 });
    await page.mouse.wheel(0, -100);
    await expect.poll(where).toMatchObject({ page: 0, piece: 0 });
    await page.mouse.wheel(0, -100); // the first piece of the book stays
    await expect.poll(where).toMatchObject({ page: 0, piece: 0 });
    await page.mouse.wheel(0, 100);

    // Ctrl + wheel turns the page and keeps the place on it
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, 100);
    await page.keyboard.up('Control');
    await expect.poll(where).toMatchObject({ page: 1, piece: 1 });
    expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1.25); // the browser did not zoom

    // up from the first piece of a page goes to the last one of the page before
    await page.mouse.wheel(0, -100);
    await page.mouse.wheel(0, -100);
    const before = await where();
    expect(before.page).toBe(0);
    expect(before.piece).toBe(before.count - 1);

    await page.keyboard.press('PageDown');
    await expect.poll(async () => (await where()).page).toBe(1);
    await page.keyboard.press('PageUp');
    await expect.poll(async () => (await where()).page).toBe(0);
    expectNoErrors(errors);
  });
});
