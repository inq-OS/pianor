// Covers core_13.AC1, core_13.AC2, core_13.AC5, core_13.AC6, core_13.AC7, core_13.AC8, core_13.AC9.
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { bubbleOpen, clickButton, expectNoErrors, lastButton, openGame, openPiece, pressInBubble, pressPracticeButton as press, sceneButton, sceneTexts, waitForScene } from './helpers';

/** The beat lane on the staff (core_13 rule 2): its dots on the page, how many the wave lifts now, how many keys are coloured. */
const lane = (page: Page) => page.evaluate(() => {
  const scene = window.__game.scene.getScene('practice') as unknown as { playSession: { staffView: { laneShown(): { dots: number; lifted: number; coloured: number } } | null } };
  return scene.playSession.staffView?.laneShown() ?? { dots: 0, lifted: 0, coloured: 0 };
});
const running = (page: Page) => page.evaluate(() => window.__game.registry.get('context').audio.metronome.running as boolean);

/** Where the lane's wave is now (a drawn tick), null with none. */
const waveAt = (page: Page) => page.evaluate(() => {
  const view = (window.__game.scene.getScene('practice') as unknown as { playSession: { staffView: { laneWave: number | null; clickWave?: number | null } | null } }).playSession.staffView;
  return view ? (view.clickWave !== undefined ? view.clickWave : view.laneWave) : null;
});
/** Mark the learning run on the practice screen, and whether the one there now is the one marked (a new step starts a new run). */
const markRun = (page: Page) => page.evaluate(() => { (window.__game.scene.getScene('practice') as unknown as { learn: { marked?: boolean } }).learn.marked = true; });
const sameRun = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { learn: { marked?: boolean } | null }).learn?.marked === true);

/** Kiur's Learn in the room, then the piece: its learning run on the practice screen. */
async function learnPiece(page: Page, title: string): Promise<void> {
  await page.evaluate(() => {
    window.__game.scene.stop('menu');
    window.__game.scene.start('profile');
  });
  await waitForScene(page, 'profile');
  await expect.poll(() => sceneButton(page, 'profile', 'Kiur')).toBeGreaterThanOrEqual(0);
  await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Kiur'));
  await expect.poll(() => sceneButton(page, 'profile', 'Learn')).toBeGreaterThanOrEqual(0);
  await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Learn'));
  await waitForScene(page, 'menu');
  await openPiece(page, title);
}

/** Press keys of the virtual EZ-220 one at a time, `gapMs` apart. */
async function keysApart(page: Page, midis: number[], gapMs: number): Promise<void> {
  for (const [i, midi] of midis.entries()) {
    if (i > 0) await page.waitForTimeout(gapMs);
    await page.evaluate((m) => { window.__virtualDevice!.press(m, 80); window.__virtualDevice!.release(m); }, midi);
  }
}

