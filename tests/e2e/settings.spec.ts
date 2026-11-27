// Covers ft_1_32.AC2 (the learning settings), ft_0_16.AC3, ft_0_16.AC4, ft_1_11.AC1, ft_1_11.AC6, ft_1_16.AC1.
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { addPlayer, clickAndRedraw, clickButton, clickToolbar, expectNoErrors, goToMainMenu, menuButton, openGame, openPiece, openSettings, pickProfile, playerName, results, sceneButton, sceneTexts, toScoreScreen, useOneLine, waitForScene } from './helpers';

/** The settings screen's buttons, in the order it makes them: one per setting, each press moving to its next choice; then the band's door (d088, ft_1_20). */
const LINES = 0;
const BARS = 2;
const BAR_NUMBERS = 3;
const CHORD = 4;
const DURATION_LH = 6;
const DURATION_RH = 7;

const settings = (page: Page) => page.evaluate(() => window.__game.registry.get('context').profiles.staffSettings as { lines: unknown; barsPerLine: unknown });

const staff = (page: Page) =>
  page.evaluate(() => {
    const view = window.__game.scene.getScene('practice').playSession.staffView;
    const l = view.layout;
    return {
      fits: l.fits as boolean, staffSpace: l.staffSpace as number, linesPerPage: l.linesPerPage as number, pageCount: l.pageCount as number,
      barsOnLine: l.systems[0].barCount as number, page: view.currentPage as number,
    };
  });

test.describe('one line of music at a time', () => {
  test('a piece longer than one line turns the page as it is played, to the end', async ({ page }) => {
    const errors = await openGame(page);
    await useOneLine(page);
    await openPiece(page, 'Twinkle Twinkle Little Star');
    const start = await staff(page);
    expect(start).toMatchObject({ fits: true, linesPerPage: 1, barsOnLine: 2, page: 0 });
    expect(start.pageCount).toBe(4);
    expect(start.staffSpace).toBeGreaterThanOrEqual(28); // one line of 2 bars of a one-hand piece on the laptop

    // Play every note through the virtual piano and note, after each one, the page on screen and the page of the next note.
    const seen = await page.evaluate(async () => {
      const scene = window.__game.scene.getScene('practice');
      const layout = scene.playSession.staffView.layout;
      const pageOf = (index: number) => layout.systems[layout.notes.find((n: { index: number }) => n.index === index).system].page as number;
      const out: { shown: number; expected: number | null }[] = [];
      for (const note of scene.chart.notes as { midi: number }[]) {
        window.__virtualDevice!.press(note.midi, 80);
        window.__virtualDevice!.release(note.midi);
        await new Promise((r) => setTimeout(r, 20));
        const awaiting = scene.playSession.controller.getState().awaiting as number[];
        out.push({ shown: scene.playSession.staffView.currentPage, expected: awaiting.length > 0 ? pageOf(awaiting[0]!) : null });
      }
      return out;
    });
    for (const [i, s] of seen.entries()) if (s.expected !== null) expect(s.shown, `after note ${i + 1}`).toBe(s.expected);
    expect(seen.map((s) => s.shown)).toEqual([...seen.map((s) => s.shown)].sort((a, b) => a - b)); // never back
    expect(new Set(seen.map((s) => s.shown))).toEqual(new Set([0, 1, 2, 3])); // every page was shown

    await toScoreScreen(page);
    expect(await results(page)).toMatchObject({ accuracy: 1, mistakes: 0, notes: 28 });
    expectNoErrors(errors);
  });

  test('a two-hand piece on one line: both staves with big notes, and both hands keep to the page', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await useOneLine(page);
    await openPiece(page, 'Both Hands');
    const start = await staff(page);
    expect(start).toMatchObject({ fits: true, linesPerPage: 1, page: 0 });
    expect(start.staffSpace).toBeGreaterThanOrEqual(20); // was 13 when the whole piece had to fit
    expectNoErrors(errors);
  });
});

