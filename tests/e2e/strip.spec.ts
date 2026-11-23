import { expect, test, type Page } from '@playwright/test';
import { activeScene, buttonPoint, clickButton, clickToolbar, expectNoErrors, openGame, reachButton, waitForScene } from './helpers';

/**
 * The frame with no toolbar (ft_1_20, d282): every screen but the teacher's pins its actions in one slim strip at its foot,
 * with no text on it, or has no strip when it pins nothing (the room, the map, the scenes, which have the backpack). Back (the
 * door) and Settings (the gear) stay in the top corners where the toolbar had them, faded until the pointer is on them. The
 * player is in the room: the name on the shield, the shield opens the player's card.
 */
/** Each screen and the rows its strip takes: none in the room (it pins nothing), 17 elsewhere. */
const SCREENS = [
  // not the main menu: it paints every row itself, with its own board of plates (ft_1_07)
  ['profile', {}, 0],
  ['menu', {}, 17],
  ['settings', {}, 17],
  // practice and the piece maker add the bubble (bubble.spec.ts)
  ['noteTrainer', {}, 17],
] as const;

type Box = { x: number; y: number; width: number; height: number };

const startScene = (page: Page, key: string, data: object = {}) =>
  page.evaluate(({ k, d }) => (window.__game.scene.getScenes(true)[0] as unknown as { scene: { start(key: string, data: unknown): void } }).scene.start(k, d), { k: key, d: data });

/** The frame as the scene drew it: the main area, Back and Settings, the strip's cells and every button, and the texts drawn on the strip. */
const frame = (page: Page) =>
  page.evaluate(() => {
    const scene = window.__game.scene.getScenes(true)[0] as unknown as {
      px: { width: number; height: number };
      mainRows: number;
      buttons: { rect: Box; press(): void; objects: unknown[] }[];
      toolbarButtons: { back: { rect: Box } | null; settings: { rect: Box } | null; items: { rect: Box }[] };
      root: { list: { pixelText?: boolean; text: string; y: number; visible: boolean }[] };
    };
    return {
      px: scene.px,
      rows: scene.mainRows,
      back: scene.toolbarButtons.back?.rect ?? null,
      settings: scene.toolbarButtons.settings?.rect ?? null,
      items: scene.toolbarButtons.items.map((b) => b.rect),
      all: scene.buttons.map((b) => b.rect),
      stripTexts: scene.root.list.filter((o) => o.pixelText === true && o.visible && o.text !== '' && o.y >= scene.mainRows && !scene.buttons.some((btn) => btn.objects.includes(o))).map((o) => o.text),
    };
  });

const gearAlpha = (page: Page) =>
  page.evaluate(() => (window.__game.scene.getScene('menu') as unknown as { toolbarButtons: { settings: { objects: { alpha: number }[] } } }).toolbarButtons.settings.objects[0]!.alpha);

