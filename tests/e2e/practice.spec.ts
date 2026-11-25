// Covers ft_0_09.AC1, ft_1_12.AC12.
import { expect, test } from './fixtures';
import {
  LITTLE_STEPS, activeScenes, allMenuTitles, clickButton, clickToolbar, expectNoErrors, isPieceLabel, lastButton, menuButton, menuLabels, openGame, openPiece, playWithKeys, playWithVirtualPiano, results, sceneButton, sceneTexts, showMenuPageWith, toScoreScreen, turnMenuPage, waitForScene, bandAction, sceneWords } from './helpers';

test.describe('menu', () => {
  test('lists the pieces, shows the piano credit on the credits screen, and opens a piece with a real click @smoke', async ({ page }) => {
    const errors = await openGame(page);
    const texts = await sceneTexts(page, 'menu');
    // the New piece card is a staff-and-pencil picture now (no visible text); its label is still on the button
    expect(await sceneButton(page, 'menu', '+ New piece')).toBeGreaterThanOrEqual(0);
    expect(texts).not.toEqual(expect.arrayContaining(['Practice']));
    // the player's rank and XP are in the room since the band (ft_1_20.AC13), not on this screen
    expect(texts).not.toContain('0 / 100 XP');
    // The pieces come in pages of six; every one of them is on some page.
    expect(await allMenuTitles(page)).toEqual(
      expect.arrayContaining([
        'Bass Steps', 'High and Low', 'Little Steps', 'Rest Waltz', 'Twinkle Twinkle Little Star', 'Take Turns', 'Both Hands',
        'Hot Cross Buns', 'Ode to Joy', 'Stair Steps', 'Ode to Joy, Left Hand', 'Low Walk', 'Mary Had a Little Lamb', 'Au Clair de la Lune', 'Quiet Pond',
      ]),
    );

    await openPiece(page, 'Little Steps');
    expect(await page.evaluate(() => window.__game.scene.getScene('practice').chart.id)).toBe('little-steps');
    expectNoErrors(errors);
  });

  // Every button of every page stays on screen on the laptop (d105), with room left for the player to tap them.
  test('every button of the menu is on screen', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    const height = await page.evaluate(() => document.querySelector('canvas')!.height);
    for (let turn = 0; turn < 5; turn++) {
      const bounds = await page.evaluate(() =>
        (window.__game.scene.getScene('menu').buttons as { screenRect(): { top: number; bottom: number } }[])
          .slice(4) // the pieces and the pager; the four buttons at the top are smaller
          .map((b) => {
            const r = b.screenRect();
            return { top: r.top, bottom: r.bottom, height: r.bottom - r.top };
          }),
      );
      expect(bounds.length).toBeGreaterThan(0);
      for (const b of bounds) {
        expect(b.top).toBeGreaterThanOrEqual(0);
        expect(b.bottom).toBeLessThanOrEqual(height);
        expect(b.height).toBeGreaterThanOrEqual(64); // big enough for a small finger (a card is 32 art pixels, a pager key 18)
      }
      const next = await menuButton(page, 'Next');
      if (next < 0 || (await page.evaluate((i) => (window.__game.scene.getScene('menu').buttons[i] as { disabled: boolean }).disabled, next))) break;
      await turnMenuPage(page, next);
    }
    expectNoErrors(errors);
  });

  test('ft_1_12.AC12 a long list is paged: numbered pages, the turned corners turn them, and the page is remembered after playing a piece', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    const bookPage = () => page.evaluate(() => window.__game.scene.getScene('menu').page as number);
    // the book's pages are numbered at their feet (1 and 2 on the first spread), with no words
    const numbers = () => page.evaluate(() => (window.__game.scene.getScene('menu').children.list as unknown as { list?: { name: string; text?: string }[] }[]).flatMap((o) => o.list ?? []).filter((o) => o.name.startsWith('pageNumber:')).map((o) => o.name.slice('pageNumber:'.length)));
    expect(await numbers()).toEqual(['1', '2']);
    expect(await bookPage()).toBe(0);
    expect(await menuButton(page, 'Next')).toBeGreaterThanOrEqual(0);
    const first = await allMenuTitles(page);
    expect(first.length).toBeGreaterThan(6);
    expect(new Set(first).size).toBe(first.length); // no piece twice
    await showMenuPageWith(page, 'Little Steps'); // back to the first page (reading every page left the menu on the last)

    // Previous does nothing on the first page; Next goes to the second.
    await clickButton(page, 'menu', await menuButton(page, 'Previous'));
    expect(await bookPage()).toBe(0);
    await turnMenuPage(page, await menuButton(page, 'Next'));
    expect(await bookPage()).toBe(1);
    expect(await numbers()).toEqual(['3', '4']);

    // Open a piece from page 2 and come back: still page 2.
    const piece = (await menuLabels(page)).find(isPieceLabel)!;
    await clickButton(page, 'menu', (await menuLabels(page)).indexOf(piece)); // a real click, on the page the menu is on now
    await waitForScene(page, 'practice');
    await page.keyboard.press('Escape');
    await waitForScene(page, 'menu');
    expect(await page.evaluate(() => window.__game.scene.getScene('menu').page as number)).toBe(1);
    expectNoErrors(errors);
  });
});

