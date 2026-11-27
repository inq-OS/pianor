import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { buttonPoint, clickButton, clickToolbar, expectNoErrors, openSettings, letGameRun, openBubbleFromMore, openGame, openPiece, playWithVirtualPiano, pieceXp, pressPracticeButton as press, sceneTexts, toScoreScreen, useOneLine, waitForScene, bandAction, sceneWords } from './helpers';

/** The practice screen's tools strip: the metronome click, the tempo percent, and a section to practise. */

/** Tap bar `bar` (0-based) of the staff with the real mouse, turning the staff's pages with the > and < buttons, or the arrow keys, first. */
async function tapBar(page: Page, bar: number, turn: 'buttons' | 'keys' = 'buttons'): Promise<void> {
  const pageOf = () => page.evaluate((index) => {
    const scene = window.__game.scene.getScene('practice');
    return { want: scene.playSession.layout.systems[scene.playSession.layout.bars[index].system].page as number, shown: scene.playSession.staffView.currentPage as number };
  }, bar);
  for (let turns = 0; turns < 20; turns++) {
    const { want, shown } = await pageOf();
    if (want === shown) break;
    if (turn === 'keys') await page.keyboard.press(want > shown ? 'ArrowRight' : 'ArrowLeft');
    else await press(page, want > shown ? '>' : '<');
    await expect.poll(async () => (await pageOf()).shown).not.toBe(shown);
  }
  const point = await page.evaluate((index) => {
    const scene = window.__game.scene.getScene('practice');
    const layout = scene.playSession.layout;
    const b = layout.bars[index];
    const system = layout.systems[b.system];
    const top = scene.playSession.staffView.origin.y as number; // the top bar and the tools strip, in screen pixels
    const canvas = document.querySelector('canvas')!;
    const rect = canvas.getBoundingClientRect();
    const x = b.x + b.width / 2;
    const y = top + (system.topLineY + system.bottomLineY) / 2;
    return { x: rect.left + (x / canvas.width) * rect.width, y: rect.top + (y / canvas.height) * rect.height };
  }, bar);
  await page.mouse.click(point.x, point.y);
}

/** What the practice screen's buttons say they do: a picture button's tooltip (its name and key), else its label. */
const buttonNames = (page: Page) =>
  page.evaluate(() => (window.__game.scene.getScene('practice').buttons as { options: { label: string; tooltip?: string } }[]).map((b) => b.options.tooltip ?? b.options.label));

const buttonLabels = (page: Page) =>
  page.evaluate(() => (window.__game.scene.getScene('practice').buttons as { options: { label: string } }[]).map((b) => b.options.label));

const chartId = (page: Page) => page.evaluate(() => window.__game.scene.getScene('practice').chart.id as string);
const percent = (page: Page) => page.evaluate(() => window.__game.scene.getScene('practice').percent as number);

