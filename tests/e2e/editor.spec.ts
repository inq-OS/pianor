// Covers ft_Y_04.AC27, ft_Y_04.AC29, ft_Y_04.AC30, ft_1_02e.AC1, ft_1_02e.AC2, ft_1_02e.AC3, ft_1_02e.AC4, ft_1_02e.AC5, ft_1_02e.AC6, ft_1_02e.AC7, ft_1_02e.AC8, ft_1_02d.AC25, ft_1_02d.AC34, ft_1_02d.AC35, ft_1_02d.AC36, ft_1_02d.AC37, ft_1_02d.AC38, ft_1_02d.AC39, ft_1_02d.AC31, ft_1_02d.AC32, ft_1_02d.AC33, ft_1_29.AC4, ft_1_02d.AC24, ft_1_33.AC1, ft_1_33.AC3, ft_Y_04.AC16, ft_Y_04.AC17, ft_Y_04.AC26, ft_1_02d.AC19, ft_1_02d.AC14, ft_1_02d.AC15, ft_1_02d.AC16, ft_1_02d.AC17, ft_1_02d.AC18, ft_1_02a.AC3, ft_1_02a.AC10, ft_1_02a.AC11, ft_1_02a.AC12, ft_1_02b.AC4, ft_1_02d.AC3, ft_1_02d.AC8, ft_1_02d.AC9, ft_1_02d.AC10, ft_1_02d.AC11, ft_1_02d.AC12, core_09.AC8, core_09.AC35, core_09.AC36, core_09.AC30, ft_1_02a.AC14.
import { readFileSync } from 'node:fs';
import { musicXmlToChart } from '../../src/core/import/musicxml';
import { encode as encodePng } from 'fast-png';
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { activeScenes, buttonPoint, clickButton, clickToolbar, bubbleOpen, closeBubble, expectNoErrors, lastButton, menuButton, openBubbleFromMore, openGame, openPiece, letGameRun, playWithVirtualPiano, sceneButton, sceneTexts, sceneWords, showMenuPageWith, toScoreScreen, waitForScene } from './helpers';

/** The editor is preliminary, on in the menu; `?editor=0` hides it. */
const EDITOR = '?device=virtual';

type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

/** The page position of where a right-hand note at this bar, eighth and pitch goes. */
async function canvasPoint(page: Page, place: { bar: number; start: number; step: Step; octave?: number }): Promise<{ x: number; y: number }> {
  return page.evaluate(
    (p) => {
      const scene = window.__game.scene.getScene('editor');
      const at = scene.pointForNote({ hand: 'RH', octave: 4, ...p }) as { x: number; y: number };
      const canvas = document.querySelector('canvas')!;
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + (at.x / canvas.width) * rect.width, y: rect.top + (at.y / canvas.height) * rect.height };
    },
    place,
  );
}

/**
 * Middle-click (with the real mouse) where a note of the right hand at this bar, eighth and pitch goes: the middle button
 * places notes and lengthens a note, Ctrl shortens.
 */
async function clickNote(page: Page, bar: number, start: number, step: Step, octave = 4, modifiers: ('Control')[] = []): Promise<void> {
  const point = await canvasPoint(page, { bar, start, step, octave });
  for (const m of modifiers) await page.keyboard.down(m);
  await page.mouse.click(point.x, point.y, { button: 'middle' });
  for (const m of modifiers) await page.keyboard.up(m);
}

/** Left-click (with the real mouse) there: the left button selects a note or a spot, with Shift it extends the bar selection. */
async function selectNote(page: Page, bar: number, start: number, step: Step, octave = 4, modifiers: ('Shift' | 'Alt')[] = []): Promise<void> {
  const point = await canvasPoint(page, { bar, start, step, octave });
  for (const m of modifiers) await page.keyboard.down(m);
  await page.mouse.click(point.x, point.y);
  for (const m of modifiers) await page.keyboard.up(m);
}

/** Sets up E and G as quarters at 0 and 480 (a new note has the selected length, a quarter at the start). */
async function eAndGQuarters(page: Page): Promise<void> {
  await clickNote(page, 0, 0, 'E');
  await clickNote(page, 0, 480, 'G');
}

const notes = (page: Page) =>
  page.evaluate(() => (window.__game.scene.getScene('editor').history.present.notes as { bar: number; start: number; length: string; step: string }[]).map((n) => `${n.bar}:${n.start}:${n.step}:${n.length}`));
/** What the piece maker says: its texts and the band's tooltips (Save says which levels the piece fits, ft_1_20). */
const status = async (page: Page) => (await sceneWords(page, 'editor')).join(' | ');

/** How many cards the F1 help shows (ft_1_33): each card's small mouse is named `helpMouse.<n>`. */
async function helpCards(page: Page): Promise<number> {
  return page.evaluate(() => {
    const walk = (list: { name?: string; list?: unknown[] }[]): number => list.reduce((n, o) => n + (o.name?.startsWith('helpMouse.') ? 1 : 0) + (o.list ? walk(o.list as never) : 0), 0);
    return walk(window.__game.scene.getScene('editor').children.list as never);
  });
}

async function openEditor(page: Page): Promise<void> {
  // the New piece card is the first card of the one piece list (ft_1_12)
  await expect.poll(() => menuButton(page, '+ New piece')).toBeGreaterThanOrEqual(0);
  await clickButton(page, 'menu', await menuButton(page, '+ New piece'));
  await waitForScene(page, 'editor');
  // a new piece opens on its staff in 4/4 and C (no start screen)
  await expect.poll(() => page.evaluate(() => !!(window.__game.scene.getScene('editor') as unknown as { staffView: unknown }).staffView)).toBe(true);
}

/** Presses (with the real mouse) the clef or the time signature at the start of the first line, or only moves onto it. */
async function pressSignature(page: Page, kind: 'key' | 'time', only: 'press' | 'hover' | 'right' = 'press'): Promise<void> {
  const point = await page.evaluate((k) => {
    type Layout = { staffSpace: number; systems: { left: number; staves: { topLineY: number; bottomLineY: number }[] }[]; timeSignatures: { system: number; x: number }[] };
    const scene = window.__game.scene.getScene('editor') as unknown as { layout: Layout; staffLeft: number; staffTop: number };
    const { layout } = scene;
    const system = layout.systems[0]!;
    const staff = system.staves[0]!;
    const time = layout.timeSignatures.find((ts) => ts.system === 0)!;
    const S = layout.staffSpace;
    const x = k === 'time' ? time.x + S / 4 : system.left + S;
    const canvas = document.querySelector('canvas')!;
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + ((scene.staffLeft + x) / canvas.width) * rect.width, y: rect.top + ((scene.staffTop + (staff.topLineY + staff.bottomLineY) / 2) / canvas.height) * rect.height };
  }, kind);
  if (only === 'hover') await page.mouse.move(point.x, point.y);
  else await page.mouse.click(point.x, point.y, only === 'right' ? { button: 'right' } : {});
}

/** Which panel is open over the staff's foot: the time panel or none. */
const panelOf = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { panel: string | null }).panel);

/** Opens the time panel with a press on the time signature. */
async function openTime(page: Page): Promise<void> {
  if ((await panelOf(page)) === 'time') return;
  await pressSignature(page, 'time');
  await expect.poll(() => panelOf(page)).toBe('time');
}

/** The time panel's step buttons: the time, the pick-up and the tempo, each with its - and +. */
const timeStep = (page: Page, group: 'meter' | 'pickup' | 'bpm', sign: '-' | '+') => page.evaluate(([g, s]) => {
  const buttons = window.__game.scene.getScene('editor').buttons as { options: { label: string; tooltip?: string } }[];
  const tip = { meter: 'The time:', pickup: 'Pick-up:', bpm: 'Beats per minute' }[g];
  return buttons.findIndex((b) => b.options.label === s && (b.options.tooltip ?? '').startsWith(tip));
}, [group, sign] as const);

/** The + or - after the last bar: four bars more or fewer. */
const barStep = (page: Page, sign: '-' | '+') => page.evaluate((s) => {
  const buttons = window.__game.scene.getScene('editor').buttons as { options: { label: string; tooltip?: string } }[];
  return buttons.findIndex((b) => b.options.label === s && (b.options.tooltip ?? '').startsWith('Four bars'));
}, sign);

/**
 * The index of a button with this label on the screen or in the bubble (ft_1_20, d282): first the bubble from More (the
 * selected note's options, or the place's), then the bubble opened with the right button on an empty place of the staff
 * (high A in bar `bar`, the first by default), whose options say how the next notes are written.
 */
async function bubbleButton(page: Page, label: string, bar = 0): Promise<number> {
  const found = await editorButton(page, label);
  if (found >= 0) return found;
  await closeBubble(page, 'editor');
  const place = await canvasPoint(page, { bar, start: 0, step: 'A', octave: 5 });
  await page.mouse.click(place.x, place.y, { button: 'right' });
  await expect.poll(() => bubbleOpen(page, 'editor')).toBe(true);
  return lastButton(page, 'editor', label);
}

/** Types the piece's title into its field in the top strip. */
async function setTitle(page: Page, title: string): Promise<void> {
  await page.fill('#editor-title', title);
}

/**
 * The index of the editor button with this word or label (the last one: an open menu's choices come after the screen's
 * buttons); one that is not on the screen may be an option of the bubble, which is then opened from More (ft_1_20, d282):
 * on the selected note's options while a note is selected, else on the place's.
 */
async function editorButton(page: Page, label: string): Promise<number> {
  const found = await lastButton(page, 'editor', label);
  if (found >= 0) return found;
  return (await openBubbleFromMore(page, 'editor')) ? lastButton(page, 'editor', label) : -1;
}

/** Opens the bubble's option `option` (from More) and presses its choice `choice` (ft_1_20.AC20). */
async function pickInBubble(page: Page, option: string, choice: string): Promise<void> {
  await clickButton(page, 'editor', await editorButton(page, option));
  await expect.poll(() => lastButton(page, 'editor', choice), choice).toBeGreaterThanOrEqual(0);
  await clickButton(page, 'editor', await lastButton(page, 'editor', choice));
}

/** Opens the tie and slur menu (core_09.AC30; one item now) and returns its choices' labels by button index. */
async function openTieMenu(page: Page): Promise<string[]> {
  await clickButton(page, 'editor', await editorButton(page, 'Ties and slurs'));
  // a choice drawn as a picture says its word in its label
  return page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { buttons: { objects: { text?: string }[]; options: { label: string } }[] }).buttons.map((b) => b.objects.map((o) => o.text ?? '').join('') || b.options.label));
}