test.describe('playing a whole piece without a real keyboard', () => {
  test('with the computer keyboard: results show full accuracy and five stars worth of notes', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await playWithKeys(page, LITTLE_STEPS);
    await toScoreScreen(page);

    expect(await results(page)).toMatchObject({ notes: 11, firstTryCorrect: 11, mistakes: 0, accuracy: 1, hints: { noteNames: 0, fingers: 0 } });
    const texts = await sceneTexts(page, 'results');
    // the score screen keeps few lines (ft_1_12.AC4, the clean-screen rule): no hints or detail lines
    expect(texts).toEqual(expect.arrayContaining(['Your round: 100% right the first time', 'No wrong keys at all!']));
    // the two buttons are small icons, with no text on them (ft_1_12.AC7)
    expect(texts).not.toContain('Play again');
    expect(texts).not.toContain('More pieces');
    expectNoErrors(errors);
  });

  test('through the virtual EZ-220: raw MIDI bytes, the Web MIDI wrapper, the judge and the results', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    expect(await sceneWords(page, 'practice')).toContain('Piano: Virtual EZ-220 (simulated)');
    await playWithVirtualPiano(page, LITTLE_STEPS);
    await toScoreScreen(page);
    expect(await results(page)).toMatchObject({ notes: 11, accuracy: 1, mistakes: 0 });
    expectNoErrors(errors);
  });

  test('ft_1_12.AC7: a wrong key shows the key played on the staff with its name, no sentence; it does not stop the piece and is counted', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    expect(await sceneTexts(page, 'practice')).toContain('Play the lit note when you are ready');
    const played = () => page.evaluate(() => window.__game.scene.getScene('practice').playSession.staffView?.playedShown ?? null);

    await playWithKeys(page, [65]); // F4 while C4 is awaited
    await expect.poll(played).toBe('F');
    expect(await sceneTexts(page, 'practice')).not.toContain('Not that one. Look for a lower note.');
    expect(await page.evaluate(() => window.__game.scene.getScene('practice').playSession.controller.getState().stepIndex)).toBe(0);
    await playWithKeys(page, [60]); // the right key clears it
    await expect.poll(played).toBeNull();

    await playWithKeys(page, LITTLE_STEPS.slice(1));
    await toScoreScreen(page);
    const result = await results(page);
    expect(result).toMatchObject({ notes: 11, mistakes: 1, firstTryCorrect: 10 });
    expect(await sceneTexts(page, 'results')).toContain('Wrong keys: 1');
    expectNoErrors(errors);
  });

  test('hints switched on with real clicks are recorded in the results', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await clickButton(page, 'practice', await sceneButton(page, 'practice', 'Note names'));
    await clickButton(page, 'practice', await sceneButton(page, 'practice', 'Fingers'));
    expect(await page.evaluate(() => window.__game.scene.getScene('practice').hints)).toEqual({ noteNames: true, fingers: true });

    await playWithKeys(page, LITTLE_STEPS);
    await toScoreScreen(page);
    expect((await results(page)).hints).toEqual({ noteNames: 11, fingers: 11 });
    expectNoErrors(errors);
  });

  test('a hint can be switched off again and then costs nothing', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    const fingers = () => page.evaluate(() => window.__game.scene.getScene('practice').hints.fingers as boolean);
    await clickButton(page, 'practice', await sceneButton(page, 'practice', 'Fingers'));
    await expect.poll(fingers).toBe(true);
    // a worn hint keeps the bubble open: the second press is on the same option
    await clickButton(page, 'practice', await lastButton(page, 'practice', 'Fingers'));
    await expect.poll(fingers).toBe(false);
    await playWithKeys(page, LITTLE_STEPS);
    await toScoreScreen(page);
    expect((await results(page)).hints).toEqual({ noteNames: 0, fingers: 0 });
    expectNoErrors(errors);
  });
});

