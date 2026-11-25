// Covers ft_1_02c.AC1, ft_1_02c.AC5, ft_1_02c.AC7, ft_1_02c.AC8, ft_1_02c.AC9, core_06.AC4, ft_1_36.AC13.
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { allMenuTitles, addPlayer, bandAction, clickButton, expectNoErrors, goToMainMenu, menuButton, openGame, pickProfile, sceneButton, sceneTexts, showMenuPageWith, waitForScene, playerName } from './helpers';

const PIECE = 'Cave Rumble';

/** The index of the button with this label in the scene shown now, or -1. */
const buttonIndex = (page: Page, scene: string, label: string) =>
  page.evaluate(
    ([key, text]) => (window.__game.scene.getScene(key!).buttons as { objects: { text?: string }[] }[]).findIndex((b) => b.objects.some((o) => o.text === text)),
    [scene, label],
  );

const hidden = (page: Page) => page.evaluate(() => [...window.__game.registry.get('context').profiles.hiddenPieces] as string[]);

/**
 * Open the catalogue's drawer that holds this piece (ft_1_02c.AC7): turn the cabinet's pages to it, click its front, and
 * return the button index of the piece's index card in the open drawer.
 */
async function openDrawerWith(page: Page, title: string): Promise<number> {
  const drawer = await page.evaluate((t) => (window.__game.scene.getScene('pieces') as unknown as { drawerOf(title: string): { label: string; index: number } | null }).drawerOf(t), title);
  expect(drawer, `"${title}" is in a drawer of the catalogue`).not.toBeNull();
  const cabinetPage = () => page.evaluate(() => (window.__game.scene.getScene('pieces') as unknown as { cabinetPage: number }).cabinetPage);
  for (let turn = 0; turn < 20 && (await cabinetPage()) < Math.floor(drawer!.index / 24); turn++) {
    await clickButton(page, 'pieces', await buttonIndex(page, 'pieces', 'Next'));
  }
  await clickButton(page, 'pieces', await buttonIndex(page, 'pieces', drawer!.label));
  await expect.poll(() => buttonIndex(page, 'pieces', title)).toBeGreaterThanOrEqual(0);
  return buttonIndex(page, 'pieces', title);
}

async function openPieces(page: Page): Promise<void> {
  await clickButton(page, 'menu', await menuButton(page, 'Settings'));
  await waitForScene(page, 'settings');
  await clickButton(page, 'settings', await buttonIndex(page, 'settings', 'Choose pieces'));
  await waitForScene(page, 'pieces');
}

async function leavePieces(page: Page): Promise<void> {
  await page.keyboard.press('Escape'); // closes the open drawer: the cabinet is shown again
  await expect.poll(() => page.evaluate(() => (window.__game.scene.getScene('pieces') as unknown as { open: number | null }).open)).toBeNull();
  await clickButton(page, 'pieces', await buttonIndex(page, 'pieces', 'Back'));
  await waitForScene(page, 'settings');
  await clickButton(page, 'settings', await buttonIndex(page, 'settings', 'Back'));
  await waitForScene(page, 'menu');
}

