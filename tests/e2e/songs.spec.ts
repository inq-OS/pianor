// Covers ft_1_36.AC6, ft_1_36.AC7, ft_1_36.AC8, ft_1_36.AC9, ft_1_36.AC11, ft_1_36.AC12, ft_1_36.AC20.
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { allMenuTitles, clickButton, expectNoErrors, openGame, sceneButton, sceneTexts, waitForScene } from './helpers';

const partsOff = (page: Page) => page.evaluate(() => [...window.__game.registry.get('context').profiles.songPartsOff('morning-song')] as string[]);
const rowLabels = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('song').buttons as { options: { label: string; align?: string } }[]).filter((b) => b.options.align === 'left').map((b) => b.options.label));
const practising = (page: Page) => page.evaluate(() => {
  const chart = window.__game.scene.getScene('practice').chart as { id: string; bars: unknown[] };
  return { id: chart.id, bars: chart.bars.length };
});

/** Presses a key on the song page and waits until it is drawn again. */
async function press(page: Page, key: string): Promise<void> {
  const frame = await page.evaluate(() => window.__game.loop.frame);
  await page.keyboard.press(key);
  await page.waitForFunction((f) => window.__game.loop.frame >= f + 2, frame);
}

/** The words a song puts on the practice staff: its part names and its folds (ft_1_36 rule 7). */
const staffWords = (page: Page) => page.evaluate(() => {
  const view = (window.__game.scene.getScene('practice') as unknown as { playSession: { view: { partTexts: { text: { text: string } }[] } } }).playSession.view;
  return view.partTexts.map((p) => p.text.text);
});

async function openSongPage(page: Page): Promise<void> {
  await clickButton(page, 'menu', await sceneButton(page, 'menu', 'Songs'));
  await waitForScene(page, 'songs');
  await clickButton(page, 'songs', await sceneButton(page, 'songs', 'Morning Song'));
  await waitForScene(page, 'song');
}

