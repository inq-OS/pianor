// Covers ft_1_07.AC6, ft_1_07.AC9, ft_1_07.AC10 (the name box, the main menu's names, deleting a player), ft_Y_13.AC1 (the room's arrows).
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { addPlayer, clickButton, clickToolbar, expectNoErrors, openAdminPage, openGame, profileButton, sceneTexts, waitForScene } from './helpers';

const players = (page: Page) => page.evaluate(() => window.__game.registry.get('context').profiles.profiles.length as number);

/** The name box's caret, as drawn now: its alpha and whether it shows. */
const caret = (page: Page) =>
  page.evaluate(() => {
    const found = (window.__game.scene.getScene('name') as unknown as { root: { list: { name: string; alpha: number; visible: boolean }[] } }).root.list.find((o) => o.name === 'caret');
    return found ? { alpha: found.alpha, visible: found.visible } : null;
  });

test.describe('the name box and the names', () => {
  test('ft_1_07.AC10 the new player\'s name box asks for the name over its plate, and its caret never vanishes while it blinks', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
    await waitForScene(page, 'profiles');
    await clickButton(page, 'profiles', await profileButton(page, 'New player'));
    await waitForScene(page, 'name');
    expect(await sceneTexts(page, 'name')).toContain('Type your name');
    await expect(page.locator('#name-field')).toHaveAttribute('aria-label', 'Type your name');
    // over two blinks the caret is shown each time it is looked at, full or faint
    for (let i = 0; i < 4; i++) {
      const now = await caret(page);
      expect(now?.visible).toBe(true);
      expect(now!.alpha).toBeGreaterThanOrEqual(0.5);
      await page.waitForTimeout(300);
    }
    expectNoErrors(errors);
  });

  test('ft_1_07.AC6 when the name field has no focus (a page in a frame), a press anywhere on the screen gives it, and the letters typed then are taken', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
    await waitForScene(page, 'profiles');
    await clickButton(page, 'profiles', await profileButton(page, 'New player'));
    await waitForScene(page, 'name');
    await page.evaluate(() => (document.getElementById('name-field') as HTMLInputElement).blur());
    expect(await page.evaluate(() => document.activeElement?.id)).not.toBe('name-field');
    // a press on the bare cover, well away from the box and the buttons
    const canvas = (await page.locator('canvas').boundingBox())!;
    await page.mouse.click(canvas.x + canvas.width * 0.5, canvas.y + canvas.height * 0.8);
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('name-field');
    await page.keyboard.type('MARI');
    await expect.poll(() => sceneTexts(page, 'name')).toContain('MARI');
    expectNoErrors(errors);
  });

  test('ft_1_07.AC10 a name of twelve letters, the most the box takes, is written whole on the main menu', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
    await waitForScene(page, 'profiles');
    await addPlayer(page, 'ABCDEFGHIJKL');
    // in the room it is too long for the shield's band: it hangs whole on a ribbon over the shield's point
    await expect.poll(() => page.evaluate(() => {
      const list = (window.__game.scene.getScene('profile') as unknown as { root: { list: { name: string; width: number }[] } }).root.list;
      return list.some((o) => o.name === 'shieldRibbon');
    })).toBe(true);
    expect(await page.evaluate(() => ((window.__game.scene.getScene('profile') as unknown as { root: { list: { name: string; width: number }[] } }).root.list.find((o) => o.name === 'shieldName')?.width ?? 0))).toBeGreaterThan(60); // all twelve letters, far wider than the shield's 36
    await clickToolbar(page, 'back');
    await waitForScene(page, 'profiles');
    expect(await sceneTexts(page, 'profiles')).toContain('ABCDEFGHIJKL');
    expectNoErrors(errors);
  });

  test('ft_1_07.AC9 the last player is not deleted, and the delete list says so at the first tap instead of asking first', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
    await waitForScene(page, 'profiles');
    await openAdminPage(page);
    await clickButton(page, 'admin', 3); // Delete player
    await waitForScene(page, 'adminDelete');
    // the others go, each with a tap that asks and one that deletes
    while ((await players(page)) > 1) {
      await clickButton(page, 'adminDelete', 0);
      await clickButton(page, 'adminDelete', 0);
      await expect.poll(() => sceneTexts(page, 'adminDelete')).not.toContain(expect.stringMatching(/^Delete .+\?$/));
    }
    await clickButton(page, 'adminDelete', 0);
    await expect.poll(() => sceneTexts(page, 'adminDelete')).toContain('Keep at least one player.');
    // it is written right under the name tapped, not at the list's foot
    const gap = await page.evaluate(() => {
      const scene = window.__game.scene.getScene('adminDelete') as unknown as { buttons: { rect: { y: number; height: number }; options: { label: string } }[]; root: { list: { text?: string; y: number }[] } };
      const name = window.__game.registry.get('context').profiles.profiles[0].name as string;
      const button = scene.buttons.find((b) => b.options.label === name)!.rect;
      const text = scene.root.list.find((o) => o.text === 'Keep at least one player.')!;
      return text.y - (button.y + button.height);
    });
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThanOrEqual(6);
    expect((await sceneTexts(page, 'adminDelete')).some((t) => /^Delete .+\?$/.test(t))).toBe(false);
    expect(await players(page)).toBe(1);
    expectNoErrors(errors);
  });

  test('ft_Y_13.AC1 in the room Right goes through the things in their order across the screen, and Left back reaches the telephone from the door', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
    await waitForScene(page, 'profiles');
    await clickButton(page, 'profiles', await profileButton(page, 'TUVI'));
    await waitForScene(page, 'profile');
    const focusedLabel = () => page.evaluate(() => {
      const scene = window.__game.scene.getScene('profile') as unknown as { focusables(): { focused: boolean; options: { label: string } }[] };
      return scene.focusables().find((b) => b.focused)?.options.label ?? null;
    });
    const walk = async (key: string, steps: number) => {
      const seen: (string | null)[] = [];
      for (let i = 0; i < steps; i++) {
        await page.keyboard.press(key);
        seen.push(await focusedLabel());
      }
      return seen;
    };
    await page.keyboard.press('ArrowRight'); // the first key only shows the ring
    // walk Right until Kiur, then on: the things in the room, left to right
    for (let i = 0; i < 12 && (await focusedLabel()) !== 'Kiur'; i++) await page.keyboard.press('ArrowRight');
    expect(await focusedLabel()).toBe('Kiur');
    expect(await walk('ArrowRight', 5)).toEqual(['Piano', 'Your card', 'Exercises', 'Telephone', 'Door']);
    expect(await walk('ArrowLeft', 4)).toEqual(['Telephone', 'Exercises', 'Your card', 'Piano']);
    expectNoErrors(errors);
  });

  for (const lang of ['en', 'et'] as const) {
    test(`the page says the language it is in (${lang})`, async ({ page }) => {
      const errors = await openGame(page, '?device=virtual', lang, 'profiles');
      expect(await page.evaluate(() => document.documentElement.lang)).toBe(lang);
      expectNoErrors(errors);
    });
  }
});