test.describe('the beat lane (core_13)', () => {
  test('core_13.AC1 core_13.AC7 a row of dots runs above a one-hand staff, clear of the notes, and a wave runs along it while the click runs', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    expect((await lane(page)).dots).toBeGreaterThan(16);
    expect((await lane(page)).lifted).toBe(0); // Wait mode with no click: no wave
    const place = await page.evaluate(() => {
      const scene = window.__game.scene.getScene('practice') as unknown as { playSession: { layout: { notes: { y: number; headRy: number; system: number }[]; systems: { topLineY: number }[] } } };
      const layout = scene.playSession.layout;
      return { top: layout.systems[0]!.topLineY, highest: Math.min(...layout.notes.filter((n) => n.system === 0).map((n) => n.y - n.headRy)) };
    });
    expect(place.highest).toBeGreaterThan(place.top - 1); // the piece's notes sit on the staff: the lane above is clear of them
    await press(page, 'Click');
    await expect.poll(() => running(page)).toBe(true);
    await keysApart(page, [60], 0);
    await expect.poll(async () => (await lane(page)).lifted, { timeout: 4000 }).toBeGreaterThan(0);
    expectNoErrors(errors);
  });

  test('core_13.AC5 core_13.AC6 in a learning run the wave follows the student\'s own pace and each key keeps a colour; the click at that pace only when turned on', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual&learn=1');
    await learnPiece(page, 'Little Steps');
    expect(await lane(page)).toMatchObject({ lifted: 0, coloured: 0 });
    await keysApart(page, [60, 62, 64], 400);
    // three keys: a pace of the student's own, the wave running on from the last key, the keys coloured against that pace
    await expect.poll(async () => (await lane(page)).coloured).toBeGreaterThan(0);
    await expect.poll(async () => (await lane(page)).lifted).toBeGreaterThan(0);
    expect(await running(page)).toBe(false); // no click while learning unless turned on (ft_1_32 rule 8)
    expectNoErrors(errors);
  });

  test('core_13.AC6 turned on, a learning run clicks at the student\'s pace once three keys are played', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual&learn=1');
    await page.evaluate(() => window.__game.registry.get('context').profiles.updateLearnSettings({ paceClick: true }));
    await learnPiece(page, 'Little Steps');
    await keysApart(page, [60, 62], 400);
    expect(await running(page)).toBe(false); // no pace yet
    await keysApart(page, [64], 0);
    await expect.poll(() => running(page)).toBe(true);
    expectNoErrors(errors);
  });

  test('core_13.AC1 core_13.AC5 with the click off the wave runs at the student\'s own pace from the first key, and each key keeps a colour', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    expect(await running(page)).toBe(false);
    expect((await lane(page)).lifted).toBe(0); // no key yet: no wave
    await keysApart(page, [60], 0);
    // the wave leaves the first key at the tempo the click would have, and runs on
    const first = await waveAt(page);
    await expect.poll(async () => (await waveAt(page)) ?? 0, { timeout: 4000 }).toBeGreaterThan((first ?? 0) + 100);
    await keysApart(page, [62, 64], 450);
    await expect.poll(async () => (await lane(page)).coloured).toBeGreaterThan(0);
    expect(await running(page)).toBe(false); // the wave, not the click
    expectNoErrors(errors);
  });

  test('core_13.AC5 in a learning run the next step\'s wave runs from its first key, at the pace of the step before', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual&learn=1');
    await learnPiece(page, 'Little Steps');
    await markRun(page);
    // the first step, bar 1, played evenly
    await keysApart(page, [60, 62, 64, 65], 450);
    await expect.poll(() => sameRun(page), { timeout: 8000 }).toBe(false);
    await expect.poll(() => page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { learn: { carriedBpm: number | null } }).learn.carriedBpm)).toBeGreaterThan(0);
    // one key of the next step: the wave runs on from it before the step has a pace of its own
    const midi = await page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { playSession: { chart: { notes: { midi: number }[] } } }).playSession.chart.notes[0]!.midi);
    await expect.poll(async () => { await keysApart(page, [midi], 0); return (await lane(page)).lifted; }, { timeout: 6000 }).toBeGreaterThan(0);
    expectNoErrors(errors);
  });

  test('core_13.AC8 the practice screen\'s bubble opens the beat dots\' tuning over the piece, and the piece goes on after it', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await keysApart(page, [60], 0);
    await pressInBubble(page, 'practice', 'Beat dots');
    await waitForScene(page, 'beat-lanes');
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key))).not.toContain('practice'); // paused under it
    await page.keyboard.press('Escape');
    await waitForScene(page, 'practice');
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key))).not.toContain('beat-lanes');
    // the piece goes on where it was: the next key is the second note
    await keysApart(page, [62], 0);
    await expect.poll(() => page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { playSession: { getState(): { stepIndex: number } } }).playSession.getState().stepIndex)).toBe(2);
    expectNoErrors(errors);
  });

  test('core_13.AC9 a lane set to follow the click runs on the metronome\'s beats before any key, in the bar of the next note', async ({ page }) => {
    const errors = await openGame(page);
    await page.evaluate(() => window.__game.registry.get('context').profiles.updateLearnSettings({
      beatLanes: [{ place: 'above', offset: 0, dots: { ghost: 1, beat: 1, top: 1, bottom: 1 }, wave: { height: 0.8, reach: 0.25 }, follow: 'click' }],
    }));
    await openPiece(page, 'Little Steps');
    await press(page, 'Click');
    await expect.poll(() => running(page)).toBe(true);
    // no key played: a lane that follows the student would stand still, this one runs with the click
    const seen = new Set<number>();
    await expect.poll(async () => { const w = await waveAt(page); if (w !== null) seen.add(Math.round(w / 240)); return seen.size; }, { timeout: 6000 }).toBeGreaterThan(2);
    expect(Math.max(...[...seen].map((q) => q * 240))).toBeLessThanOrEqual(1920); // within the first bar, where the next note is
    expectNoErrors(errors);
  });

  test('core_13.AC2 turned off in the settings, the lane is not drawn', async ({ page }) => {
    const errors = await openGame(page);
    await page.evaluate(() => window.__game.registry.get('context').profiles.updateLearnSettings({ beatLane: 'off' }));
    await openPiece(page, 'Little Steps');
    await press(page, 'Click');
    await expect.poll(() => running(page)).toBe(true);
    expect((await lane(page)).dots).toBe(0);
    expectNoErrors(errors);
  });
});