test.describe('piece editor (preliminary)', () => {
  test('the main menu opens the piece maker directly: no player room in between, and Back returns to the main menu', async ({ page }) => {
    const errors = await openGame(page, EDITOR, 'en', 'profiles');
    const maker = await page.evaluate(() => (window.__game.scene.getScene('profiles').buttons as { objects: { text?: string }[] }[]).findIndex((b) => b.objects.some((o) => o.text === 'Piece maker')));
    expect(maker).toBeGreaterThanOrEqual(0);
    const xpBefore = await page.evaluate(() => window.__game.registry.get('context').profiles.progress.totalXp as number);
    await clickButton(page, 'profiles', maker);
    await waitForScene(page, 'menu');
    await expect.poll(() => menuButton(page, '+ New piece')).toBeGreaterThanOrEqual(0);
    // it says what it offers in words: the new piece, and where the pieces made will be
    const texts = await sceneTexts(page, 'menu');
    expect(texts).toContain('+ New piece');
    if (!(await page.evaluate(() => window.__game.registry.get('context').pieces.list().some((p: { own?: boolean }) => p.own)))) expect(texts).toContain('The pieces you make are kept here.');
    // the piece maker saves no progress: it lists own pieces only and a card opens the editor, so no piece can be played from it
    expect(await menuButton(page, 'Practice')).toBe(-1);
    expect(await page.evaluate(() => window.__game.registry.get('context').profiles.progress.totalXp as number)).toBe(xpBefore);
    await clickButton(page, 'menu', await menuButton(page, 'Back'));
    await waitForScene(page, 'profiles');
    expectNoErrors(errors);
  });

  test('can be switched off with ?editor=0: the menu has no New piece card', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual&editor=0');
    expect(await menuButton(page, '+ New piece')).toBe(-1);
    expectNoErrors(errors);
  });

  test('there is no hand choice: the editor always shows the grand staff', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    const texts = await sceneTexts(page, 'editor');
    for (const hand of ['Right', 'Left', 'Both']) expect(texts).not.toContain(hand);
    expect(await page.evaluate(() => (window.__game.scene.getScene('editor').layout.systems[0].staves as { clef: string }[]).map((s) => s.clef))).toEqual(['treble', 'bass']);
    expectNoErrors(errors);
  });

  test('core_09.AC8 ft_1_02a.AC14 a new piece opens on its staff; a press on the clef opens the circle of fifths, on the time signature the time panel', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    const piece = () => page.evaluate(() => { const p = window.__game.scene.getScene('editor').history.present as { beats: number; fifths: number; mode: string }; return { beats: p.beats, fifths: p.fifths, mode: p.mode }; });
    expect(await piece()).toEqual({ beats: 4, fifths: 0, mode: 'major' });
    // no start screen and no Piece item: the title is in the top strip, with Save, Import and Export
    for (const gone of ['Start writing', 'Piece', 'D major / B minor']) expect(await editorButton(page, gone)).toBe(-1);
    for (const there of ['Save', 'Import', 'Export', 'Circle of fifths']) expect(await sceneButton(page, 'editor', there)).toBeGreaterThanOrEqual(0);
    await closeBubble(page, 'editor'); // the circle is an option of the bubble
    expect(await page.locator('#editor-title').inputValue()).toBe('');
    // (ft_1_02d.AC32) the pointer on the clef names the key over it, before anything is pressed
    await pressSignature(page, 'key', 'hover');
    const label = () => page.evaluate(() => { const l = (window.__game.scene.getScene('editor') as unknown as { ghostLabel: { visible: boolean; text: string } }).ghostLabel; return l.visible ? l.text : ''; });
    await expect.poll(label).toBe('C major');
    // the clef opens the circle, which sets the key (ft_1_28.AC7)
    await pressSignature(page, 'key');
    await waitForScene(page, 'circle');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !window.__game.scene.getScenes(true).some((s) => s.scene.key === 'circle'));
    // the time signature opens the time panel: its arrows and the wheel step the time while the piece is empty
    await openTime(page);
    expect(await sceneTexts(page, 'editor')).toContain('4/4');
    await clickButton(page, 'editor', await timeStep(page, 'meter', '-'));
    expect(await piece()).toEqual({ beats: 3, fifths: 0, mode: 'major' });
    const panel = await page.evaluate(() => {
      const scene = window.__game.scene.getScene('editor') as unknown as { meterText: { getBounds(): { centerX: number; centerY: number } } };
      const at = scene.meterText.getBounds();
      const canvas = document.querySelector('canvas')!;
      const rect = canvas.getBoundingClientRect();
      const ratio = rect.width / canvas.width;
      return { x: rect.left + at.centerX * ratio, y: rect.top + at.centerY * ratio };
    });
    await page.mouse.move(panel.x, panel.y);
    // up is the next time, as up is the longer length
    await page.mouse.wheel(0, -100);
    await expect.poll(piece).toEqual({ beats: 4, fifths: 0, mode: 'major' });
    // a second press closes it, and the bar buttons after the last bar come back
    expect(await barStep(page, '+')).toBe(-1);
    await pressSignature(page, 'time');
    await expect.poll(() => panelOf(page)).toBe(null);
    expect(await barStep(page, '+')).toBeGreaterThanOrEqual(0);
    expectNoErrors(errors);
  });

  test('ft_1_29.AC4 a note selected in a column of C, E and G names the chord, C', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    for (const step of ['C', 'E', 'G'] as const) await clickNote(page, 0, 0, step);
    await selectNote(page, 0, 0, 'E');
    await expect.poll(() => status(page)).toContain('Chord: C');
    expectNoErrors(errors);
  });

  test('the writer is one armed cell of the strip; notes or rests are chosen in the bubble on the staff, and the writer shows the one in use', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    const state = () => page.evaluate(() => {
      const scene = window.__game.scene.getScene('editor') as unknown as { entry: string; lengthItem: { armed: boolean; options: { label: string } } };
      return { entry: scene.entry, armed: scene.lengthItem.armed, writer: scene.lengthItem.options.label };
    });
    expect(await state()).toEqual({ entry: 'note', armed: true, writer: 'Notes' });
    // the bubble on an empty place: its first option holds notes and rests
    expect(await openBubbleFromMore(page, 'editor')).toBe(true);
    await clickButton(page, 'editor', await lastButton(page, 'editor', 'Notes'));
    await clickButton(page, 'editor', await lastButton(page, 'editor', 'Rests'));
    await expect.poll(state).toEqual({ entry: 'rest', armed: true, writer: 'Rests' });
    await closeBubble(page, 'editor');
    expect(await openBubbleFromMore(page, 'editor')).toBe(true);
    await clickButton(page, 'editor', await lastButton(page, 'editor', 'Rests'));
    await clickButton(page, 'editor', await lastButton(page, 'editor', 'Notes'));
    await expect.poll(state).toEqual({ entry: 'note', armed: true, writer: 'Notes' });
    expectNoErrors(errors);
  });

  test('core_09.AC30 the time panel sets a pick-up: a short first bar to write in, and a longer one keeps its note where it sounds', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    const state = () => page.evaluate(() => {
      const scene = window.__game.scene.getScene('editor') as unknown as { history: { present: { pickup?: number; notes: { bar: number; start: number }[] } }; chart: { bars: { startTick: number; endTick: number }[] } | null };
      const p = scene.history.present;
      return { pickup: p.pickup ?? 0, notes: p.notes.map((n) => `${n.bar}:${n.start}`), first: scene.chart ? scene.chart.bars[0]!.endTick - scene.chart.bars[0]!.startTick : null };
    });
    await openTime(page);
    expect(await sceneTexts(page, 'editor')).toContain('No pick-up');
    await clickButton(page, 'editor', await timeStep(page, 'pickup', '+'));
    expect((await state()).pickup).toBe(1);
    expect(await sceneTexts(page, 'editor')).toContain('Pick-up 1/4');
    await pressSignature(page, 'time');
    await expect.poll(() => panelOf(page)).toBe(null);
    // the first bar is one beat long: the first note goes there
    expect((await state()).first).toBe(480);
    await clickNote(page, 0, 0, 'G');
    await expect.poll(async () => (await state()).notes).toEqual(['0:0']);
    // two beats: the G stays on the last beat before bar 2, now the pick-up's second
    await openTime(page);
    await clickButton(page, 'editor', await timeStep(page, 'pickup', '+'));
    expect(await state()).toEqual({ pickup: 2, notes: ['0:480'], first: 960 });
    expect(await sceneTexts(page, 'editor')).toContain('Pick-up 2/4');
    expectNoErrors(errors);
  });

  test('every bar has its number while writing, whatever the bar numbers setting says', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    expect(await page.evaluate(() => window.__game.registry.get('context').profiles.barNumberSettings.mode as string)).toBe('off');
    await openEditor(page);
    const numbers = () => page.evaluate(() => {
      const scene = window.__game.scene.getScene('editor');
      return { bars: scene.chart.bars.length as number, drawn: (scene.staffView.barNumbers as { number: number }[]).map((b) => b.number) };
    });
    const { bars, drawn } = await numbers();
    expect(bars).toBeGreaterThan(1);
    expect(drawn).toEqual(Array.from({ length: bars }, (_, i) => i + 1));
    expectNoErrors(errors);
  });

  test('the BPM field sets the tempo of the piece and of the chart it draws (ft_1_02d.AC5)', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    const bpmOf = () => page.evaluate(() => ({ piece: window.__game.scene.getScene('editor').history.present.bpm as number | undefined, chart: window.__game.scene.getScene('editor').chart.tempoMap[0].bpm as number }));
    expect(await bpmOf()).toEqual({ piece: undefined, chart: 80 });
    await openTime(page); // the BPM is on the time panel
    expect(await sceneTexts(page, 'editor')).toContain('80 BPM');
    const plus = await timeStep(page, 'bpm', '+');
    await clickButton(page, 'editor', plus);
    await clickButton(page, 'editor', plus);
    await expect.poll(bpmOf).toEqual({ piece: 90, chart: 90 });
    expect(await sceneTexts(page, 'editor')).toContain('90 BPM');
    expectNoErrors(errors);
  });

  test('the BPM plus button is on screen and raises the BPM (ft_1_02d.AC5)', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await openTime(page);
    const index = await timeStep(page, 'bpm', '+');
    const geometry = await page.evaluate((i) => {
      const scene = window.__game.scene.getScene('editor');
      const buttons = scene.buttons as { screenCenter(): { x: number } }[];
      return { index: i, right: buttons[i]!.screenCenter().x / scene.px.scale + 8, width: scene.px.width as number };
    }, index);
    expect(geometry.right).toBeLessThanOrEqual(geometry.width);
    await clickButton(page, 'editor', geometry.index);
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('editor').history.present.bpm as number)).toBe(85);
    expectNoErrors(errors);
  });

  for (const lang of ['en', 'et'] as const) {
    // At 320x180 the editor's staff also had to be as tall as the practice screen's; with one size (d105) the staff
    // has room to spare, and the test keeps what still matters: it fits, and nothing is off the screen or on the staff.
    // With the band (ft_1_20.AC8) there are no rows of options: the staff runs from the corners' strip down to the band.
    test(`the staff fits above the band, and nothing overlaps (${lang}) (ft_1_20.AC8)`, async ({ page }) => {
      const errors = await openGame(page, EDITOR, lang, 'profiles');
      await page.evaluate(() => (window.__game.scene.getScenes(true)[0] as unknown as { scene: { start(key: string, data: unknown): void } }).scene.start('editor', {}));
      await waitForScene(page, 'editor');
      const found = await page.evaluate(() => {
        type Box = { x: number; y: number; width: number; height: number };
        const scene = window.__game.scene.getScene('editor') as unknown as {
          px: { scale: number; width: number }; scale: { height: number }; mainRows: number; staffTop: number; staffHeight: number; mainTop: number;
          layout: { fits: boolean; staffSpace: number }; buttons: { rect: Box; objects: { text?: string }[]; options: { tooltip?: string } }[];
          root: { list: { pixelText?: boolean; visible: boolean; text: string; x: number; y: number; width: number; height: number }[] };
        };
        const s = scene.px.scale;
        // the staff's rows in the main area; the band's cells lie under it
        const screenRows = Math.floor(scene.scale.height / s);
        const staff = { top: (scene.staffTop - scene.mainTop) / s, bottom: (scene.staffTop - scene.mainTop + scene.staffHeight) / s };
        const name = (b: { objects: { text?: string }[] }, i: number) => b.objects.find((o) => o.text)?.text ?? `button ${i}`;
        // the + and - after the last bar stand on the staff's line on purpose
        const barStep = (b: { options: { tooltip?: string } }) => /^(Four bars|Neli takti)/.test(b.options.tooltip ?? '');
        const boxes: { name: string; box: Box }[] = [
          ...scene.buttons.filter((b) => !barStep(b)).map((b, i) => ({ name: name(b, i), box: b.rect })),
          ...scene.root.list.filter((o) => o.pixelText === true && o.visible && o.text !== '').map((o) => ({ name: `"${o.text}"`, box: { x: o.x, y: o.y, width: o.width, height: o.height } })),
        ].filter((b) => b.box.y >= 0);
        const problems: string[] = [];
        const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        for (const { name: n, box } of boxes) {
          if (box.x < 0 || box.x + box.width > scene.px.width || box.y + box.height > screenRows) problems.push(`${n} is off the screen`);
          if (box.y < staff.bottom && staff.top < box.y + box.height) problems.push(`${n} is on the staff`);
        }
        // a text on its own button (a label) is part of it; the rest may not touch
        const buttonsOnly = boxes.filter((b) => !b.name.startsWith('"'));
        buttonsOnly.forEach((a, i) => buttonsOnly.slice(i + 1).forEach((b) => { if (overlaps(a.box, b.box)) problems.push(`${a.name} overlaps ${b.name}`); }));
        return { problems, fits: scene.layout.fits, staffSpace: scene.layout.staffSpace, staffHeight: scene.staffHeight };
      });
      expect(found.problems).toEqual([]);
      expect(found.fits).toBe(true);
      expectNoErrors(errors);
    });
  }

  test('writes a piece with real clicks and keys, saves it, and it is in the menu to play for XP', async ({ page }) => {
    test.slow(); // many clicks, then a whole piece
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    // a blank piece starts with 8 bars; this one is 4 bars long, so take one step of 4 off (the - after the last bar)
    await page.fill('#editor-title', 'Up and Down');
    await clickButton(page, 'editor', await barStep(page, '-'));

    // C D E F | G2 F2 | E D C D | C4, with the length keys 4, 2 and 1 and the mouse, left to right: each note has the
    // selected length, and a click on the rest after a note starts where that rest starts
    for (const [start, step] of [[0, 'C'], [480, 'D'], [960, 'E'], [1440, 'F']] as const) await clickNote(page, 0, start, step);
    await page.keyboard.press('Digit2');
    await clickNote(page, 1, 0, 'G');
    await clickNote(page, 1, 960, 'F');
    await page.keyboard.press('Digit4');
    for (const [start, step] of [[0, 'E'], [480, 'D'], [960, 'C'], [1440, 'D']] as const) await clickNote(page, 2, start, step);
    await page.keyboard.press('Digit1');
    await clickNote(page, 3, 0, 'C');
    expect(await notes(page)).toHaveLength(11);
    expect((await notes(page)).filter((n) => n.startsWith('1:'))).toEqual(['1:0:G:half', '1:960:F:half']);

    // undo and redo
    await page.keyboard.press('Control+KeyZ');
    expect(await notes(page)).toHaveLength(10);
    await page.keyboard.press('Control+KeyY');
    expect(await notes(page)).toHaveLength(11);

    // a left click on a note selects it, and a middle click on a note makes it longer: here the next note is in the way
    await selectNote(page, 0, 0, 'C');
    await clickNote(page, 0, 0, 'C');
    await expect.poll(() => status(page)).toContain('Another note is in the way.');
    // Ctrl + middle click makes it shorter, the length key makes it a quarter again
    await clickNote(page, 0, 0, 'C', 4, ['Control']);
    expect((await notes(page))[0]).toBe('0:0:C:eighth');
    await page.keyboard.press('Digit4');
    expect((await notes(page))[0]).toBe('0:0:C:quarter');
    // a click on an empty place in the column of a note adds a chord note there; undo takes it away
    await clickNote(page, 0, 480, 'G');
    expect(await notes(page)).toHaveLength(12);
    expect((await notes(page)).filter((n) => n.startsWith('0:480:')).sort()).toEqual(['0:480:D:quarter', '0:480:G:quarter']);
    await page.keyboard.press('Control+KeyZ');
    expect(await notes(page)).toHaveLength(11);
    expect((await notes(page)).filter((n) => n.startsWith('0:480:'))).toEqual(['0:480:D:quarter']);

    await expect.poll(() => status(page)).toMatch(/Fits (level 1\.|levels 1 to)/);
    await clickButton(page, 'editor', await page.evaluate(() => (window.__game.scene.getScene('editor').buttons as { objects: { text?: string }[] }[]).findIndex((b) => b.objects.some((o) => o.text === 'Save'))));
    await expect.poll(() => status(page)).toContain('Saved. It is in the menu now.');
    expect(await page.evaluate(() => window.__game.registry.get('context').ownPieces.list().map((r: { id: string }) => r.id))).toEqual(['own-up-and-down']);

    // back in the one piece list (ft_1_12.AC2): the own piece has a pencil that opens it in the editor, and its card plays it and earns XP
    await clickToolbar(page, 'back');
    await waitForScene(page, 'menu');
    await showMenuPageWith(page, 'Up and Down');
    const pencil = await page.evaluate(() => {
      const button = window.__game.scene.getScene('menu').editButtons.get('own-up-and-down') as { screenCenter(): { x: number; y: number } } | undefined;
      if (!button) return null;
      const c = button.screenCenter();
      const r = document.querySelector('canvas')!.getBoundingClientRect();
      const canvas = document.querySelector('canvas')!;
      return { x: r.left + (c.x / canvas.width) * r.width, y: r.top + (c.y / canvas.height) * r.height };
    });
    expect(pencil, 'the own piece has a pencil').not.toBeNull();
    await page.mouse.click(pencil!.x, pencil!.y);
    await waitForScene(page, 'editor');
    await clickToolbar(page, 'back');
    await waitForScene(page, 'menu');
    await openPiece(page, 'Up and Down');
    await playWithVirtualPiano(page, [60, 62, 64, 65, 67, 65, 64, 62, 60, 62, 60]);
    await toScoreScreen(page);
    // the own piece earns its own XP (ft_1_13)
    expect(await page.evaluate(() => Object.values(window.__game.registry.get('context').profiles.progress.pieces).some((p) => (p as { xp: number }).xp > 0))).toBe(true);
    expectNoErrors(errors);
  });

  test('core_09.AC8 the clef opens the circle of fifths, which sets the key; a note takes the key\'s sharp, the natural tool changes it, and the saved piece opens in that key', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await setTitle(page, 'In G');
    // a press beside the clef opens the circle of fifths; its tick sets G major (ft_1_28 rule 8)
    const sign = await page.evaluate(() => {
      const scene = window.__game.scene.getScene('editor') as unknown as { layout: { clefs: { x: number }[]; bars: { x: number }[]; staffSpace: number; systems: { staves: { bottomLineY: number }[] }[] }; staffTop: number };
      const canvas = document.querySelector('canvas')!;
      const rect = canvas.getBoundingClientRect();
      const S = scene.layout.staffSpace;
      const x = (scene.layout.clefs[0]!.x + scene.layout.bars[0]!.x) / 2;
      const y = scene.staffTop + scene.layout.systems[0]!.staves[0]!.bottomLineY - (8 * S) / 2;
      return { x: rect.left + (x / canvas.width) * rect.width, y: rect.top + (y / canvas.height) * rect.height };
    });
    await page.mouse.click(sign.x, sign.y);
    await waitForScene(page, 'circle');
    await page.evaluate(() => (window.__game.scene.getScene('circle') as unknown as { choose(key: { fifths: number; mode: string }, play: boolean): void }).choose({ fifths: 1, mode: 'major' }, false));
    await clickButton(page, 'circle', await sceneButton(page, 'circle', 'Set the key: G major'));
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('editor').history.present.fifths)).toBe(1);

    // a note on F is F sharp in G; the accidental option in the bubble on the note opens sharp, flat and natural
    const alters = () => page.evaluate(() => (window.__game.scene.getScene('editor').history.present.notes as { step: string; alter: number }[]).map((n) => `${n.step}:${n.alter}`));
    await clickNote(page, 0, 0, 'F');
    expect(await alters()).toEqual(['F:1']);
    await selectNote(page, 0, 0, 'F'); // a left click on the note selects it
    await pickInBubble(page, '#', 'b');
    expect(await alters()).toEqual(['F:-1']);
    await pickInBubble(page, 'b', '=');
    expect(await alters()).toEqual(['F:0']);

    await clickButton(page, 'editor', await page.evaluate(() => (window.__game.scene.getScene('editor').buttons as { objects: { text?: string }[] }[]).findIndex((b) => b.objects.some((o) => o.text === 'Save'))));
    await expect.poll(() => status(page)).toContain('Saved. It is in the menu now.');
    // the saved piece opens in its key with its natural note
    const reopened = await page.evaluate(async () => {
      window.__game.scene.start('editor', { id: 'own-in-g' });
      await new Promise((r) => setTimeout(r, 300));
      const piece = window.__game.scene.getScene('editor').history.present;
      return { fifths: piece.fifths, notes: piece.notes.map((n: { step: string; alter: number }) => `${n.step}:${n.alter}`) };
    });
    expect(reopened).toEqual({ fifths: 1, notes: ['F:0'] });
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC3 the wheel over an empty place cycles the length and stops at the ends; over a note Ctrl + wheel changes the length, and the number keys still work', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    const length = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { length: string }).length);
    const at = (place: { bar: number; start: number; step: Step }) => canvasPoint(page, place);

    // an empty place (no note under the pointer): up is longer, down is shorter, and both stop at the ends
    const empty = await at({ bar: 0, start: 960, step: 'E' });
    await page.mouse.move(empty.x, empty.y);
    expect(await length()).toBe('quarter');
    await page.mouse.wheel(0, -100);
    expect(await length()).toBe('half');
    await page.mouse.wheel(0, -100);
    expect(await length()).toBe('whole');
    await page.mouse.wheel(0, -100);
    expect(await length()).toBe('whole');
    for (let i = 0; i < 5; i++) await page.mouse.wheel(0, 100);
    expect(await length()).toBe('sixteenth');

    // a note under the pointer: Ctrl + wheel changes that note's length (here up makes the quarter a half), not the current length
    await page.keyboard.press('Digit4');
    await clickNote(page, 0, 1440, 'G');
    await clickNote(page, 0, 0, 'C');
    const over = await at({ bar: 0, start: 0, step: 'C' });
    await page.mouse.move(over.x, over.y);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Control');
    await expect.poll(async () => (await notes(page))[0]).toBe('0:0:C:half');
    expect(await length()).toBe('quarter');

    // the number keys still set the length
    await page.keyboard.press('Digit8');
    expect(await length()).toBe('eighth');
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC8 ft_1_02a.AC12 the wheel in the column of a chord moves the whole chord, and the part of the bar it changes is highlighted', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await clickNote(page, 0, 0, 'C');
    await clickNote(page, 0, 0, 'E');
    expect(await notes(page)).toEqual(['0:0:C:quarter', '0:0:E:quarter']);
    const highlighted = () => page.evaluate(() => {
      const target = (window.__game.scene.getScene('editor') as unknown as { target: { commandBuffer: unknown[] } }).target;
      return target.commandBuffer.length > 0;
    });
    // above the chord's heads, in its column: the chord is highlighted, and the wheel up moves both notes
    const above = await canvasPoint(page, { bar: 0, start: 0, step: 'A', octave: 5 });
    await page.mouse.move(above.x, above.y);
    expect(await highlighted()).toBe(true);
    await page.mouse.wheel(0, -100);
    await expect.poll(() => notes(page)).toEqual(['0:0:D:quarter', '0:0:F:quarter']);
    // Ctrl + wheel there changes the chord's length
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Control');
    await expect.poll(() => notes(page)).toEqual(['0:0:D:half', '0:0:F:half']);
    // off the staff nothing is highlighted
    await page.mouse.move(5, 5);
    expect(await highlighted()).toBe(false);
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC8 Ctrl + wheel on a placed rest changes its length as on a note', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    const rests = () => page.evaluate(() => (window.__game.scene.getScene('editor').history.present.rests ?? []).map((r: { start: number; length: string }) => `${r.start}:${r.length}`));
    // key 0 writes rests: a quarter rest at the start of the bar
    await page.keyboard.press('Digit0');
    await clickNote(page, 0, 0, 'B');
    expect(await rests()).toEqual(['0:quarter']);
    const over = await canvasPoint(page, { bar: 0, start: 0, step: 'B' });
    await page.mouse.move(over.x, over.y);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await expect.poll(rests).toEqual(['0:half']);
    await page.mouse.wheel(0, 100);
    await expect.poll(rests).toEqual(['0:quarter']);
    await page.mouse.wheel(0, 100);
    await expect.poll(rests).toEqual(['0:eighth']);
    await page.keyboard.up('Control');
    expectNoErrors(errors);
  });

  test('Try it plays the piece on the practice screen and comes back to the editor with it', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await eAndGQuarters(page);
    const tryIt = await page.evaluate(() => (window.__game.scene.getScene('editor').buttons as { objects: { text?: string }[] }[]).findIndex((b) => b.objects.some((o) => o.text === 'Try it')));
    await clickButton(page, 'editor', tryIt);
    await waitForScene(page, 'practice');
    expect(await page.evaluate(() => window.__game.scene.getScene('practice').chart.notes.map((n: { midi: number }) => n.midi))).toEqual([64, 67]);
    await page.keyboard.press('Escape');
    await waitForScene(page, 'editor');
    expect(await notes(page)).toEqual(['0:0:E:quarter', '0:480:G:quarter']);
    expectNoErrors(errors);
  });

  test('writes in order on the shadow notes: the chosen length, rests with key 0, a note on a rest, and the staff never resizes (ft_1_02a.AC10) (ft_1_02a.AC11)', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    const frame = () => page.evaluate(() => {
      const scene = window.__game.scene.getScene('editor') as unknown as { layout: { staffSpace: number; clefs: { x: number; y: number }[] } };
      return { staffSpace: scene.layout.staffSpace, clef: scene.layout.clefs[0] };
    });
    const before = await frame();
    // a half, then a quarter on the shadow after it: each keeps its length
    await page.keyboard.press('Digit2');
    await clickNote(page, 0, 0, 'E');
    await page.keyboard.press('Digit4');
    await clickNote(page, 0, 960, 'G');
    expect(await notes(page)).toEqual(['0:0:E:half', '0:960:G:quarter']);
    // key 0 writes rests: a quarter rest fills the bar
    await page.keyboard.press('Digit0');
    await clickNote(page, 0, 1440, 'G');
    expect(await page.evaluate(() => window.__game.scene.getScene('editor').history.present.rests)).toEqual([{ hand: 'RH', bar: 0, start: 1440, length: 'quarter' }]);
    await page.keyboard.press('Digit0');
    // a note put on the rest takes its place
    await clickNote(page, 0, 1440, 'C', 5);
    expect(await notes(page)).toEqual(['0:0:E:half', '0:960:G:quarter', '0:1440:C:quarter']);
    expect(await page.evaluate(() => window.__game.scene.getScene('editor').history.present.rests)).toEqual([]);
    // eighths in the next bars: the bars grow, the staff keeps its size and the clef its place
    await page.keyboard.press('Digit8');
    for (let start = 0; start < 1920; start += 240) await clickNote(page, 1, start, 'C', 5);
    expect(await frame()).toEqual(before);
    expectNoErrors(errors);
  });

  test('refuses what the staff cannot draw and says why: a note past the bar line @smoke', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    // two halves fill the bar (the second on the half rest after the first)
    await page.keyboard.press('Digit2');
    await clickNote(page, 0, 0, 'E');
    await clickNote(page, 0, 960, 'C');
    expect(await notes(page)).toEqual(['0:0:E:half', '0:960:C:half']);
    await selectNote(page, 0, 960, 'C'); // a left click selects the note
    await clickNote(page, 0, 960, 'C'); // a middle click on the note makes it longer, past the bar line
    await expect.poll(() => status(page)).toContain('That does not fit before the bar line.');
    expect(await notes(page)).toEqual(['0:0:E:half', '0:960:C:half']);
    expectNoErrors(errors);
  });

  test('ft_1_02b.AC4 exports a piece as a file and imports it again as a new own piece', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await setTitle(page, 'Carry Me');
    await eAndGQuarters(page);
    // Export saves the piece first and downloads one file
    const download = page.waitForEvent('download');
    await clickButton(page, 'editor', await bubbleButton(page, 'Export'));
    const file = await download;
    expect(file.suggestedFilename()).toBe('own-carry-me.pianor-piece.json');
    const path = await file.path();
    const text = readFileSync(path, 'utf-8');
    expect(JSON.parse(text)).toMatchObject({ kind: 'pianor-piece', schemaVersion: 3, id: 'own-carry-me' });
    await expect.poll(() => status(page)).toContain('Saved the file own-carry-me.pianor-piece.json.');

    // Import adds the piece from the file as a new own piece, under a free title (ft_1_02a.AC15), and the piece being written stays as it is
    const chooser = page.waitForEvent('filechooser');
    await clickButton(page, 'editor', await bubbleButton(page, 'Import'));
    await (await chooser).setFiles(path);
    await expect.poll(() => status(page)).toContain('Added "Carry Me 2" to your pieces.');
    expect(await page.evaluate(() => window.__game.registry.get('context').ownPieces.list().map((r: { id: string }) => r.id))).toEqual(['own-carry-me', 'own-carry-me-2']);
    expect(await notes(page)).toEqual(['0:0:E:quarter', '0:480:G:quarter']);

    // a file that is not a piece file is refused with a sentence
    const refused = page.waitForEvent('filechooser');
    await clickButton(page, 'editor', await bubbleButton(page, 'Import'));
    await (await refused).setFiles({ name: 'oops.json', mimeType: 'application/json', buffer: Buffer.from('{ nope') });
    await expect.poll(() => status(page)).toContain('That file is not a piece file.');
    expect(await page.evaluate(() => window.__game.registry.get('context').ownPieces.list())).toHaveLength(2);
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC21 Undo past the time set to A brings A back with its step', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await openTime(page);
    await clickButton(page, 'editor', await timeStep(page, 'meter', '-'));
    await clickButton(page, 'editor', await timeStep(page, 'meter', '+'));
    await clickButton(page, 'editor', await timeStep(page, 'meter', '+'));
    const auto = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { meterAuto: boolean }).meterAuto);
    expect(await auto()).toBe(true);
    await page.keyboard.press('Control+z');
    expect(await auto()).toBe(false);
    expect(await page.evaluate(() => window.__game.scene.getScene('editor').history.present.beats)).toBe(4);
    await page.keyboard.press('Control+y');
    expect(await auto()).toBe(true);
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC17 Ctrl + Enter on a placed rest moves on, Enter makes it longer, and Delete takes it away', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    const rests = () => page.evaluate(() => (window.__game.scene.getScene('editor').history.present.rests ?? []).map((r: { start: number; length: string }) => `${r.start}:${r.length}`));
    const cursorAt = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { keyCursor: { bar: number; start: number } | null }).keyCursor?.start);
    await page.keyboard.press('KeyR');
    await page.keyboard.press('Digit4');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    expect(await rests()).toEqual(['0:quarter']);
    expect(await cursorAt()).toBe(0);
    await page.keyboard.press('Control+Enter');
    expect(await cursorAt()).toBe(480);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');
    expect(await rests()).toEqual(['0:half']);
    await page.keyboard.press('Delete');
    expect(await rests()).toEqual([]);
    expectNoErrors(errors);
  });

  test('Esc in the title field gives the keys back without leaving, and Ctrl + S there saves instead of the browser', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await clickNote(page, 0, 0, 'C');
    await page.keyboard.press('Control+s');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('editor-title');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.activeElement?.id)).not.toBe('editor-title');
    expect(await activeScenes(page)).toContain('editor');
    // typing goes to the field; Ctrl + S there is the piece maker's, and saves under the name
    await page.click('#editor-title');
    await page.keyboard.type('Bells');
    await page.keyboard.press('Control+s');
    await expect.poll(() => status(page)).toContain('Saved. It is in the menu now.');
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC24 the selected bars and the drag-repeat grip are drawn over the parchment', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await clickNote(page, 0, 0, 'C');
    const box = await canvasPoint(page, { bar: 1, start: 0, step: 'B', octave: 4 });
    const area = { x: box.x - 4, y: box.y - 20, width: 30, height: 40 };
    // the pointer away from the staff, so its target box is not drawn in either picture
    await page.mouse.move(area.x, 700);
    await letGameRun(page, 3);
    const before = await page.screenshot({ clip: area });
    await selectNote(page, 1, 0, 'B', 4, ['Shift']);
    await page.mouse.move(area.x, 700);
    // Shift + click selects from the bar clicked last (the note's) to this one
    expect(await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { barSel: unknown }).barSel)).toEqual({ from: 0, to: 1 });
    await letGameRun(page, 3);
    expect((await page.screenshot({ clip: area })).equals(before)).toBe(false);
    expectNoErrors(errors);
  });

  test('ft_1_02a.AC13 Export of a saved piece whose name was emptied exports nothing until it has a name again', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await setTitle(page, 'Sunny Day');
    await eAndGQuarters(page);
    await clickButton(page, 'editor', await editorButton(page, 'Save'));
    await expect.poll(() => status(page)).toContain('Saved. It is in the menu now.');
    await clickNote(page, 0, 960, 'C');
    await setTitle(page, '');
    let downloads = 0;
    page.on('download', () => downloads++);
    await clickButton(page, 'editor', await bubbleButton(page, 'Export'));
    await expect.poll(() => status(page)).toContain('Give the piece a name, then press Enter.');
    await letGameRun(page, 10, 500);
    expect(downloads).toBe(0);
    expect(await status(page)).not.toContain('Saved the file');
    expectNoErrors(errors);
  });

  test('a typed name stays through Undo and Redo: typing it is no undo step', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await eAndGQuarters(page);
    await setTitle(page, 'Sunny Day');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Control+z');
    expect(await notes(page)).toEqual(['0:0:E:quarter']);
    expect(await page.evaluate(() => window.__game.scene.getScene('editor').history.present.title)).toBe('Sunny Day');
    expect(await page.inputValue('#editor-title')).toBe('Sunny Day');
    await page.keyboard.press('Control+y');
    expect(await notes(page)).toEqual(['0:0:E:quarter', '0:480:G:quarter']);
    expect(await page.inputValue('#editor-title')).toBe('Sunny Day');
    expect(await page.evaluate(() => window.__game.scene.getScene('editor').history.present.title)).toBe('Sunny Day');
    expectNoErrors(errors);
  });

  test('ft_1_02a.AC15 a piece file with a blank name is imported under a name, never a blank one', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await setTitle(page, 'Carry Me');
    await eAndGQuarters(page);
    const download = page.waitForEvent('download');
    await clickButton(page, 'editor', await bubbleButton(page, 'Export'));
    const file = JSON.parse(readFileSync(await (await download).path(), 'utf-8')) as { piece: { title: string } };
    file.piece.title = '   ';
    const chooser = page.waitForEvent('filechooser');
    await clickButton(page, 'editor', await bubbleButton(page, 'Import'));
    await (await chooser).setFiles({ name: 'blank.pianor-piece.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
    await expect.poll(() => status(page)).toContain('Added "Imported piece" to your pieces.');
    expect(await page.evaluate(() => window.__game.registry.get('context').ownPieces.list().map((r: { piece: { title: string } }) => r.piece.title))).toEqual(['Carry Me', 'Imported piece']);
    expectNoErrors(errors);
  });
});