test.describe('turning pieces on and off', () => {
  test('a piece turned off leaves the menu, survives a reload, belongs to one player and comes back when turned on', async ({ page }) => {
    test.slow(); // the game loads twice
    const errors = await openGame(page);
    const all = await allMenuTitles(page);
    expect(all).toContain(PIECE);

    await openPieces(page);
    expect(await sceneTexts(page, 'pieces')).toEqual(expect.arrayContaining(['Pieces']));
    const card = await openDrawerWith(page, PIECE);
    expect(await sceneTexts(page, 'pieces')).toContain('On');
    await clickButton(page, 'pieces', card);
    await expect.poll(async () => (await hidden(page)).length).toBe(1);
    await leavePieces(page);

    expect(await allMenuTitles(page)).toEqual(all.filter((title) => title !== PIECE));

    // a reload keeps it off
    await openGame(page);
    expect(await hidden(page)).toHaveLength(1);
    expect(await allMenuTitles(page)).toEqual(all.filter((title) => title !== PIECE));

    // another player still has every piece, and the first player's choice is still there when switching back
    await goToMainMenu(page);
    await addPlayer(page, 'KAI');
    await expect.poll(() => playerName(page)).toBe('KAI');
    await clickButton(page, 'profile', 0); // the piano: the piece list
    await waitForScene(page, 'menu');
    expect(await hidden(page)).toEqual([]);
    expect(await allMenuTitles(page)).toEqual(all);
    await goToMainMenu(page);
    await pickProfile(page, 'TUVI');
    await expect.poll(() => playerName(page)).toBe('TUVI');
    await waitForScene(page, 'menu');
    // the player's name changes before the menu has redrawn, so the list is polled
    await expect.poll(() => allMenuTitles(page)).toEqual(all.filter((title) => title !== PIECE));

    // the list still shows the piece (as off), and turning it on puts it back in the menu
    await openPieces(page);
    const again = await openDrawerWith(page, PIECE);
    expect(await sceneTexts(page, 'pieces')).toContain('Off');
    await clickButton(page, 'pieces', again);
    await expect.poll(() => hidden(page)).toEqual([]);
    await leavePieces(page);
    expect(await allMenuTitles(page)).toEqual(all);
    expectNoErrors(errors);
  });
});

test.describe('taking a piece out of the book (ft_1_02c.AC8, AC9)', () => {
  /** The on-screen point of a piece's hide button in the book, or null when it has none. */
  const hidePoint = (page: Page, chartId: string) => page.evaluate((id) => {
    const button = window.__game.scene.getScene('menu').hideButtons.get(id) as { screenCenter(): { x: number; y: number } } | undefined;
    if (!button) return null;
    const c = button.screenCenter();
    const canvas = document.querySelector('canvas')!;
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (c.x / canvas.width) * r.width, y: r.top + (c.y / canvas.height) * r.height };
  }, chartId);
  const armed = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('menu').armedHide as { piece: string } | null)?.piece ?? null);
  /** The hide's stroke through a title shown now: 'armed', 'hint' (under the pointer) or null. */
  const stroke = (page: Page) => page.evaluate(() => {
    type Node = { name: string; visible: boolean; list?: Node[] };
    const walk = (nodes: Node[]): Node[] => nodes.flatMap((o) => [o, ...walk(o.list ?? [])]);
    const shown = walk(window.__game.scene.getScene('menu').children.list as unknown as Node[]).find((o) => o.name.startsWith('hideStroke') && o.visible);
    return shown ? (shown.name.startsWith('hideStroke:armed') ? 'armed' : 'hint') : null;
  });

  test('ft_1_02c.AC8 the hide shows what it does, the first press only arms it, the second takes the piece out of the book; AC9 the book opens every piece and Back returns to it', async ({ page }) => {
    const errors = await openGame(page);
    const all = await allMenuTitles(page);
    await showMenuPageWith(page, PIECE);
    const point = await hidePoint(page, 'cave-rumble');
    expect(point, 'a piece in the book has a hide button').not.toBeNull();
    // under the pointer: a faint stroke through its title (d286), nothing hidden
    await page.mouse.move(point!.x, point!.y);
    await expect.poll(() => stroke(page)).toBe('hint');
    // the first press arms it: the card struck through, still in the book
    await page.mouse.click(point!.x, point!.y);
    await expect.poll(() => armed(page)).toBe('cave-rumble');
    expect(await stroke(page)).toBe('armed');
    expect(await hidden(page)).toEqual([]);
    // Esc puts it back to rest; a double click only arms it
    await page.keyboard.press('Escape');
    await expect.poll(() => armed(page)).toBeNull();
    expect(await page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key))).toContain('menu');
    await page.mouse.dblclick(point!.x, point!.y);
    await expect.poll(() => armed(page)).toBe('cave-rumble');
    expect(await hidden(page)).toEqual([]);
    // the second press, a moment later, takes it out
    await page.waitForTimeout(600);
    await page.mouse.click(point!.x, point!.y);
    await expect.poll(() => hidden(page)).toEqual(['cave-rumble']);
    expect(await allMenuTitles(page)).toEqual(all.filter((title) => title !== PIECE));

    // an armed hide that is not pressed again goes back to rest
    const other = all.find((title) => title !== PIECE)!;
    await showMenuPageWith(page, other);
    const otherId = await page.evaluate((t) => (window.__game.registry.get('context').pieces.list() as { chart: { id: string; title: string } }[]).find((p) => p.chart.title === t)!.chart.id, other);
    const otherPoint = (await hidePoint(page, otherId))!;
    await page.mouse.click(otherPoint.x, otherPoint.y);
    await expect.poll(() => armed(page)).toBe(otherId);
    await expect.poll(() => armed(page), { timeout: 8000 }).toBeNull();
    expect(await hidden(page)).toEqual(['cave-rumble']);

    // the book's strip opens every piece; the hidden one is put back, and Back goes to the book
    await clickButton(page, 'menu', await bandAction(page, 'menu', 1));
    await waitForScene(page, 'pieces');
    const card = await openDrawerWith(page, PIECE);
    expect(await sceneTexts(page, 'pieces')).toContain('Off');
    await clickButton(page, 'pieces', card);
    await expect.poll(() => hidden(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await clickButton(page, 'pieces', await buttonIndex(page, 'pieces', 'Back'));
    await waitForScene(page, 'menu');
    expect(await allMenuTitles(page)).toEqual(all);
    expectNoErrors(errors);
  });
});