test.describe('practice tools (core_02 and core_03)', () => {
  test('the strip has the tempo percent, the bubble the click and the section button @smoke', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    expect(await sceneTexts(page, 'practice')).toEqual(expect.arrayContaining(['-', '100%', '+']));
    expect(await openBubbleFromMore(page, 'practice')).toBe(true);
    expect(await buttonNames(page)).toEqual(expect.arrayContaining(['Click [Shift+M]', 'Section [Shift+R]'])); // the metronome and A | -> | B
    expectNoErrors(errors);
  });

  test('the piece shows its own BPM in Wait mode (ft_1_02d.AC6)', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    const bpm = await page.evaluate(() => Math.round(window.__game.scene.getScene('practice').chart.tempoMap[0].bpm as number));
    expect(await sceneWords(page, 'practice')).toContain(`${bpm} BPM`);
    await press(page, '-');
    await expect.poll(() => percent(page)).toBe(90);
    expect(await sceneWords(page, 'practice')).toContain(`${bpm} BPM`); // Wait mode: the percent does not change the tempo
    expectNoErrors(errors);
  });

  test('the tempo percent goes in steps of ten and is kept when the scene starts over', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await press(page, '-');
    await expect.poll(() => percent(page)).toBe(90);
    expect(await sceneTexts(page, 'practice')).toContain('90%');
    await press(page, '+');
    await press(page, '+');
    await expect.poll(() => percent(page)).toBe(110);
    expectNoErrors(errors);
  });

  test('in Tempo mode the percent changes the speed of the piece', async ({ page }) => {
    const errors = await openGame(page);
    await page.evaluate(() => window.__game.registry.get('context').profiles.updatePlaySettings({ mode: 'tempo' }));
    await openPiece(page, 'Little Steps');
    await press(page, '-');
    await expect.poll(() => percent(page)).toBe(90);
    expect(await page.evaluate(() => window.__game.scene.getScene('practice').transport.tempoPercent)).toBe(90);
    expectNoErrors(errors);
  });

  test('core_02.AC1 the click starts the metronome in Wait mode and stops it again', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    const running = () => page.evaluate(() => window.__game.registry.get('context').audio.metronome.running as boolean);
    expect(await running()).toBe(false);
    await press(page, 'Click');
    await expect.poll(running).toBe(true);
    await press(page, 'Click');
    await expect.poll(running).toBe(false);
    await page.keyboard.press('Escape');
    await waitForScene(page, 'menu');
    expect(await running()).toBe(false); // leaving stops it
    expectNoErrors(errors);
  });

  test('two taps mark a section, which loops without giving any XP, until Whole piece', async ({ page }) => {
    test.slow();
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await press(page, 'Section');
    await expect.poll(() => sceneTexts(page, 'practice')).toContain('Tap the first bar of the part to practice.');
    await tapBar(page, 1);
    await expect.poll(() => sceneTexts(page, 'practice')).toContain('Now tap its last bar.');
    await tapBar(page, 2);
    await expect.poll(() => chartId(page)).toBe('little-steps#bars-2-3');
    expect(await page.evaluate(() => window.__game.scene.getScene('practice').chart.title as string)).toBe('Little Steps (bars 2 to 3)');
    // no title on the practice screen (ft_1_20, AX-3 provisional): the section is said by Whole piece in the bubble
    expect(await openBubbleFromMore(page, 'practice')).toBe(true);
    expect(await buttonNames(page)).toContain('Whole piece [Shift+R]');

    // play the six notes of bars 2 and 3: no results screen, no XP, and it starts over
    await playWithVirtualPiano(page, [67, 65, 65, 64, 62, 60]);
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('practice').startData.lap)).toBe(1);
    expect(await pieceXp(page, 'little-steps')).toBe(0);
    expect(await page.evaluate(() => window.__game.scene.getScene('practice').playSession.controller.getState().stepIndex)).toBe(0);
    await playWithVirtualPiano(page, [67, 65, 65, 64, 62, 60]);
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('practice').startData.lap)).toBe(2);

    await press(page, 'Whole piece');
    await expect.poll(() => chartId(page)).toBe('little-steps');
    await playWithVirtualPiano(page, [60, 62, 64, 65, 67, 65, 65, 64, 62, 60, 60]);
    await toScoreScreen(page);
    expect(await pieceXp(page, 'little-steps')).toBeGreaterThan(0); // the piece's XP (ft_1_13)
    expectNoErrors(errors);
  });

  test('core_03.AC4 a looped section wraps over to its first bar at once and the click keeps ticking (Wait mode)', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    const metronome = () => page.evaluate(() => ({ running: window.__game.registry.get('context').audio.metronome.running as boolean }));
    await press(page, 'Click');
    await expect.poll(async () => (await metronome()).running).toBe(true);
    await press(page, 'Section');
    await tapBar(page, 1);
    await tapBar(page, 2);
    await expect.poll(() => chartId(page)).toBe('little-steps#bars-2-3');
    // the Click survived the restart for the section; count its starts from here
    await page.evaluate(() => {
      const m = window.__game.registry.get('context').audio.metronome;
      const start = m.start.bind(m);
      (window as unknown as { __starts: number }).__starts = 0;
      m.start = (o: unknown) => { (window as unknown as { __starts: number }).__starts++; start(o); };
    });
    await playWithVirtualPiano(page, [67, 65, 65, 64, 62, 60]);
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('practice').startData.lap)).toBe(1);
    // no pause and no restart of the click: it never stopped, and the next lap takes its first note at once
    expect((await metronome()).running).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { __starts: number }).__starts)).toBe(0);
    expect(await sceneTexts(page, 'practice')).toContain('Again! Lap 2.');
    expectNoErrors(errors);
  });

  test('core_03.AC5 the ramp strip shows with a section; a step of +10% every lap speeds the next lap up', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    expect(await buttonLabels(page)).not.toContain('+0');
    await press(page, 'Section');
    await tapBar(page, 1);
    await tapBar(page, 2);
    await expect.poll(() => chartId(page)).toBe('little-steps#bars-2-3');
    // the ramp is an opening item of the band (ft_1_20.AC5): its panel opens over the staff's foot
    await press(page, 'Tempo ramp');
    expect(await buttonLabels(page)).toEqual(expect.arrayContaining(['+0', 'BPM', 'every 1', 'Clean', 'to 100', '%']));
    await press(page, 'BPM'); // the step's unit: now %
    for (let i = 0; i < 4; i++) await press(page, `+${[0, 1, 2, 5][i]}`); // 0 -> 1 -> 2 -> 5 -> 10
    await press(page, 'to 100'); // -> 110
    await press(page, 'Clean'); // off: every lap steps up
    expect(await buttonLabels(page)).toEqual(expect.arrayContaining(['+10', 'to 110']));
    // the mouse wheel over a value turns it by one: up on +10 gives +11, down again gives +10
    const centre = (label: string) => page.evaluate((l) => {
      const scene = window.__game.scene.getScene('practice');
      const b = (scene.buttons as { options: { label: string }; screenRect(): { left: number; top: number; right: number; bottom: number } }[]).find((x) => x.options.label === l)!;
      const r = b.screenRect();
      const canvas = document.querySelector('canvas')!;
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + (((r.left + r.right) / 2) / canvas.width) * rect.width, y: rect.top + (((r.top + r.bottom) / 2) / canvas.height) * rect.height };
    }, label);
    let at = await centre('+10');
    await page.mouse.move(at.x, at.y);
    await page.mouse.wheel(0, -100);
    await expect.poll(() => buttonLabels(page)).toContain('+11');
    at = await centre('+11');
    await page.mouse.move(at.x, at.y);
    await page.mouse.wheel(0, 100);
    await expect.poll(() => buttonLabels(page)).toContain('+10');
    await playWithVirtualPiano(page, [66, 67, 65, 65, 64, 62, 60]); // one wrong key first: no matter, Clean is off
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('practice').startData.lap)).toBe(1);
    expect(await percent(page)).toBe(110);
    expect(await sceneTexts(page, 'practice')).toContain('Lap 2, faster: 77 BPM.');
    expect(await buttonLabels(page)).toEqual(expect.arrayContaining(['+10', 'to 110'])); // the ramp stays for the next laps
    // A carries the tempo and the lap; leaving the section, Kiur sums it up
    expect(await page.evaluate(() => (window.__game.scene.getScene('practice').playSession.staffView.markTexts as { text: { text: string } }[]).map((m) => m.text.text))).toContain('A  77 BPM, lap 2');
    await press(page, 'Whole piece');
    await expect.poll(() => chartId(page)).toBe('little-steps');
    expect(await sceneTexts(page, 'practice')).toContain('Laps: 1, clean: 0, 70 to 77 BPM.');
    expectNoErrors(errors);
  });

  test('a section with nothing to play is refused and Kiur asks for another last bar', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    // the same piece with bar 2 emptied: rests only there
    await page.evaluate(() => {
      const scene = window.__game.scene.getScene('practice');
      const chart = scene.fullChart as { id: string; notes: { bar: number }[] };
      (scene as unknown as { scene: { restart(data: unknown): void } }).scene.restart({ chart: { ...chart, id: 'rest-bar', notes: chart.notes.filter((n) => n.bar !== 1) } });
    });
    await expect.poll(() => chartId(page)).toBe('rest-bar');
    await press(page, 'Section');
    await tapBar(page, 1);
    await expect.poll(() => sceneTexts(page, 'practice')).toContain('Now tap its last bar.');
    await tapBar(page, 1);
    await expect.poll(() => sceneTexts(page, 'practice')).toContain('No notes to play there! Tap another last bar.');
    expect(await chartId(page)).toBe('rest-bar');
    expect(await page.evaluate(() => window.__game.scene.getScene('practice').picking)).toBe('last');
    await tapBar(page, 2); // bars 2 and 3: bar 3 has notes
    await expect.poll(() => chartId(page)).toBe('rest-bar#bars-2-3');
    expectNoErrors(errors);
  });

  test('marking and practising a section keeps the staff size; A marks the first bar, then A and B the section', async ({ page }) => {
    test.slow();
    const errors = await openGame(page);
    await useOneLine(page);
    await openPiece(page, 'Little Steps');
    const view = () => page.evaluate(() => {
      const scene = window.__game.scene.getScene('practice');
      return {
        staffSpace: scene.playSession.layout.staffSpace as number,
        pages: scene.playSession.layout.pageCount as number,
        marks: (scene.playSession.staffView.markTexts as { text: { text: string } }[]).map((m) => m.text.text),
        tint: [...((scene.playSession.staffView.section?.tint ?? []) as number[])],
      };
    });
    const before = await view();
    expect(before.pages).toBeGreaterThan(1); // one line at a time: bar 3 is on another page
    await press(page, 'Section');
    await expect.poll(() => sceneTexts(page, 'practice')).toContain('Tap the first bar of the part to practice.');
    expect(await view()).toEqual({ ...before, marks: [], tint: [] }); // the same view, page by page, not the whole piece shrunk
    await tapBar(page, 1);
    await expect.poll(() => view()).toEqual({ ...before, marks: ['A'], tint: [1] });
    await tapBar(page, 2); // on the next page: turned with the > button
    await expect.poll(() => chartId(page)).toBe('little-steps#bars-2-3');
    const section = await view();
    // the ramp strip under the tools (core_03.AC5) takes one row while a section plays, so the staff is a little smaller (32 to 27 px here), never the whole piece shrunk
    expect(section.staffSpace).toBeGreaterThanOrEqual(before.staffSpace * 0.8);
    expect(section.marks).toEqual(['A  70 BPM, lap 1', 'B']); // A carries the tempo and the lap
    expectNoErrors(errors);
  });

  test('in a one-bar section B stands after the whole of A with its tempo and lap, not on top of it', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await press(page, 'Section');
    await tapBar(page, 1);
    await tapBar(page, 1);
    await expect.poll(() => chartId(page)).toBe('little-steps#bars-2-2');
    const marks = await page.evaluate(() => (window.__game.scene.getScene('practice').playSession.staffView.markTexts as { text: { text: string; x: number; width: number } }[])
      .map((m) => ({ text: m.text.text, x: m.text.x, width: m.text.width })));
    expect(marks.map((m) => m.text)).toEqual(['A  70 BPM, lap 1', 'B']);
    expect(marks[1]!.x).toBeGreaterThan(marks[0]!.x + marks[0]!.width);
    expectNoErrors(errors);
  });

  test('a piece starts at the tempo percent where this player last played it', async ({ page }) => {
    test.slow();
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    expect(await percent(page)).toBe(100);
    await press(page, '+');
    await expect.poll(() => percent(page)).toBe(110);
    await playWithVirtualPiano(page, [60, 62, 64, 65, 67, 65, 65, 64, 62, 60, 60]);
    await toScoreScreen(page);
    expect(await page.evaluate(() => window.__game.registry.get('context').profiles.profile.attempts[0].play)).toEqual({ mode: 'wait', tempoPercent: 110 });
    await clickButton(page, 'results', await bandAction(page, 'results', 0)); // Play again
    await waitForScene(page, 'practice');
    expect(await percent(page)).toBe(110);
    expectNoErrors(errors);
  });

  test('Escape while marking a section cancels the marking and does not leave the piece', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await press(page, 'Section');
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('practice').picking)).toBeNull();
    await letGameRun(page, 20, 300); // a leave would have started by now
    expect((await page.evaluate(() => window.__game.scene.getScenes(true).map((s: { scene: { key: string } }) => s.scene.key)))).toContain('practice');
    expectNoErrors(errors);
  });

  test('Escape while a section is practised gives no score screen: back to the pieces (core_03 rule 4)', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await press(page, 'Section');
    await tapBar(page, 1);
    await expect.poll(() => sceneTexts(page, 'practice')).toContain('Now tap its last bar.');
    await tapBar(page, 2);
    await expect.poll(() => chartId(page)).toBe('little-steps#bars-2-3');
    await playWithVirtualPiano(page, [67, 65, 65, 64, 62, 60]); // a lap
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('practice').startData.lap)).toBe(1);
    await playWithVirtualPiano(page, [67, 65]); // and some keys of the next
    await page.keyboard.press('Escape');
    await waitForScene(page, 'menu');
    expect(await page.evaluate(() => window.__game.scene.getScenes(true).map((s: { scene: { key: string } }) => s.scene.key))).toEqual(['menu']);
    expectNoErrors(errors);
  });

  test('the wheel over the mode cell leaves the way to play alone, and over -, the percent and + it steps the tempo (ft_1_20.AC16)', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    const cell = async (label: string) => buttonPoint(page, 'practice', await page.evaluate((l) => (window.__game.scene.getScene('practice').buttons as { options: { label: string } }[]).findIndex((b) => b.options.label === l), label));
    const mode = () => page.evaluate(() => window.__game.registry.get('context').profiles.playSettings.mode as string);
    expect(await mode()).toBe('wait');
    const wait = await cell('Wait');
    await page.mouse.move(wait.x, wait.y);
    await page.mouse.wheel(0, 100);
    await page.mouse.wheel(0, -100);
    await letGameRun(page, 5);
    expect(await mode()).toBe('wait');
    expect(await sceneWords(page, 'practice')).toContain('Wait');
    for (const label of ['-', '100%', '+']) {
      const before = await percent(page);
      const at = await cell(label === '100%' ? `${before}%` : label);
      await page.mouse.move(at.x, at.y);
      await page.mouse.wheel(0, -100); // up: faster
      await expect.poll(() => percent(page)).toBe(before + 10);
      await waitForScene(page, 'practice');
    }
    const back = await cell('-');
    await page.mouse.move(back.x, back.y);
    await page.mouse.wheel(0, 100); // down: slower
    await expect.poll(() => percent(page)).toBe(120);
    expectNoErrors(errors);
  });

  test('back from Settings the piece goes on at the note it stood on, in its section, lap and tempo', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await press(page, '-');
    await expect.poll(() => percent(page)).toBe(90);
    await press(page, 'Section');
    await tapBar(page, 1);
    await expect.poll(() => sceneTexts(page, 'practice')).toContain('Now tap its last bar.');
    await tapBar(page, 2);
    await expect.poll(() => chartId(page)).toBe('little-steps#bars-2-3');
    await playWithVirtualPiano(page, [67, 65, 65, 64, 62, 60]); // a lap
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('practice').startData.lap)).toBe(1);
    await playWithVirtualPiano(page, [67, 65]); // two keys of the next
    const step = () => page.evaluate(() => window.__game.scene.getScene('practice').playSession.controller.getState().stepIndex as number);
    await expect.poll(step).toBe(2);
    await openSettings(page);
    await clickToolbar(page, 'back');
    await waitForScene(page, 'practice');
    expect(await chartId(page)).toBe('little-steps#bars-2-3');
    expect(await percent(page)).toBe(90);
    expect(await page.evaluate(() => window.__game.scene.getScene('practice').startData.lap)).toBe(1);
    expect(await step()).toBe(2);
    await playWithVirtualPiano(page, [65]); // the next note goes on from there
    await expect.poll(step).toBe(3);
    expectNoErrors(errors);
  });

  test('two presses of + before the screen starts over both count (a double click)', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await page.evaluate(() => {
      const scene = window.__game.scene.getScene('practice');
      const plus = (scene.buttons as { options: { label: string }; press(): void }[]).find((b) => b.options.label === '+')!;
      plus.press();
      plus.press();
    });
    await expect.poll(() => percent(page)).toBe(120);
    await waitForScene(page, 'practice');
    expect(await percent(page)).toBe(120);
    expectNoErrors(errors);
  });

  test('Shift+M toggles the click, plain M is still a note, Shift+= and Shift+- change the click speed', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    const running = () => page.evaluate(() => window.__game.registry.get('context').audio.metronome.running as boolean);
    const bpm = () => page.evaluate(() => (window.__game.registry.get('context').audio.metronome as unknown as { bpm: number }).bpm);
    await page.keyboard.press('Shift+KeyM');
    await expect.poll(running).toBe(true);
    const start = await bpm();
    await page.keyboard.press('Shift+Equal');
    await expect.poll(bpm).toBe(start + 5);
    await page.keyboard.press('Shift+Minus');
    await page.keyboard.press('Shift+Minus');
    await expect.poll(bpm).toBe(start - 5);
    await expect.poll(() => sceneWords(page, 'practice')).toContain(`70 BPM (${start - 5})`);
    await page.keyboard.press('Shift+KeyM');
    await expect.poll(running).toBe(false);
    expectNoErrors(errors);
  });

  test('Shift+R, 2, 3 marks bars 2 and 3 with the keyboard, and Shift+R again goes back to the whole piece', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await page.keyboard.press('Shift+KeyR');
    await expect.poll(() => sceneTexts(page, 'practice')).toContain('Tap the first bar of the part to practice.');
    await page.keyboard.press('Digit2');
    await expect.poll(() => sceneTexts(page, 'practice')).toContain('Now tap its last bar.');
    await page.keyboard.press('Digit3');
    await expect.poll(() => chartId(page)).toBe('little-steps#bars-2-3');
    expect(await openBubbleFromMore(page, 'practice')).toBe(true);
    expect(await buttonNames(page)).toContain('Whole piece [Shift+R]');
    await page.keyboard.press('Escape'); // closes the bubble
    await page.keyboard.press('Shift+KeyR');
    await expect.poll(() => chartId(page)).toBe('little-steps');
    expectNoErrors(errors);
  });

  test('ft_1_30.AC10: arrows above the notes where the hand moves show with the finger numbers, and hide without them', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual&unlock=all');
    await openPiece(page, 'Twinkle Twinkle Little Star');
    const arrows = () => page.evaluate(() => window.__game.scene.getScene('practice').playSession.staffView.handShiftsShown as { up: number; down: number });
    expect(await arrows()).toEqual({ up: 0, down: 0 });
    await page.keyboard.press('KeyF');
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('practice').hints.fingers)).toBe(true);
    // Twinkle leaves the C position at A: the hand moves up for it and back down for F E D C
    await expect.poll(arrows).toEqual({ up: 1, down: 1 });
    await page.keyboard.press('KeyF');
    await expect.poll(arrows).toEqual({ up: 0, down: 0 });
    expectNoErrors(errors);
  });

  test('Shift+R does not play a note (plain R still does), A and F switch the hints, Shift+R twice cancels the picking', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    // count the notes the judge sees (the scene's onJudged is called through `this`, so it can be wrapped)
    await page.evaluate(() => {
      const scene = window.__game.scene.getScene('practice');
      scene.judgedCount = 0;
      const original = scene.onJudged.bind(scene);
      scene.onJudged = (...args: unknown[]) => {
        scene.judgedCount++;
        original(...args);
      };
    });
    const judged = () => page.evaluate(() => window.__game.scene.getScene('practice').judgedCount as number);
    await page.keyboard.press('KeyA');
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('practice').hints)).toEqual({ noteNames: true, fingers: false });
    await page.keyboard.press('KeyF');
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('practice').hints)).toEqual({ noteNames: true, fingers: true });
    expect(await buttonNames(page)).toEqual(expect.arrayContaining(['Note names [A]', 'Fingers [F]']));
    // the note names button is a note, and shows a name beside it once names are on
    const namesIcon = () => page.evaluate(() => (window.__game.scene.getScene('practice').buttons as { options: { label: string; icon?: { width: number } } }[]).find((b) => b.options.label === 'Note names')!.options.icon!.width);
    expect(await namesIcon()).toBe(10);
    await page.keyboard.press('Shift+KeyR'); // plain R is a note of the computer-keyboard piano; with Shift it is the section key
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('practice').picking)).toBe('first');
    await page.keyboard.press('Shift+KeyR');
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('practice').picking)).toBeNull();
    expect(await judged()).toBe(0); // A, F and Shift+R reached no piano (keys arrive in order, and the polls above saw them)
    await page.keyboard.press('KeyR'); // plain R is the note F5: the judge sees it (and it is wrong for the first step)
    await expect.poll(judged).toBe(1);
    await letGameRun(page, 10);
    expect(await judged()).toBe(1);
    expectNoErrors(errors);
  });

  test('the strip\'s cells do not overlap and none is cut off, with a section and the BPM of Tempo mode (ft_1_20.AC18)', async ({ page }) => {
    const errors = await openGame(page);
    await page.evaluate(() => window.__game.registry.get('context').profiles.updatePlaySettings({ mode: 'tempo' }));
    await openPiece(page, 'Little Steps');
    await press(page, '-'); // a percent other than 100 makes the BPM label longest
    await expect.poll(() => percent(page)).toBe(90);
    await page.keyboard.press('Shift+KeyR');
    await page.keyboard.press('Digit2');
    await page.keyboard.press('Digit3');
    await expect.poll(() => chartId(page)).toBe('little-steps#bars-2-3');
    const band = await page.evaluate(() => {
      const scene = window.__game.scene.getScene('practice');
      const rects = scene.buttons.map((b: { rect: { x: number; y: number; width: number; height: number } }) => b.rect).filter((r: { y: number }) => r.y >= (scene.px.height as number));
      return { width: scene.px.width as number, rects: rects as { x: number; y: number; width: number; height: number }[] };
    });
    // Listen, Start again, the mode, slower, the tempo, faster and More
    expect(band.rects.length).toBeGreaterThanOrEqual(7);
    for (const [i, a] of band.rects.entries()) {
      expect(a.x + a.width, `cell ${i}`).toBeLessThanOrEqual(band.width);
      for (const b of band.rects.slice(i + 1)) expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y, `cells ${i}`).toBe(true);
    }
    await page.screenshot({ path: test.info().outputPath('band.png') });
    expectNoErrors(errors);
  });

  test('core_03.AC5 the ramp panel fits in Estonian, over the staff and above the band, with its longest values', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'et');
    await openPiece(page, 'Little Steps');
    await page.keyboard.press('Shift+KeyR');
    await page.keyboard.press('Digit2');
    await page.keyboard.press('Digit3');
    await expect.poll(() => chartId(page)).toBe('little-steps#bars-2-3');
    // the longest values: +10, every 10, to 200 (in BPM: 140); the panel opened from its item (ft_1_20.AC5)
    await page.evaluate(() => {
      const scene = window.__game.scene.getScene('practice');
      scene.startData = { ...scene.startData, ramp: { step: 10, stepUnit: 'bpm', every: 10, onlyClean: true, target: 200, targetUnit: 'percent' } };
      scene.rampOpen = true;
      scene.redraw();
    });
    const rows = await page.evaluate(() => {
      const scene = window.__game.scene.getScene('practice');
      const rects = scene.buttons.map((b: { rect: { x: number; y: number; width: number; height: number } }) => b.rect) as { x: number; y: number; width: number; height: number }[];
      return { width: scene.px.width as number, height: scene.px.height as number, rects };
    });
    // the panel's six buttons: the row along the main area's foot, just above the band
    const ramp = rows.rects.filter((r) => r.y + r.height <= rows.height && r.y >= rows.height - 20).sort((a, b) => a.x - b.x);
    expect(ramp.length).toBe(6);
    for (let i = 1; i < ramp.length; i++) expect(ramp[i - 1]!.x + ramp[i - 1]!.width, `button ${i}`).toBeLessThanOrEqual(ramp[i]!.x);
    expect(ramp.at(-1)!.x + ramp.at(-1)!.width).toBeLessThanOrEqual(rows.width);
    await page.screenshot({ path: test.info().outputPath('ramp-et.png') });
    expectNoErrors(errors);
  });

  test('ft_1_12.AC9 Kuula plays the piece with its notes lit, keys are not judged meanwhile, Space starts it over, and Stop gives the piece back to play', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    const state = () => page.evaluate(() => {
      const scene = window.__game.scene.getScene('practice');
      const lit = [...(scene.playSession.staffView?.cursors ?? [])] as number[];
      return { listening: scene.listening as boolean, playing: (scene.listenAlong?.isPlaying ?? false) as boolean, lit, judged: (scene.playSession.getState().noteProgress as string[]).filter((p) => p !== 'pending').length };
    });
    // every change of the lit notes while Kuula plays, taken after each game step with the player's own song time: the
    // test reads what the screen showed frame by frame, not one moment that a slow poll can miss (a quarter at 70 BPM is
    // lit for under a second)
    type Lit = { lit: number[]; elapsed: number };
    await page.evaluate(() => {
      const w = window as unknown as { __lit: Lit[] };
      w.__lit = [];
      window.__game.events.on('poststep', () => {
        const scene = window.__game.scene.getScene('practice');
        const elapsed = scene.sys.isActive() && scene.listening ? (scene.listenAlong?.player.elapsedMs() as number | null) : null;
        if (elapsed === null || elapsed === undefined || elapsed < 0) return; // the lead-in: nothing sounds yet
        const lit = [...(scene.playSession?.staffView?.cursors ?? [])] as number[];
        if (lit.join(',') !== w.__lit.at(-1)?.lit.join(',')) w.__lit.push({ lit, elapsed });
      });
    });
    const litLog = () => page.evaluate(() => (window as unknown as { __lit: Lit[] }).__lit);
    /** The notes lit one after the other since entry `from` of the log (empty ones, between notes, left out). */
    const litSince = async (from: number) => (await litLog()).slice(from).map((l) => l.lit).filter((l) => l.length > 0);
    const listenButton = (label: string) => page.evaluate((text) => (window.__game.scene.getScene('practice').buttons as { options: { label: string } }[]).findIndex((b) => b.options.label === text), label);
    const first = await page.evaluate(() => window.__game.scene.getScene('practice').chart.notes[0].midi as number);
    expect(await listenButton('Listen')).toBeGreaterThanOrEqual(0);
    await clickButton(page, 'practice', await listenButton('Listen'));
    await expect.poll(async () => (await state()).playing).toBe(true);
    // the first note lights as it sounds (after the lead-in)
    await expect.poll(() => litSince(0)).toContainEqual([0]);
    // the student's keys are not judged while the game plays the piece
    await playWithVirtualPiano(page, [first]);
    await letGameRun(page, 5);
    expect((await state()).judged).toBe(0);
    // the notes light one after the other, the first one first
    await expect.poll(async () => (await litSince(0)).length, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
    expect((await litSince(0)).slice(0, 2)).toEqual([[0], [1]]);
    // the space bar (AC8) starts the listening over from the first note: note 0 lights again
    const beforeSpace = (await litLog()).length;
    await page.keyboard.press('Space');
    await expect.poll(() => litSince(beforeSpace)).toContainEqual([0]);
    expect((await state()).listening).toBe(true);
    // the toolbar button is now Stop: the piece starts over, waiting for its first note
    await clickButton(page, 'practice', await listenButton('Stop'));
    await expect.poll(async () => (await state()).listening).toBe(false);
    expect((await state()).playing).toBe(false);
    await playWithVirtualPiano(page, [first]);
    await expect.poll(async () => (await state()).judged).toBe(1);
    expectNoErrors(errors);
  });
});