test.describe('the frame with no toolbar (ft_1_20, d282)', () => {
  test('ft_1_20.AC9 ft_1_20.AC2 every screen has its strip at its foot or none, Back and Settings in the same top corners and nothing above the main area', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    let first: Awaited<ReturnType<typeof frame>> | null = null;
    for (const [key, data, strip] of SCREENS) {
      await startScene(page, key, data);
      await waitForScene(page, key);
      const f = await frame(page);
      // the main area is every row above the strip: 163 on the target screen, 180 with nothing pinned
      expect(f.rows, key).toBe(180 - strip);
      for (const r of f.all) expect(r.y, key).toBeGreaterThanOrEqual(0);
      // no text on the strip: only the words on its buttons, which are not loose texts
      expect(f.stripTexts, key).toEqual([]);
      for (const r of f.items) expect(r.y, key).toBeGreaterThanOrEqual(f.rows);
      if (strip === 0) expect(f.items, key).toEqual([]);
      // the door and the gear where the toolbar had them: the top corners
      for (const r of [f.back, f.settings].filter((b): b is Box => b !== null)) expect(r.y + r.height, key).toBeLessThanOrEqual(20);
      if (f.back) expect(f.back.x, key).toBe(4);
      if (f.settings) expect(f.settings.x + f.settings.width, key).toBe(f.px.width - 4);
      if (key !== 'settings') expect(f.settings, key).not.toBeNull();
      first ??= f;
      if (f.settings && first.settings) expect(f.settings, key).toEqual(first.settings);
      if (f.back && first.back) expect(f.back, key).toEqual(first.back);
      if (f.back && f.settings) {
        expect(f.back.y, key).toBe(f.settings.y);
      }
    }
    expectNoErrors(errors);
  });

  test('ft_1_20.AC3 the gear is clear while the pointer is on it and faded once it leaves, with its name in a bubble', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'menu');
    await waitForScene(page, 'menu');
    expect(await gearAlpha(page)).toBeLessThan(1);
    const index = await page.evaluate(() => {
      const scene = window.__game.scene.getScene('menu') as unknown as { buttons: unknown[]; toolbarButtons: { settings: unknown } };
      return scene.buttons.indexOf(scene.toolbarButtons.settings);
    });
    const point = await buttonPoint(page, 'menu', index);
    await page.mouse.move(point.x, point.y);
    await expect.poll(() => gearAlpha(page)).toBe(1);
    await expect.poll(() => page.evaluate(() => (window.__game.scene.getScene('menu') as unknown as { toolbarButtons: { settings: { tooltipShown: string | null } } }).toolbarButtons.settings.tooltipShown)).toBe('Settings');
    const canvas = (await page.locator('canvas').boundingBox())!;
    await page.mouse.move(canvas.x + 5, canvas.y + 300);
    await expect.poll(() => gearAlpha(page)).toBeLessThan(1);
    expectNoErrors(errors);
  });

  test('ft_1_20.AC13 in the room the name is on the shield, and the shield opens the player\'s card, which Esc closes', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'profile');
    await waitForScene(page, 'profile');
    const texts = () => page.evaluate(() => (window.__game.scene.getScene('profile') as unknown as { root: { list: { pixelText?: boolean; text: string }[] } }).root.list.filter((o) => o.pixelText === true).map((o) => o.text));
    // the name is written into the shield (part of the shield, not a separate bubble): a picture on its grid, no loose text
    expect(await texts()).not.toContain('TUVI');
    expect(await page.evaluate(() => (window.__game.scene.getScene('profile') as unknown as { root: { list: { name: string }[] } }).root.list.some((o) => o.name === 'shieldName'))).toBe(true);
    const shield = await page.evaluate(() => {
      const scene = window.__game.scene.getScene('profile') as unknown as { buttons: { label?: unknown; labelFit(): { label: string } }[] };
      return scene.buttons.findIndex((b) => b.labelFit().label === 'Your card');
    });
    expect(shield).toBeGreaterThanOrEqual(0);
    await clickButton(page, 'profile', shield);
    await expect.poll(async () => (await texts()).includes('Pieces played')).toBe(true);
    expect(await texts()).toEqual(expect.arrayContaining(['Level 1', '0 / 100 XP']));
    expect(await texts()).not.toContain('Battles won'); // the battle is gone (ft_1_21): the card counts no fights
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await texts()).includes('Pieces played')).toBe(false);
    expect(await activeScene(page)).toBe('profile');
    expectNoErrors(errors);
  });

  test('ft_1_20.AC14 in the room a contour lights round the shield under the pointer and goes when it leaves; an object wakes instead and gets none (ft_1_20.AC15)', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'profile');
    await waitForScene(page, 'profile');
    const lit = () => page.evaluate(() => (window.__game.scene.getScene('profile') as unknown as { root: { list: { name: string; visible: boolean }[] } }).root.list.filter((o) => o.name.startsWith('hover:') && o.visible).map((o) => o.name));
    const index = (label: string) => page.evaluate((l) => (window.__game.scene.getScene('profile') as unknown as { buttons: { labelFit(): { label: string } }[] }).buttons.findIndex((b) => b.labelFit().label === l), label);
    expect(await lit()).toEqual([]);
    for (const [label, contours] of [['Your card', ['hover:shield']], ['Piano', []]] as const) {
      const at = await index(label);
      expect(at, label).toBeGreaterThanOrEqual(0);
      const point = await buttonPoint(page, 'profile', at);
      await page.mouse.move(point.x, point.y);
      await expect.poll(lit, label).toEqual(contours);
    }
    const shield = await buttonPoint(page, 'profile', await index('Your card'));
    await page.mouse.move(shield.x, shield.y);
    await expect.poll(lit).toEqual(['hover:shield']);
    const canvas = (await page.locator('canvas').boundingBox())!;
    await page.mouse.move(canvas.x + 2, canvas.y + canvas.height - 2);
    await expect.poll(lit).toEqual([]);
    expectNoErrors(errors);
  });

  test('ft_1_20.AC2 the gear opens the settings screen and its door returns to the screen it came from', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'noteTrainer');
    await waitForScene(page, 'noteTrainer');
    await clickToolbar(page, 'settings');
    await waitForScene(page, 'settings');
    await clickToolbar(page, 'back');
    await waitForScene(page, 'noteTrainer');
    expectNoErrors(errors);
  });

  test('ft_1_20.AC10 the strip needs no switch, and the teacher screen keeps the toolbar and draws no strip', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual&band=0');
    await startScene(page, 'menu');
    await waitForScene(page, 'menu');
    expect((await frame(page)).rows).toBe(163);
    await page.evaluate(() => window.__game.registry.get('context').teacher.lock.check('pianor')); // her password (ft_1_26.AC1)
    await startScene(page, 'teacher', {});
    await waitForScene(page, 'teacher');
    const f = await frame(page);
    // the toolbar's Back above the main area (her screen has no Settings), and the main area runs to the screen's foot
    expect(f.back!.y + f.back!.height).toBeLessThanOrEqual(0);
    expect(f.rows).toBe(157);
    expect(await page.evaluate(() => (window.__game.scene.getScene('teacher') as unknown as { bandShown: boolean }).bandShown)).toBe(false);
    expectNoErrors(errors);
  });
});