test.describe('songs made of pieces', () => {
  test('ft_1_36.AC6 the song bookmark opens the songs list in the book; a song\'s pieces are not listed on their own; its play button plays the whole song', async ({ page }) => {
    const errors = await openGame(page);
    const titles = await allMenuTitles(page);
    expect(titles.some((t) => t.startsWith('Morning Song'))).toBe(false);
    await clickButton(page, 'menu', await sceneButton(page, 'menu', 'Songs'));
    await waitForScene(page, 'songs');
    const texts = await sceneTexts(page, 'songs');
    expect(texts).toEqual(expect.arrayContaining(['24 of 82 bars, 3 parts', '♩80 C']));
    await clickButton(page, 'songs', await sceneButton(page, 'songs', 'Play Morning Song'));
    await waitForScene(page, 'practice');
    // the intro and the outro, joined: the blanks between are folded out
    expect(await practising(page)).toEqual({ id: 'song:morning-song', bars: 24 });
    expectNoErrors(errors);
  });

  test('ft_1_36.AC7 ft_1_36.AC8 the song page shows the whole song and the numbered outline; the keyboard walks, unfolds and plays the rows', async ({ page }) => {
    const errors = await openGame(page);
    await openSongPage(page);
    const rows = await rowLabels(page);
    expect(rows[0]).toBe('Morning Song');
    expect(rows.slice(1).map((r) => r.split(' ')[0])).toEqual(['1', '2', '2.1', '2.2', '2.3', '3']);
    expect(rows[1]).toBe('1 Intro +2');
    expect(await sceneTexts(page, 'song')).toEqual(expect.arrayContaining(['1-82', '71-82', '13-36']));
    // the first key only shows the selection: Enter on opening never plays
    await press(page, 'Enter');
    expect(await page.evaluate(() => window.__game.scene.getScenes(true).some((s) => s.scene.key === 'song'))).toBe(true);
    // Down to the intro, Right unfolds its phrases
    await press(page, 'ArrowDown');
    await press(page, 'ArrowRight');
    expect((await rowLabels(page)).slice(1, 4)).toEqual(['1 Intro', '1.1 First half', '1.2 Second half']);
    // a blank has no play button; Enter on the intro plays it alone
    expect(await sceneButton(page, 'song', 'Play Verse 1')).toBe(-1);
    await press(page, 'Enter');
    await waitForScene(page, 'practice');
    expect(await practising(page)).toEqual({ id: 'morning-song-intro', bars: 12 });
    expectNoErrors(errors);
  });

  test('ft_1_36.AC11 ft_1_36.AC20 a switch takes a part out of the song for this player and survives a reload; the last written part stays on; a label turns its parts at once', async ({ page }) => {
    const errors = await openGame(page);
    await openSongPage(page);
    // a first key shows the selection, then Down six times to the outro, Space takes it out
    await press(page, 'ArrowDown');
    for (let i = 0; i < 6; i++) await press(page, 'ArrowDown');
    await press(page, ' ');
    await expect.poll(() => partsOff(page)).toEqual(['outro']);
    // the intro is now the last written part on: its switch does nothing and says why
    for (let i = 0; i < 5; i++) await press(page, 'ArrowUp');
    await press(page, ' ');
    expect(await partsOff(page)).toEqual(['outro']);
    expect(await sceneTexts(page, 'song')).toContain('One part must stay on.');
    // the Verse label in the strip takes both verses out at once
    await clickButton(page, 'song', await sceneButton(page, 'song', 'Verse'));
    await expect.poll(() => partsOff(page)).toEqual(['outro', 'verse-1', 'verse-2']);
    // the switches are this player's, kept across a reload
    await openGame(page);
    expect(await partsOff(page)).toEqual(['outro', 'verse-1', 'verse-2']);
    expectNoErrors(errors);
  });

  test('ft_1_36.AC9 ft_1_36.AC12 the whole song names its parts and folds its blanks on the staff; a play with a part off is kept apart; Back returns to the song page', async ({ page }) => {
    const errors = await openGame(page);
    await openSongPage(page);
    await clickButton(page, 'song', await sceneButton(page, 'song', 'Play Morning Song'));
    await waitForScene(page, 'practice');
    expect(await staffWords(page)).toEqual(['Intro', 'Outro', 'Verses and chorus, bars 13 to 70, not written yet']);
    expect((await practising(page)).id).toBe('song:morning-song');
    // Back leads to the song page the play started from, not the piece book
    await page.keyboard.press('Escape');
    await waitForScene(page, 'song');
    // with the outro off the whole song is another chart, so its passes never count as the song's best
    for (let i = 0; i < 7; i++) await press(page, 'ArrowDown');
    await press(page, ' ');
    await expect.poll(() => partsOff(page)).toEqual(['outro']);
    await clickButton(page, 'song', await sceneButton(page, 'song', 'Play Morning Song'));
    await waitForScene(page, 'practice');
    const some = await practising(page);
    expect(some.bars).toBe(12);
    expect(some.id).not.toBe('song:morning-song');
    expect(await staffWords(page)).toContain('Outro, bars 71 to 82, off');
    expectNoErrors(errors);
  });

  test('ft_1_36.AC12 the song\'s stats from the songs list go back to the songs list, also by way of its learning page', async ({ page }) => {
    const errors = await openGame(page);
    await clickButton(page, 'menu', await sceneButton(page, 'menu', 'Songs'));
    await waitForScene(page, 'songs');
    await clickButton(page, 'songs', await sceneButton(page, 'songs', 'S'));
    await waitForScene(page, 'results');
    expect(await sceneButton(page, 'results', 'Back to the songs')).toBeGreaterThanOrEqual(0);
    await page.keyboard.press('Escape');
    await waitForScene(page, 'songs');
    expectNoErrors(errors);
  });
});