test.describe('the parts of a piece from the song list (core_06)', () => {
  /** Click a card's parts button ("P") with the real mouse, at its on-screen position; null when the card has none. */
  const partsButtonPoint = (page: Page, chartId: string) => page.evaluate((id) => {
    const button = window.__game.scene.getScene('menu').partsButtons.get(id) as { screenCenter(): { x: number; y: number } } | undefined;
    if (!button) return null;
    const c = button.screenCenter();
    const canvas = document.querySelector('canvas')!;
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (c.x / canvas.width) * r.width, y: r.top + (c.y / canvas.height) * r.height };
  }, chartId);
  const practising = (page: Page) => page.evaluate(() => window.__game.scene.getScene('practice').chart.id as string);

  test('core_06.AC4 ft_1_36.AC13 a tap on a piece plays it at once; the P button of a piece with parts opens the song page with the whole piece first and then its parts, and a part\'s play button practises its bars', async ({ page }) => {
    const errors = await openGame(page);
    // a piece with parts: its card plays the whole piece at once (AX-3 provisional in MenuScene: the parts are behind P)
    await clickButton(page, 'menu', await showMenuPageWith(page, 'Au Clair de la Lune'));
    await waitForScene(page, 'practice');
    expect(await practising(page)).toBe('au-clair-de-la-lune');
    await page.keyboard.press('Escape');
    await waitForScene(page, 'menu');
    // its P button opens the song page with the piece at its root: the whole piece first, then one row per part with its bars
    await showMenuPageWith(page, 'Au Clair de la Lune');
    const point = await partsButtonPoint(page, 'au-clair-de-la-lune');
    expect(point, 'a piece with parts has a P button').not.toBeNull();
    await page.mouse.click(point!.x, point!.y);
    await waitForScene(page, 'song');
    const parts = await page.evaluate(() => (window.__game.registry.get('context').pieces.find('au-clair-de-la-lune').chart.phrases as { name: string; startBar: number; endBar: number }[]).map((p) => ({ ...p })));
    expect(parts.length).toBeGreaterThan(0);
    const rows = await page.evaluate(() => (window.__game.scene.getScene('song').buttons as { options: { label: string; align?: string } }[]).filter((b) => b.options.align === 'left').map((b) => b.options.label));
    expect(rows[0]).toBe('Au Clair de la Lune');
    expect(rows.length).toBe(parts.length + 1);
    expect(rows[1]).toBe(`1 ${parts[0]!.name}`);
    expect(await sceneTexts(page, 'song')).toContain(`${parts[0]!.startBar + 1}-${parts[0]!.endBar + 1}`);
    // a part's play button practises that part's bars as a section
    await clickButton(page, 'song', await sceneButton(page, 'song', `Play ${parts[0]!.name}`));
    await waitForScene(page, 'practice');
    expect(await practising(page)).toBe(`au-clair-de-la-lune#bars-${parts[0]!.startBar + 1}-${parts[0]!.endBar + 1}`);
    expectNoErrors(errors);
  });
});
