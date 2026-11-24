// Covers ft_0_10.AC2, ft_0_10.AC4, ft_0_15.AC5.
import { expect, test, type Page } from '@playwright/test';
import { LITTLE_STEPS, addPlayer, clickButton, clickToolbar, expectNoErrors, goToMainMenu, openAdminPage, openGame, openPiece, pickProfile, playWithKeys, profileButton, nameDone, sceneButton, sceneTexts, showMenuPageWith, toPieceList, toScoreScreen, waitForScene, bandAction } from './helpers';

const progress = (page: Page) =>
  page.evaluate(() => {
    const p = window.__game.registry.get('context').profiles;
    return { xp: p.progress.totalXp as number, level: p.progress.level.level as number, name: p.profile.name as string, attempts: p.profile.attempts.length as number, pieceXp: (p.recordFor('little-steps')?.xp ?? 0) as number };
  });

async function finish(page: Page, title: string, midis: number[]): Promise<void> {
  await openPiece(page, title);
  await playWithKeys(page, midis);
  await toScoreScreen(page);
}

test.describe('earning XP and levels', () => {
  test('ft_1_13.AC1, ft_1_13.AC2: finishing a piece shows the piece XP it earned and the piece level; the player XP stays', async ({ page }) => {
    const errors = await openGame(page);
    expect(await progress(page)).toMatchObject({ xp: 0, level: 1, name: 'TUVI' });
    await finish(page, 'Little Steps', LITTLE_STEPS);
    const texts = await sceneTexts(page, 'results');
    expect(texts).toEqual(expect.arrayContaining(['+70 XP', 'Level 2   20 / 100 XP']));
    expect(texts).not.toContain('First time bonus'); // no breakdown of the XP
    expect(await progress(page)).toMatchObject({ xp: 0, level: 1, attempts: 1, pieceXp: 70 });
    expectNoErrors(errors);
  });

  test('playing the same piece again earns 30%, and the card shows the piece level (ft_1_13.AC1)', async ({ page }) => {
    const errors = await openGame(page);
    await finish(page, 'Little Steps', LITTLE_STEPS);
    await clickButton(page, 'results', await bandAction(page, 'results', 0)); // Play again
    await waitForScene(page, 'practice');
    await playWithKeys(page, LITTLE_STEPS);
    await toScoreScreen(page);
    expect(await sceneTexts(page, 'results')).toEqual(expect.arrayContaining(['+15 XP']));
    await clickButton(page, 'results', await bandAction(page, 'results', 1)); // More pieces
    await waitForScene(page, 'menu');
    await showMenuPageWith(page, 'Little Steps');
    expect(await sceneTexts(page, 'menu')).toEqual(expect.arrayContaining(['Level 2'])); // the card's piece level (the player's is in the room, ft_1_20.AC13)
    // the level is never written over the card's small buttons, in the two-page book either
    const overlaps = await page.evaluate(() => {
      type Rect = { x: number; y: number; width: number; height: number };
      type Small = Map<string, { rect: Rect }>;
      const menu = window.__game.scene.getScene('menu') as unknown as { root: { list: (Rect & { text?: string })[] }; infoButtons: Small; statsButtons: Small; partsButtons: Small };
      const small = [menu.infoButtons, menu.statsButtons, menu.partsButtons].flatMap((m) => [...m.values()].map((b) => b.rect));
      const levels = menu.root.list.filter((o) => o.text === 'Level 2');
      if (levels.length === 0 || small.length === 0) return -1;
      return levels.flatMap((l) => small.filter((r) => l.x < r.x + r.width && r.x < l.x + l.width && l.y < r.y + r.height && r.y < l.y + l.height)).length;
    });
    expect(overlaps).toBe(0);
    expect((await progress(page)).pieceXp).toBe(85);
    expectNoErrors(errors);
  });


  test('stars earned are shown on the piece in the menu', async ({ page }) => {
    await openGame(page);
    await finish(page, 'Little Steps', LITTLE_STEPS);
    await clickButton(page, 'results', await bandAction(page, 'results', 1));
    await waitForScene(page, 'menu');
    expect(await page.evaluate(() => window.__game.registry.get('context').profiles.recordFor('little-steps').bestStars)).toBe(3);
  });
});