test.describe('settings', () => {
  const openSettings = async (page: Page) => {
    await clickButton(page, 'menu', await menuButton(page, 'Settings'));
    await waitForScene(page, 'settings');
  };
  /** The name of a settings button's current choice: its tooltip when it shows a number, else its label (a picture's name). */
  const shows = (page: Page, index: number) =>
    page.evaluate((i) => {
      const o = (window.__game.scene.getScene('settings').buttons[i] as { options: { label: string; tooltip?: string } }).options;
      return o.tooltip ?? o.label;
    }, index);
  /** The text a settings button draws (a number, or blank). */
  const buttonText = (page: Page, index: number) => page.evaluate((i) => (window.__game.scene.getScene('settings').buttons[i] as { options: { label: string } }).options.label, index);
  /** The button shows its choice as a picture, never as a word that could be cut short. */
  const isPicture = (page: Page, index: number) => page.evaluate((i) => (window.__game.scene.getScene('settings').buttons[i] as { options: { iconOnly?: boolean } }).options.iconOnly === true, index);

  test('ft_1_32.AC2 ft_1_32.AC12 the second page sets how a piece is learned: the step size, the rings and their threshold, the hands', async ({ page }) => {
    const errors = await openGame(page);
    await openSettings(page);
    await clickAndRedraw(page, 'settings', await sceneButton(page, 'settings', 'Learning'));
    expect(await sceneTexts(page, 'settings')).toEqual(expect.arrayContaining(['New bars in learning', 'Rings over missed notes', 'Ring after misses', 'Two-hand pieces']));
    const learn = () => page.evaluate(() => window.__game.registry.get('context').profiles.learnSettings as unknown);
    expect([await shows(page, 0), await shows(page, 1), await shows(page, 2), await shows(page, 3)]).toEqual(['One bar at a time', 'Rings on', 'After 2 misses', 'Both hands together']);
    await clickAndRedraw(page, 'settings', 0);
    await clickAndRedraw(page, 'settings', 1);
    await clickAndRedraw(page, 'settings', 2);
    await clickAndRedraw(page, 'settings', 3);
    await expect.poll(learn).toEqual({ stepBars: 2, markers: false, markersFrom: 3, handsApart: true });
    // the same button turns back to the first page: its rows are where they were
    await clickAndRedraw(page, 'settings', await sceneButton(page, 'settings', 'Learning'));
    expect(await shows(page, LINES)).toBe('2');
    expectNoErrors(errors);
  });

  test('are changed with real clicks, and the practice screen follows them', async ({ page }) => {
    const errors = await openGame(page);
    await openSettings(page);
    expect(await sceneTexts(page, 'settings')).toEqual(expect.arrayContaining(['Settings', 'Lines of music on the screen', 'Bars on a line']));
    expect([await shows(page, LINES), await shows(page, BARS)]).toEqual(['2', 'Auto']); // two lines by default
    expect(await buttonText(page, BARS)).toBe('A');

    await clickAndRedraw(page, 'settings', BARS);
    await expect.poll(() => settings(page)).toEqual({ lines: 2, barsPerLine: 2 });
    await clickAndRedraw(page, 'settings', BARS);
    await expect.poll(() => settings(page)).toEqual({ lines: 2, barsPerLine: 4 });
    expect([await shows(page, LINES), await shows(page, BARS)]).toEqual(['2', '4']);

    await clickToolbar(page, 'back');
    await waitForScene(page, 'menu');
    await openPiece(page, 'Twinkle Twinkle Little Star');
    expect(await staff(page)).toMatchObject({ fits: true, linesPerPage: 2, barsOnLine: 4, pageCount: 1 });
    await page.keyboard.press('Escape');
    await waitForScene(page, 'menu');

    await openSettings(page);
    await clickAndRedraw(page, 'settings', LINES); // after the last choice comes the first again
    await expect.poll(() => settings(page)).toEqual({ lines: 'all', barsPerLine: 4 });
    await clickAndRedraw(page, 'settings', LINES);
    await expect.poll(() => settings(page)).toEqual({ lines: 1, barsPerLine: 4 });
    await clickAndRedraw(page, 'settings', BARS);
    await expect.poll(() => settings(page)).toEqual({ lines: 1, barsPerLine: 'auto' });
    await page.keyboard.press('Escape'); // Escape leaves the settings too
    await waitForScene(page, 'menu');
    expectNoErrors(errors);
  });

  test('survive a reload of the page', async ({ page }) => {
    test.slow(); // the game loads twice
    await openGame(page);
    await openSettings(page);
    await clickAndRedraw(page, 'settings', LINES);
    await expect.poll(() => settings(page)).toEqual({ lines: 'all', barsPerLine: 'auto' });
    const errors = await openGame(page);
    expect(await settings(page)).toEqual({ lines: 'all', barsPerLine: 'auto' });
    expectNoErrors(errors);
  });

  test('ft_0_16.AC7: bar numbers are off until a choice is clicked, the practice staff follows it (every bar too), and it survives a reload', async ({ page }) => {
    test.slow(); // the game loads twice
    const mode = () => page.evaluate(() => window.__game.registry.get('context').profiles.barNumberSettings.mode as string);
    const drawn = () => page.evaluate(() => (window.__game.scene.getScene('practice').playSession.staffView.barNumbers as { number: number }[]).map((b) => b.number));
    /** Press the bar numbers button `times` times: off, first bar, every bar, every 2nd, every 4th, then off again. */
    const press = async (times: number) => {
      for (let i = 0; i < times; i++) {
        const before = await mode();
        await clickAndRedraw(page, 'settings', BAR_NUMBERS);
        await expect.poll(mode).not.toBe(before);
      }
    };
    await openGame(page);
    await openSettings(page);
    expect(await sceneTexts(page, 'settings')).toEqual(expect.arrayContaining(['Bar numbers']));
    expect(await mode()).toBe('off');
    expect(await shows(page, BAR_NUMBERS)).toBe('Off'); // the picture's name
    expect(await isPicture(page, BAR_NUMBERS)).toBe(true); // five bars with no numbers

    await press(1);
    expect(await mode()).toBe('first');
    expect(await shows(page, BAR_NUMBERS)).toBe('First bar');
    await press(2);
    expect(await mode()).toBe('every2');
    expect(await shows(page, BAR_NUMBERS)).toBe('Every 2nd');
    expect(await isPicture(page, BAR_NUMBERS)).toBe(true); // 1, 3 and 5 over five bars
    expect(await settings(page)).toEqual({ lines: 2, barsPerLine: 'auto' }); // the other settings are left alone

    const errors = await openGame(page);
    expect(await mode()).toBe('every2');
    await openPiece(page, 'Twinkle Twinkle Little Star');
    expect(await drawn()).toEqual([1, 3, 5, 7]);
    await page.keyboard.press('Escape');
    await waitForScene(page, 'menu');
    await openSettings(page);
    await press(4); // every 4th, off, first bar, every bar
    expect(await mode()).toBe('every');
    await clickToolbar(page, 'back');
    await waitForScene(page, 'menu');
    await openPiece(page, 'Twinkle Twinkle Little Star');
    expect(await drawn()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    await page.keyboard.press('Escape');
    await waitForScene(page, 'menu');
    await openSettings(page);
    await press(3); // every 2nd, every 4th, off
    expect(await mode()).toBe('off');
    await clickToolbar(page, 'back');
    await waitForScene(page, 'menu');
    await openPiece(page, 'Twinkle Twinkle Little Star');
    expect(await drawn()).toEqual([]);
    expectNoErrors(errors);
  });

  test('the finger numbers switch goes off, top note, every note and back, each a picture, and the choice survives a reload', async ({ page }) => {
    test.slow(); // the game loads twice
    const mode = () => page.evaluate(() => (window.__game.registry.get('context').profiles.fingerNumbers as string));
    await openGame(page);
    await openSettings(page);
    expect(await sceneTexts(page, 'settings')).toEqual(expect.arrayContaining(['Finger numbers']));
    expect(await mode()).toBe('off');
    expect(await shows(page, CHORD)).toBe('No finger numbers');
    expect(await isPicture(page, CHORD)).toBe(true);

    await clickAndRedraw(page, 'settings', CHORD);
    await expect.poll(mode).toBe('top');
    expect(await shows(page, CHORD)).toBe('Top note only');
    expect(await isPicture(page, CHORD)).toBe(true);

    await clickAndRedraw(page, 'settings', CHORD);
    await expect.poll(mode).toBe('all');
    expect(await shows(page, CHORD)).toBe('Every note');
    expect(await isPicture(page, CHORD)).toBe(true);

    const errors = await openGame(page);
    expect(await mode()).toBe('all');
    await openSettings(page);
    expect(await shows(page, CHORD)).toBe('Every note');
    await clickAndRedraw(page, 'settings', CHORD);
    await expect.poll(mode).toBe('off');
    expectNoErrors(errors);
  });

  test('ft_1_11.AC1: each hand\'s note length cycles Off, Ghost notes, Band, Ghost notes and band, and the choice survives a reload', async ({ page }) => {
    test.slow(); // the game loads twice
    const help = () => page.evaluate(() => window.__game.registry.get('context').profiles.durationHelp as { RH: string; LH: string });
    await openGame(page);
    await openSettings(page);
    expect(await sceneTexts(page, 'settings')).toEqual(expect.arrayContaining(['Note length, right hand', 'Note length, left hand']));
    expect(await help()).toEqual({ RH: 'off', LH: 'off' });
    expect([await shows(page, DURATION_RH), await shows(page, DURATION_LH)]).toEqual(['Off', 'Off']);
    // the left hand (bass) on the left, the right hand on the right, as at the piano
    const x = (index: number) => page.evaluate((i) => (window.__game.scene.getScene('settings').buttons as { rect: { x: number } }[])[i]!.rect.x, index);
    expect(await x(DURATION_LH)).toBeLessThan(await x(DURATION_RH));
    for (const [value, label] of [['ghost', 'Ghost notes'], ['band', 'Band'], ['both', 'Ghost notes and band'], ['off', 'Off'], ['ghost', 'Ghost notes']] as const) {
      await clickAndRedraw(page, 'settings', DURATION_LH);
      await expect.poll(help).toEqual({ RH: 'off', LH: value });
      expect(await shows(page, DURATION_LH)).toBe(label);
    }
    await clickAndRedraw(page, 'settings', DURATION_RH);
    await clickAndRedraw(page, 'settings', DURATION_RH);
    await expect.poll(help).toEqual({ RH: 'band', LH: 'ghost' });
    const errors = await openGame(page);
    expect(await help()).toEqual({ RH: 'band', LH: 'ghost' });
    expectNoErrors(errors);
  });

  test('ft_1_11.AC6: the practice staff shows the note length marks the player chose, and none when off', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual&unlock=all');
    const marks = () => page.evaluate(() => (window.__game.scene.getScene('practice')?.playSession?.staffView?.durationMarksShown ?? { bands: 0, ghosts: 0 }) as { bands: number; ghosts: number });
    /** Save a choice and open the piece again, as coming back from the settings does. */
    const choose = async (help: { RH: string; LH: string }) => {
      await page.evaluate(async (h) => {
        await window.__game.registry.get('context').profiles.updateDurationHelp(h);
        const scene = window.__game.scene.getScene('practice');
        (window as unknown as { oldView: unknown }).oldView = scene.playSession.staffView;
        (scene.scene as unknown as { restart(data: unknown): void }).restart(scene.startData);
      }, help);
      // the restarted screen has a new staff
      await expect.poll(() => page.evaluate(() => {
        const view = window.__game.scene.getScene('practice')?.playSession?.staffView;
        return view !== undefined && view !== null && view !== (window as unknown as { oldView: unknown }).oldView;
      })).toBe(true);
    };
    await openPiece(page, 'Both Hands');
    expect(await marks()).toEqual({ bands: 0, ghosts: 0 });
    await choose({ RH: 'off', LH: 'band' });
    const band = await marks();
    expect(band.bands).toBeGreaterThan(0);
    expect(band.ghosts).toBe(0);
    await choose({ RH: 'band', LH: 'both' });
    const both = await marks();
    expect(both.bands).toBeGreaterThan(band.bands); // the right hand's bands too
    expect(both.ghosts).toBeGreaterThan(0); // the left hand holds whole notes
    expectNoErrors(errors);
  });

  test('belong to each player: a new player starts with the defaults, and switching back finds those of the first player again', async ({ page }) => {
    const errors = await openGame(page);
    await openSettings(page);
    await clickAndRedraw(page, 'settings', BARS);
    await expect.poll(() => settings(page)).toEqual({ lines: 2, barsPerLine: 2 });
    await clickToolbar(page, 'back');
    await waitForScene(page, 'menu');

    await goToMainMenu(page);
    await addPlayer(page, 'KAI');
    await expect.poll(() => playerName(page)).toBe('KAI');
    expect(await settings(page)).toEqual({ lines: 2, barsPerLine: 'auto' });
    // Settings from the room: Back returns to the room
    await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Settings'));
    await waitForScene(page, 'settings');
    await clickToolbar(page, 'back');
    await waitForScene(page, 'profile');

    await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Back'));
    await pickProfile(page, 'TUVI');
    await expect.poll(() => playerName(page)).toBe('TUVI');
    expect(await settings(page)).toEqual({ lines: 2, barsPerLine: 2 });
    expectNoErrors(errors);
  });
});