test.describe('the space bar starts the play over', () => {
  const stepIndex = (page: Page) => page.evaluate(() => window.__game.scene.getScene('practice').playSession.getState().stepIndex as number);

  test('ft_1_12.AC8 in Wait mode the space bar goes back to the first note, keeps the click on and plays no note', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    const running = () => page.evaluate(() => window.__game.registry.get('context').audio.metronome.running as boolean);
    await page.keyboard.press('Shift+KeyM');
    await expect.poll(running).toBe(true);
    await playWithVirtualPiano(page, [60, 62, 64]);
    await expect.poll(() => stepIndex(page)).toBe(3);
    await page.keyboard.press('Space');
    await expect.poll(() => stepIndex(page)).toBe(0);
    expect(await chartId(page)).toBe('little-steps');
    await expect.poll(running).toBe(true); // the click starts again with the piece
    // the keys played before the reset stay in the session: leaving opens the score screen, not the piece list
    expect(await page.evaluate(() => window.__game.scene.getScene('practice').session.notesRight as number)).toBe(3);
    // the piece goes on from its first note
    await playWithVirtualPiano(page, [60]);
    await expect.poll(() => stepIndex(page)).toBe(1);
    expectNoErrors(errors);
  });

  test('ft_1_12.AC8 a section starts over at its own first bar', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await page.keyboard.press('Shift+KeyR');
    await page.keyboard.press('Digit2');
    await page.keyboard.press('Digit3');
    await expect.poll(() => chartId(page)).toBe('little-steps#bars-2-3');
    await playWithVirtualPiano(page, [67]);
    await expect.poll(() => stepIndex(page)).toBe(1);
    await page.keyboard.press('Space');
    await expect.poll(() => stepIndex(page)).toBe(0);
    expect(await chartId(page)).toBe('little-steps#bars-2-3');
    expectNoErrors(errors);
  });

  test('ft_1_12.AC8 in Tempo mode the space bar counts in at once, with no key pressed', async ({ page }) => {
    const errors = await openGame(page);
    await page.evaluate(() => window.__game.registry.get('context').profiles.updatePlaySettings({ mode: 'tempo' }));
    await openPiece(page, 'Little Steps');
    const started = () => page.evaluate(() => window.__game.scene.getScene('practice').playSession.transport.started as boolean);
    expect(await started()).toBe(false);
    await page.keyboard.press('Space');
    await expect.poll(started).toBe(true);
    const running = () => page.evaluate(() => window.__game.registry.get('context').audio.metronome.running as boolean);
    await expect.poll(running).toBe(true); // the count-in clicks
    await expect.poll(() => sceneTexts(page, 'practice')).toContain('1');
    expectNoErrors(errors);
  });
});

