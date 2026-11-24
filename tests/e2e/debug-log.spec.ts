import { readFile } from 'node:fs/promises';
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { clickButton, openGame, playWithVirtualPiano, profileButton, waitForScene } from './helpers';

/** The built-in debug log (ft_Y_15): `?debug=1` keeps what happened in memory and the corner button saves it as a text file. */

async function downloadLog(page: Page): Promise<string> {
  const download = page.waitForEvent('download');
  await page.locator('#debug-log').click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^pianor-debug-\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d\.txt$/);
  return readFile(await file.path(), 'utf8');
}

test('without ?debug=1 there is no button and the log stays off (ft_Y_15.AC1)', async ({ page }) => {
  await openGame(page);
  await expect(page.locator('#debug-log')).toHaveCount(0);
});

test.describe(() => {
  // the test throws an error on purpose, for the log to keep
  test.use({ allowPageErrors: true });
  test('with ?debug=1 the button saves the screens, keys played and an uncaught error (ft_Y_15.AC2, ft_Y_15.AC3)', async ({ page }) => {
    await openGame(page, '?device=virtual&debug=1');
    await playWithVirtualPiano(page, [60]);
    await page.evaluate(() => setTimeout(() => { throw new RangeError('test error from the debug log test'); }));
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('pianor.debugLog') ?? '')).toContain('test error');
    const text = await downloadLog(page);
    expect(text).toMatch(/ page http:\/\/[^ ]+debug=1/);
    expect(text).toContain(' scene boot');
    expect(text).toContain(' scene menu');
    expect(text).toMatch(/ note on 60 v80 /);
    expect(text).toContain(' error RangeError: test error from the debug log test');

    // the page reloaded in the same tab starts with what the page before it left
    await page.reload();
    await page.locator('#debug-log').waitFor();
    const after = await downloadLog(page);
    expect(after.indexOf('test error from the debug log test')).toBeGreaterThan(-1);
    expect(after.indexOf('test error from the debug log test')).toBeLessThan(after.indexOf('--- page reloaded ---'));
  });
});

test('a name typed on the name screen is written as stars (ft_Y_15.AC3)', async ({ page }) => {
  await openGame(page, '?device=virtual&debug=1', 'en', 'profiles');
  await clickButton(page, 'profiles', await profileButton(page, 'New player'));
  await waitForScene(page, 'name');
  await page.keyboard.type('Kzx');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'profile');
  const text = await downloadLog(page);
  expect(text).toContain(' scene name');
  expect(text).toContain(' key *');
  expect(text).not.toMatch(/ key [Kzx]$/m);
  expect(text).toContain(' key Enter');
});