// ft_1_16: Report a bug on the settings screen opens GitHub's new-issue page filled in with the screen it was opened from.
test('ft_1_16.AC1 Report a bug opens a filled-in issue for the screen and piece the settings were opened from', async ({ page, context }) => {
  await context.route(/^https:\/\/github\.com\//, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'issue form' }));
  const errors = await openGame(page);
  await openPiece(page, 'Twinkle Twinkle Little Star');
  const chartId = await page.evaluate(() => window.__game.scene.getScene('practice').chart.id as string);
  await clickButton(page, 'practice', await sceneButton(page, 'practice', 'Settings'));
  await waitForScene(page, 'settings');
  const popup = page.waitForEvent('popup');
  await clickButton(page, 'settings', await sceneButton(page, 'settings', 'Report a bug'));
  const url = new URL((await popup).url());
  expect(url.origin + url.pathname).toBe('https://github.com/inq-OS/pianor/issues/new');
  expect(url.searchParams.get('title')).toBe(`Bug: practice (${chartId})`);
  expect(url.searchParams.get('labels')).toBe('bug');
  expect(url.searchParams.get('body')).toContain(`- Piece: \`${chartId}\``);
  expect(url.searchParams.get('body')).not.toContain('TUVI');
  // the game stays where it was
  expect(await page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key))).toContain('settings');
  expectNoErrors(errors);
});

