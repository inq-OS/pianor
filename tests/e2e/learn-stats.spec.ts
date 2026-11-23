// Covers ft_1_32.AC9, ft_1_32.AC10.
import { expect, test, type Page } from '@playwright/test';
import { clickButton, expectNoErrors, openGame, sceneTexts, showMenuPageWith, waitForScene, stripAction } from './helpers';

/** Give the active player measured runs of Little Steps over three days: uneven with stops at first, even at the end. */
async function seedRuns(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const today = new Date();
    const day = (back: number) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const run = (back: number, kind: 'confirm' | 'join' | 'whole', bpm: number, sd: number, halts: number, bars: number[], hands: { RH: number; LH: number }) => ({
      day: day(back), step: 4, bpm, sd, mad: Math.min(sd, 24), drift: halts > 0 ? -14 : 2, halts, steady: halts === 0 && sd < 20, kind, firstBar: 0, bars, hands,
    });
    await window.__game.registry.get('context').profiles.saveLearnProgress('little-steps', {
      step: 5, wholeStreak: 0, recall: false, confirm: false, misses: 0, medals: ['gold', 'gold', 'silver', 'gold', 'gold'], lastDay: day(0), bpm: [58, 62, 66],
      tests: [
        run(9, 'confirm', 50, 96, 2, [100, 100, 230, 100], { RH: 10, LH: 30 }),
        run(2, 'confirm', 52, 60, 1, [100, 100, 190, 100], { RH: 10, LH: 26 }),
        run(2, 'confirm', 55, 34, 0, [100, 104, 150, 100], { RH: 9, LH: 22 }),
        run(1, 'confirm', 58, 14, 0, [100, 100, 130, 100], { RH: 8, LH: 20 }),
        run(0, 'confirm', 62, 11, 0, [100, 100, 140, 100], { RH: 8, LH: 19 }),
        run(0, 'whole', 66, 8, 0, [100, 100, 135, 100], { RH: 7, LH: 18 }),
      ],
    });
  });
}

const shown = (page: Page) =>
  page.evaluate(() => {
    const scene = window.__game.scene.getScene('learn-stats') as unknown as {
      graph: { shown: number; total: number; trend: unknown; referenceY: number | null; lines: { value: number }[]; points: { y2: number | null }[] } | null;
      strip: { shade: number | null }[];
      focus: { kind: string }[];
    };
    return {
      graph: scene.graph && { shown: scene.graph.shown, trend: scene.graph.trend !== null, reference: scene.graph.referenceY !== null, scale: scene.graph.lines.map((l) => l.value), rings: scene.graph.points.filter((p) => p.y2 !== null).length },
      strip: scene.strip.map((cell) => cell.shade),
      focus: scene.focus.map((f) => f.kind),
    };
  });

async function press(page: Page, label: string): Promise<void> {
  const index = await page.evaluate((l) => (window.__game.scene.getScene('learn-stats').buttons as { options: { label: string } }[]).findIndex((b) => b.options.label === l), label);
  expect(index, `button ${label}`).toBeGreaterThanOrEqual(0);
  await clickButton(page, 'learn-stats', index);
}

async function openLearnStats(page: Page): Promise<void> {
  await showMenuPageWith(page, 'Little Steps');
  const point = await page.evaluate(() => {
    const c = window.__game.scene.getScene('menu').statsButtons.get('little-steps')!.screenCenter();
    const canvas = document.querySelector('canvas')!;
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (c.x / canvas.width) * r.width, y: r.top + (c.y / canvas.height) * r.height };
  });
  await page.mouse.click(point.x, point.y);
  await waitForScene(page, 'results');
  await clickButton(page, 'results', await stripAction(page, 'results', 2)); // Learning tempo
  await waitForScene(page, 'learn-stats');
}