/** synthetic: a PDF of `pages` pages, each with two piano systems drawn as lines, made by the browser itself. */
async function syntheticPdf(page: Page, pages: number): Promise<Buffer> {
  const sheet = await page.context().newPage();
  const system = (top: number) => [0, 1].map((k) => [0, 1, 2, 3, 4].map((l) => `<line x1="40" x2="760" y1="${top + k * 90 + l * 10}" y2="${top + k * 90 + l * 10}" stroke="black"/>`).join('')).join('');
  const html = Array.from({ length: pages }, () => `<div style="width:210mm;height:296mm;page-break-after:always"><svg viewBox="0 0 800 1130" width="100%">${system(100)}${system(400)}</svg></div>`).join('');
  await sheet.setContent(`<html><body style="margin:0">${html}</body></html>`);
  const pdf = await sheet.pdf({ format: 'A4', margin: { top: 0, bottom: 0, left: 0, right: 0 } });
  await sheet.close();
  return pdf;
}

/**
 * synthetic: what the computer answers after reading pages 1 and 2: 20 bars, a new page at bar 13, the bars' places on the
 * pages; with `misread`, that bar of the book (from 1) holds a note too many.
 */
function readBook(misread?: number): unknown {
  const note = (i: number) => `<note><pitch><step>${'CDEFGAB'[i % 7]}</step><octave>4</octave></pitch><duration>4</duration></note>`;
  const measures = Array.from({ length: 20 }, (_, i) => `<measure number="${i + 1}">${i === 12 ? '<print new-page="yes"/>' : i % 4 === 0 && i > 0 ? '<print new-system="yes"/>' : ''}${i === 0 ? '<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><sound tempo="90"/>' : ''}${note(i)}${misread === i + 1 ? note(i + 1) : ''}</measure>`);
  const read = musicXmlToChart(`<score-partwise><part-list/><part id="P1">${measures.join('')}</part></score-partwise>`, 'book');
  if (!read.ok) throw new Error(read.reason);
  const layout = { width: 2480, height: 3508, systems: [0, 1, 2].map((s) => ({ staves: [{ top: 300 + s * 900, bottom: 400 + s * 900 }, { top: 600 + s * 900, bottom: 700 + s * 900 }], bars: [0, 1, 2, 3].map((b) => ({ x1: 200 + b * 500, x2: 700 + b * 500 })) })) };
  const places = Array.from({ length: 20 }, (_, bar) => {
    const page = bar < 12 ? 0 : 1;
    const inPage = page === 0 ? bar : bar - 12;
    return { page, system: Math.floor(inPage / 4), x1: 200 + (inPage % 4) * 500, x2: 700 + (inPage % 4) * 500 };
  });
  return { state: 'done', movements: [{ chart: read.chart, marks: read.marks, warnings: [] }], pages: [1, 2], uneven: [], layouts: [layout, layout], places: [places] };
}

test.describe('piece maker: a PDF of many pages into a song (ft_Y_04 slice 6)', () => {
  test('ft_Y_04.AC26 Import takes a PDF: pages left out, the rest read, the parts checked over the pages, Split and Join, Make the song', async ({ page }) => {
    const asked: string[] = [];
    let statusCalls = 0;
    let partsAsked: unknown = null;
    await page.route('**/__pianor/photo**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      if (path === '/__pianor/photo') return route.fulfill({ json: { ok: true } });
      asked.push(`${route.request().method()} ${path}${url.search}`);
      if (path === '/__pianor/photo/book') return route.fulfill({ json: { ok: true, book: 'book-old-waltz' } });
      if (path.endsWith('/status')) return route.fulfill({ json: ++statusCalls === 1 ? { state: 'reading', page: 1, pages: [1, 2], seconds: 65 } : readBook() });
      if (path.endsWith('/parts')) {
        partsAsked = route.request().postDataJSON();
        return route.fulfill({ json: { ok: true, written: 2 } });
      }
      return route.fulfill({ json: { ok: true } });
    });
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await expect.poll(() => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { photoReady: boolean }).photoReady)).toBe(true);
    const chooser = page.waitForEvent('filechooser');
    await clickButton(page, 'editor', await bubbleButton(page, 'Import'));
    await (await chooser).setFiles({ name: 'Old_Waltz.pdf', mimeType: 'application/pdf', buffer: await syntheticPdf(page, 3) });
    // every page shown and in; a click leaves page 3 out
    await expect(page.locator('#book-tool-read')).toHaveText('Read 3 pages');
    await expect(page.locator('#book-tool-name')).toHaveValue('Old Waltz');
    await page.locator('#book-tool-page-3').click();
    await expect(page.locator('#book-tool-page-3')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#book-tool-read').click();
    // the PDF, a picture of each chosen page, then the reading of those pages only
    await expect.poll(() => asked.filter((a) => a.startsWith('POST'))).toEqual([
      'POST /__pianor/photo/book?name=Old_Waltz.pdf&title=Old%20Waltz',
      'POST /__pianor/photo/book/book-old-waltz/page/1',
      'POST /__pianor/photo/book/book-old-waltz/page/2',
      'POST /__pianor/photo/book/book-old-waltz/read?pages=1,2',
    ]);
    // the parts over the pages: cut at the page start, 12 and 8 bars
    await expect(page.locator('.book-tool-part')).toHaveCount(2);
    await expect(page.locator('.book-tool-part').first()).toContainText('1. Part 1 bars 1 to 12, page 1.');
    await expect(page.locator('#book-tool-split canvas')).toHaveCount(2);
    // Esc asks before throwing the reading away; no keeps it
    page.once('dialog', (d) => void d.dismiss());
    await page.keyboard.press('Escape');
    await expect(page.locator('#book-tool')).toHaveCount(1);
    await page.locator('#book-tool-split-1').click();
    await expect(page.locator('.book-tool-part')).toHaveCount(3);
    await expect(page.locator('.book-tool-part').first()).toContainText('bars 1 to 4');
    await page.locator('#book-tool-join-1').click();
    await expect(page.locator('.book-tool-part')).toHaveCount(2);
    // a page looked at closely, and back
    await page.locator('#book-tool-show-2').click();
    await expect(page.locator('#book-tool-page-view')).toBeVisible();
    await page.locator('#book-tool-to-parts').click();
    // back to the pages keeps the reading while the same pages are chosen
    await page.locator('#book-tool-back').click();
    await page.locator('#book-tool-to-check').click();
    await expect(page.locator('#book-tool-make')).toHaveText('Make the song (2 parts)');
    await page.locator('#book-tool-make').click();
    await waitForScene(page, 'song');
    const song = await page.evaluate(() => (window.__game.registry.get('context') as { ownSongs: { list(): { title: string; nodes: { kind: string; piece?: string; name?: string }[] }[] } }).ownSongs.list()[0]);
    expect(song?.title).toBe('Old Waltz');
    expect(song?.nodes.map((n) => [n.kind, n.piece, n.name])).toEqual([['piece', 'own-old-waltz-p01', 'Part 1'], ['piece', 'own-old-waltz-p02', 'Part 2']]);
    expect(partsAsked).toEqual([{ id: 'own-old-waltz-p01', movement: 0, firstBar: 0, lastBar: 11 }, { id: 'own-old-waltz-p02', movement: 0, firstBar: 12, lastBar: 19 }]);
    expectNoErrors(errors);
  });

  test('ft_Y_04.AC26 another PDF chosen after a reading is read anew, never shown with the first one\'s parts; Enter in the name goes back to a kept reading', async ({ page }) => {
    const asked: string[] = [];
    await page.route('**/__pianor/photo**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      if (path === '/__pianor/photo') return route.fulfill({ json: { ok: true } });
      asked.push(`${route.request().method()} ${path}${url.search}`);
      if (path === '/__pianor/photo/book') return route.fulfill({ json: { ok: true, book: 'book-old-waltz' } });
      if (path.endsWith('/status')) return route.fulfill({ json: readBook() });
      return route.fulfill({ json: { ok: true } });
    });
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await expect.poll(() => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { photoReady: boolean }).photoReady)).toBe(true);
    await page.fill('#editor-title', 'Kept Name');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const chooser = page.waitForEvent('filechooser');
    await clickButton(page, 'editor', await bubbleButton(page, 'Import'));
    await (await chooser).setFiles({ name: 'Old_Waltz.pdf', mimeType: 'application/pdf', buffer: await syntheticPdf(page, 2) });
    await expect(page.locator('#book-tool-read')).toHaveText('Read 2 pages');
    await page.locator('#book-tool-read').click();
    await expect(page.locator('.book-tool-part')).toHaveCount(2);
    // back to the pages: Enter in the name goes back to the reading, and reads nothing again
    await page.locator('#book-tool-back').click();
    const reads = () => asked.filter((a) => a.includes('/read?')).length;
    expect(reads()).toBe(1);
    await page.locator('#book-tool-name').press('Enter');
    await expect(page.locator('.book-tool-part')).toHaveCount(2);
    expect(reads()).toBe(1);
    // another PDF of as many pages is read anew
    await page.locator('#book-tool-back').click();
    const another = page.waitForEvent('filechooser');
    await page.locator('#book-tool-choose').click();
    await (await another).setFiles({ name: 'Other_Book.pdf', mimeType: 'application/pdf', buffer: await syntheticPdf(page, 2) });
    await expect(page.locator('#book-tool-name')).toHaveValue('Other Book');
    await expect(page.locator('#book-tool-read')).toHaveText('Read 2 pages');
    await expect(page.locator('#book-tool-to-check')).toHaveCount(0);
    // Ctrl + Z typed in the tool never undoes the piece maker's title behind it
    await page.locator('#book-tool-note').click();
    await page.keyboard.press('Control+z');
    expect(await page.inputValue('#editor-title')).toBe('Kept Name');
    expectNoErrors(errors);
  });

  test('ft_Y_04.AC29 ft_Y_04.AC30 a part names its bars to fill as the book counts them; a page left out redraws no page picture', async ({ page }) => {
    await page.route('**/__pianor/photo**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/__pianor/photo/book') return route.fulfill({ json: { ok: true, book: 'book-old-waltz' } });
      if (path.endsWith('/status')) return route.fulfill({ json: readBook(16) });
      return route.fulfill({ json: { ok: true } });
    });
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await expect.poll(() => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { photoReady: boolean }).photoReady)).toBe(true);
    const chooser = page.waitForEvent('filechooser');
    await clickButton(page, 'editor', await bubbleButton(page, 'Import'));
    await (await chooser).setFiles({ name: 'Old_Waltz.pdf', mimeType: 'application/pdf', buffer: await syntheticPdf(page, 3) });
    await expect(page.locator('#book-tool-read')).toHaveText('Read 3 pages');
    // the pages' pictures are drawn once: a page left out and taken back keeps every picture as it was
    await page.evaluate(() => document.querySelectorAll('#book-tool-pages canvas').forEach((c) => c.setAttribute('data-first', 'yes')));
    await page.locator('#book-tool-page-3').click();
    await page.locator('#book-tool-page-2').click();
    await page.locator('#book-tool-page-2').click();
    await expect(page.locator('#book-tool-pages canvas[data-first="yes"]')).toHaveCount(3);
    await expect(page.locator('#book-tool-page-3')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#book-tool-page-2')).toHaveAttribute('aria-pressed', 'true');
    // a name typed while on the pages stays in its field
    await page.locator('#book-tool-name').fill('Waltz Book');
    await page.locator('#book-tool-page-1').click();
    await page.locator('#book-tool-page-1').click();
    await expect(page.locator('#book-tool-name')).toHaveValue('Waltz Book');
    await page.locator('#book-tool-read').click();
    // the second part starts at bar 13: its misread bar is bar 16 of the book, as in the list and on the paper
    await expect(page.locator('.book-tool-part')).toHaveCount(2);
    await expect(page.locator('.book-tool-part').nth(1)).toContainText('bars 13 to 20');
    await expect(page.locator('.book-tool-part').nth(1)).toContainText('Bars to fill by hand: 16.');
    await expect(page.locator('.book-tool-part').first()).not.toContainText('Bars to fill by hand');
    expectNoErrors(errors);
  });
});

/** A photo of one system of two staves, 400 by 300, with a bar line at 200: what the server's cleaning leaves (synthetic). */
function photoPng(): Buffer {
  const width = 400;
  const height = 300;
  const data = new Uint8Array(width * height).fill(255);
  for (const top of [60, 180]) for (let l = 0; l < 5; l++) data.fill(0, (top + l * 10) * width + 20, (top + l * 10) * width + 380);
  for (let y = 60; y <= 220; y++) for (const x of [20, 200, 379]) data[y * width + x] = 0;
  return Buffer.from(encodePng({ width, height, data, channels: 1, depth: 8 }));
}