// Space between staves only changes two-staff pieces, and none of the approved pieces has two staves yet, so a tap says so.
test('a tap on Space between staves says it is for pieces with both hands', async ({ page }) => {
  const errors = await openGame(page);
  await clickButton(page, 'menu', await menuButton(page, 'Settings'));
  await waitForScene(page, 'settings');
  const hint = 'Space between staves: for pieces with both hands.';
  expect(await sceneTexts(page, 'settings')).not.toContain(hint);
  const wide = await page.evaluate(() => (window.__game.scene.getScene('settings').buttons as { objects: { text?: string }[] }[]).findIndex((b) => b.objects.some((o) => o.text === 'Small'))); // shows the current choice; a press makes it wide
  expect(wide).toBeGreaterThanOrEqual(0);
  await clickButton(page, 'settings', wide);
  await expect.poll(() => sceneTexts(page, 'settings')).toContain(hint);
  expectNoErrors(errors);
});

// the labels of the settings rows must not draw over each other (the spacing row was drawn over the timing row's label).
// The header (title and player line, above y 30) is left out here.
test.describe('settings labels', () => {

  test('no two labels on the settings screen overlap', async ({ page }) => {
    const errors = await openGame(page);
    await clickButton(page, 'menu', await menuButton(page, 'Settings'));
    await waitForScene(page, 'settings');
    const overlaps = await page.evaluate(() => {
      type Text = { pixelText?: boolean; text: string; visible: boolean; x: number; y: number; scaleX: number; scaleY: number; letterBox: { left: number; top: number; right: number; bottom: number } };
      const texts = (window.__game.scene.getScene('settings').root.list as Text[])
        .filter((o) => o.pixelText === true && o.visible && o.text.trim() !== '' && o.y >= 30)
        .map((o) => ({ text: o.text, left: o.x + o.letterBox.left * o.scaleX, top: o.y + o.letterBox.top * o.scaleY, right: o.x + o.letterBox.right * o.scaleX, bottom: o.y + o.letterBox.bottom * o.scaleY }));
      const out: string[] = [];
      for (let i = 0; i < texts.length; i++) {
        for (let j = i + 1; j < texts.length; j++) {
          const a = texts[i]!;
          const b = texts[j]!;
          if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) out.push(`"${a.text}" overlaps "${b.text}"`);
        }
      }
      return out;
    });
    expect(overlaps).toEqual([]);
    expectNoErrors(errors);
  });
});