test.describe('other pieces', () => {
  test('a piece with rests and 3/4 time can be played to the end', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await openPiece(page, 'Rest Waltz');
    await playWithKeys(page, [60, 62, 64, 67, 60]); // C D E | G (rest) | (bar rest) | C (rest)
    await toScoreScreen(page);
    expect(await results(page)).toMatchObject({ notes: 5, accuracy: 1 });
    expectNoErrors(errors);
  });

  test('a piece with eighth notes is drawn with beams and can be played to the end', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await openPiece(page, 'Skipping Stones');
    const drawn = await page.evaluate(() => {
      const layout = window.__game.scene.getScene('practice').playSession.staffView.layout;
      return { notes: layout.notes.length as number, beams: layout.beams.length as number, flags: layout.notes.filter((n: { flag: boolean }) => n.flag).length as number, fits: layout.fits as boolean };
    });
    expect(drawn).toEqual({ notes: 36, beams: 10, flags: 0, fits: true });
    // C D E F G | G F E D C | C E G E C | D E F G E | G G F E D | E D C D E | F E D C D | C
    await playWithVirtualPiano(page, [60, 62, 64, 65, 67, 67, 65, 64, 62, 60, 60, 64, 67, 64, 60, 62, 64, 65, 67, 64, 67, 67, 65, 64, 62, 64, 62, 60, 62, 64, 65, 64, 62, 60, 62, 60]);
    await toScoreScreen(page);
    expect(await results(page)).toMatchObject({ accuracy: 1, mistakes: 0 });
    expectNoErrors(errors);
  });

  test('a left-hand piece on the bass clef can be played to the end', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await openPiece(page, 'Bass Steps');
    // C3 D3 E3 F3 | G3 F3 | E3 D3 C3 | C3 : played one octave up on the computer keyboard base, so shift down an octave first
    await page.keyboard.press('ArrowLeft');
    await playWithKeys(page, [48, 50, 52, 53, 55, 53, 52, 50, 48, 48].map((m) => m + 12));
    await toScoreScreen(page);
    expect(await results(page)).toMatchObject({ notes: 10, accuracy: 1 });
    expectNoErrors(errors);
  });
});

test.describe('moving around', () => {
  test('play again restarts the same piece from the first note', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await playWithKeys(page, LITTLE_STEPS);
    await toScoreScreen(page);
    await clickButton(page, 'results', await bandAction(page, 'results', 0));
    await waitForScene(page, 'practice');
    expect(await page.evaluate(() => window.__game.scene.getScene('practice').playSession.controller.getState())).toMatchObject({ stepIndex: 0, done: false });
    expectNoErrors(errors);
  });

  test('more pieces goes back to the menu', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await playWithKeys(page, LITTLE_STEPS);
    await toScoreScreen(page);
    await clickButton(page, 'results', await bandAction(page, 'results', 1));
    await waitForScene(page, 'menu');
    expect(await activeScenes(page)).toContain('menu');
    expectNoErrors(errors);
  });

  test('the Back button and the Escape key leave a piece: to the score screen after notes, to the list before any (ft_1_12.AC4)', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await playWithKeys(page, [60, 62]);
    await clickToolbar(page, 'back');
    await waitForScene(page, 'results');
    await clickToolbar(page, 'back');
    await waitForScene(page, 'menu');

    await openPiece(page, 'Little Steps');
    await page.keyboard.press('Escape');
    await waitForScene(page, 'menu');
    expectNoErrors(errors);
  });
});

test.describe('input availability', () => {
  test('without a real piano the on-screen keyboard stays hidden (d099), the game points at the computer keyboard, and its keys work', async ({ page }) => {
    const errors = await openGame(page, '');
    await expect(page.locator('#keyboard')).toBeHidden();
    await openPiece(page, 'Little Steps');
    expect(await sceneWords(page, 'practice')).toContain('No piano found. Use the computer keyboard.');
    await playWithKeys(page, LITTLE_STEPS);
    await toScoreScreen(page);
    expect((await results(page)).accuracy).toBe(1);
    expectNoErrors(errors);
  });

  test('clicking the on-screen keys plays notes too, and the game points at them while they are shown @smoke', async ({ page }) => {
    const errors = await openGame(page, '?keys=1');
    await expect(page.locator('#keyboard')).toBeVisible();
    await openPiece(page, 'Little Steps');
    expect(await sceneWords(page, 'practice')).toContain('No piano found. Use the on-screen keys or the computer keyboard.');
    await page.locator('[data-testid="on-screen-keyboard"] [data-midi="60"]').click(); // C4
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('practice').playSession.controller.getState().stepIndex)).toBe(1);
    expectNoErrors(errors);
  });

  test('with the virtual EZ-220 connected the on-screen keyboard steps aside', async ({ page }) => {
    const errors = await openGame(page);
    await expect(page.locator('#keyboard')).toBeHidden();
    expectNoErrors(errors);
  });
});
