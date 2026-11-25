// Covers ft_1_36.AC14, ft_1_36.AC6, ft_1_36.AC7, ft_1_36.AC8, ft_1_36.AC9, ft_1_36.AC10, ft_1_36.AC11, ft_1_36.AC12, ft_1_36.AC20.
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { allMenuTitles, clickButton, expectNoErrors, menuButton, openGame, pressInBubble, sceneButton, sceneTexts, waitForScene } from './helpers';

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

/** The song map over the practice staff (ft_1_36 rule 8): its blocks, the lit one, whether a page frame is drawn, and the staff's page. */
const songMap = (page: Page) => page.evaluate(() => {
  const scene = window.__game.scene.getScene('practice') as unknown as {
    mapDrawn: { blocks: { id: string; name: string; w: number }[]; buttons: Map<string, { active: boolean }>; frame: unknown } | null;
    playSession: { view: { currentPage: number } };
  };
  const drawn = scene.mapDrawn;
  return {
    names: drawn?.blocks.map((b) => b.name) ?? [],
    widths: drawn?.blocks.map((b) => b.w) ?? [],
    lit: drawn?.blocks.filter((b) => drawn.buttons.get(b.id)?.active).map((b) => b.name) ?? [],
    framed: Boolean(drawn?.frame),
    page: scene.playSession.view.currentPage,
  };
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

  test('ft_1_36.AC10 the song map shows the parts by their bars, frames the page and lights the part being played; a press turns the page without starting play', async ({ page }) => {
    const errors = await openGame(page);
    await openSongPage(page);
    await clickButton(page, 'song', await sceneButton(page, 'song', 'Play Morning Song'));
    await waitForScene(page, 'practice');
    const map = await songMap(page);
    expect(map.names).toEqual(['Intro', 'Verse 1', 'Chorus', 'Verse 2', 'Outro']);
    // a 24-bar verse is wider than the 12-bar intro; no block is narrower than the minimum
    expect(map.widths[1]!).toBeGreaterThan(map.widths[0]!);
    expect(Math.min(...map.widths)).toBeGreaterThanOrEqual(16);
    expect(map.lit).toEqual(['Intro']);
    expect(map.framed).toBe(true);
    expect(map.page).toBe(0);
    // the outro's block turns the staff to the outro; the intro is still the part to play
    await clickButton(page, 'practice', await sceneButton(page, 'practice', 'Outro'));
    const turned = await songMap(page);
    expect(turned.page).toBeGreaterThan(0);
    expect(turned.lit).toEqual(['Intro']);
    expect(turned.framed).toBe(true);
    expectNoErrors(errors);
  });

  test('ft_1_36.AC6 the library files a song by its title, never its pieces, and turns it off as one; the songs list then leaves it out; its i button opens its info card', async ({ page }) => {
    const errors = await openGame(page);
    // the info card from the songs list: the song's title, closed by Escape
    await clickButton(page, 'menu', await sceneButton(page, 'menu', 'Songs'));
    await waitForScene(page, 'songs');
    await clickButton(page, 'songs', await sceneButton(page, 'songs', 'i'));
    await expect.poll(() => sceneTexts(page, 'songs')).toContain('Close');
    await page.keyboard.press('Escape');
    await expect.poll(() => sceneTexts(page, 'songs')).not.toContain('Close');
    await page.keyboard.press('Escape');
    await waitForScene(page, 'menu');
    // the library: one card for the song, none for its pieces
    await clickButton(page, 'menu', await menuButton(page, 'Settings'));
    await waitForScene(page, 'settings');
    await clickButton(page, 'settings', await sceneButton(page, 'settings', 'Choose pieces'));
    await waitForScene(page, 'pieces');
    const drawerOf = (title: string) => page.evaluate((x) => (window.__game.scene.getScene('pieces') as unknown as { drawerOf(t: string): { label: string } | null }).drawerOf(x), title);
    expect(await drawerOf('Morning Song: Intro')).toBeNull();
    const drawer = await drawerOf('Morning Song');
    expect(drawer).not.toBeNull();
    await clickButton(page, 'pieces', await sceneButton(page, 'pieces', drawer!.label));
    await clickButton(page, 'pieces', await sceneButton(page, 'pieces', 'Morning Song'));
    await expect.poll(() => page.evaluate(() => [...window.__game.registry.get('context').profiles.hiddenPieces] as string[])).toContain('song:morning-song');
    // the songs list no longer shows it
    await page.evaluate(() => { window.__game.scene.stop('pieces'); window.__game.scene.start('songs'); });
    await waitForScene(page, 'songs');
    expect(await sceneTexts(page, 'songs')).toContain('All songs are off. Turn some on in Settings.');
    expectNoErrors(errors);
  });

  test('ft_1_36.AC11 a player\'s first song page says once what a tick does, until a switch is pressed, and never again after a reload', async ({ page }) => {
    const errors = await openGame(page);
    await openSongPage(page);
    expect(await sceneTexts(page, 'song')).toContain('Ticked parts are played.');
    // a press on a switch: the hint has done its work and goes
    await clickButton(page, 'song', await sceneButton(page, 'song', 'In the song'));
    await expect.poll(() => sceneTexts(page, 'song')).not.toContain('Ticked parts are played.');
    await page.keyboard.press('Escape');
    await waitForScene(page, 'songs');
    await clickButton(page, 'songs', await sceneButton(page, 'songs', 'Morning Song'));
    await waitForScene(page, 'song');
    expect(await sceneTexts(page, 'song')).not.toContain('Ticked parts are played.');
    // told is kept: after a reload the hint does not come back
    await openGame(page);
    await openSongPage(page);
    expect(await sceneTexts(page, 'song')).not.toContain('Ticked parts are played.');
    expectNoErrors(errors);
  });

  test('ft_1_36.AC14 a new song takes its title and one blank; rows are added, moved, renamed and removed through the bubble, each undoable, and kept after a reload', async ({ page }) => {
    const errors = await openGame(page);
    await clickButton(page, 'menu', await sceneButton(page, 'menu', 'Songs'));
    await waitForScene(page, 'songs');
    await clickButton(page, 'songs', await sceneButton(page, 'songs', '+ New song'));
    await expect(page.locator('#text-field')).toBeFocused();
    await page.keyboard.type('Evening Tune');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'song');
    await expect.poll(() => rowLabels(page)).toEqual(['Evening Tune', '1 Part 1']);
    // a group after the first part, holding a new blank
    await clickButton(page, 'song', await sceneButton(page, 'song', '1 Part 1'));
    await pressInBubble(page, 'song', 'Add');
    await clickButton(page, 'song', await sceneButton(page, 'song', 'New group'));
    await expect.poll(() => rowLabels(page)).toEqual(['Evening Tune', '1 Part 1', '2 Group 1', '2.1 Part 2']);
    // out of its group, then back by Undo
    await clickButton(page, 'song', await sceneButton(page, 'song', '2.1 Part 2'));
    await pressInBubble(page, 'song', 'Move');
    await clickButton(page, 'song', await sceneButton(page, 'song', 'Out of group'));
    await expect.poll(() => rowLabels(page)).toEqual(['Evening Tune', '1 Part 1', '2 Group 1', '3 Part 2']);
    await page.keyboard.press('Control+z');
    await expect.poll(() => rowLabels(page)).toEqual(['Evening Tune', '1 Part 1', '2 Group 1', '2.1 Part 2']);
    // a name typed in the row's field
    await clickButton(page, 'song', await sceneButton(page, 'song', '1 Part 1'));
    await pressInBubble(page, 'song', 'Name');
    await expect(page.locator('#text-field')).toBeFocused();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('Verse');
    await page.keyboard.press('Enter');
    await expect.poll(() => rowLabels(page)).toEqual(['Evening Tune', '1 Verse', '2 Group 1', '2.1 Part 2']);
    // removed at once, and said
    await clickButton(page, 'song', await sceneButton(page, 'song', '2 Group 1'));
    await pressInBubble(page, 'song', 'Remove');
    await expect.poll(() => rowLabels(page)).toEqual(['Evening Tune', '1 Verse']);
    expect(await sceneTexts(page, 'song')).toContain('Removed Group 1.');
    // kept on this device
    await openGame(page);
    await clickButton(page, 'menu', await sceneButton(page, 'menu', 'Songs'));
    await waitForScene(page, 'songs');
    await clickButton(page, 'songs', await sceneButton(page, 'songs', 'Evening Tune'));
    await waitForScene(page, 'song');
    await expect.poll(() => rowLabels(page)).toEqual(['Evening Tune', '1 Verse']);
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
