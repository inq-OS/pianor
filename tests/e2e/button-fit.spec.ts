import { expect, test, type Page } from '@playwright/test';
import { expectNoErrors, openGame, waitForScene } from './helpers';

/**
 * Every button's label stays inside its frame: the letters may not reach the outline or the light and dark lines
 * inside it, on any screen, on the laptop's full screen (1920x1080 at Windows 125% scaling, d105).
 * `PixelButton.labelFit` measures what is drawn.
 */

async function overflowing(page: Page, key: string): Promise<string[]> {
  return page.evaluate((k) => {
    const buttons = window.__game.scene.getScene(k).buttons as { labelFit(): { label: string; overflow: number } }[];
    return buttons.map((b) => b.labelFit()).filter((f) => f.overflow > 0).map((f) => `${k}: "${f.label}" by ${f.overflow} px`);
  }, key);
}

/** Texts in the pixel font that run past the bottom or the right edge of the screen. */
async function offScreen(page: Page, key: string): Promise<string[]> {
  return page.evaluate((k) => {
    const scene = window.__game.scene.getScene(k) as unknown as { px: { width: number; height: number; scale: number }; scale: { height: number }; root: { list: { pixelText?: boolean; visible: boolean; text: string; x: number; y: number; width: number; height: number }[] } };
    // the band (ft_1_20) lies under the main area: the screen runs on to the canvas's foot
    const bottom = Math.floor(scene.scale.height / scene.px.scale);
    return scene.root.list
      // a picture button keeps its name as a hidden label: only what is drawn counts
      .filter((o) => o.pixelText === true && o.visible && o.text !== '' && (o.y + o.height > bottom || o.x + o.width > scene.px.width))
      .map((o) => `${k}: "${o.text}" runs off the screen`);
  }, key);
}

async function show(page: Page, key: string, data: object = {}): Promise<string[]> {
  await page.evaluate(({ k, d }) => {
    const running = window.__game.scene.getScenes(true)[0] as unknown as { scene: { start(key: string, data: unknown): void } };
    running.scene.start(k, d);
  }, { k: key, d: data });
  await waitForScene(page, key);
  return [...(await overflowing(page, key)), ...(await offScreen(page, key))];
}

/** The one piece list (ft_1_12), with its New piece card, and the same list as the main menu's piece maker. */
async function menuModes(page: Page): Promise<string[]> {
  const found: string[] = [];
  for (const maker of [false, true]) {
    await page.evaluate((m) => {
      const game = window.__game as unknown as { registry: { set(k: string, v: unknown): void }; scene: { getScene(k: string): { scene: { restart(): void } } } };
      game.registry.set('maker', m);
      game.scene.getScene('menu').scene.restart();
    }, maker);
    await waitForScene(page, 'menu');
    found.push(...(await overflowing(page, 'menu')));
  }
  await page.evaluate(() => (window.__game as unknown as { registry: { set(k: string, v: unknown): void } }).registry.set('maker', false));
  return found;
}

test.describe('button labels on the laptop full screen (d105)', () => {

  test('every label fits inside its button on the menu, settings, pieces, credits, main menu, room, and editor screens', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    const found = [...(await menuModes(page))];
    for (const key of ['settings', 'pieces', 'credits', 'profiles', 'profile']) found.push(...(await show(page, key)));
    found.push(...(await show(page, 'editor')));
    expect(found).toEqual([]);
    expectNoErrors(errors);
  });

  test('every label fits inside its button on the practice screen: Wait and Tempo mode, a section, Free play', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    const found = [...(await show(page, 'practice', { chartId: 'little-steps' }))];
    found.push(...(await show(page, 'practice', { chartId: 'little-steps', section: { first: 0, last: 1 } })));
    found.push(...(await show(page, 'practice', { chartId: 'little-steps', freePlay: true })));
    await page.evaluate(() => window.__game.registry.get('context').profiles.updatePlaySettings({ mode: 'tempo', scoreView: 'number' }));
    found.push(...(await show(page, 'practice', { chartId: 'little-steps' })));
    expect(found).toEqual([]);
    expectNoErrors(errors);
  });

  test('every label fits inside its button on the practice screen in Estonian, Free play included', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'et');
    const found = [...(await show(page, 'practice', { chartId: 'little-steps' }))];
    found.push(...(await show(page, 'practice', { chartId: 'little-steps', freePlay: true })));
    expect(found).toEqual([]);
    expectNoErrors(errors);
  });
});

/** Drawn texts whose letters (their letter boxes) overlap another text, or run onto a button they are not the label of. */
async function overlapping(page: Page, key: string): Promise<string[]> {
  return page.evaluate((k) => {
    type Text = { pixelText?: boolean; visible: boolean; text: string; x: number; y: number; scaleX: number; scaleY: number; letterBox: { left: number; top: number; right: number; bottom: number } };
    type Box = { left: number; top: number; right: number; bottom: number };
    const scene = window.__game.scene.getScene(k) as unknown as { root: { list: Text[] }; buttons: { objects: unknown[]; box: { x: number; y: number; width: number; height: number } }[] };
    const hit = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const own = new Set(scene.buttons.flatMap((b) => b.objects));
    const texts = scene.root.list
      .filter((o) => o.pixelText === true && o.visible && o.text !== '')
      .map((o) => ({ text: o.text, free: !own.has(o), box: { left: o.x + o.letterBox.left * o.scaleX, top: o.y + o.letterBox.top * o.scaleY, right: o.x + o.letterBox.right * o.scaleX, bottom: o.y + o.letterBox.bottom * o.scaleY } }));
    const found: string[] = [];
    texts.forEach((a, i) => texts.slice(i + 1).forEach((b) => {
      if (hit(a.box, b.box)) found.push(`${k}: "${a.text}" overlaps "${b.text}"`);
    }));
    for (const text of texts.filter((t) => t.free)) {
      for (const { box } of scene.buttons) if (hit(text.box, { left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height })) found.push(`${k}: "${text.text}" runs onto a button`);
    }
    return found;
  }, key);
}

test.describe('labels in Estonian', () => {
  test('ft_0_18.AC6 the Estonian labels fit on the stats (score screen), knoll and settings screens too, with no play saved yet', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'et');
    const found: string[] = [];
    found.push(...(await show(page, 'results', { chartId: 'little-steps' })));
    found.push(...(await overlapping(page, 'results')));
    found.push(...(await show(page, 'knoll')));
    found.push(...(await show(page, 'settings')));
    expect(found).toEqual([]);
    expectNoErrors(errors);
  });

  test('ft_0_18.AC6 no two labels overlap on the note trainer and the pieces screen, where the title and the wrapped hint ran into the lines under them (d086)', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'et');
    const found: string[] = [];
    for (const key of ['noteTrainer', 'pieces']) {
      found.push(...(await show(page, key)));
      found.push(...(await overlapping(page, key)));
    }
    expect(found).toEqual([]);
    expectNoErrors(errors);
  });
});