test.describe('the learning stats of a piece (ft_1_32)', () => {
  test('ft_1_32.AC9 every measure has its graph, the filters narrow the runs, and the bars show where the pace drops', async ({ page }) => {
    const errors = await openGame(page);
    await seedRuns(page);
    await openLearnStats(page);
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/learn-stats-tempo.png` });

    // the tempo first: all six runs, the baseline as a line, a trend, and the slow third bar tinted
    expect(await sceneTexts(page, 'learn-stats')).toEqual(expect.arrayContaining(['Little Steps: own tempo 60', 'Latest 66, trend +3.2']));
    let now = await shown(page);
    expect(now.graph).toMatchObject({ shown: 6, trend: true, reference: true });
    expect(now.strip).toEqual([0, 0, 3, 0]);

    // another measure: the spread, from zero, no baseline line
    await press(page, 'Spread');
    now = await shown(page);
    expect(now.graph).toMatchObject({ shown: 6, reference: false });
    expect(now.graph!.scale[0]).toBe(0);
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/learn-stats-spread.png` });

    // the hands: the left hand as a second mark on every run
    await press(page, 'Hands');
    expect((await shown(page)).graph).toMatchObject({ shown: 6, rings: 6 });
    expect(await sceneTexts(page, 'learn-stats')).toContain('Right 7%, left 18%');
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/learn-stats-hands.png` });

    // the filters step through their choices: the whole-piece test alone, then the last seven days of every test, then today
    await press(page, 'Tests: all');
    await press(page, 'Tests: chunks');
    await press(page, 'Tests: joins');
    expect((await shown(page)).graph).toMatchObject({ shown: 1 });
    await press(page, 'Tests: whole');
    await press(page, 'Days: all');
    expect((await shown(page)).graph).toMatchObject({ shown: 5 });
    await press(page, 'Days: 7');
    expect((await shown(page)).graph).toMatchObject({ shown: 2 });

    // no run for a choice says so, and Back returns to the piece's stats page
    await press(page, 'Tests: all');
    await press(page, 'Tests: chunks');
    expect((await shown(page)).graph).toMatchObject({ shown: 0 });
    expect(await sceneTexts(page, 'learn-stats')).toContain('No tests for this choice yet');
    await page.keyboard.press('Escape');
    await waitForScene(page, 'results');
    expectNoErrors(errors);
  });

  test('ft_1_32.AC10 the ? opens the pages in words: what to work on by the latest runs, then what each number means', async ({ page }) => {
    const errors = await openGame(page);
    await seedRuns(page);
    await openLearnStats(page);
    await press(page, '?');
    let texts = await sceneTexts(page, 'learn-stats');
    expect(texts).toContain('What to work on');
    // the latest three runs: no stop, the third bar slow, the left hand the uneven one
    expect((await shown(page)).focus).toEqual(['slowBar', 'hand']);
    expect(texts).toEqual(expect.arrayContaining([
      'Bar 3 takes 135% of the time it should. Practice it alone until it keeps up with the rest.',
      'The left hand wobbles more (19%) than the right (8%). Play the left hand alone.',
    ]));
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/learn-stats-focus.png` });

    await press(page, '>');
    texts = await sceneTexts(page, 'learn-stats');
    expect(texts).toContain('What the numbers mean');
    expect(texts.some((text) => text.startsWith('Tempo: the speed the player chose'))).toBe(true);
    expect(texts.some((text) => text.startsWith('Spread: how far the gaps'))).toBe(true);
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/learn-stats-meaning.png` });
    for (let i = 0; i < 3; i++) await press(page, '>');
    expect((await sceneTexts(page, 'learn-stats')).some((text) => text.startsWith('Bars: the speed of each bar'))).toBe(true);

    // Esc leaves the pages for the graph, and again for the piece's stats page
    await page.keyboard.press('Escape');
    expect((await shown(page)).graph).not.toBeNull();
    await page.keyboard.press('Escape');
    await waitForScene(page, 'results');
    expectNoErrors(errors);
  });
});
