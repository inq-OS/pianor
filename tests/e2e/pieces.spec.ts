// Covers ft_1_02c.AC1, ft_1_02c.AC5, ft_1_02c.AC7, core_06.AC4.
import { expect, test, type Page } from '@playwright/test';
import { allMenuTitles, addPlayer, clickButton, expectNoErrors, goToMainMenu, menuButton, openGame, pickProfile, sceneButton, sceneTexts, showMenuPageWith, waitForScene, playerName } from './helpers';

const TWINKLE = 'Twinkle Twinkle Little Star';

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
  test('a piece turned off leaves the menu and fights, survives a reload, belongs to one player and comes back when turned on', async ({ page }) => {
    test.slow(); // the game loads twice
    const errors = await openGame(page);
    const all = await allMenuTitles(page);
    expect(all).toContain(TWINKLE);

    await openPieces(page);
    expect(await sceneTexts(page, 'pieces')).toEqual(expect.arrayContaining(['Pieces']));
    const card = await openDrawerWith(page, TWINKLE);
    expect(await sceneTexts(page, 'pieces')).toContain('On');
    await clickButton(page, 'pieces', card);
    await expect.poll(async () => (await hidden(page)).length).toBe(1);
    await leavePieces(page);

    expect(await allMenuTitles(page)).toEqual(all.filter((title) => title !== TWINKLE));

    // a reload keeps it off
    await openGame(page);
    expect(await hidden(page)).toHaveLength(1);
    expect(await allMenuTitles(page)).toEqual(all.filter((title) => title !== TWINKLE));

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
    await expect.poll(() => allMenuTitles(page)).toEqual(all.filter((title) => title !== TWINKLE));

    // the list still shows the piece (as off), and turning it on puts it back in the menu
    await openPieces(page);
    const again = await openDrawerWith(page, TWINKLE);
    expect(await sceneTexts(page, 'pieces')).toContain('Off');
    await clickButton(page, 'pieces', again);
    await expect.poll(() => hidden(page)).toEqual([]);
    await leavePieces(page);
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

  test('core_06.AC4 a tap on a piece plays it at once; the P button of a piece with parts opens the whole piece and then its part cards, and a part card practises its bars', async ({ page }) => {
    const errors = await openGame(page);
    // a piece with parts: its card plays the whole piece at once (AX-3 provisional in MenuScene: the parts are behind P)
    await clickButton(page, 'menu', await showMenuPageWith(page, 'Hot Cross Buns'));
    await waitForScene(page, 'practice');
    expect(await practising(page)).toBe('hot-cross-buns');
    await page.keyboard.press('Escape');
    await waitForScene(page, 'menu');
    // its P button opens the part cards: the whole piece first, then one card per part with its bars
    await showMenuPageWith(page, 'Hot Cross Buns');
    const point = await partsButtonPoint(page, 'hot-cross-buns');
    expect(point, 'a piece with parts has a P button').not.toBeNull();
    await page.mouse.click(point!.x, point!.y);
    await waitForScene(page, 'parts');
    const parts = await page.evaluate(() => (window.__game.registry.get('context').pieces.find('hot-cross-buns').chart.phrases as { name: string; startBar: number; endBar: number }[]).map((p) => ({ ...p })));
    expect(parts.length).toBeGreaterThan(0);
    const cards = await page.evaluate(() => (window.__game.scene.getScene('parts').buttons as { options: { label: string; look?: string } }[]).filter((b) => b.options.look === 'ink').map((b) => b.options.label));
    expect(cards[0]).toBe('Whole piece');
    expect(cards.length).toBe(parts.length + 1);
    expect(await sceneTexts(page, 'parts')).toContain(`Bars ${parts[0]!.startBar + 1} to ${parts[0]!.endBar + 1}`);
    // a part card practises that part's bars as a section
    await clickButton(page, 'parts', await sceneButton(page, 'parts', cards[1]!));
    await waitForScene(page, 'practice');
    expect(await practising(page)).toBe(`hot-cross-buns#bars-${parts[0]!.startBar + 1}-${parts[0]!.endBar + 1}`);
    expectNoErrors(errors);
  });
});