test.describe('piece maker: a photo of a sheet (ft_Y_04 slices 4 and 5)', () => {
  test('ft_Y_04.AC16 ft_Y_04.AC17 ft_Y_04.AC18 Import opens the photo tool: crop, read on the PC, put the key right, open with the photo behind the staff', async ({ page }) => {
    const layout = { width: 400, height: 300, systems: [{ staves: [{ top: 60, bottom: 100 }, { top: 180, bottom: 220 }], bars: [{ x1: 20, x2: 200 }, { x1: 200, x2: 379 }] }] };
    let sent = '';
    let title = '';
    let body: Buffer | null = null;
    let file = '';
    // the game's server on a PC with Audiveris, as tools/vite-photo.ts answers (Audiveris itself is never run here)
    await page.route('**/__pianor/photo**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/__pianor/photo' && route.request().method() === 'GET') return route.fulfill({ json: { ok: true } });
      if (url.pathname === '/__pianor/photo') {
        sent = url.searchParams.get('name') ?? '';
        title = url.searchParams.get('title') ?? '';
        body = route.request().postDataBuffer();
        return route.fulfill({ json: { ok: true, id: 'own-from-paper', file, problems: [{ bar: 2, beat: 1, hand: 'RH', what: 'a triplet quarter' }] } });
      }
      if (url.pathname.endsWith('/map')) return route.fulfill({ json: { image: 'sheet-cleaned.png', layout } });
      return route.fulfill({ body: photoPng(), contentType: 'image/png' });
    });
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await setTitle(page, 'From Paper');
    await eAndGQuarters(page);
    // the server's answer is a piece file: the one this piece exports (Export saves the piece, so the import may go ahead)
    const download = page.waitForEvent('download');
    await clickButton(page, 'editor', await bubbleButton(page, 'Export'));
    file = readFileSync(await (await download).path(), 'utf-8');
    await expect.poll(() => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { photoReady: boolean }).photoReady)).toBe(true);
    const chooser = page.waitForEvent('filechooser');
    await clickButton(page, 'editor', await bubbleButton(page, 'Import'));
    await (await chooser).setFiles({ name: 'From_Paper.png', mimeType: 'image/png', buffer: photoPng() });
    // the tool over the piece maker, the photo in it; a drag marks the part to read (the photo is shown at its own size, centred)
    const canvas = page.locator('#photo-tool-canvas');
    await expect(canvas).toBeVisible();
    await expect(page.locator('#photo-tool-title')).toHaveValue('From Paper');
    const box = (await canvas.boundingBox())!;
    const left = box.x + (box.width - 400) / 2;
    const top = box.y + (box.height - 300) / 2;
    await page.mouse.move(left + 10, top + 40);
    await page.mouse.down();
    await page.mouse.move(left + 390, top + 240, { steps: 4 });
    await page.mouse.up();
    // a quarter turn and back: four presses of Turn bring it round
    for (let i = 0; i < 4; i++) await page.locator('#photo-tool-turn').click();
    await page.mouse.move(left + 10, top + 40);
    await page.mouse.down();
    await page.mouse.move(left + 390, top + 240, { steps: 4 });
    await page.mouse.up();
    await page.locator('#photo-tool-read').click();
    // what was read, to check against the sheet: the reading missed the key signature, one sharp is put right here
    await expect(page.locator('#photo-tool-check')).toContainText('Bars to fill by hand: 2.');
    expect(sent).toBe('From Paper.jpg');
    expect(title).toBe('From Paper');
    // the part sent is a JPEG of the part marked, not the whole photo
    const sentBytes = body as Buffer | null;
    expect([...sentBytes!.subarray(0, 2)]).toEqual([0xff, 0xd8]);
    const size = await page.evaluate(async (b64) => {
      const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))]));
      return [bitmap.width, bitmap.height];
    }, sentBytes!.toString('base64'));
    expect(size).toEqual([380, 200]);
    await expect(page.locator('.photo-tool-hand-RH')).toContainText('Right hand: lowest');
    await page.locator('#photo-tool-key').selectOption('1');
    await page.locator('#photo-tool-open').click();
    await expect(page.locator('#photo-tool')).toHaveCount(0);
    await expect.poll(() => status(page)).toContain('Fill bars 2 by hand');
    expect(await page.evaluate(() => (window.__game.scene.getScene('editor').history.present as { fifths: number }).fifths)).toBe(1);
    // the new piece is open, with the photo over the canvas, clicks passing through, ink in the bars
    const photo = page.locator('#editor-photo');
    await expect(photo).toBeVisible();
    expect(await photo.evaluate((c: HTMLCanvasElement) => c.style.pointerEvents)).toBe('none');
    const inked = () => photo.evaluate((c: HTMLCanvasElement) => {
      const px = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < px.length; i += 4) if (px[i]! > 0) n++;
      return n;
    });
    const before = await inked();
    expect(before).toBeGreaterThan(100);
    // full stop moves the photo a bar on: one bar fewer has a photo behind it
    await page.keyboard.press('Period');
    await expect.poll(() => status(page)).toContain('Photo moved by +1 bar');
    await expect.poll(inked).toBeLessThan(before);
    // G hides it and shows it again
    await page.keyboard.press('KeyG');
    await expect(photo).toBeHidden();
    await page.keyboard.press('KeyG');
    await expect(photo).toBeVisible();
    expectNoErrors(errors);
  });

  test('ft_Y_04.AC27 Import offers photos and PDFs only while Audiveris is there, asked at each Import, and says once where to get it', async ({ page }) => {
    let installed = false;
    await page.route('**/__pianor/photo', (route) => route.fulfill({ json: installed ? { ok: true } : { ok: false, reason: 'Audiveris is not installed on this computer' } }));
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    const importOnce = async () => {
      const chooser = page.waitForEvent('filechooser');
      await clickButton(page, 'editor', await bubbleButton(page, 'Import'));
      const picked = await chooser;
      const accept = await picked.element().getAttribute('accept');
      await picked.setFiles([]);
      return accept ?? '';
    };
    const told = async () => (await sceneTexts(page, 'editor')).filter((text) => text.includes('Audiveris')).length;
    expect(await importOnce()).not.toContain('pdf');
    await expect.poll(told).toBe(1);
    await page.waitForTimeout(100);
    // installed meanwhile: the next Import asks again and takes a PDF
    installed = true;
    expect(await importOnce()).toContain('pdf');
    expectNoErrors(errors);
  });

  test('ft_Y_04.AC18 the photo tool closes with Esc and leaves the piece maker as it was; typing the name writes no notes', async ({ page }) => {
    await page.route('**/__pianor/photo**', (route) => route.fulfill({ json: { ok: true } }));
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await expect.poll(() => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { photoReady: boolean }).photoReady)).toBe(true);
    const editorRuns = () => page.evaluate(() => (window.__game.scene as unknown as { isActive(key: string): boolean }).isActive('editor'));
    const openTool = async () => {
      const chooser = page.waitForEvent('filechooser');
      await clickButton(page, 'editor', await bubbleButton(page, 'Import'));
      await (await chooser).setFiles({ name: 'sheet.png', mimeType: 'image/png', buffer: photoPng() });
      await expect(page.locator('#photo-tool-canvas')).toBeVisible();
      // the piece maker waits behind the tool
      await expect.poll(editorRuns).toBe(false);
    };
    const closed = async () => {
      await expect(page.locator('#photo-tool')).toHaveCount(0);
      await expect.poll(editorRuns).toBe(true);
    };
    // Esc closes it straight away, wherever the focus is after the file was chosen
    await openTool();
    await page.keyboard.press('Escape');
    await closed();
    await openTool();
    await page.locator('#photo-tool-title').fill('');
    await page.locator('#photo-tool-title').pressSequentially('abc 123');
    await page.locator('#photo-tool-title').press('Escape');
    await closed();
    expect(await notes(page)).toEqual([]);
    // the piece maker takes its clicks again
    await clickNote(page, 0, 0, 'E');
    await expect.poll(() => notes(page)).toEqual(['0:0:E:quarter']);
    expectNoErrors(errors);
  });
});

/** Presses and releases a key of the virtual EZ-220 (its events are timed on the song clock, so holds are real waits). */
const press = (page: Page, midi: number) => page.evaluate((m) => window.__virtualDevice!.press(m, 80), midi);
const release = (page: Page, midi: number) => page.evaluate((m) => window.__virtualDevice!.release(m), midi);
const tap = async (page: Page, midi: number, holdMs = 100): Promise<void> => {
  await press(page, midi);
  await page.waitForTimeout(holdMs);
  await release(page, midi);
};

test.describe('piece maker: writing by playing keys (ft_1_02d)', () => {
  test('ft_1_02d.AC9 playing C5 then E5 as short taps writes two treble quarters, and a bass key lands in the left hand', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await tap(page, 72);
    await page.waitForTimeout(400);
    await tap(page, 76);
    await expect.poll(() => notes(page)).toEqual(['0:0:C:quarter', '0:480:E:quarter']);
    await page.waitForTimeout(400);
    await tap(page, 48);
    // notes() lists the piece in bar and start order, so the bass C (bar 0, start 0) sits before the treble E
    await expect.poll(() => notes(page)).toEqual(['0:0:C:quarter', '0:0:C:quarter', '0:480:E:quarter']);
    const hands = await page.evaluate(() => (window.__game.scene.getScene('editor').history.present.notes as { hand: string; bar: number; start: number; octave: number }[]).map((n) => `${n.hand}:${n.bar}:${n.start}:${n.octave}`).sort());
    expect(hands).toEqual(['LH:0:0:3', 'RH:0:0:5', 'RH:0:480:5']);
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC10 holding a key about 1.4 s gives a half, and a 100 ms tap is a quarter with the short-tap toggle off', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await press(page, 72);
    await page.waitForTimeout(1400);
    await release(page, 72);
    await expect.poll(() => notes(page)).toEqual(['0:0:C:half']);
    await page.waitForTimeout(400);
    await tap(page, 76, 100);
    await expect.poll(() => notes(page)).toEqual(['0:0:C:half', '0:960:E:quarter']);
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC11 Backspace after two played notes removes the last one, and Ctrl+Z after a played note removes it as one step', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await tap(page, 72);
    await page.waitForTimeout(400);
    await tap(page, 76);
    await expect.poll(() => notes(page)).toEqual(['0:0:C:quarter', '0:480:E:quarter']);
    await page.keyboard.press('Backspace');
    await expect.poll(() => notes(page)).toEqual(['0:0:C:quarter']);
    await page.waitForTimeout(400);
    await tap(page, 76);
    await expect.poll(() => notes(page)).toEqual(['0:0:C:quarter', '0:480:E:quarter']);
    await page.keyboard.press('Control+KeyZ');
    await expect.poll(() => notes(page)).toEqual(['0:0:C:quarter']);
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC12 with the Notes/Rests switch on Rests, a played treble key writes a right-hand rest', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await page.keyboard.press('Digit0');
    await tap(page, 72);
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('editor').history.present.rests)).toEqual([{ hand: 'RH', bar: 0, start: 0, length: 'quarter' }]);
    expect(await notes(page)).toEqual([]);
    expectNoErrors(errors);
  });
});

test.describe('piece maker: the left click, the bubble on a note or a rest, and the message (ft_1_02d)', () => {
  /** What a click writes: notes or rests. */
  const entry = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { entry: string }).entry);
  async function rightClick(page: Page, place: { bar: number; start: number; step: Step; octave?: number }): Promise<void> {
    await closeBubble(page, 'editor');
    const at = await canvasPoint(page, place);
    await page.mouse.click(at.x, at.y, { button: 'right' });
    await expect.poll(() => bubbleOpen(page, 'editor')).toBe(true);
  }

  test('ft_1_02d.AC50 ft_1_02d.AC51 a left click on an empty place writes a note, on the note selects it, and on the space above makes a chord', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await selectNote(page, 0, 0, 'G');
    expect(await notes(page)).toEqual(['0:0:G:quarter']);
    // on the note itself: selected, not made longer
    await selectNote(page, 0, 0, 'G');
    expect(await notes(page)).toEqual(['0:0:G:quarter']);
    expect(await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { selected: { step: string } | null }).selected?.step)).toBe('G');
    // the A a step above the G joins it as a chord, it does not lengthen the G
    await selectNote(page, 0, 0, 'A');
    expect((await notes(page)).sort()).toEqual(['0:0:A:quarter', '0:0:G:quarter']);
    // the middle button still writes too
    await clickNote(page, 0, 480, 'E');
    expect((await notes(page)).sort()).toEqual(['0:0:A:quarter', '0:0:G:quarter', '0:480:E:quarter']);
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC53 the bubble on a placed rest has Delete, which removes the rest', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { setEntry(kind: string): void }).setEntry('rest'));
    await selectNote(page, 0, 0, 'B');
    const rests = () => page.evaluate(() => (window.__game.scene.getScene('editor').history.present.rests ?? []).length);
    expect(await rests()).toBe(1);
    await rightClick(page, { bar: 0, start: 0, step: 'B' });
    await clickButton(page, 'editor', await lastButton(page, 'editor', 'Delete'));
    await expect.poll(rests).toBe(0);
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC55 the length in the bubble of a note is that note\'s, and opening it keeps rests as the writer', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await clickNote(page, 0, 0, 'G');
    // the writer goes on to halves and rests
    await page.keyboard.press('Digit2');
    await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { setEntry(kind: string): void }).setEntry('rest'));
    await rightClick(page, { bar: 0, start: 0, step: 'G' });
    expect(await lastButton(page, 'editor', '1/4')).toBeGreaterThanOrEqual(0);
    expect(await lastButton(page, 'editor', '1/2')).toBe(-1);
    await clickButton(page, 'editor', await lastButton(page, 'editor', '1/4'));
    expect(await entry(page)).toBe('rest');
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC54 a message stands in the strip at the foot, never over the staff, and over its buttons only for a moment', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await page.keyboard.press('Control+KeyX');
    await expect.poll(() => status(page)).toContain('Select bars first');
    const spot = await page.evaluate(() => {
      const scene = window.__game.scene.getScene('editor') as unknown as { messageBox: { image: { y: number; visible: boolean } } | null; bandTop: number | null };
      return { y: scene.messageBox?.image.y, visible: scene.messageBox?.image.visible, band: scene.bandTop };
    });
    expect(spot.visible).toBe(true);
    expect(spot.y).toBeGreaterThanOrEqual(spot.band!);
    const shown = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { messageBox: { image: { visible: boolean } } | null }).messageBox?.image.visible);
    // a message that waits (as a pick's does) over the buttons: the next key takes it away, and so does time
    const sayLong = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { say(text: string): void }).say('Now click the note the tie or slur goes to, then the next one.'));
    await sayLong();
    await expect.poll(shown).toBe(true);
    await page.keyboard.press('Shift');
    await expect.poll(shown).toBe(false);
    await sayLong();
    await expect.poll(shown).toBe(true);
    await expect.poll(shown, { timeout: 10000 }).toBe(false);
    expectNoErrors(errors);
  });
});

test.describe('tie pick and selection', () => {
  test('a pick stays armed through a refused edit: its message returns once the refusal fades, and a click selects the note at once', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    // a B and a C after it: no repeated chord, so nothing is tied
    await clickNote(page, 0, 0, 'B');
    await clickNote(page, 0, 480, 'C');
    await selectNote(page, 0, 0, 'B');
    const selected = await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { selected: unknown }).selected);
    expect(selected).toMatchObject({ bar: 0, start: 0, step: 'B' });
    // the tie tools are in the tie menu
    const pickAt = (await openTieMenu(page)).findIndex((l) => l === 'Pick');
    expect(pickAt).toBeGreaterThanOrEqual(0);
    await clickButton(page, 'editor', pickAt);
    expect(await sceneTexts(page, 'editor')).toContain('Now click the note the tie or slur goes to.');
    // a paste with nothing copied is refused: its message shows for a moment, the pick stays armed, and its message
    // returns when the refusal fades (ALL is not offered here: nothing repeats, ft_1_02d.AC35)
    await page.keyboard.press('Control+KeyV');
    await expect.poll(() => status(page)).not.toContain('Now click the note the tie or slur goes to.');
    // the refusal is on the editor's own timer (scene time, MESSAGE_MS), which runs slower than the wall clock when
    // frames are slow or the page has no focus (Phaser caps each frame's step), so fast-forward that clock rather than
    // wait a fixed number of wall-clock seconds
    const timer = () => page.evaluate(() => {
      const scene = window.__game.scene.getScene('editor') as unknown as { messageTimer: { delay: number; hasDispatched: boolean } | null };
      return scene.messageTimer ? { delay: scene.messageTimer.delay, done: scene.messageTimer.hasDispatched } : null;
    });
    expect(await timer()).toEqual({ delay: 3000, done: false });
    await page.evaluate(() => { window.__game.scene.getScene('editor').time.timeScale = 1000; });
    await expect.poll(timer).toMatchObject({ done: true });
    await page.evaluate(() => { window.__game.scene.getScene('editor').time.timeScale = 1; });
    // the message is said again (over the strip's buttons it then stays its own moment, ft_1_02d.AC54, which the
    // fast clock has already run through)
    expect(await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { message: string }).message)).toBe('Now click the note the tie or slur goes to.');
    expect(await page.evaluate(() => !!(window.__game.scene.getScene('editor') as unknown as { arcFrom: unknown }).arcFrom)).toBe(true);
    expectNoErrors(errors);
  });
});

test.describe('tie drawn', () => {
  test('ALL on two same-pitch quarters draws the tie on the staff', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    const noteList = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { history: { present: { notes: { start: number; step: string; length: string }[] } } }).history.present.notes.map((n) => `${n.start}:${n.step}:${n.length}`));
    await clickNote(page, 0, 0, 'E');
    expect(await noteList()).toEqual(['0:E:quarter']);
    await clickNote(page, 0, 480, 'E');
    expect(await noteList()).toEqual(['0:E:quarter', '480:E:quarter']);
    await selectNote(page, 0, 0, 'E'); // the ties are options of the bubble on a note
    const allAt = (await openTieMenu(page)).findIndex((l) => l === 'ALL' || l === 'KÕIK');
    expect(allAt).toBeGreaterThanOrEqual(0);
    await clickButton(page, 'editor', allAt);
    // the staff the player sees has one tie arc between the two E's
    expect(await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { layout: { ties: unknown[] } }).layout.ties.length)).toBe(1);
    expectNoErrors(errors);
  });
});

test.describe('slurs (core_09.AC30)', () => {
  test('(core_09.AC30) PICK slurs the selected note to the note clicked, the staff draws the curve between the two heads, it survives a save and a reopen, and the SLUR item takes it away', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await setTitle(page, 'Slur Piece');
    // four right-hand quarters C, D, E, F in the first bar
    await clickNote(page, 0, 0, 'C');
    await clickNote(page, 0, 480, 'D');
    await clickNote(page, 0, 960, 'E');
    await clickNote(page, 0, 1440, 'F');
    const fourNotes = ['0:0:C:quarter', '0:480:D:quarter', '0:960:E:quarter', '0:1440:F:quarter'];
    expect(await notes(page)).toEqual(fourNotes);

    // a left click selects C; PICK arms the slur, and the next note clicked (E) is where it ends
    await selectNote(page, 0, 0, 'C');
    const pickAt = (await openTieMenu(page)).findIndex((l) => l === 'Pick');
    expect(pickAt).toBeGreaterThanOrEqual(0);
    await clickButton(page, 'editor', pickAt);
    expect(await sceneTexts(page, 'editor')).toContain('Now click the note the tie or slur goes to.');
    // (ft_1_02d.AC25) the pointer on E, before the click: the slur it would make shows as a preview, and the piece has none yet
    const over = await canvasPoint(page, { bar: 0, start: 960, step: 'E' });
    await page.mouse.move(over.x, over.y);
    const preview = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { previewCache: { marks: { slurs: unknown[]; ties: unknown[] } } | null }).previewCache?.marks ?? null);
    await expect.poll(async () => (await preview())?.slurs.length ?? 0).toBe(1);
    expect((await preview())?.ties).toEqual([]);
    expect(await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { history: { present: { slurs?: unknown[] } } }).history.present.slurs ?? [])).toEqual([]);
    await clickNote(page, 0, 960, 'E');
    expect(await status(page)).not.toContain('Now click the note the tie or slur goes to.');
    expect(await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { arcFrom: unknown }).arcFrom)).toBeNull();

    // the piece holds the slur from C to E; the staff draws it from the head of C to the head of E; the notes did not move
    const piece = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { history: { present: { slurs?: unknown[] } } }).history.present.slurs ?? []);
    const drawn = () => page.evaluate(() => {
      const scene = window.__game.scene.getScene('editor') as unknown as { layout: { staffSpace: number; slurs: { from: number | null; to: number | null; x1: number; x2: number }[] } };
      return { space: scene.layout.staffSpace, curves: scene.layout.slurs.map((s) => ({ from: s.from, to: s.to, x1: s.x1, x2: s.x2 })) };
    });
    const headsOf = () => page.evaluate(() => {
      // the points are on the screen, the layout counts from the staff's own left side (moved in for its parchment, d119)
      const scene = window.__game.scene.getScene('editor') as unknown as { staffLeft: number; pointForNote(p: { hand: string; bar: number; start: number; step: string; octave: number }): { x: number } };
      return { c: scene.pointForNote({ hand: 'RH', bar: 0, start: 0, step: 'C', octave: 4 }).x - scene.staffLeft, e: scene.pointForNote({ hand: 'RH', bar: 0, start: 960, step: 'E', octave: 4 }).x - scene.staffLeft };
    });
    expect(await piece()).toEqual([{ hand: 'RH', from: { bar: 0, start: 0 }, to: { bar: 0, start: 960 } }]);
    await expect.poll(async () => (await drawn()).curves.length).toBe(1);
    const { space, curves } = await drawn();
    const [curve] = curves;
    const heads = await headsOf();
    // the curve starts and ends at the heads it joins: within a head's width of their centres (it leaves from the head's side)
    expect(Math.abs(curve!.x1 - heads.c)).toBeLessThan(space);
    expect(Math.abs(curve!.x2 - heads.e)).toBeLessThan(space);
    expect(curve!.from).not.toBeNull();
    expect(curve!.to).not.toBeNull();
    expect(await notes(page)).toEqual(fourNotes);

    // saved, and opened again: the slur is still in the piece and is drawn
    await clickButton(page, 'editor', await editorButton(page, 'Save'));
    await expect.poll(() => status(page)).toContain('Saved. It is in the menu now.');
    const id = await page.evaluate(() => (window.__game.registry.get('context').ownPieces.list() as { id: string }[])[0]!.id);
    await page.evaluate((pieceId) => {
      window.__game.scene.start('editor', { id: pieceId });
    }, id);
    await expect.poll(() => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { layout: { slurs: unknown[] } } | undefined)?.layout?.slurs.length ?? 0)).toBe(1);
    expect(await piece()).toEqual([{ hand: 'RH', from: { bar: 0, start: 0 }, to: { bar: 0, start: 960 } }]);
    expect(await notes(page)).toEqual(fourNotes);

    // the tie-or-slur choice on the selected C takes the slur away (a second press), and the staff draws no curve
    await clickNote(page, 0, 0, 'C');
    const slurAt = (await openTieMenu(page)).findIndex((l) => l === 'Tie or slur');
    expect(slurAt).toBeGreaterThanOrEqual(0);
    await clickButton(page, 'editor', slurAt);
    expect(await piece()).toEqual([]);
    await expect.poll(async () => (await drawn()).curves.length).toBe(0);
    expect(await notes(page)).toEqual(fourNotes);
    expectNoErrors(errors);
  });
});