test.describe('turning the staff\'s pages by hand', () => {
  test('ft_0_16.AC8 the arrow keys and the wheel turn the pages both ways, and the next key played turns back to the lit notes', async ({ page }) => {
    const errors = await openGame(page);
    await useOneLine(page);
    await openPiece(page, 'Little Steps');
    const shown = () => page.evaluate(() => {
      const scene = window.__game.scene.getScene('practice');
      return { page: scene.playSession.staffView.currentPage as number, pages: scene.playSession.layout.pageCount as number };
    });
    const { pages } = await shown();
    expect(pages).toBeGreaterThan(1);
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await shown()).page).toBe(1);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft'); // the first page stays
    await expect.poll(async () => (await shown()).page).toBe(0);
    const middle = await page.evaluate(() => {
      const r = document.querySelector('canvas')!.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.move(middle.x, middle.y);
    for (let i = 0; i < pages + 1; i++) await page.mouse.wheel(0, 100); // the last page stays
    await expect.poll(async () => (await shown()).page).toBe(pages - 1);
    await page.mouse.wheel(0, -100);
    await expect.poll(async () => (await shown()).page).toBe(pages - 2);
    // a look only: the play waits at its first note, and playing it turns back to its page
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await shown()).page).toBe(1);
    await playWithVirtualPiano(page, [60]);
    await expect.poll(async () => (await shown()).page).toBe(0);
    expect(await page.evaluate(() => window.__game.scene.getScene('practice').playSession.controller.getState().stepIndex)).toBe(1);
    expectNoErrors(errors);
  });
});