// a label with Õ Ä Ö Ü has rows for the marks above its capitals; it used to start that much lower, so in Estonian
// the row titles ran into their buttons. Marks included, no label may touch a button, in either language.
for (const lang of ['en', 'et'] as const) {
  test(`no settings label runs into a button, in ${lang}`, async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', lang);
    await clickButton(page, 'menu', await menuButton(page, lang === 'en' ? 'Settings' : 'Seaded'));
    await waitForScene(page, 'settings');
    const hits = await page.evaluate(() => {
      type Text = { pixelText?: boolean; text: string; visible: boolean; x: number; y: number; scaleX: number; scaleY: number; letterBox: { left: number; right: number; bottom: number } };
      const scene = window.__game.scene.getScene('settings');
      const buttons = (scene.buttons as { rect: { x: number; y: number; width: number; height: number } }[]).map((b) => b.rect);
      const texts = (scene.root.list as Text[]).filter((o) => o.pixelText === true && o.visible && o.text.trim() !== '');
      const out: string[] = [];
      for (const o of texts) {
        const box = { left: o.x + o.letterBox.left * o.scaleX, top: o.y, right: o.x + o.letterBox.right * o.scaleX, bottom: o.y + o.letterBox.bottom * o.scaleY };
        const inside = (r: { x: number; y: number; width: number; height: number }) => box.left >= r.x && box.right <= r.x + r.width && box.top >= r.y && box.bottom <= r.y + r.height;
        if (buttons.some(inside)) continue; // a button's own label
        for (const r of buttons) if (box.left < r.x + r.width && r.x < box.right && box.top < r.y + r.height && r.y < box.bottom) out.push(`"${o.text}" runs into a button at ${r.x},${r.y}`);
      }
      return out;
    });
    expect(hits).toEqual([]);
    expectNoErrors(errors);
  });
}