test.describe('one item each for the accidentals, ties and slurs, and repeats', () => {
  test('core_09.AC13 core_09.AC20 the tie-or-slur choice ties to the same key and slurs to another; the repeat item asks for the start bar, then the end bar', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    // C C E in the first bar: the first C ties to the second, the second slurs to the E
    await clickNote(page, 0, 0, 'C');
    await clickNote(page, 0, 480, 'C');
    await clickNote(page, 0, 960, 'E');
    const arcs = () => page.evaluate(() => {
      const present = (window.__game.scene.getScene('editor') as unknown as { history: { present: { notes: { start: number; tieNext?: boolean }[]; slurs?: unknown[] } } }).history.present;
      return { ties: present.notes.filter((n) => n.tieNext).map((n) => n.start), slurs: (present.slurs ?? []).length };
    });
    const pressArc = async () => clickButton(page, 'editor', (await openTieMenu(page)).findIndex((l) => l === 'Tie or slur'));
    await selectNote(page, 0, 0, 'C');
    await pressArc();
    expect(await arcs()).toEqual({ ties: [0], slurs: 0 });
    await selectNote(page, 0, 480, 'C');
    await pressArc();
    expect(await arcs()).toEqual({ ties: [0], slurs: 1 });

    // one repeat item: K asks for the start bar (it is lit); the signs snap to the nearest bar line (ft_1_02d.AC31), so a
    // click near the start of bar 2 starts it there, and a click near the end of bar 3 ends it there (from the bubble of a
    // bar the repeat starts on that bar: ft_1_02d.AC38)
    const repeats = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { history: { present: { repeats?: unknown[] } } }).history.present.repeats ?? []);
    expect(await editorButton(page, '|:')).toBe(-1);
    await closeBubble(page, 'editor');
    await page.keyboard.press('KeyK');
    expect(await status(page)).toContain('Click the bar the repeat starts on.');
    await selectNote(page, 1, 0, 'C');
    expect(await status(page)).toContain('Now click the bar the repeat ends on.');
    expect(await repeats()).toEqual([]);
    await selectNote(page, 2, 1440, 'C');
    expect(await repeats()).toEqual([{ startBar: 1, endBar: 2 }]);
    expect(await status(page)).not.toContain('the repeat ends on');
    // the notes stayed as they were: the clicks only picked bars
    expect(await notes(page)).toEqual(['0:0:C:quarter', '0:480:C:quarter', '0:960:E:quarter']);
    // K asks again; Esc ends the pick and stays in the piece maker, and a click writes again
    await page.keyboard.press('KeyK');
    expect(await status(page)).toContain('Click the bar the repeat starts on.');
    await page.keyboard.press('Escape');
    expect(await status(page)).not.toContain('the repeat starts on');
    expect(await activeScenes(page)).toContain('editor');
    await clickNote(page, 0, 1440, 'G');
    expect(await notes(page)).toEqual(['0:0:C:quarter', '0:480:C:quarter', '0:960:E:quarter', '0:1440:G:quarter']);
    expectNoErrors(errors);
  });
});

test.describe('pages with a note selected', () => {
  // with a note selected, the page buttons and Page Down drew the staff again on the selected note's page
  test('the note that spills a piece onto a second page draws the page buttons at once, with no freeze', async ({ page }) => {
    // the page buttons were counted on a staff wider than the one drawn: one page there, two on the staff, and each redraw
    // asked for another until the stack ran out after about a minute. The quarters are written one more at a time, in 24 bars,
    // until the one that spills onto a second page.
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await clickNote(page, 0, 0, 'E');
    const write = (count: number) => page.evaluate((count) => {
      const scene = window.__game.scene.getScene('editor') as unknown as {
        history: { present: { bars: number; notes: { bar: number; start: number }[] } };
        apply(edit: { ok: true; piece: unknown }, select: null): void;
        layout: { pageCount: number };
        pageButtonsDrawn: boolean;
      };
      const piece = scene.history.present;
      const note = piece.notes[0]!;
      const started = performance.now();
      scene.apply({ ok: true, piece: { ...piece, bars: 24, notes: Array.from({ length: count }, (_, i) => ({ ...note, bar: Math.floor(i / 4), start: (i % 4) * 480 })) } }, null);
      return { ms: performance.now() - started, pages: scene.layout.pageCount, buttons: scene.pageButtonsDrawn };
    }, count);
    let count = 1;
    while (count < 96 && (await write(count + 1)).pages === 1) count++;
    expect(count).toBeLessThan(96);
    expect(await write(count)).toMatchObject({ pages: 1, buttons: false });
    const spilled = await write(count + 1);
    expect(spilled).toMatchObject({ pages: 2, buttons: true });
    expect(spilled.ms).toBeLessThan(3000);
    expectNoErrors(errors);
  });

  test('Page Down and the > button turn the page while a note on the first page is selected', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await clickNote(page, 0, 0, 'E');
    // the same note in every bar of a long piece: more lines than one page holds
    await page.evaluate(() => {
      const scene = window.__game.scene.getScene('editor') as unknown as {
        history: { present: { bars: number; notes: { bar: number }[] } };
        apply(edit: { ok: true; piece: unknown }, select: null): void;
      };
      const piece = scene.history.present;
      const note = piece.notes[0]!;
      scene.apply({ ok: true, piece: { ...piece, bars: 48, notes: Array.from({ length: 48 }, (_, bar) => ({ ...note, bar })) } }, null);
    });
    const state = () => page.evaluate(() => {
      const scene = window.__game.scene.getScene('editor') as unknown as { page: number; selected: unknown; layout: { pageCount: number } };
      return { page: scene.page, pages: scene.layout.pageCount, selected: scene.selected !== null };
    });
    expect((await state()).pages).toBeGreaterThan(1);
    // a left click on the note selects it
    await selectNote(page, 0, 0, 'E');
    expect(await state()).toMatchObject({ page: 0, selected: true });
    await page.keyboard.press('PageDown');
    expect(await state()).toMatchObject({ page: 1, selected: true });
    await page.keyboard.press('PageUp');
    expect((await state()).page).toBe(0);
    expectNoErrors(errors);
  });
});

test.describe('fingers (ft_1_02d.AC4)', () => {
  test('(ft_1_02d.AC4) ft_1_02d.AC19 F and a digit set the finger of the selected note, the staff draws it, and F then 0 takes it away', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await clickNote(page, 0, 0, 'E');
    // a new note is not selected; a left click on it selects it
    await selectNote(page, 0, 0, 'E');
    const fingerOf = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { history: { present: { notes: { finger?: number }[] } } }).history.present.notes[0]?.finger ?? null);
    // the finger numbers the staff shows: the ones that are visible and not empty
    const drawn = () => page.evaluate(() => {
      const view = (window.__game.scene.getScene('editor') as unknown as { staffView: { fingerTexts: { text: string; visible: boolean }[] } }).staffView;
      return view.fingerTexts.filter((t) => t.visible && t.text !== '').map((t) => t.text);
    });
    expect(await fingerOf()).toBeNull();
    expect(await drawn()).toEqual([]);
    // F opens the finger menu (ft_1_02d.AC19): a digit sets that finger, 0 takes it away
    for (const finger of [1, 3, 5]) {
      await page.keyboard.press('KeyF');
      await page.keyboard.press(`Digit${finger}`);
      expect(await fingerOf()).toBe(finger);
      expect(await drawn()).toEqual([String(finger)]);
    }
    await page.keyboard.press('KeyF');
    await page.keyboard.press('Digit0');
    expect(await fingerOf()).toBeNull();
    expect(await drawn()).toEqual([]);
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC33 each note of a two-note chord gets its own finger, and the piece maker draws both', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    // C and E at the same start: one chord
    await clickNote(page, 0, 0, 'C');
    await clickNote(page, 0, 0, 'E');
    const fingers = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { history: { present: { notes: { step: string; finger?: number }[] } } }).history.present.notes.map((n) => `${n.step}${n.finger ?? '-'}`).sort());
    const drawn = () => page.evaluate(() => {
      const view = (window.__game.scene.getScene('editor') as unknown as { staffView: { fingerTexts: { text: string; visible: boolean }[] } }).staffView;
      return view.fingerTexts.filter((t) => t.visible && t.text !== '').map((t) => t.text).sort();
    });
    await selectNote(page, 0, 0, 'C');
    await page.keyboard.press('KeyF');
    await page.keyboard.press('Digit1');
    await selectNote(page, 0, 0, 'E');
    await page.keyboard.press('KeyF');
    await page.keyboard.press('Digit3');
    expect(await fingers()).toEqual(['C1', 'E3']);
    // shown on both heads, whatever the practice screen's TOP or ALL setting
    await expect.poll(drawn).toEqual(['1', '3']);
    expectNoErrors(errors);
  });
});

test.describe('slim tool row with menus', () => {
  test('ft_1_02d.AC50 the middle button places a note, Alt + left click places too, and so does a plain left click', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await selectNote(page, 0, 0, 'E');
    expect(await notes(page)).toEqual(['0:0:E:quarter']);
    await page.keyboard.press('Control+KeyZ');
    expect(await notes(page)).toEqual([]);
    await clickNote(page, 0, 0, 'E');
    expect(await notes(page)).toEqual(['0:0:E:quarter']);
    await selectNote(page, 0, 480, 'G', 4, ['Alt']);
    expect(await notes(page)).toEqual(['0:0:E:quarter', '0:480:G:quarter']);
    // a left click on the E selects it and changes nothing; a middle click on it makes it longer (here G is in the way)
    await selectNote(page, 0, 0, 'E');
    expect(await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { selected: unknown }).selected)).toMatchObject({ bar: 0, start: 0, step: 'E' });
    expect(await notes(page)).toEqual(['0:0:E:quarter', '0:480:G:quarter']);
    expectNoErrors(errors);
  });

  test('a left drag draws a lasso, and every bar it touches is selected and lit', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    const bandLength = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { band: { commandBuffer: unknown[] } | null }).band?.commandBuffer.length ?? 0);
    const idleBand = await bandLength();
    await clickNote(page, 0, 0, 'E');
    await clickNote(page, 1, 0, 'G');
    const from = await canvasPoint(page, { bar: 0, start: 480, step: 'C' });
    const to = await canvasPoint(page, { bar: 1, start: 480, step: 'A' });
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await page.mouse.up();
    expect(await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { barSel: unknown }).barSel)).toEqual({ from: 0, to: 1 });
    expect(await bandLength()).toBeGreaterThan(idleBand);
    // the drag wrote nothing
    expect(await notes(page)).toEqual(['0:0:E:quarter', '1:0:G:quarter']);
    // Ctrl+C then Ctrl+V pastes the two bars after them
    await page.keyboard.press('Control+KeyC');
    await page.keyboard.press('Control+KeyV');
    expect((await notes(page)).sort()).toEqual(['0:0:E:quarter', '1:0:G:quarter', '2:0:E:quarter', '3:0:G:quarter']);
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC24 the grip at the selection\'s right edge, dragged three bar lengths right, puts in three copies, and one Ctrl+Z takes them out', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await clickNote(page, 0, 0, 'E');
    await clickNote(page, 1, 0, 'G');
    await selectNote(page, 0, 0, 'E');
    await selectNote(page, 0, 0, 'E', 4, ['Shift']);
    expect(await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { barSel: unknown }).barSel)).toEqual({ from: 0, to: 0 });
    // the grip: centred on the right edge of the selection's last bar, halfway down the grand staff
    const grip = await page.evaluate(() => {
      type Layout = { staffSpace: number; bars: { x: number; width: number; system: number }[]; systems: { staves: { topLineY: number; bottomLineY: number }[] }[] };
      const scene = window.__game.scene.getScene('editor') as unknown as { layout: Layout; staffLeft: number; staffTop: number };
      const bar = scene.layout.bars[0]!;
      const staves = scene.layout.systems[bar.system]!.staves;
      const middle = (Math.min(...staves.map((s) => s.topLineY)) + Math.max(...staves.map((s) => s.bottomLineY))) / 2;
      const canvas = document.querySelector('canvas')!;
      const rect = canvas.getBoundingClientRect();
      const x = scene.staffLeft + bar.x + bar.width;
      const y = scene.staffTop + middle;
      return { x: rect.left + (x / canvas.width) * rect.width, y: rect.top + (y / canvas.height) * rect.height };
    });
    const to = await canvasPoint(page, { bar: 3, start: 480, step: 'B' });
    await page.mouse.move(grip.x, grip.y);
    await page.mouse.down();
    await page.mouse.move((grip.x + to.x) / 2, to.y, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await expect.poll(() => status(page)).toContain('3 copies');
    await page.mouse.up();
    // three copies of bar 0 right after it; the G moves on to bar 4
    expect((await notes(page)).sort()).toEqual(['0:0:E:quarter', '1:0:E:quarter', '2:0:E:quarter', '3:0:E:quarter', '4:0:G:quarter']);
    await page.keyboard.press('Control+KeyZ');
    expect((await notes(page)).sort()).toEqual(['0:0:E:quarter', '1:0:G:quarter']);
    expectNoErrors(errors);
  });

  test('Shift + click selects bars; Ctrl+C and Ctrl+V paste them after the selection; Up moves them; Ctrl+Z and Esc', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    const bar = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { barSel: { from: number; to: number } | null }).barSel);
    // the band behind the staff is drawn while bars are selected (the picture, not only the data)
    // (an empty Graphics already holds its default style commands, so the test compares with the idle length)
    const bandLength = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { band: { commandBuffer: unknown[] } | null }).band?.commandBuffer.length ?? 0);
    const idleBand = await bandLength();
    await clickNote(page, 0, 0, 'E');
    // Shift + click on the note of bar 0 selects that bar (the bar of the last click is the anchor)
    await selectNote(page, 0, 0, 'E', 4, ['Shift']);
    expect(await bar()).toEqual({ from: 0, to: 0 });
    expect(await bandLength()).toBeGreaterThan(idleBand);
    // copy the bar with Ctrl+C; the selection stays on it, so Ctrl+V pastes right after it: the pasted bar is selected
    await page.keyboard.press('Control+KeyC');
    await page.keyboard.press('Control+KeyV');
    expect(await bar()).toEqual({ from: 1, to: 1 });
    expect(await notes(page)).toEqual(['0:0:E:quarter', '1:0:E:quarter']);
    // Shift + Up moves the selected bar's notes one step (E to F; the plain arrows move the cursor, ft_1_02d.AC16); Ctrl+Z takes that one step back
    await page.keyboard.press('Shift+ArrowUp');
    expect(await notes(page)).toEqual(['0:0:E:quarter', '1:0:F:quarter']);
    await page.keyboard.press('Control+KeyZ');
    expect(await notes(page)).toEqual(['0:0:E:quarter', '1:0:E:quarter']);
    // Esc clears the bar selection and the band goes with it
    await page.keyboard.press('Escape');
    expect(await bar()).toBeNull();
    expect(await bandLength()).toBe(idleBand);
    expectNoErrors(errors);
  });

  test('Ctrl+X takes a bar out and the later bars move back; Ctrl+V puts it back; Insert adds an empty bar before the selection', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    const sel = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { barSel: { from: number; to: number } | null }).barSel);
    const sortedNotes = async () => (await notes(page)).sort();
    await clickNote(page, 0, 0, 'E');
    await clickNote(page, 1, 0, 'G');
    await clickNote(page, 2, 0, 'C');
    // a left click selects the G (bar 1), and Shift + left click on it selects its bar
    await selectNote(page, 1, 0, 'G');
    await selectNote(page, 1, 0, 'G', 4, ['Shift']);
    expect(await sel()).toEqual({ from: 1, to: 1 });
    // cut: bar 1 goes, the C moves back from bar 2 to bar 1, and nothing stays selected
    await page.keyboard.press('Control+KeyX');
    expect(await sortedNotes()).toEqual(['0:0:E:quarter', '1:0:C:quarter']);
    expect(await sel()).toBeNull();
    // paste with no selection: the bar goes back where it was cut, and the C moves on again
    await page.keyboard.press('Control+KeyV');
    expect(await sortedNotes()).toEqual(['0:0:E:quarter', '1:0:G:quarter', '2:0:C:quarter']);
    expect(await sel()).toEqual({ from: 1, to: 1 });
    // Insert: an empty bar before the selected bar; the G and the C move one bar on, and the new bar is selected
    await page.keyboard.press('Insert');
    expect(await sortedNotes()).toEqual(['0:0:E:quarter', '2:0:G:quarter', '3:0:C:quarter']);
    expect(await sel()).toEqual({ from: 1, to: 1 });
    // one Ctrl+Z takes the insert back as one step
    await page.keyboard.press('Control+KeyZ');
    expect(await sortedNotes()).toEqual(['0:0:E:quarter', '1:0:G:quarter', '2:0:C:quarter']);
    expectNoErrors(errors);
  });

  test('copy, paste and the ties are one picture each; paste opens x1, x2, x4, and a press outside a menu only closes it', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    const bars = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { history: { present: { bars: number } } }).history.present.bars);
    const menuOpen = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { menuOpen: boolean }).menuOpen);
    for (const old of ['COPY', 'PASTE', 'TIE', 'PICK', 'ALL', 'x2', 'x4']) expect(await editorButton(page, old)).toBe(-1);
    await closeBubble(page, 'editor');
    await clickNote(page, 0, 0, 'E');
    await selectNote(page, 0, 0, 'E');
    // copy is in the bubble on the note, paste in the bubble on a place: there, in the second bar, twice
    await clickButton(page, 'editor', await editorButton(page, 'Copy'));
    const before = await bars();
    await closeBubble(page, 'editor');
    await clickButton(page, 'editor', await bubbleButton(page, 'Paste', 1));
    expect(await menuOpen()).toBe(true);
    await clickButton(page, 'editor', await editorButton(page, 'x2'));
    expect(await menuOpen()).toBe(false);
    expect(await notes(page)).toEqual(['0:0:E:quarter', '1:0:E:quarter', '2:0:E:quarter']);
    expect(await bars()).toBe(before);
    // a press on the staff while the menu is open closes the menu and writes nothing
    const notesBefore = await notes(page);
    await clickButton(page, 'editor', await bubbleButton(page, 'Paste'));
    await clickNote(page, 1, 480, 'G');
    expect(await menuOpen()).toBe(false);
    expect(await notes(page)).toEqual(notesBefore);
    // Esc closes a menu and stays in the editor
    await selectNote(page, 0, 0, 'E');
    await openTieMenu(page);
    expect(await menuOpen()).toBe(true);
    await page.keyboard.press('Escape');
    expect(await menuOpen()).toBe(false);
    expect(await activeScenes(page)).toContain('editor');
    expectNoErrors(errors);
  });
});

test.describe('settings and back', () => {
  test('unsaved notes are still there after a visit to Settings and back', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await eAndGQuarters(page);
    const written = await notes(page);
    expect(written).toHaveLength(2);
    await clickToolbar(page, 'settings');
    await waitForScene(page, 'settings');
    await page.keyboard.press('Escape');
    await waitForScene(page, 'editor');
    await expect.poll(() => notes(page)).toEqual(written);
    // still unsaved, and the first note can be undone
    expect(await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { dirty(): boolean }).dirty())).toBe(true);
    await page.keyboard.press('Control+KeyZ');
    await expect.poll(() => notes(page)).toHaveLength(1);
    expectNoErrors(errors);
  });
});

test.describe('finger buttons and AUTO (ft_1_02d.AC13)', () => {
  test('a finger button sets the selected note; AUTO fills the notes with none from the level and keeps the author\'s finger', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await clickNote(page, 0, 0, 'C');
    await clickNote(page, 0, 480, 'D');
    // a click on a note that is not selected selects it: D is the one the finger buttons change
    await clickNote(page, 0, 480, 'D');
    // the fingers are a menu item of the band (ft_1_20): F opens it from the keyboard too
    const at = async (label: string) => {
      const labels = await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { buttons: { options: { label: string } }[] }).buttons.map((b) => b.options.label));
      return labels.lastIndexOf(label);
    };
    const fingers = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { history: { present: { notes: { finger?: number }[] } } }).history.present.notes.map((n) => n.finger ?? null));
    await clickButton(page, 'editor', await bubbleButton(page, 'Fingers'));
    expect(await at('3')).toBeGreaterThanOrEqual(0);
    await clickButton(page, 'editor', await at('3'));
    expect(await fingers()).toEqual([null, 3]);
    // AUTO: C4 is in the level-1 right-hand position (finger 1); D4 keeps the author's finger 3
    await clickButton(page, 'editor', await editorButton(page, 'Fingers'));
    expect(await at('AUTO')).toBeGreaterThanOrEqual(0);
    await clickButton(page, 'editor', await at('AUTO'));
    expect(await fingers()).toEqual([1, 3]);
    expectNoErrors(errors);
  });
});

