import { expect, test, type Page } from '@playwright/test';
import { activeScene, buttonPoint, clickButton, clickToolbar, expectNoErrors, openGame, waitForScene } from './helpers';

/**
 * The action and inventory band (ft_1_20, d115), now the default (AC10): every screen but the teacher's gets the band at its foot in place of
 * the toolbar, with no text on it and the screen's toolbar items in its action cells until the screen is moved. Back (the door) and Settings (the gear) stay in the top corners where the toolbar had them, faded
 * until the pointer is on them. The player is in the room: the name on the shield, the shield opens
 * the player's card.
 */
const SCREENS = [
  // not the main menu: it paints every row itself, with its own board of plates in the band's wood (ft_1_07)
  ['profile', {}],
  ['menu', {}],
  ['settings', {}],
  ['practice', { chartId: 'little-steps' }],
  ['editor', {}],
  ['noteTrainer', {}],
] as const;

type Box = { x: number; y: number; width: number; height: number };

const startScene = (page: Page, key: string, data: object = {}) =>
  page.evaluate(({ k, d }) => (window.__game.scene.getScenes(true)[0] as unknown as { scene: { start(key: string, data: unknown): void } }).scene.start(k, d), { k: key, d: data });

/** The frame as the scene drew it: the main area, Back and Settings, the band's action cells and every button, and the texts drawn on the band. */
const band = (page: Page) =>
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
      bandTexts: scene.root.list.filter((o) => o.pixelText === true && o.visible && o.text !== '' && o.y >= scene.px.height && !scene.buttons.some((btn) => btn.objects.includes(o))).map((o) => o.text),
    };
  });

const gearAlpha = (page: Page) =>
  page.evaluate(() => (window.__game.scene.getScene('menu') as unknown as { toolbarButtons: { settings: { objects: { alpha: number }[] } } }).toolbarButtons.settings.objects[0]!.alpha);