// each setting's button shows its current choice as a picture, the way the student sees it while playing, or
// as a number where a number says it best (bars on a line), never as a word.
test('the setting buttons show pictures or numbers, and the choice name only as a tooltip', async ({ page }) => {
  const errors = await openGame(page);
  await clickButton(page, 'menu', await menuButton(page, 'Settings'));
  await waitForScene(page, 'settings');
  const buttons = await page.evaluate(() =>
    (window.__game.scene.getScene('settings').buttons as { options: { label: string; tooltip?: string; icon?: unknown; iconOnly?: boolean } }[]).slice(0, 6).map((b) => ({
      name: b.options.tooltip ?? b.options.label, picture: b.options.icon !== undefined && b.options.iconOnly === true, text: b.options.tooltip === undefined ? null : b.options.label,
    })),
  );
  expect(buttons).toHaveLength(6); // Wait/Tempo moved to the practice screen; the keyboard switch is on this screen's toolbar (d099)
  expect(buttons.filter((b) => !b.picture)).toEqual([{ name: 'Auto', picture: false, text: 'A' }]); // bar and finger numbers are pictures too
  const texts = await sceneTexts(page, 'settings');
  for (const word of ['Colors', 'Auto', 'Small', 'Back']) expect(texts).not.toContain(word);
  expectNoErrors(errors);
});