test.describe('the bubble shows the note as it is (ft_1_20)', () => {
  test('the dynamic option of a note with none says none, its none choice is named and lit, and the finger in use is lit', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await clickNote(page, 0, 0, 'C');
    await clickNote(page, 0, 0, 'C');
    const lit = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { menu: { buttons: { options: { label: string }; active: boolean }[] } | null }).menu?.buttons.filter((b) => b.active).map((b) => b.options.label) ?? []);
    // no dynamic on the note: the option says so, never a mark the note does not have
    const none = await editorButton(page, 'No dynamic mark');
    expect(none).toBeGreaterThanOrEqual(0);
    await clickButton(page, 'editor', none);
    await expect.poll(lit).toContain('No dynamic mark');
    await closeBubble(page, 'editor');
    // the finger written on the note is lit among the fingers
    await pickInBubble(page, 'Fingers', '3');
    await clickButton(page, 'editor', await editorButton(page, 'Fingers'));
    await expect.poll(lit).toContain('3');
    expectNoErrors(errors);
  });
});

test.describe('pre-notes (grace notes, core_09.AC35, core_09.AC36, d121)', () => {
  type Grace = { step: string; octave: number; alter: number; slash: boolean };
  const graces = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('editor').history.present.notes as { step: string; grace?: Grace }[]).map((n) => `${n.step}:${n.grace ? `${n.grace.step}${n.grace.octave}${n.grace.alter}${n.grace.slash ? '/' : ''}` : '-'}`));
  /** Where the editor's staff put each grace head, where it was drawn, and the staff's place on the canvas. */
  const drawn = (page: Page) => page.evaluate(() => {
    const scene = window.__game.scene.getScene('editor') as unknown as { layout: { graces: { index: number; x: number; y: number; slash: unknown; stem: { x: number; y1: number; y2: number } }[] }; staffView: { gracesShown: { index: number; x: number; y: number; slash: boolean }[]; origin: { x: number; y: number }; theme: { ink: number; paper: number } } };
    return {
      layout: scene.layout.graces.map((g) => ({ index: g.index, x: g.x, y: g.y, slash: g.slash !== null, stem: g.stem })),
      shown: scene.staffView.gracesShown.map((g) => ({ ...g })),
      origin: { ...scene.staffView.origin },
      ink: scene.staffView.theme.ink,
      paper: scene.staffView.theme.paper,
    };
  });
  const pixelSum = (page: Page, x: number, y: number): Promise<number> => page.evaluate(
    ([px, py]) => new Promise<number>((resolve) => {
      const renderer = (window.__game as unknown as { renderer: { snapshotPixel(x: number, y: number, done: (c: { r: number; g: number; b: number }) => void): void } }).renderer;
      renderer.snapshotPixel(Math.round(px), Math.round(py), (c) => resolve(c.r + c.g + c.b));
    }),
    [x, y] as const,
  );
  /** The darkest of a point and its eight neighbours (a small head can fall between pixels). */
  const darkest = async (page: Page, x: number, y: number): Promise<number> => {
    let min = 255 * 3;
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) min = Math.min(min, await pixelSum(page, x + dx, y + dy));
    return min;
  };
  const graceButton = (page: Page) => bubbleButton(page, 'GRACE NOTE');

  test('(core_09.AC35) (core_09.AC36) place a note, select it, press GRACE NOTE, play a key: the small head is drawn where the layout put it; a staff click works too; it survives save, reopen and play', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await setTitle(page, 'Grace Piece');
    // the author's flow: place E and G, select E (a left click on it), press the item, play D on the keyboard
    await eAndGQuarters(page);
    await selectNote(page, 0, 0, 'E');
    expect(await graceButton(page)).toBeGreaterThanOrEqual(0);
    await clickButton(page, 'editor', await graceButton(page));
    expect(await status(page)).toContain('Now play or click the key of the grace note.');
    await tap(page, 62);
    await expect.poll(() => graces(page)).toEqual(['E:D40/', 'G:-']);
    // the key played wrote no note of its own, and the pick is over
    expect(await notes(page)).toEqual(['0:0:E:quarter', '0:480:G:quarter']);
    expect(await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { graceFor: unknown }).graceFor)).toBeNull();
    expect(await status(page)).not.toContain('Now play or click the key of the grace note.');

    // the same with a staff click: select G, press the item, click the B line (a place right of G, so not G's head)
    await selectNote(page, 0, 480, 'G');
    await clickButton(page, 'editor', await graceButton(page));
    await clickNote(page, 0, 960, 'B');
    await expect.poll(() => graces(page)).toEqual(['E:D40/', 'G:B40/']);
    expect(await notes(page)).toEqual(['0:0:E:quarter', '0:480:G:quarter']);

    // the editor staff draws both small heads at their layout positions, and the canvas shows ink there (head and stem)
    await expect.poll(async () => (await drawn(page)).shown.length).toBe(2);
    const d = await drawn(page);
    expect(d.shown).toEqual(d.layout.map((l) => ({ index: l.index, x: l.x, y: l.y, slash: l.slash })));
    expect(d.layout.every((l) => l.slash)).toBe(true);
    // the sheet's body colour: the staff lies on parchment (d119), whose corner at the origin is its torn, darker rim
    const sum = (c: number): number => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
    const paper = sum(d.paper);
    const ink = sum(d.ink);
    for (const l of d.layout) {
      expect(await darkest(page, d.origin.x + l.x, d.origin.y + l.y), `head of grace ${l.index}`).toBeLessThan((paper + ink) / 2);
      expect(await darkest(page, d.origin.x + l.stem.x, d.origin.y + (l.stem.y1 * 0.25 + l.stem.y2 * 0.75)), `stem of grace ${l.index}`).toBeLessThan((paper + ink) / 2);
    }
    // each grace head sits left of its main note
    const heads = await page.evaluate(() => {
      const scene = window.__game.scene.getScene('editor') as unknown as { pointForNote(p: { hand: string; bar: number; start: number; step: string; octave: number }): { x: number } };
      return [scene.pointForNote({ hand: 'RH', bar: 0, start: 0, step: 'E', octave: 4 }).x, scene.pointForNote({ hand: 'RH', bar: 0, start: 480, step: 'G', octave: 4 }).x];
    });
    d.layout.forEach((l, i) => expect(d.origin.x + l.x).toBeLessThan(heads[i]!));
    if (process.env.GRACE_EDITOR_SHOT) await page.screenshot({ path: process.env.GRACE_EDITOR_SHOT });

    // the item on a note with a pre-note is REMOVE GRACE NOTE and takes it away (ft_1_02d.AC39); undo brings it back
    await clickNote(page, 0, 0, 'E');
    await clickButton(page, 'editor', await bubbleButton(page, 'REMOVE GRACE NOTE'));
    await expect.poll(() => graces(page)).toEqual(['E:-', 'G:B40/']);
    await page.keyboard.press('Control+KeyZ');
    await expect.poll(() => graces(page)).toEqual(['E:D40/', 'G:B40/']);

    // saved, and opened again: both pre-notes are in the piece and drawn
    await clickButton(page, 'editor', await editorButton(page, 'Save'));
    await expect.poll(() => status(page)).toContain('Saved. It is in the menu now.');
    const id = await page.evaluate(() => (window.__game.registry.get('context').ownPieces.list() as { id: string; abc: string }[])[0]!);
    expect(id.abc).toContain('{/D}E2 {/B}G2');
    await page.evaluate((pieceId) => window.__game.scene.start('editor', { id: pieceId }), id.id);
    await expect.poll(() => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { staffView?: { gracesShown: unknown[] } }).staffView?.gracesShown.length ?? 0)).toBe(2);
    expect(await graces(page)).toEqual(['E:D40/', 'G:B40/']);

    // and played: the practice screen has both graces, the grace keys are ignored and the main notes count
    const tryIt = await page.evaluate(() => (window.__game.scene.getScene('editor').buttons as { objects: { text?: string }[] }[]).findIndex((b) => b.objects.some((o) => o.text === 'Try it')));
    await clickButton(page, 'editor', tryIt);
    await waitForScene(page, 'practice');
    expect(await page.evaluate(() => (window.__game.scene.getScene('practice').chart.graces as { pitch: { midi: number } }[]).map((g) => g.pitch.midi))).toEqual([62, 71]);
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('practice').playSession?.staffView?.gracesShown.length ?? 0)).toBe(2);
    const state = () => page.evaluate(() => {
      const s = window.__game.scene.getScene('practice').playSession.controller.getState();
      return { step: s.stepIndex as number, last: (s.lastJudged?.verdict ?? null) as string | null, done: s.done as boolean };
    });
    await expect.poll(async () => (await state()).step).toBe(0);
    await playWithVirtualPiano(page, [62]); // the grace D: no note judged, the E still waits
    await letGameRun(page, 10);
    expect(await state()).toEqual({ step: 0, last: null, done: false });
    await playWithVirtualPiano(page, [64]);
    await expect.poll(state).toEqual({ step: 1, last: 'correct', done: false });
    await playWithVirtualPiano(page, [71]); // the grace B: nothing marked wrong, the G still waits
    await letGameRun(page, 10);
    expect(await state()).toEqual({ step: 1, last: 'correct', done: false });
    await playWithVirtualPiano(page, [67]);
    await expect.poll(state).toEqual({ step: 2, last: 'correct', done: true });
    // Try it goes back to the piece maker when the piece is played
    await waitForScene(page, 'editor');
    expectNoErrors(errors);
  });
});

/** The piece maker's keyboard cursor and the editor's state the keyboard tests read. */
const keyState = (page: Page) => page.evaluate(() => {
  const scene = window.__game.scene.getScene('editor') as unknown as {
    keyCursor: { hand: string; bar: number; start: number; step: string; octave: number } | null;
    selected: { step: string; start: number } | null;
    cursorMark: { commandBuffer: unknown[] } | null;
    history: { present: { notes: { bar: number; start: number; step: string; octave: number; tieNext?: boolean; length: string }[]; slurs?: unknown[] } };
  };
  const c = scene.keyCursor;
  return {
    cursor: c ? `${c.hand}:${c.bar}:${c.start}:${c.step}${c.octave}` : null,
    selected: scene.selected ? `${scene.selected.start}:${scene.selected.step}` : null,
    marked: (scene.cursorMark?.commandBuffer.length ?? 0) > 2,
    ties: scene.history.present.notes.filter((n) => n.tieNext).map((n) => `${n.bar}:${n.start}:${n.step}`),
    slurs: (scene.history.present.slurs ?? []).length,
  };
});

async function pressTimes(page: Page, key: string, times: number): Promise<void> {
  for (let i = 0; i < times; i++) await page.keyboard.press(key);
}

test.describe('piece maker with the keyboard only', () => {
  test('ft_1_02d.AC14 ft_1_02d.AC15 ft_1_02d.AC17 arrows move the cursor, Enter writes a melody, and the letter keys play no notes', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    // Z, X and M are keys of the computer-keyboard piano: in the piece maker they write nothing (ft_1_02d.AC14)
    for (const key of ['KeyZ', 'KeyX', 'KeyM']) await page.keyboard.press(key);
    await letGameRun(page, 20);
    expect(await notes(page)).toEqual([]);
    // the first arrow shows the cursor where writing goes on: bar 1, the middle line of the treble staff (B4), drawn on the staff
    await page.keyboard.press('ArrowRight');
    expect(await keyState(page)).toMatchObject({ cursor: 'RH:0:0:B4', marked: true });
    // down six staff steps to C4, Enter writes a quarter there and the cursor stays on it
    await pressTimes(page, 'ArrowDown', 6);
    await page.keyboard.press('Enter');
    expect(await notes(page)).toEqual(['0:0:C:quarter']);
    // right goes to the end of the note; up two steps to E; Enter
    await page.keyboard.press('ArrowRight');
    await pressTimes(page, 'ArrowUp', 2);
    await page.keyboard.press('Enter');
    // a half note: 2 picks the length, then G a step above the third beat
    await page.keyboard.press('ArrowRight');
    await pressTimes(page, 'ArrowUp', 2);
    await page.keyboard.press('Digit2');
    await page.keyboard.press('Enter');
    expect(await notes(page)).toEqual(['0:0:C:quarter', '0:480:E:quarter', '0:960:G:half']);
    // left back onto the E selects it; Ctrl + right jumps to the next bar, Ctrl + down to the bass staff's top space at the same
    // place, then its bottom space, then round to the treble's top space (A2, G3, F4, E5)
    await page.keyboard.press('ArrowLeft');
    expect(await keyState(page)).toMatchObject({ cursor: 'RH:0:480:G4', selected: null });
    await pressTimes(page, 'ArrowDown', 2);
    expect(await keyState(page)).toMatchObject({ cursor: 'RH:0:480:E4', selected: '480:E' });
    await page.keyboard.press('Control+ArrowRight');
    expect((await keyState(page)).cursor).toBe('RH:1:0:E4');
    await page.keyboard.press('Control+ArrowDown');
    expect((await keyState(page)).cursor).toBe('LH:1:0:G3');
    await page.keyboard.press('Control+ArrowDown');
    expect((await keyState(page)).cursor).toBe('LH:1:0:A2');
    await page.keyboard.press('Control+ArrowDown');
    expect((await keyState(page)).cursor).toBe('RH:1:0:E5');
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC17 Ctrl+Enter writes a note and moves on to the next place, so a melody is Ctrl+Enter and up or down; a plain arrow ends a bar selection and its band', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await page.keyboard.press('ArrowRight');
    await pressTimes(page, 'ArrowDown', 6);
    await page.keyboard.press('Control+Enter');
    expect((await keyState(page)).cursor).toBe('RH:0:480:C4');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Control+Enter');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Control+Enter');
    expect(await notes(page)).toEqual(['0:0:C:quarter', '0:480:D:quarter', '0:960:E:quarter']);
    expect((await keyState(page)).cursor).toBe('RH:0:1440:E4');
    // Ctrl + Shift + right selects bars from the cursor's bar; a plain arrow ends the selection and the band goes (the picture, not only the data)
    const bandLength = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { band: { commandBuffer: unknown[] } | null }).band?.commandBuffer.length ?? 0);
    const idleBand = await bandLength();
    await page.keyboard.press('Control+Shift+ArrowRight');
    expect(await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { barSel: unknown }).barSel)).toEqual({ from: 0, to: 1 });
    expect(await bandLength()).toBeGreaterThan(idleBand);
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { barSel: unknown }).barSel)).toBeNull();
    expect(await bandLength()).toBe(idleBand);
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC16 ft_1_02d.AC17 Shift+Enter holds the note on with a tie; Shift + up makes the tie a slur, Shift + down a tie again; Shift + right lengthens', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await page.keyboard.press('ArrowRight');
    await pressTimes(page, 'ArrowDown', 4);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Shift+Enter');
    expect(await notes(page)).toEqual(['0:0:E:quarter', '0:480:E:quarter']);
    expect(await keyState(page)).toMatchObject({ cursor: 'RH:0:480:E4', ties: ['0:0:E'], slurs: 0 });
    await page.keyboard.press('Shift+ArrowUp');
    expect(await notes(page)).toEqual(['0:0:E:quarter', '0:480:F:quarter']);
    expect(await keyState(page)).toMatchObject({ cursor: 'RH:0:480:F4', ties: [], slurs: 1 });
    await page.keyboard.press('Shift+ArrowDown');
    expect(await keyState(page)).toMatchObject({ cursor: 'RH:0:480:E4', ties: ['0:0:E'], slurs: 0 });
    await page.keyboard.press('Shift+ArrowRight');
    expect(await notes(page)).toEqual(['0:0:E:quarter', '0:480:E:half']);
    // one undo step each
    await page.keyboard.press('Control+KeyZ');
    expect(await notes(page)).toEqual(['0:0:E:quarter', '0:480:E:quarter']);
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC18 C builds a chord on the cursor\'s pitch and cycles 1-3-5, 1-5, 1-3, 1-3-5-7; up and down reach each head', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await page.keyboard.press('ArrowRight');
    await pressTimes(page, 'ArrowDown', 6);
    const chord = async () => (await notes(page)).map((n) => n.split(':')[2]).join(' ');
    await page.keyboard.press('KeyC');
    expect(await chord()).toBe('C E G');
    expect(await status(page)).toContain('Chord 1-3-5');
    await page.keyboard.press('KeyC');
    expect(await chord()).toBe('C G');
    await page.keyboard.press('KeyC');
    expect(await chord()).toBe('C E');
    await page.keyboard.press('KeyC');
    expect(await chord()).toBe('C E G B');
    // after an undo the next press goes on from the chord on the staff (it is read from the notes)
    await page.keyboard.press('Control+KeyZ');
    expect(await chord()).toBe('C E');
    await page.keyboard.press('KeyC');
    expect(await chord()).toBe('C E G B');
    // up two steps lands on the E of the chord and selects that head only
    await pressTimes(page, 'ArrowUp', 2);
    expect(await keyState(page)).toMatchObject({ cursor: 'RH:0:0:E4', selected: '0:E' });
    expectNoErrors(errors);
  });
});