test.describe('tuning the beat lanes (core_13 rule 10)', () => {
  const lanesScene = (page: Page) => page.evaluate(() => {
    const scene = window.__game.scene.getScene('beat-lanes') as unknown as { view: { laneShown(): { lanes: number; dots: number; lifted: number; blinking: number } } | null; laneYs(): number[] };
    return { shown: scene.view?.laneShown() ?? null, ys: scene.laneYs() };
  });

  /** Game pixels to the page's: the canvas may be drawn at another size than the game's. */
  const toPage = async (page: Page) => {
    const box = (await page.locator('canvas').first().boundingBox())!;
    const k = await page.evaluate((w) => w / (window.__game as unknown as { scale: { width: number } }).scale.width, box.width);
    return (x: number, y: number) => ({ x: box.x + x * k, y: box.y + y * k });
  };
  const staffTop = (page: Page) => page.evaluate(() => {
    const s = window.__game.scene.getScene('beat-lanes') as unknown as { layout: { staffSpace: number; systems: { topLineY: number }[] }; view: { origin: { y: number } } };
    return { top: s.view.origin.y + s.layout.systems[0]!.topLineY, S: s.layout.staffSpace };
  });
  const saved = (page: Page) => page.evaluate(() => window.__game.registry.get('context').profiles.learnSettings.beatLanes as { place: string; offset: number; wave: { height: number }; blink?: boolean }[] | undefined);

  test('core_13.AC8 the beat dots button opens a page with a running preview and says how it is used; a click on the staff adds a row there, and a row dragged stays where it is dropped', async ({ page }) => {
    const errors = await openGame(page);
    await page.evaluate(() => { window.__game.scene.stop('menu'); window.__game.scene.start('settings', { page: 1 }); });
    await waitForScene(page, 'settings');
    await clickButton(page, 'settings', await sceneButton(page, 'settings', 'Tune the beat dots: which dots, the wave, and where they run'));
    await waitForScene(page, 'beat-lanes');
    await expect.poll(async () => (await lanesScene(page)).shown?.lanes).toBe(1);
    await expect.poll(async () => (await lanesScene(page)).shown?.lifted ?? 0).toBeGreaterThan(0); // the wave runs on the preview
    // the page says how it is used, at the sheet's foot
    expect((await sceneTexts(page, 'beat-lanes')).join(' ')).toContain('Click the staff to add a row of dots');
    const at = await toPage(page);
    // a click over the staff, away from the row between the staves, adds a row there
    const { top, S } = await staffTop(page);
    const click = at(400, top - 2 * S);
    await page.mouse.move(click.x, click.y);
    await expect.poll(async () => (await lanesScene(page)).shown?.lanes).toBe(2); // the row it would add shows faintly first
    await page.mouse.click(click.x, click.y);
    await expect.poll(async () => (await saved(page))?.length).toBe(2);
    expect((await saved(page))![1]!.place).toBe('above');
    // drag the new row down a little
    const [, above] = (await lanesScene(page)).ys;
    const from = at(600, above!);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y + 30, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => (await lanesScene(page)).ys[1]).toBeGreaterThan(above!);
    await expect.poll(async () => (await saved(page))?.length).toBe(2); // a drag adds no row
    expectNoErrors(errors);
  });

  test('core_13.AC8 a right click on a row opens its bubble: a slider dragged shows the wave as it goes and keeps it when let go, and the blink lights the notes', async ({ page }) => {
    const errors = await openGame(page);
    await page.evaluate(() => { window.__game.scene.stop('menu'); window.__game.scene.start('beat-lanes', {}); });
    await waitForScene(page, 'beat-lanes');
    await expect.poll(async () => (await lanesScene(page)).shown?.lanes).toBe(1);
    const at = await toPage(page);
    const [between] = (await lanesScene(page)).ys;
    const lane = at(500, between!);
    await page.mouse.click(lane.x, lane.y, { button: 'right' });
    await expect.poll(() => bubbleOpen(page, 'beat-lanes')).toBe(true);
    await clickButton(page, 'beat-lanes', await lastButton(page, 'beat-lanes', 'How high the wave lifts the dots'));
    await expect.poll(() => page.evaluate(() => {
      const s = window.__game.scene.getScene('beat-lanes') as unknown as { menu: { slider?: object; buttons: { options: { label: string } }[] } | null };
      return s.menu ? (s.menu.slider ? 'slider' : s.menu.buttons.map((b) => b.options.label).join('|')) : 'closed';
    })).toBe('slider');
    const arc = await page.evaluate(() => {
      const s = window.__game.scene.getScene('beat-lanes') as unknown as { menu: { slider?: { arc: { centre: { x: number; y: number }; radius: number; from: number; to: number } } } | null; root: { x: number; y: number }; px: { scale: number } };
      const a = s.menu?.slider?.arc;
      if (!a) return null;
      const point = (f: number) => {
        const t = a.from + f * (a.to - a.from);
        return { x: s.root.x + (a.centre.x + a.radius * Math.cos(t)) * s.px.scale, y: s.root.y + (a.centre.y + a.radius * Math.sin(t)) * s.px.scale };
      };
      return [point(0.53), point(1)];
    });
    expect(arc).not.toBeNull();
    const [middle, end] = [at(arc![0]!.x, arc![0]!.y), at(arc![1]!.x, arc![1]!.y)];
    await page.mouse.move(middle.x, middle.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 6 });
    // while held nothing is kept yet
    expect((await saved(page))?.[0]?.wave.height ?? 0.8).toBe(0.8);
    await page.mouse.up();
    await expect.poll(async () => (await saved(page))?.[0]?.wave.height).toBe(1.5);
    expect(await bubbleOpen(page, 'beat-lanes')).toBe(true); // the slider stays open for another try
    // the arrow keys move it a step at a time
    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => (await saved(page))?.[0]?.wave.height).toBe(1.4);
    await page.keyboard.press('Escape');
    await expect.poll(() => bubbleOpen(page, 'beat-lanes')).toBe(false);
    // the blink, on the lane's bubble
    await page.mouse.click(lane.x, lane.y, { button: 'right' });
    await expect.poll(() => bubbleOpen(page, 'beat-lanes')).toBe(true);
    await expect.poll(() => lastButton(page, 'beat-lanes', 'Notes light up as the wave passes')).toBeGreaterThanOrEqual(0);
    await clickButton(page, 'beat-lanes', await lastButton(page, 'beat-lanes', 'Notes light up as the wave passes'));
    await expect.poll(async () => (await saved(page))?.[0]?.blink).toBe(true);
    await expect.poll(async () => (await lanesScene(page)).shown?.blinking ?? 0).toBeGreaterThan(0);
    expectNoErrors(errors);
  });
});