// Settings must fit the laptop's full screen (d105):
// every button, its label and every text inside the screen, nothing drawn over anything else, in both languages, with the hint
// line in use and the on-screen keyboard shown. Before the redesign the Bar numbers row ran 8 pixels off the right edge.
for (const lang of ['en', 'et'] as const) {
  test(`every setting, label and the hint fit on the screen and nothing overlaps, in ${lang}`, async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', lang);
    await clickButton(page, 'menu', await menuButton(page, lang === 'en' ? 'Settings' : 'Seaded'));
    await waitForScene(page, 'settings');
    const check = () => page.evaluate(() => {
      type Box = { left: number; top: number; right: number; bottom: number };
      type Text = { pixelText?: boolean; visible: boolean; text: string; x: number; y: number; scaleX: number; scaleY: number; letterBox: Box };
      type Rect = { x: number; y: number; width: number; height: number };
      const scene = window.__game.scene.getScene('settings') as unknown as {
        px: { width: number; height: number; scale: number }; scale: { height: number }; root: { list: Text[] };
        buttons: { objects: unknown[]; box: Rect; options: { label: string }; labelFit(): { label: string; overflow: number } }[];
      };
      const { width } = scene.px;
      // the band (ft_1_20) sits under the main area: the screen runs on to the canvas's foot
      const screen: Box = { left: 0, top: 0, right: width, bottom: Math.floor(scene.scale.height / scene.px.scale) };
      const out: string[] = [];
      const outside = (b: Box) => b.left < screen.left || b.top < screen.top || b.right > screen.right || b.bottom > screen.bottom;
      const hit = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const rects = scene.buttons.map((b) => ({ name: b.options.label, box: { left: b.box.x, top: b.box.y, right: b.box.x + b.box.width, bottom: b.box.y + b.box.height } }));
      for (const r of rects) if (outside(r.box)) out.push(`button "${r.name}" runs off the screen`);
      rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => { if (hit(a.box, b.box)) out.push(`button "${a.name}" overlaps "${b.name}"`); }));
      for (const f of scene.buttons.map((b) => b.labelFit())) if (f.overflow > 0) out.push(`"${f.label}" overflows its button by ${f.overflow} px`);
      const own = new Set(scene.buttons.flatMap((b) => b.objects));
      const texts = scene.root.list
        .filter((o) => o.pixelText === true && o.visible && o.text.trim() !== '')
        .map((o) => ({ text: o.text, free: !own.has(o), box: { left: o.x + o.letterBox.left * o.scaleX, top: o.y + o.letterBox.top * o.scaleY, right: o.x + o.letterBox.right * o.scaleX, bottom: o.y + o.letterBox.bottom * o.scaleY } }));
      for (const t of texts) if (outside(t.box)) out.push(`"${t.text}" runs off the screen`);
      texts.forEach((a, i) => texts.slice(i + 1).forEach((b) => { if (hit(a.box, b.box)) out.push(`"${a.text}" overlaps "${b.text}"`); }));
      for (const t of texts.filter((x) => x.free)) for (const r of rects) if (hit(t.box, r.box)) out.push(`"${t.text}" runs onto button "${r.name}"`);
      return { out };
    });
    const first = await check();
    expect(first.out).toEqual([]);

    // the longest things the screen can show: the Space between staves hint, and the saving-failed line
    await clickButton(page, 'settings', 1); // Space between staves, the second setting made
    await expect.poll(async () => (await check()).out).toEqual([]);
    await page.evaluate(() => {
      const scene = window.__game.scene.getScene('settings') as unknown as { saveFailed: boolean; redraw(): void };
      scene.saveFailed = true;
      scene.redraw();
    });
    expect((await check()).out).toEqual([]);

    // the on-screen keyboard takes rows from the bottom: the settings still fit above it
    await page.evaluate(() => window.__game.registry.get('context').keyboardSwitch.toggle());
    expect(await page.evaluate(() => window.__game.registry.get('context').keyboardSwitch.shown() as boolean)).toBe(true);
    await expect.poll(async () => (await check()).out).toEqual([]);
    expectNoErrors(errors);
  });
}

test('Choose pieces and back again returns to the settings page it left, and from there to the piece being played', async ({ page }) => {
  const errors = await openGame(page);
  await openPiece(page, 'Little Steps');
  await openSettings(page);
  await clickAndRedraw(page, 'settings', await sceneButton(page, 'settings', 'Learning'));
  expect(await page.evaluate(() => window.__game.scene.getScene('settings').page)).toBe(1);
  await clickButton(page, 'settings', await sceneButton(page, 'settings', 'Choose pieces'));
  await waitForScene(page, 'pieces');
  await page.keyboard.press('Escape');
  await waitForScene(page, 'settings');
  expect(await page.evaluate(() => window.__game.scene.getScene('settings').page)).toBe(1);
  await page.keyboard.press('Escape');
  await waitForScene(page, 'practice');
  expect(await page.evaluate(() => window.__game.scene.getScene('practice').chart.id as string)).toBe('little-steps');
  expectNoErrors(errors);
});

test('a setting button reached with the arrow keys shows its choice name at once, as the pointer does after a moment', async ({ page }) => {
  const errors = await openGame(page);
  await openSettings(page);
  const focusedButton = () => page.evaluate(() => {
    const focused = (window.__game.scene.getScene('settings').buttons as { focused: boolean; options: { iconOnly?: boolean }; tooltipShown: string | null }[]).find((b) => b.focused);
    return focused ? { iconOnly: focused.options.iconOnly === true, tip: focused.tooltipShown } : null;
  });
  // down the rows to the first setting that is a picture only
  let shown = null as Awaited<ReturnType<typeof focusedButton>>;
  for (let i = 0; i < 8 && shown?.iconOnly !== true; i++) {
    await page.keyboard.press('ArrowDown');
    shown = await focusedButton();
  }
  expect(shown?.iconOnly).toBe(true);
  expect(shown?.tip).toBeTruthy();
  expectNoErrors(errors);
});