test.describe('piece maker keys on the tools (ft_1_02d.AC19)', () => {
  const menuOpen = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { menuOpen: boolean }).menuOpen);
  const lengthNow = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { length: string }).length);

  test('ft_1_02d.AC19 N opens the lengths numbered as the length keys: 3 picks the dotted half; N then Enter writes the default quarter', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Digit8');
    expect(await lengthNow(page)).toBe('eighth');
    // N with no number: Enter takes the quarter (the default), closes the menu and writes the note at the cursor
    await page.keyboard.press('KeyN');
    expect(await menuOpen(page)).toBe(true);
    // the numbers are drawn on the choices: whole 1, dotted half 3, half 2, quarter 4, eighth 8
    expect(await sceneTexts(page, 'editor')).toEqual(expect.arrayContaining(['1', '3', '2', '4', '8']));
    await page.keyboard.press('Enter');
    expect(await menuOpen(page)).toBe(false);
    expect(await notes(page)).toEqual(['0:0:B:quarter']);
    // N then 3: the dotted half, and the menu goes; Ctrl+Enter-free: the right arrow moves on, Enter writes it
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('KeyN');
    await page.keyboard.press('Digit3');
    expect(await menuOpen(page)).toBe(false);
    expect(await lengthNow(page)).toBe('dottedHalf');
    await page.keyboard.press('Enter');
    expect(await notes(page)).toEqual(['0:0:B:quarter', '0:480:B:dottedHalf']);
    // R: rests, the same lengths; R then 4 and Enter writes a quarter rest in the next bar
    await page.keyboard.press('Control+ArrowRight');
    await page.keyboard.press('KeyR');
    await page.keyboard.press('Digit4');
    await page.keyboard.press('Enter');
    const rests = await page.evaluate(() => ((window.__game.scene.getScene('editor') as unknown as { history: { present: { rests?: { bar: number; start: number; length: string }[] } } }).history.present.rests ?? []).map((r) => `${r.bar}:${r.start}:${r.length}`));
    expect(rests).toEqual(['1:0:quarter']);
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC19 ft_1_33.AC1 F1 shows the key on every tool and a card for each mouse action; Esc hides them; A then 1 puts a sharp on the note under the cursor', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    const texts = () => sceneTexts(page, 'editor');
    // two Bs written from the keyboard, so the first has a tie to offer (T, ft_1_02d.AC35)
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Control+Enter');
    await page.keyboard.press('Enter');
    // a bar copied, so the place's bubble offers paste (ft_1_02d.AC35)
    await page.keyboard.press('Control+KeyC');
    expect(await texts()).not.toContain('^S');
    await page.keyboard.press('F1');
    // the keys on the tools (the lengths show their number keys), and the mouse picture over the staff (ft_1_33.AC1); the
    // bubble's options show theirs too while the help is up: on the note and on an empty place (ft_1_20, d282)
    expect(await helpCards(page)).toBe(7);
    expect(await texts()).toContain('Keys');
    expect((await texts()).join(' ')).not.toContain('Ctrl + Enter');
    const seen = new Set(await texts());
    for (const at of [{ bar: 0, step: 'B' as const, octave: 4 }, { bar: 1, step: 'A' as const, octave: 5 }]) {
      const p = await canvasPoint(page, { ...at, start: 0 });
      await page.mouse.click(p.x, p.y, { button: 'right' });
      await expect.poll(() => bubbleOpen(page, 'editor')).toBe(true);
      for (const text of await texts()) seen.add(text);
      await closeBubble(page, 'editor');
    }
    for (const key of ['N', 'A', 'T', 'K', 'F', 'D', 'P', 'Y', 'V', 'M', 'U', 'Del', '^S', '^C', '^Z', '^Y', '^E', '^O']) expect([...seen]).toContain(key);
    await page.keyboard.press('Escape');
    expect(await texts()).not.toContain('^S');
    // still in the editor: Esc closed the list, it did not leave
    expect(await activeScenes(page)).toContain('editor');
    // A is the accidental key: the natural B under the cursor goes sharp at once
    await selectNote(page, 0, 0, 'B');
    await page.keyboard.press('KeyA');
    const alter = await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { history: { present: { notes: { alter: number }[] } } }).history.present.notes[0]?.alter);
    expect(alter).toBe(1);
    expectNoErrors(errors);
  });

  test('ft_1_33.AC3 Enter on the F1 help starts Kiur\'s tour of the keys: the cursor, its bar and the band under the spotlight; it ends back on the help, the piece unchanged', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await page.keyboard.press('F1');
    const before = await page.evaluate(() => JSON.stringify((window.__game.scene.getScene('editor') as unknown as { history: { present: unknown } }).history.present));
    await page.keyboard.press('Enter');
    await expect.poll(() => activeScenes(page)).toContain('intro');
    const showing = () => page.evaluate(() => (window.__game.scene.getScene('intro') as unknown as { showing: { step: number; text: string; spot: { x: number; y: number; w: number; h: number } | null } | null }).showing);
    const spots: ({ x: number; y: number; w: number; h: number } | null)[] = [];
    for (let step = 0; step < 5; step++) {
      await expect.poll(async () => (await showing())?.step).toBe(step);
      spots.push((await showing())!.spot);
      // a long line has more than one page; Enter turns each
      while ((await showing())?.step === step) await page.keyboard.press('Enter');
    }
    // every step has its thing lit: the cursor (three times), its bar (wider), the band (the whole width)
    for (const spot of spots) expect(spot).not.toBeNull();
    expect(spots[3]!.w).toBeGreaterThan(spots[0]!.w);
    expect(spots[4]!.w).toBeGreaterThan(spots[3]!.w);
    await expect.poll(() => activeScenes(page)).not.toContain('intro');
    // back on the help, and Esc in the tour also ends it there
    expect(await helpCards(page)).toBe(7);
    await page.keyboard.press('Enter');
    await expect.poll(() => activeScenes(page)).toContain('intro');
    await page.keyboard.press('Escape');
    await expect.poll(() => activeScenes(page)).not.toContain('intro');
    expect(await helpCards(page)).toBe(7);
    const after = await page.evaluate(() => JSON.stringify((window.__game.scene.getScene('editor') as unknown as { history: { present: unknown } }).history.present));
    expect(after).toBe(before);
    await page.keyboard.press('Escape');
    expect(await helpCards(page)).toBe(0);
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC19 a key menu closed by a click is gone: Enter in a menu opened next with the mouse neither takes its default nor writes', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Digit8');
    await page.keyboard.press('KeyN');
    expect(await menuOpen(page)).toBe(true);
    // a click off the menu closes it (the click goes no further: Undo has nothing to undo)
    await clickButton(page, 'editor', await editorButton(page, 'Undo'));
    expect(await menuOpen(page)).toBe(false);
    // the writer's lengths, opened with the mouse
    await clickButton(page, 'editor', await editorButton(page, 'Notes'));
    expect(await menuOpen(page)).toBe(true);
    await page.keyboard.press('Enter');
    expect(await lengthNow(page)).toBe('eighth');
    expect(await notes(page)).toEqual([]);
    // holding a menu key down (its auto-repeat) picks nothing: the menu stays open
    await page.keyboard.press('Escape');
    expect(await menuOpen(page)).toBe(false);
    await page.keyboard.down('KeyN');
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN', key: 'n', repeat: true })));
    await page.keyboard.up('KeyN');
    expect(await menuOpen(page)).toBe(true);
    expect(await lengthNow(page)).toBe('eighth');
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC19 the strip and the top strip show the keys on their tools, and N then 3 picks the dotted half there', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    const texts = () => sceneTexts(page, 'editor');
    await page.keyboard.press('F1');
    for (const key of ['^S', '^E', '^O', 'N', 'P', 'Y', '^Z', '^Y']) expect(await texts()).toContain(key);
    await page.keyboard.press('Escape');
    await page.keyboard.press('KeyN');
    expect(await menuOpen(page)).toBe(true);
    await page.keyboard.press('Digit3');
    expect(await menuOpen(page)).toBe(false);
    expect(await lengthNow(page)).toBe('dottedHalf');
    expectNoErrors(errors);
  });
});

test.describe('the next length and the A time', () => {
  test('ft_1_02d.AC20 after an eighth the next note is an eighth, after two eighths a quarter again', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Digit8');
    for (let i = 0; i < 3; i++) await page.keyboard.press('Control+Enter');
    expect(await notes(page)).toEqual(['0:0:B:eighth', '0:240:B:eighth', '0:480:B:quarter']);
    expect(await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { length: string }).length)).toBe('quarter');
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC22 Enter on a note makes it a step longer; Alt + Enter makes it as long as the bar allows, or writes that long a note', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    expect(await notes(page)).toEqual(['0:0:B:quarter']);
    await page.keyboard.press('Enter');
    expect(await notes(page)).toEqual(['0:0:B:half']);
    await page.keyboard.press('Alt+Enter');
    expect(await notes(page)).toEqual(['0:0:B:whole']);
    // on a free place after a quarter, Alt + Enter writes the dotted half that fills the bar
    await page.keyboard.press('Control+ArrowRight');
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Alt+Enter');
    expect(await notes(page)).toEqual(['0:0:B:whole', '1:0:B:quarter', '1:480:B:dottedHalf']);
    expectNoErrors(errors);
  });

  test('ft_1_02a.AC13 Save on a new piece with no name of its own opens the title to type; Enter there saves it under that name', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await clickNote(page, 0, 0, 'C');
    await clickButton(page, 'editor', await editorButton(page, 'Save'));
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('editor-title');
    expect(await status(page)).toContain('Give the piece a name, then press Enter.');
    expect(await page.evaluate(() => window.__game.registry.get('context').ownPieces.list().length)).toBe(0);
    await page.fill('#editor-title', 'Bells');
    await page.press('#editor-title', 'Enter');
    await expect.poll(() => status(page)).toContain('Saved. It is in the menu now.');
    expect(await page.evaluate(() => window.__game.registry.get('context').ownPieces.list().map((r: { id: string }) => r.id))).toEqual(['own-bells']);
    expectNoErrors(errors);
  });

  test('Esc in the title box asked for by Save gives the keys back to the piece maker, and the title gets no letter', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await clickNote(page, 0, 0, 'C');
    await clickButton(page, 'editor', await editorButton(page, 'Save'));
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('editor-title');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.activeElement?.id)).not.toBe('editor-title');
    await page.keyboard.type('n');
    expect(await page.inputValue('#editor-title')).toBe('');
    expect(await activeScenes(page)).toContain('editor');
    expectNoErrors(errors);
  });

  test(':wq on a piece with no name asks for it, then saves and leaves once it is typed', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await clickNote(page, 0, 0, 'C');
    await page.keyboard.press('Control+Shift+KeyV');
    await page.keyboard.type(':wq');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('editor-title');
    await page.fill('#editor-title', 'Bells');
    await page.press('#editor-title', 'Enter');
    await expect.poll(() => activeScenes(page)).not.toContain('editor');
    expect(await page.evaluate(() => window.__game.registry.get('context').ownPieces.list().map((r: { id: string }) => r.id))).toEqual(['own-bells']);
    expectNoErrors(errors);
  });

  test('ft_1_02a.AC15 a piece is never saved under a blank name or one another piece has, in any case: the field turns red until the name is new', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await clickNote(page, 0, 0, 'C');
    // spaces are no name
    await page.fill('#editor-title', '   ');
    await clickButton(page, 'editor', await editorButton(page, 'Save'));
    expect(await status(page)).toContain('Give the piece a name, then press Enter.');
    // a piece of the game has this name, in other letters
    await page.fill('#editor-title', 'twinkle TWINKLE little star');
    await page.press('#editor-title', 'Enter');
    await clickButton(page, 'editor', await editorButton(page, 'Save'));
    await expect.poll(() => status(page)).toContain('Another piece has this name.');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('editor-title');
    const ring = () => page.evaluate(() => getComputedStyle(document.querySelector('#editor-title')!).borderTopColor);
    const red = await ring();
    expect(red).toBe('rgb(215, 38, 61)');
    expect(await page.evaluate(() => window.__game.registry.get('context').ownPieces.list().length)).toBe(0);
    // a new name: the ring goes back, and Enter saves
    await page.fill('#editor-title', 'Twinkle for Me');
    expect(await ring()).not.toBe(red);
    await page.press('#editor-title', 'Enter');
    await expect.poll(() => status(page)).toContain('Saved. It is in the menu now.');
    expect(await page.evaluate(() => window.__game.registry.get('context').ownPieces.list().map((r: { piece: { title: string } }) => r.piece.title))).toEqual(['Twinkle for Me']);
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC21 with A the first bar sets the time: three quarters, a click in the next bar, and the piece maker asks for 3/4', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await expect.poll(() => menuButton(page, '+ New piece')).toBeGreaterThanOrEqual(0);
    await clickButton(page, 'menu', await menuButton(page, '+ New piece'));
    await waitForScene(page, 'editor');
    await expect.poll(() => page.evaluate(() => !!(window.__game.scene.getScene('editor') as unknown as { staffView: unknown }).staffView)).toBe(true);
    // A is the step after 4/4 on the time panel
    await openTime(page);
    await clickButton(page, 'editor', await timeStep(page, 'meter', '+'));
    await pressSignature(page, 'time');
    await expect.poll(() => panelOf(page)).toBe(null);
    const state = () => page.evaluate(() => {
      const scene = window.__game.scene.getScene('editor') as unknown as { meterAuto: boolean; meterAsk: number | null; history: { present: { beats: number } } };
      return { auto: scene.meterAuto, ask: scene.meterAsk, beats: scene.history.present.beats };
    });
    expect(await state()).toEqual({ auto: true, ask: null, beats: 4 });
    // three quarters in the first bar; the length is not guessed while the time waits
    await clickNote(page, 0, 0, 'C');
    await clickNote(page, 0, 480, 'D');
    await clickNote(page, 0, 960, 'E');
    expect(await state()).toEqual({ auto: true, ask: null, beats: 4 });
    // a click in the next bar asks for 3/4 and writes nothing there
    await clickNote(page, 1, 0, 'F');
    expect(await state()).toEqual({ auto: true, ask: 3, beats: 4 });
    expect(await notes(page)).toEqual(['0:0:C:quarter', '0:480:D:quarter', '0:960:E:quarter']);
    // 2/4 cannot hold the bar; the tick takes the guess, and the piece is in 3/4 from now
    const disabled = await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { buttons: { options: { label: string }; disabled: boolean }[] }).buttons.filter((b) => b.options.label === '2/4').map((b) => b.disabled));
    expect(disabled).toEqual([true]);
    await clickButton(page, 'editor', await editorButton(page, 'This time'));
    expect(await state()).toEqual({ auto: false, ask: null, beats: 3 });
    expect(await notes(page)).toEqual(['0:0:C:quarter', '0:480:D:quarter', '0:960:E:quarter']);
    await clickNote(page, 1, 0, 'F');
    expect(await notes(page)).toEqual(['0:0:C:quarter', '0:480:D:quarter', '0:960:E:quarter', '1:0:F:quarter']);
    expectNoErrors(errors);
  });
});

test.describe('piece maker: vim keys (ft_1_02e)', () => {
  /** The vim keys' mode and the keys pending, from the scene. */
  const vimState = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { vim: { mode: string; pending: string; line: string | null } | null }).vim);

  test('ft_1_02e.AC1 ft_1_02e.AC2 ft_1_02e.AC3 ft_1_02e.AC4 ft_1_02e.AC5 ft_1_02e.AC6 ft_1_02e.AC7 ft_1_02e.AC8 Ctrl+Shift+V turns them on; insert writes letters, normal moves and changes, Esc never leaves', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    // off by default: h is no key of the piece maker and moves nothing
    expect(await vimState(page)).toBeNull();
    await page.keyboard.press('Control+Shift+KeyV');
    expect(await vimState(page)).toMatchObject({ mode: 'normal' });
    expect(await sceneTexts(page, 'editor')).toContain('vim');
    // the cursor shows at once on B4; 6j goes down to C4; i, then c d e g writes four quarters, each from the one before
    expect((await keyState(page)).cursor).toBe('RH:0:0:B4');
    await page.keyboard.type('6j');
    expect((await keyState(page)).cursor).toBe('RH:0:0:C4');
    await page.keyboard.type('icdeg');
    expect(await vimState(page)).toMatchObject({ mode: 'insert' });
    expect(await notes(page)).toEqual(['0:0:C:quarter', '0:480:D:quarter', '0:960:E:quarter', '0:1440:G:quarter']);
    // the bar is full, so the cursor went on to the next bar; Esc back to normal, gg to the first bar, onto its C4 (a move in
    // time lands on the note there), Ctrl-A a step up: one edit, u takes it back, . does it again
    expect((await keyState(page)).cursor).toBe('RH:1:0:G4');
    await page.keyboard.press('Escape');
    expect(await vimState(page)).toMatchObject({ mode: 'normal' });
    await page.keyboard.type('gg');
    expect((await keyState(page)).cursor).toBe('RH:0:0:C4');
    await page.keyboard.press('Control+KeyA');
    expect((await notes(page))[0]).toBe('0:0:D:quarter');
    await page.keyboard.type('u');
    expect((await notes(page))[0]).toBe('0:0:C:quarter');
    await page.keyboard.type('.');
    expect((await notes(page))[0]).toBe('0:0:D:quarter');
    // 2~ makes the D flat (sharp, then flat) in one edit: one u takes it back
    await page.keyboard.type('2~');
    expect(await page.evaluate(() => (window.__game.scene.getScene('editor').history.present.notes as { start: number; alter: number }[]).find((n) => n.start === 0)!.alter)).toBe(-1);
    await page.keyboard.type('u');
    expect(await page.evaluate(() => (window.__game.scene.getScene('editor').history.present.notes as { start: number; alter: number }[]).find((n) => n.start === 0)!.alter)).toBe(0);
    expect((await notes(page))[0]).toBe('0:0:D:quarter');
    // yy and p: the bar again after it; dd takes the copy out again
    await page.keyboard.type('yyp');
    expect((await notes(page)).filter((n) => n.startsWith('1:'))).toHaveLength(4);
    expect((await keyState(page)).cursor).toMatch(/^RH:1:0:/);
    await page.keyboard.type('dd');
    expect((await notes(page)).filter((n) => n.startsWith('1:'))).toHaveLength(0);
    // x takes the note under the cursor; a letter vim does not use does nothing, and Esc in normal mode stays
    await page.keyboard.type('gg');
    await page.keyboard.type('x');
    expect(await notes(page)).toEqual(['0:480:D:quarter', '0:960:E:quarter', '0:1440:G:quarter']);
    await page.keyboard.type('q');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    expect(await activeScenes(page)).toContain('editor');
    // F1 shows the vim keymap over the staff (ft_1_02e.AC8); Esc hides it
    await page.keyboard.press('F1');
    expect(await sceneTexts(page, 'editor')).toEqual(expect.arrayContaining(['Move', 'Insert mode', 'write a note']));
    await page.keyboard.press('Escape');
    // a : line runs a tool by its word; :set novim turns the keys off
    await page.keyboard.type(':nonsense');
    expect(await vimState(page)).toMatchObject({ line: 'nonsense' });
    await page.keyboard.press('Enter');
    expect(await status(page)).toContain('No such command: nonsense');
    await page.keyboard.type(':set novim');
    await page.keyboard.press('Enter');
    expect(await vimState(page)).toBeNull();
    expectNoErrors(errors);
  });

  test('ft_1_02e.AC5 in insert mode an uppercase letter stacks a chord on the note just written, and + makes it sharp', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await page.keyboard.press('Control+Shift+KeyV');
    await page.keyboard.type('6jicEG+');
    const chord = await page.evaluate(() => (window.__game.scene.getScene('editor').history.present.notes as { start: number; step: string; octave: number; alter: number }[]).map((n) => `${n.start}:${n.step}${n.octave}:${n.alter}`).sort());
    expect(chord).toEqual(['0:C4:0', '0:E4:0', '0:G4:1']);
    // the cursor stayed where writing goes on, after the chord
    expect((await keyState(page)).cursor).toBe('RH:0:480:C4');
    expectNoErrors(errors);
  });
});