test.describe('the action and inventory band (ft_1_20, d115)', () => {
  test('ft_1_20.AC10 ft_1_20.AC2 every screen has the band at its foot, Back and Settings in the same top corners and nothing above the main area', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    let first: Awaited<ReturnType<typeof band>> | null = null;
    for (const [key, data] of SCREENS) {
      await startScene(page, key, data);
      await waitForScene(page, key);
      const f = await band(page);
      // the main area is every row above the band: 124 on the target screen
      expect(f.px.height, key).toBe(124);
      expect(f.rows, key).toBe(124);
      for (const r of f.all) expect(r.y, key).toBeGreaterThanOrEqual(0);
      // no text on the band: only the words on its buttons, which are not loose texts
      expect(f.bandTexts, key).toEqual([]);
      for (const r of f.items) expect(r.y, key).toBeGreaterThanOrEqual(f.px.height);
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

  test('ft_1_20.AC2 the Settings cell opens the settings screen and its Back cell returns to the screen it came from', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'noteTrainer');
    await waitForScene(page, 'noteTrainer');
    await clickToolbar(page, 'settings');
    await waitForScene(page, 'settings');
    await clickToolbar(page, 'back');
    await waitForScene(page, 'noteTrainer');
    expectNoErrors(errors);
  });

  test('ft_1_20.AC10 the band needs no switch, and the teacher screen keeps the toolbar and draws no band', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual&band=0');
    await startScene(page, 'menu');
    await waitForScene(page, 'menu');
    expect((await band(page)).rows).toBe(124);
    await page.evaluate(() => window.__game.registry.get('context').teacher.lock.check('pianor')); // her password (ft_1_26.AC1)
    await startScene(page, 'teacher', {});
    await waitForScene(page, 'teacher');
    const f = await band(page);
    // the toolbar's Back above the main area (her screen has no Settings), and the main area runs to the screen's foot
    expect(f.back!.y + f.back!.height).toBeLessThanOrEqual(0);
    expect(f.rows).toBeGreaterThan(124);
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

/** Where the staff is drawn and every button that is not in the band or a top corner (a button over the staff's top strip is allowed). */
const staffAndStrays = (page: Page, key: string) =>
  page.evaluate((k) => {
    const scene = window.__game.scene.getScene(k) as unknown as {
      px: { height: number; scale: number };
      mainRows: number;
      cornerStrip: { rows: number };
      buttons: { rect: Box; labelFit(): { label: string }; options: { tooltip?: string } }[];
      staffTop?: number;
      staffHeight?: number;
      playSession?: { staffView: { top?: number } | null };
    };
    const strip = scene.cornerStrip.rows;
    return {
      strip,
      rows: scene.mainRows,
      // the piece maker's + and - after the last bar stand on the staff's line on purpose
      strays: scene.buttons.filter((b) => b.rect.y < scene.px.height && b.rect.y + b.rect.height > strip && !/^(Four bars|Neli takti)/.test(b.options.tooltip ?? '')).map((b) => b.labelFit().label),
      editorStaffRows: scene.staffHeight === undefined ? null : scene.staffHeight / scene.px.scale,
    };
  }, key);

test.describe('the screens\' buttons in the band (ft_1_20.AC8)', () => {
  test('ft_1_20.AC8 practice has no bars: its tools are band cells and items, Kiur stands between the door and the gear, and the staff gets the rest', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'practice', { chartId: 'little-steps' });
    await waitForScene(page, 'practice');
    const f = await staffAndStrays(page, 'practice');
    // nothing but the staff between the corners' strip and the band: 104 of the 124 rows (87 with the bars)
    expect(f.strays).toEqual([]);
    expect(f.rows - f.strip).toBeGreaterThanOrEqual(100);
    const state = () => page.evaluate(() => {
      const s = window.__game.scene.getScene('practice') as unknown as { percent: number; listening: boolean; hints: { noteNames: boolean }; clickOn: boolean };
      return { percent: s.percent, listening: s.listening, names: s.hints.noteNames, click: s.clickOn };
    });
    // the tempo cells: slower, the percent (a press puts it back to 100), faster
    await press(page, 'practice', '-');
    await expect.poll(async () => (await state()).percent).toBe(90);
    await press(page, 'practice', '90%');
    await expect.poll(async () => (await state()).percent).toBe(100);
    // a worn item lights while it is on
    await press(page, 'practice', 'Note names');
    await expect.poll(async () => (await state()).names).toBe(true);
    await press(page, 'practice', 'Click');
    await expect.poll(async () => (await state()).click).toBe(true);
    await press(page, 'practice', 'Listen');
    await expect.poll(async () => (await state()).listening).toBe(true);
    await press(page, 'practice', 'Stop');
    await expect.poll(async () => (await state()).listening).toBe(false);
    expectNoErrors(errors);
  });

  test('ft_1_20.AC5 a section\'s tempo ramp is an opening item: its panel opens over the staff\'s foot and Esc closes it', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'practice', { chartId: 'little-steps', section: { first: 0, last: 1 } });
    await waitForScene(page, 'practice');
    const open = () => page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { rampOpen: boolean }).rampOpen);
    expect(await labelled(page, 'practice', 'Clean')).toBe(-1);
    await press(page, 'practice', 'Tempo ramp');
    await expect.poll(open).toBe(true);
    expect(await labelled(page, 'practice', 'Clean')).toBeGreaterThanOrEqual(0);
    await page.keyboard.press('Escape');
    await expect.poll(open).toBe(false);
    expect(await activeScene(page)).toBe('practice');
    expectNoErrors(errors);
  });

  test('ft_1_20.AC8 the piece maker has no rows: the Notes item opens every length, the wheel still cycles and steps an item\'s choices (ft_1_20.AC16), the finger menu sets the selected note\'s finger, the title is in the top strip', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'editor', {});
    await waitForScene(page, 'editor');
    const f = await staffAndStrays(page, 'editor');
    expect(f.strays).toEqual([]);
    expect(f.editorStaffRows).toBeGreaterThanOrEqual(100);
    const length = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { length: string }).length);
    expect(await length()).toBe('quarter');
    // the Notes item: pressed, it opens all five lengths; a pick sets the length and closes it
    const menuOpen = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { menuOpen: boolean }).menuOpen);
    const lengthCells = () =>
      page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { buttons: { labelFit(): { label: string } }[] }).buttons.map((b) => b.labelFit().label).filter((l) => ['1', '3/4', '1/2', '1/4', '1/8'].includes(l)));
    expect(await lengthCells()).toEqual([]);
    await press(page, 'editor', 'Notes');
    await expect.poll(menuOpen).toBe(true);
    expect(await lengthCells()).toEqual(['1', '3/4', '1/2', '1/4', '1/8']);
    await press(page, 'editor', '1/8');
    await expect.poll(length).toBe('eighth');
    expect(await menuOpen()).toBe(false);
    await press(page, 'editor', 'Notes');
    await press(page, 'editor', '1/2');
    await expect.poll(length).toBe('half');
    // the wheel over the Notes item steps through its choices as its menu lists them: up is the one before (half to dotted half, ft_1_20.AC16)
    const item = await buttonPoint(page, 'editor', await labelled(page, 'editor', 'Notes'));
    await page.mouse.move(item.x, item.y);
    await page.mouse.wheel(0, -100);
    await expect.poll(length).toBe('dottedHalf');
    await page.mouse.wheel(0, 100);
    await expect.poll(length).toBe('half');
    // away from a note on the staff the wheel still cycles the length: up is longer (half to whole; it skips the dotted lengths, ft_1_02d.AC3)
    const staff = await page.evaluate(() => {
      const s = window.__game.scene.getScene('editor') as unknown as { staffTop: number; staffHeight: number };
      const canvas = document.querySelector('canvas')!;
      const rect = canvas.getBoundingClientRect();
      // the middle of the staff area, a little left of its right end: free time of the empty piece, no note
      return { x: rect.left + rect.width * 0.9, y: rect.top + ((s.staffTop + s.staffHeight / 2) / canvas.height) * rect.height };
    });
    await page.mouse.move(staff.x, staff.y);
    await page.mouse.wheel(0, -100);
    await expect.poll(length).toBe('whole');
    // the wheel on the inventory beside an item turns its page: down is the next, where Notes is not (ft_1_20.AC16)
    const down = await buttonPoint(page, 'editor', await labelled(page, 'editor', 'More items'));
    await page.mouse.move(down.x, down.y);
    await page.mouse.wheel(0, 100);
    await expect.poll(() => labelled(page, 'editor', 'Notes')).toBe(-1);
    await page.mouse.wheel(0, -100);
    await expect.poll(() => labelled(page, 'editor', 'Notes')).toBeGreaterThanOrEqual(0);
    await page.mouse.wheel(0, 100);
    await expect.poll(() => labelled(page, 'editor', 'Notes')).toBe(-1);
    await page.mouse.wheel(0, -100);
    await expect.poll(() => labelled(page, 'editor', 'Notes')).toBeGreaterThanOrEqual(0);
    // the wheel on the arrows was the band's alone: the piece maker's length wheel did not turn with it
    expect(await length()).toBe('whole');
    // a note to work on: written by the virtual piano, then selected
    await page.evaluate(() => {
      const d = window.__virtualDevice!;
      d.press(60, 80);
      d.release(60);
    });
    await expect.poll(() => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { history: { present: { notes: unknown[] } } }).history.present.notes.length)).toBe(1);
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('editor') as unknown as { history: { present: { notes: object[] } }; select(ref: object): void };
      s.select(s.history.present.notes[0]!);
    });
    // Fingers may be on the second page of items
    if ((await labelled(page, 'editor', 'Fingers')) < 0) await press(page, 'editor', 'More items');
    await press(page, 'editor', 'Fingers');
    await press(page, 'editor', '3');
    await expect.poll(() => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { history: { present: { notes: { finger?: number }[] } } }).history.present.notes[0]!.finger)).toBe(3);
    // no Piece item: the title field is always in the top strip
    expect(await labelled(page, 'editor', 'Piece')).toBe(-1);
    await expect(page.locator('#editor-title')).toBeVisible();
    expect(await activeScene(page)).toBe('editor');
    expectNoErrors(errors);
  });

  test('ft_1_20.AC9 the score screen\'s two buttons are the band\'s actions', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await startScene(page, 'results', { chartId: 'little-steps' });
    await waitForScene(page, 'results');
    const f = await band(page);
    expect(f.items.length).toBe(2);
    for (const r of f.items) expect(r.y).toBeGreaterThanOrEqual(f.px.height);
    await press(page, 'results', 'Play');
    await waitForScene(page, 'practice');
    expectNoErrors(errors);
  });
});