test.describe('start from a tapped bar', () => {
  test('core_03.AC6 a tap on a bar starts the play there under a start mark, loops back to it with no XP, and a tap on the mark takes it away', async ({ page }) => {
    test.slow();
    const errors = await openGame(page);
    await useOneLine(page);
    await openPiece(page, 'Little Steps');
    const bars = await page.evaluate(() => window.__game.scene.getScene('practice').fullChart.bars.length as number);
    const marks = () => page.evaluate(() => (window.__game.scene.getScene('practice').playSession.staffView.markTexts as { text: { text: string } }[]).map((m) => m.text.text));
    const xp = await pieceXp(page, 'little-steps');
    await tapBar(page, 2, 'keys'); // on the second page: turned with the arrow key first
    await expect.poll(() => chartId(page)).toBe(`little-steps#bars-3-${bars}`);
    expect(await marks()).toEqual(['▶']);
    expect(await page.evaluate(() => window.__game.scene.getScene('practice').picking)).toBeNull();

    // played to the end it loops back to the mark, with no XP
    const notes = await page.evaluate(() => (window.__game.scene.getScene('practice').chart.notes as { midi: number }[]).map((n) => n.midi));
    await playWithVirtualPiano(page, notes);
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('practice').startData.lap as number)).toBe(1);
    expect(await chartId(page)).toBe(`little-steps#bars-3-${bars}`);
    expect(await marks()).toEqual(['▶']);
    expect(await pieceXp(page, 'little-steps')).toBe(xp);

    // a tap on the marked bar: the whole piece again, with no mark
    await tapBar(page, 0, 'keys');
    await expect.poll(() => chartId(page)).toBe('little-steps');
    expect(await marks()).toEqual([]);
    expectNoErrors(errors);
  });
});