test.describe('piece maker: the cursor follows the pointer, the bubble offers what applies (ft_1_02d)', () => {
  /** The words of the open bubble after a right click at this place of the right hand's staff. */
  const buttonDisabled = (page: Page, index: number) => page.evaluate((i) => (window.__game.scene.getScene('editor').buttons as { disabled: boolean }[])[i]!.disabled, index);
  /** Changes the piece as an edit would (one undo step), to set up a state the test is not about. */
  const changePiece = (page: Page, change: string) => page.evaluate((c) => {
    const scene = window.__game.scene.getScene('editor') as unknown as { history: { present: Record<string, unknown> & { notes: Record<string, unknown>[] } }; change(next: unknown): void };
    const p = scene.history.present;
    scene.change(c === 'grace' ? { ...p, notes: p.notes.map((n, i) => (i === 0 ? { ...n, grace: { step: 'D', octave: 4, alter: 0, slash: true } } : n)) } : { ...p, repeats: [{ startBar: 0, endBar: 1 }] });
  }, change);

  async function bubbleAt(page: Page, place: { bar: number; start: number; step: Step; octave?: number }): Promise<string[]> {
    await closeBubble(page, 'editor');
    const at = await canvasPoint(page, place);
    await page.mouse.click(at.x, at.y, { button: 'right' });
    await expect.poll(() => bubbleOpen(page, 'editor')).toBe(true);
    return sceneWords(page, 'editor');
  }

  /** A left drag from bar 0 to bar 1: the lasso selects both bars. */
  async function lassoBars(page: Page): Promise<void> {
    const from = await canvasPoint(page, { bar: 0, start: 240, step: 'C' });
    const to = await canvasPoint(page, { bar: 1, start: 1200, step: 'A' });
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await page.mouse.up();
    expect(await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { barSel: unknown }).barSel)).toEqual({ from: 0, to: 1 });
  }

  test('ft_1_02d.AC34 with its switch on, the keyboard cursor follows the pointer: onto a note it selects it, onto a free place it goes there, and the arrows still move it', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await eAndGQuarters(page);
    // off at first: the pointer on E leaves the selection alone
    const e0 = await canvasPoint(page, { bar: 0, start: 0, step: 'E' });
    await page.mouse.move(e0.x, e0.y, { steps: 3 });
    expect((await keyState(page)).selected).toBeNull();
    // the switch is in the bubble on an empty place, as two pictures
    await clickButton(page, 'editor', await bubbleButton(page, 'Cursor stays put', 2));
    await clickButton(page, 'editor', await lastButton(page, 'editor', 'Cursor follows the mouse'));
    expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('pianor-editor/entry-prefs') ?? '{}').followPointer)).toBe(true);
    await page.mouse.move(e0.x + 40, e0.y + 40, { steps: 2 });
    // the pointer is still where G was written: it moves off and back onto it
    const e = await canvasPoint(page, { bar: 0, start: 0, step: 'E' });
    await page.mouse.move(e.x, e.y, { steps: 3 });
    await expect.poll(async () => (await keyState(page)).selected).toBe('0:E');
    const g = await canvasPoint(page, { bar: 0, start: 480, step: 'G' });
    await page.mouse.move(g.x, g.y, { steps: 3 });
    await expect.poll(async () => (await keyState(page)).selected).toBe('480:G');
    expect((await keyState(page)).cursor).toBe('RH:0:480:G4');
    const free = await canvasPoint(page, { bar: 1, start: 0, step: 'C', octave: 5 });
    await page.mouse.move(free.x, free.y, { steps: 3 });
    await expect.poll(async () => (await keyState(page)).cursor).toBe('RH:1:0:C5');
    expect((await keyState(page)).selected).toBeNull();
    // an arrow moves the cursor on from there, and it stays where the key put it while the pointer rests
    await page.keyboard.press('ArrowUp');
    expect((await keyState(page)).cursor).toBe('RH:1:0:D5');
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC35 the bubble on a note offers no repeat signs, and paste stands greyed until something is copied', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await eAndGQuarters(page);
    const onNote = await bubbleAt(page, { bar: 0, start: 0, step: 'E' });
    expect(onNote).toContain('Copy');
    expect(onNote).not.toContain('|: :|');
    expect(onNote).not.toContain('Paste');
    const onPlace = await bubbleAt(page, { bar: 2, start: 0, step: 'A', octave: 5 });
    expect(onPlace).toContain('|: :|');
    expect(await buttonDisabled(page, await lastButton(page, 'editor', 'Paste'))).toBe(true);
    await closeBubble(page, 'editor');
    await selectNote(page, 0, 0, 'E');
    await page.keyboard.press('Control+KeyC');
    await bubbleAt(page, { bar: 2, start: 0, step: 'A', octave: 5 });
    expect(await buttonDisabled(page, await lastButton(page, 'editor', 'Paste'))).toBe(false);
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC35 on a note inside selected bars with something copied every option fits one page: Copy keeps slot 7, no More', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await eAndGQuarters(page);
    await selectNote(page, 0, 0, 'E');
    // Shift + click on the note's bar selects the bar and keeps the note selected
    const g = await canvasPoint(page, { bar: 0, start: 480, step: 'G' });
    await page.keyboard.down('Shift');
    await page.mouse.click(g.x, g.y);
    await page.keyboard.up('Shift');
    await page.keyboard.press('Control+KeyC');
    await bubbleAt(page, { bar: 0, start: 480, step: 'G' });
    // the note's own options are there too, so nine would have been offered before
    expect((await keyState(page)).selected).not.toBeNull();
    const ring = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { menu: { ring: { options: { label: string } }[] } }).menu.ring.map((b) => b.options.label));
    const labels = await ring();
    expect(labels).not.toContain('More');
    expect(labels).toContain('Paste');
    expect(labels).toContain('Copy');
    // Copy stands in the same slot as on a note alone (slot 7, the last), Paste in slot 6
    const slots = await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { bubbleOptions(at: null): ({ label: string } | null)[] }).bubbleOptions(null).map((o) => o?.label ?? null));
    expect(slots[7]).toBe('Copy');
    expect(slots[6]).toBe('Paste');
    expect(slots).toHaveLength(8);
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC36 lassoed bars are slurred from a right click, with no first note picked, and the slur is drawn faint before the press', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await eAndGQuarters(page);
    await clickNote(page, 1, 0, 'C', 5);
    await lassoBars(page);
    // a right click on a note inside the selection keeps the selection
    await bubbleAt(page, { bar: 0, start: 480, step: 'G' });
    await clickButton(page, 'editor', await lastButton(page, 'editor', 'Ties and slurs'));
    const slur = await lastButton(page, 'editor', 'Slur');
    expect(slur).toBeGreaterThanOrEqual(0);
    // the pointer on SLUR draws the slur faint first (d286)
    const ghost = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { itemGhost: { commandBuffer: unknown[] } | null }).itemGhost?.commandBuffer.length ?? 0);
    const point = await buttonPoint(page, 'editor', slur);
    await page.mouse.move(point.x, point.y, { steps: 2 });
    await expect.poll(ghost).toBeGreaterThan(0);
    expect((await keyState(page)).slurs).toBe(0);
    await clickButton(page, 'editor', slur);
    expect(await page.evaluate(() => window.__game.scene.getScene('editor').history.present.slurs)).toEqual([{ hand: 'RH', from: { bar: 0, start: 0 }, to: { bar: 1, start: 0 } }]);
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC37 a paste over bars with notes warns first and writes over them only when pasted again', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await clickNote(page, 0, 0, 'E');
    await clickNote(page, 1, 0, 'G');
    // copy bar 0, then select bar 1, which has a note
    await selectNote(page, 0, 0, 'E');
    await selectNote(page, 0, 0, 'E', 4, ['Shift']);
    await page.keyboard.press('Control+KeyC');
    await selectNote(page, 1, 0, 'G');
    await selectNote(page, 1, 0, 'G', 4, ['Shift']);
    await page.keyboard.press('Control+KeyV');
    expect(await notes(page)).toEqual(['0:0:E:quarter', '1:0:G:quarter']);
    expect(await status(page)).toContain('Notes this paste writes over (red): 1.');
    await page.keyboard.press('Control+KeyV');
    expect(await notes(page)).toEqual(['0:0:E:quarter', '1:0:E:quarter']);
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC38 the repeat picked in the bubble of a right click on a bar starts on that bar and asks only for its end', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await eAndGQuarters(page);
    await bubbleAt(page, { bar: 1, start: 480, step: 'A', octave: 5 });
    await clickButton(page, 'editor', await lastButton(page, 'editor', '|: :|'));
    const pick = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { repeatPick: { startBar: number | null } | null }).repeatPick);
    expect(await pick()).toEqual({ startBar: 1 });
    expect(await status(page)).toContain('Now click the bar the repeat ends on.');
    // the end: a click in bar 2
    const end = await canvasPoint(page, { bar: 2, start: 1440, step: 'A', octave: 5 });
    await page.mouse.click(end.x, end.y);
    expect(await page.evaluate(() => window.__game.scene.getScene('editor').history.present.repeats)).toEqual([{ startBar: 1, endBar: 2 }]);
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC39 an option waiting for an earlier step is greyed, one that cannot apply there is gone', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    const strip = async () => {
      const out: Record<string, boolean> = {};
      for (const label of ['Listen', 'Try it', 'Undo', 'Redo']) out[label] = await buttonDisabled(page, await editorButton(page, label));
      return out;
    };
    // an empty piece: nothing to hear, try, undo or redo
    expect(await strip()).toEqual({ Listen: true, 'Try it': true, Undo: true, Redo: true });
    await eAndGQuarters(page);
    expect(await strip()).toEqual({ Listen: false, 'Try it': false, Undo: false, Redo: true });
    await clickButton(page, 'editor', await editorButton(page, 'Undo'));
    expect((await strip()).Redo).toBe(false);
    await clickButton(page, 'editor', await editorButton(page, 'Redo'));
    // a length that does not fit the selected note there (E before G) is greyed in the length menu
    await selectNote(page, 0, 0, 'E');
    const lengths = await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { lengthItems(kind: string): { label: string; disabled: boolean }[] }).lengthItems('note').filter((i) => i.disabled).map((i) => i.label));
    expect(lengths).toEqual(expect.arrayContaining(['1', '1/2']));
    expect(lengths).not.toContain('1/4');
    // AUTO only while it would write a finger
    await bubbleAt(page, { bar: 0, start: 0, step: 'E' });
    await clickButton(page, 'editor', await lastButton(page, 'editor', 'Fingers'));
    await clickButton(page, 'editor', await lastButton(page, 'editor', 'AUTO'));
    await bubbleAt(page, { bar: 0, start: 0, step: 'E' });
    await clickButton(page, 'editor', await lastButton(page, 'editor', 'Fingers'));
    expect(await lastButton(page, 'editor', 'AUTO')).toBe(-1);
    // a note with a grace note offers to remove it
    await closeBubble(page, 'editor');
    await changePiece(page, 'grace');
    expect(await bubbleAt(page, { bar: 0, start: 0, step: 'E' })).toContain('REMOVE GRACE NOTE');
    // resting on it draws the grace note going in red first (d286)
    const ghostDrawn = () => page.evaluate(() => ((window.__game.scene.getScene('editor') as unknown as { itemGhost: { commandBuffer: unknown[] } | null }).itemGhost?.commandBuffer.length ?? 0));
    const graceAt = await buttonPoint(page, 'editor', await lastButton(page, 'editor', 'REMOVE GRACE NOTE'));
    await page.mouse.move(graceAt.x, graceAt.y, { steps: 3 });
    await expect.poll(ghostDrawn).toBeGreaterThan(0);
    // the key's circle is the bubble of the clef and key signature, not of a place
    expect(await bubbleAt(page, { bar: 2, start: 0, step: 'A', octave: 5 })).not.toContain('Circle of fifths');
    await closeBubble(page, 'editor');
    await pressSignature(page, 'key', 'right');
    await expect.poll(() => bubbleOpen(page, 'editor')).toBe(true);
    expect(await sceneWords(page, 'editor')).toContain('Circle of fifths');
    // a bar inside a repeat offers to remove it, its bars shaded red first (d286)
    await closeBubble(page, 'editor');
    await changePiece(page, 'repeat');
    await bubbleAt(page, { bar: 1, start: 960, step: 'A', octave: 5 });
    const remove = await lastButton(page, 'editor', 'Remove this repeat');
    expect(remove).toBeGreaterThanOrEqual(0);
    // the grace note's red went with its bubble
    expect(await ghostDrawn()).toBe(0);
    const hover = await buttonPoint(page, 'editor', remove);
    await page.mouse.move(hover.x, hover.y, { steps: 3 });
    await expect.poll(ghostDrawn).toBeGreaterThan(0);
    await clickButton(page, 'editor', remove);
    expect(await page.evaluate(() => window.__game.scene.getScene('editor').history.present.repeats)).toBeUndefined();
    // the short tap is for a piano: with none connected and no on-screen keyboard it is gone
    expect(await bubbleAt(page, { bar: 2, start: 0, step: 'A', octave: 5 })).toContain('A short tap writes an eighth note (on) or a quarter note (off)');
    await closeBubble(page, 'editor');
    await page.evaluate(() => {
      const context = window.__game.registry.get('context') as { midi: unknown; keyboardSwitch: { shown(): boolean } };
      context.midi = null;
      context.keyboardSwitch.shown = () => false;
    });
    expect(await bubbleAt(page, { bar: 2, start: 0, step: 'A', octave: 5 })).not.toContain('A short tap writes an eighth note (on) or a quarter note (off)');
    expectNoErrors(errors);
  });
});

test.describe('piece maker: leaving, Listen, pages and the keys that went nowhere', () => {
  const focusedLeave = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('editorLeave') as unknown as { focusedButton?: { options: { label: string } } }).focusedButton?.options.label ?? null);
  const unloadAsks = (page: Page) => page.evaluate(() => {
    const e = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(e);
    return e.defaultPrevented;
  });

  test('ft_1_02a.AC16 Esc never leaves the piece maker; the door with unsaved work asks on a panel, on Stay, and the tab asks before it closes', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    expect(await unloadAsks(page)).toBe(false);
    await clickNote(page, 0, 0, 'E');
    expect(await unloadAsks(page)).toBe(true);
    // a menu closed by Esc, then a habitual second Esc and a third: still in the piece maker, the door named
    await page.keyboard.press('KeyN');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    expect(await activeScenes(page)).toContain('editor');
    expect(await status(page)).toContain('To leave the piece maker, press the door.');
    // the door: the panel, the keys on Stay; Enter stays, so does Esc
    await clickToolbar(page, 'back');
    await waitForScene(page, 'editorLeave');
    expect(await sceneTexts(page, 'editorLeave')).toEqual(expect.arrayContaining(['This piece has changes that are not saved.', 'Save and leave', 'Leave without saving', 'Stay']));
    expect(await focusedLeave(page)).toBe('Stay');
    await page.keyboard.press('Enter');
    await expect.poll(() => activeScenes(page)).not.toContain('editorLeave');
    expect(await activeScenes(page)).toContain('editor');
    await clickToolbar(page, 'back');
    await waitForScene(page, 'editorLeave');
    await page.keyboard.press('Escape');
    await expect.poll(() => activeScenes(page)).not.toContain('editorLeave');
    expect(await notes(page)).toEqual(['0:0:E:quarter']);
    // Save and leave: saved under its title, then the menu
    await setTitle(page, 'Door Test');
    await clickToolbar(page, 'back');
    await waitForScene(page, 'editorLeave');
    await clickButton(page, 'editorLeave', await sceneButton(page, 'editorLeave', 'Save and leave'));
    await waitForScene(page, 'menu');
    expect(await page.evaluate(() => window.__game.registry.get('context').ownPieces.list().map((r: { piece: { title: string } }) => r.piece.title))).toEqual(['Door Test']);
    // Leave without saving leaves the change behind
    await openEditor(page);
    await clickNote(page, 0, 0, 'G');
    await clickToolbar(page, 'back');
    await waitForScene(page, 'editorLeave');
    await page.keyboard.press('ArrowUp');
    expect(await focusedLeave(page)).toBe('Leave without saving');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'menu');
    expect(await page.evaluate(() => window.__game.registry.get('context').ownPieces.list().length)).toBe(1);
    expectNoErrors(errors);
  });

  test('ft_1_02a.AC17 Listen ends after the last written note, not after the empty bars, and shows Listen again', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await eAndGQuarters(page);
    const listen = () => page.evaluate(() => {
      const scene = window.__game.scene.getScene('editor') as unknown as { piece: { bars: number }; player: { isPlaying: boolean; lengthMs: number }; listenButton: { options: { label: string } } | null };
      return { bars: scene.piece.bars, playing: scene.player.isPlaying, ms: scene.player.lengthMs };
    });
    await page.keyboard.press('KeyP');
    const started = await listen();
    expect(started.bars).toBeGreaterThanOrEqual(8);
    expect(started.playing).toBe(true);
    // two quarters and the last one's ring, not eight bars
    expect(started.ms).toBeLessThan(3000);
    await expect.poll(async () => (await listen()).playing, { timeout: 5000 }).toBe(false);
    expect(await sceneWords(page, 'editor')).toContain('Listen');
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC17 Ctrl + Enter at the last place of the piece adds four empty bars and goes on, one undo step with the note', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    const bars = () => page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { piece: { bars: number } }).piece.bars);
    const start = await bars();
    // the cursor to the last bar, a whole note there with Ctrl + Enter
    await page.keyboard.press('ArrowRight');
    await pressTimes(page, 'Control+ArrowRight', start - 1);
    expect((await keyState(page)).cursor).toBe(`RH:${start - 1}:0:B4`);
    await page.keyboard.press('Digit1');
    await page.keyboard.press('Control+Enter');
    expect(await notes(page)).toEqual([`${start - 1}:0:B:whole`]);
    expect(await bars()).toBe(start + 4);
    expect((await keyState(page)).cursor).toBe(`RH:${start}:0:B4`);
    // the cursor is drawn on the page of the new bar
    await page.keyboard.press('Control+Enter');
    expect(await notes(page)).toEqual([`${start - 1}:0:B:whole`, `${start}:0:B:whole`]);
    await page.keyboard.press('Control+KeyZ');
    await page.keyboard.press('Control+KeyZ');
    expect(await notes(page)).toEqual([]);
    expect(await bars()).toBe(start);
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC15 after played keys the drawn cursor stands where the next key goes', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await page.keyboard.press('ArrowRight');
    expect((await keyState(page)).cursor).toBe('RH:0:0:B4');
    await tap(page, 72);
    await page.waitForTimeout(400);
    await tap(page, 76);
    await expect.poll(() => notes(page)).toEqual(['0:0:C:quarter', '0:480:E:quarter']);
    await expect.poll(async () => (await keyState(page)).cursor).toBe('RH:0:960:E5');
    // Enter there writes after the played notes
    await page.keyboard.press('Enter');
    expect(await notes(page)).toEqual(['0:0:C:quarter', '0:480:E:quarter', '0:960:E:quarter']);
    expectNoErrors(errors);
  });

  test('ft_1_02a.AC11 ft_1_02d.AC15 Page Down puts the cursor on the first bar of the page, the strip says which page, and undo turns to the page of its change', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await clickNote(page, 0, 0, 'E');
    await page.evaluate(() => {
      const scene = window.__game.scene.getScene('editor') as unknown as {
        history: { present: { bars: number; notes: { bar: number }[] } };
        apply(edit: { ok: true; piece: unknown }, select: null): void;
      };
      const piece = scene.history.present;
      const note = piece.notes[0]!;
      scene.apply({ ok: true, piece: { ...piece, bars: 32, notes: Array.from({ length: 32 }, (_, bar) => ({ ...note, bar })) } }, null);
    });
    const state = () => page.evaluate(() => {
      type Layout = { pageCount: number; bars: { system: number }[]; systems: { page: number }[] };
      const scene = window.__game.scene.getScene('editor') as unknown as { page: number; layout: Layout };
      const first = scene.layout.bars.findIndex((b) => scene.layout.systems[b.system]!.page === scene.page);
      return { page: scene.page, pages: scene.layout.pageCount, first };
    });
    const { pages } = await state();
    expect(pages).toBeGreaterThan(1);
    expect(await sceneTexts(page, 'editor')).toContain(`page 1 of ${pages}`);
    await page.keyboard.press('PageDown');
    const second = await state();
    expect(second.page).toBe(1);
    expect((await keyState(page)).cursor).toBe(`RH:${second.first}:0:E4`);
    expect(await sceneTexts(page, 'editor')).toContain(`page 2 of ${pages}`);
    // a change on page 2, then back to page 1: undo shows page 2 again
    await page.keyboard.press('Delete');
    await page.keyboard.press('PageUp');
    expect((await state()).page).toBe(0);
    expect((await keyState(page)).cursor).toBe('RH:0:0:E4');
    await page.keyboard.press('Control+KeyZ');
    expect((await state()).page).toBe(1);
    expect(await sceneTexts(page, 'editor')).toContain(`page 2 of ${pages}`);
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC21 while the time panel is open digits, the arrows, Enter and Esc are its own and never reach the selected note', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await clickNote(page, 1, 0, 'E');
    await selectNote(page, 1, 0, 'E');
    const piece = () => page.evaluate(() => {
      const scene = window.__game.scene.getScene('editor') as unknown as { piece: { bpm?: number; pickup?: number }; panel: string | null; entry: string };
      return { bpm: scene.piece.bpm ?? null, pickup: scene.piece.pickup ?? 0, panel: scene.panel, entry: scene.entry };
    });
    await page.keyboard.press('KeyI');
    expect((await piece()).panel).toBe('time');
    // right to the pick-up: 1 is one beat; right to the tempo: 9 then 0 is 90
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Digit1');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Digit9');
    await page.keyboard.press('Digit0');
    expect(await piece()).toEqual({ bpm: 90, pickup: 1, panel: 'time', entry: 'note' });
    expect(await notes(page)).toEqual(['1:0:E:quarter']);
    // a tempo typed and Enter: set, and the panel closes
    await page.keyboard.press('Digit7');
    await page.keyboard.press('Digit5');
    await page.keyboard.press('Enter');
    expect(await piece()).toMatchObject({ bpm: 75, panel: null });
    expect(await notes(page)).toEqual(['1:0:E:quarter']);
    await page.keyboard.press('KeyI');
    await page.keyboard.press('Escape');
    expect((await piece()).panel).toBeNull();
    expect(await activeScenes(page)).toContain('editor');
    expectNoErrors(errors);
  });

  test('ft_1_02d.AC37 a paste that warned asks again after any other action in between', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await clickNote(page, 0, 0, 'E');
    await clickNote(page, 1, 0, 'G');
    await selectNote(page, 0, 0, 'E');
    await selectNote(page, 0, 0, 'E', 4, ['Shift']);
    await page.keyboard.press('Control+KeyC');
    await selectNote(page, 1, 0, 'G');
    await selectNote(page, 1, 0, 'G', 4, ['Shift']);
    await page.keyboard.press('Control+KeyV');
    expect(await status(page)).toContain('Notes this paste writes over (red): 1.');
    // another key in between (a menu opened and closed): the next paste warns again and writes nothing
    await page.keyboard.press('KeyN');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+KeyV');
    expect(await notes(page)).toEqual(['0:0:E:quarter', '1:0:G:quarter']);
    await page.keyboard.press('Control+KeyV');
    expect(await notes(page)).toEqual(['0:0:E:quarter', '1:0:E:quarter']);
    expectNoErrors(errors);
  });

  test('ft_1_02e.AC5 in vim insert mode Backspace after a rest takes the rest away', async ({ page }) => {
    const errors = await openGame(page, EDITOR);
    await openEditor(page);
    await page.keyboard.press('Control+Shift+KeyV');
    await page.keyboard.type('icr');
    const rests = () => page.evaluate(() => ((window.__game.scene.getScene('editor') as unknown as { piece: { rests?: { bar: number; start: number }[] } }).piece.rests ?? []).map((r) => `${r.bar}:${r.start}`));
    expect(await rests()).toEqual(['0:480']);
    await page.keyboard.press('Backspace');
    expect(await rests()).toEqual([]);
    expect(await notes(page)).toHaveLength(1);
    expect((await keyState(page)).cursor).toMatch(/^RH:0:480:/);
    await page.keyboard.press('Backspace');
    expect(await notes(page)).toEqual([]);
    expectNoErrors(errors);
  });
});