/** The index of the button whose label (its word, also when it shows only its picture) is `label` on scene `key`, or -1. */
const labelled = (page: Page, key: string, label: string) =>
  page.evaluate(({ k, l }) => (window.__game.scene.getScene(k) as unknown as { buttons: { labelFit(): { label: string } }[] }).buttons.findIndex((b) => b.labelFit().label === l), { k: key, l: label });

/** Click the button labelled `label` with the real mouse. */
async function press(page: Page, key: string, label: string): Promise<void> {
  await expect.poll(() => labelled(page, key, label), label).toBeGreaterThanOrEqual(0);
  await clickButton(page, key, await labelled(page, key, label));
}

test.describe('the screens\' buttons in the strip and the bubble (ft_1_20.AC8)', () => {
  test('ft_1_20.AC22 a section\'s tempo ramp is in the bubble: its panel opens over the staff\'s foot and Esc closes it', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'practice', { chartId: 'little-steps', section: { first: 0, last: 1 } });
    await waitForScene(page, 'practice');
    const open = () => page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { rampOpen: boolean }).rampOpen);
    expect(await labelled(page, 'practice', 'Clean')).toBe(-1);
    // the ramp is in the bubble now (ft_1_20, d282): More opens it
    await clickButton(page, 'practice', await reachButton(page, 'practice', 'Tempo ramp'));
    await expect.poll(open).toBe(true);
    expect(await labelled(page, 'practice', 'Clean')).toBeGreaterThanOrEqual(0);
    await page.keyboard.press('Escape');
    await expect.poll(open).toBe(false);
    expect(await activeScene(page)).toBe('practice');
    expectNoErrors(errors);
  });

  test('ft_1_20.AC9 the score screen\'s two buttons are the strip\'s cells', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'results', { chartId: 'little-steps' });
    await waitForScene(page, 'results');
    const f = await frame(page);
    expect(f.items.length).toBe(2);
    for (const r of f.items) expect(r.y).toBeGreaterThanOrEqual(f.rows);
    await press(page, 'results', 'Play');
    await waitForScene(page, 'practice');
    expectNoErrors(errors);
  });
});

/** The backpack's button on scene `key`, and whether its page is open. */
const backpack = (page: Page, key: string) =>
  page.evaluate((k) => {
    const scene = window.__game.scene.getScene(k) as unknown as { buttons: { labelFit(): { label: string } }[]; backpackShown: boolean };
    return { index: scene.buttons.findIndex((b) => b.labelFit().label === 'Backpack'), open: scene.backpackShown };
  }, key);

test.describe('the backpack (ft_1_20, d282)', () => {
  test('ft_1_20.AC23 the room, the map and the scenes have the backpack from the start, and no strip; a press opens its page and Esc closes it', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    for (const key of ['profile', 'keriMap', 'knoll']) {
      await startScene(page, key);
      await waitForScene(page, key);
      expect((await frame(page)).rows, key).toBe(180);
      const bag = await backpack(page, key);
      expect(bag.index, key).toBeGreaterThanOrEqual(0);
      expect(bag.open, key).toBe(false);
      await clickButton(page, key, bag.index);
      await expect.poll(async () => (await backpack(page, key)).open, key).toBe(true);
      // nothing kept yet: the page says so in a line, no empty slots
      expect(await page.evaluate((k) => (window.__game.scene.getScene(k) as unknown as { children: { list: { list?: { name: string }[] }[] } }).children.list.some((c) => c.list?.some((o) => o.name === 'backpackEmpty')), key), key).toBe(true);
      await page.keyboard.press('Escape');
      await expect.poll(async () => (await backpack(page, key)).open, key).toBe(false);
      expect(await activeScene(page), key).toBe(key);
    }
    expectNoErrors(errors);
  });

  test('ft_1_20.AC23 a kept prize stands in the backpack\'s page, named in its tooltip, and a second press closes the page', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await page.evaluate(async () => {
      const { profiles } = window.__game.registry.get('context');
      await profiles.saveWorld(profiles.profile.id, { flags: [], items: ['acorn'], met: {}, teacherVisits: [] });
    });
    await startScene(page, 'profile');
    await waitForScene(page, 'profile');
    await expect.poll(() => page.evaluate(() => (window.__game.scene.getScene('profile') as unknown as { world: { items: string[] } | null }).world?.items ?? [])).toEqual(['acorn']);
    await clickButton(page, 'profile', (await backpack(page, 'profile')).index);
    await expect.poll(async () => (await backpack(page, 'profile')).open).toBe(true);
    const acorn = await labelled(page, 'profile', 'Acorn');
    expect(acorn).toBeGreaterThanOrEqual(0);
    await clickButton(page, 'profile', (await backpack(page, 'profile')).index);
    await expect.poll(async () => (await backpack(page, 'profile')).open).toBe(false);
    expect(await labelled(page, 'profile', 'Acorn')).toBe(-1);
    expectNoErrors(errors);
  });
});