test.describe('saves', () => {
  test('progress survives a reload of the page', async ({ page }) => {
    const errors = await openGame(page);
    await finish(page, 'Little Steps', LITTLE_STEPS);
    expect((await progress(page)).pieceXp).toBe(70);
    await page.reload();
    await page.waitForFunction(() => window.__game?.scene.getScenes(true).some((s) => s.scene.key === 'profiles'));
    await toPieceList(page);
    expect(await progress(page)).toMatchObject({ xp: 0, attempts: 1, name: 'TUVI', pieceXp: 70 });
    await showMenuPageWith(page, 'Little Steps');
    expect(await sceneTexts(page, 'menu')).toEqual(expect.arrayContaining(['Level 2'])); // the piece's level on its card
    expectNoErrors(errors);
  });

  test('ft_1_07.AC3: choosing a player shows the dashboard with the name, and its card the level', async ({ page }) => {
    const errors = await openGame(page);
    await goToMainMenu(page);
    await waitForScene(page, 'profiles');
    await clickButton(page, 'profiles', await profileButton(page, 'VINT'));
    await waitForScene(page, 'profile');
    // the name is on the shield and the level in the shield's card (ft_1_20.AC13)
    expect(await page.evaluate(() => window.__game.registry.get('context').profiles.profile.name as string)).toBe('VINT');
    await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Your card'));
    await expect.poll(() => sceneTexts(page, 'profile')).toContain('Level 1');
    expectNoErrors(errors);
  });

  test('ft_1_07.AC4, ft_1_18.AC4: the room has the piano and the door (no book); the door opens the map of Keri', async ({ page }) => {
    const errors = await openGame(page);
    await goToMainMenu(page);
    await waitForScene(page, 'profiles');
    await clickButton(page, 'profiles', await profileButton(page, 'VINT'));
    await waitForScene(page, 'profile');
    // the objects are the buttons; their names show only on hover and focus (ft_1_08.AC7)
    expect([await sceneButton(page, 'profile', 'Piano'), await sceneButton(page, 'profile', 'Door'), await sceneButton(page, 'profile', 'Book')]).toEqual([0, 1, -1]);
    await clickButton(page, 'profile', 1); // Door: the map of Keri (ft_1_18.AC4)
    await waitForScene(page, 'keriMap');
    expectNoErrors(errors);
  });

  test('ft_1_07.AC6: the admin page offers export and import of a player', async ({ page }) => {
    const errors = await openGame(page);
    await goToMainMenu(page);
    await waitForScene(page, 'profiles');
    await openAdminPage(page);
    expect(await sceneTexts(page, 'admin')).toEqual(expect.arrayContaining(['Admin', 'Export player', 'Import player']));
    expectNoErrors(errors);
  });

  test('ft_1_07.AC6: a file that is not a player says so on the admin page', async ({ page }) => {
    const errors = await openGame(page);
    await goToMainMenu(page);
    await waitForScene(page, 'profiles');
    await openAdminPage(page);
    // the browser's file picker cannot be driven here: the picker hands back text that is not a player
    await page.evaluate(() => {
      window.__game.registry.get('context').files.pick = async () => 'not a player';
    });
    await clickButton(page, 'admin', 1); // Import player
    await expect.poll(() => sceneTexts(page, 'admin')).toContain('That file is not a player.');
    expectNoErrors(errors);
  });

  test('ft_1_07.AC6 ft_1_07.AC9: rename the active player, then delete it from the delete list after a second tap', async ({ page }) => {
    const errors = await openGame(page);
    await goToMainMenu(page);
    await waitForScene(page, 'profiles');
    await openAdminPage(page);
    await clickButton(page, 'admin', 2); // Rename player: the name picker, not the browser's box
    await waitForScene(page, 'name');
    // the picker's letters are buttons 0 to 29 in NAME_LETTERS order: Z is 19, then DONE is 31
    for (let i = 0; i < 3; i++) await clickButton(page, 'name', 19);
    await clickButton(page, 'name', await nameDone(page)); // Done
    await waitForScene(page, 'admin');
    await expect.poll(() => sceneTexts(page, 'admin')).toContain('Renamed.');
    await clickButton(page, 'admin', 3); // Delete player: the list of players
    await waitForScene(page, 'adminDelete');
    expect(await sceneTexts(page, 'adminDelete')).toEqual(expect.arrayContaining(['ZZZ', 'VINT', 'KIUR', 'PÄÄSU']));
    await clickButton(page, 'adminDelete', 0); // the first tap asks
    await expect.poll(() => sceneTexts(page, 'adminDelete')).toContain('Delete ZZZ?');
    expect(await page.evaluate(() => window.__game.registry.get('context').profiles.profiles.length as number)).toBe(4);
    await clickButton(page, 'adminDelete', 0); // the second deletes
    await expect.poll(() => sceneTexts(page, 'adminDelete')).not.toContain('Delete ZZZ?');
    expect(await sceneTexts(page, 'adminDelete')).not.toContain('ZZZ');
    expect(await sceneTexts(page, 'adminDelete')).toEqual(expect.arrayContaining(['VINT', 'KIUR', 'PÄÄSU']));
    expectNoErrors(errors);
  });

  test('ft_1_07.AC2: a second player has separate progress, and switching back keeps the first', async ({ page }) => {
    const errors = await openGame(page);
    await finish(page, 'Little Steps', LITTLE_STEPS);
    await clickButton(page, 'results', await bandAction(page, 'results', 1));
    await waitForScene(page, 'menu');

    await goToMainMenu(page);
    await addPlayer(page, 'KAI');
    await expect.poll(() => progress(page)).toMatchObject({ name: 'KAI', xp: 0 });
    await waitForScene(page, 'profile'); // KAI's room (the name is written into the shield, ft_1_20)

    await clickToolbar(page, 'back');
    await pickProfile(page, 'TUVI');
    await expect.poll(() => progress(page)).toMatchObject({ name: 'TUVI', pieceXp: 70 });
    await page.reload();
    await page.waitForFunction(() => window.__game?.scene.getScenes(true).some((s) => s.scene.key === 'profiles'));
    expect(await progress(page)).toMatchObject({ name: 'TUVI', pieceXp: 70 }); // the active player was remembered
    expectNoErrors(errors);
  });

  test('export and import of a player through the dev page', async ({ page }) => {
    await openGame(page);
    await finish(page, 'Little Steps', LITTLE_STEPS);
    await page.goto('/?demo=profile&lang=en');
    await page.getByRole('button', { name: 'Export this player' }).click();
    await expect(page.locator('textarea')).not.toHaveValue('');
    const text = await page.locator('textarea').inputValue();
    expect(JSON.parse(text)).toMatchObject({ format: 'pianor-profile', exportVersion: 2, documents: { profile: { name: 'TUVI' } } });

    await page.evaluate(() => localStorage.clear()); // a new device
    await page.reload();
    await page.locator('textarea').fill(text);
    await page.getByRole('button', { name: 'Import as a new player' }).click();
    await expect(page.locator('p')).toContainText('Imported');
    await expect(page.locator('pre')).toContainText('1 attempt(s)');
  });
});
