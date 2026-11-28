// Covers ft_1_39.AC1, ft_1_39.AC3, ft_1_39.AC5.
// The stand opens the lesson book: every catalog topic by area, the written lessons pressable, the rest ghosted. A lesson
// runs its six steps on the keys: Kiur's show, copy, pitfall, try until a clean run, the tune, the check and its medal.
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { clickButton, expectNoErrors, openFromStand, openGame, profileButton, sceneButton, sceneTexts, totalXp, waitForScene } from './helpers';

type Run = { step(): string; current(): { shown: number[]; answer: number[]; played: number } | null; medal(): string | null };
const run = (page: Page) => page.evaluate(() => {
  const r = (window.__game.scene.getScene('lesson') as unknown as { run: Run }).run;
  return { step: r.step(), current: r.current(), medal: r.medal() };
});
const press = (page: Page, midi: number) => page.evaluate((m) => {
  window.__virtualDevice!.press(m, 80);
  window.__virtualDevice!.release(m);
}, midi);
/** Plays the rest of the current item right. */
async function playItem(page: Page): Promise<void> {
  const { current } = await run(page);
  for (const midi of current!.answer.slice(current!.played)) await press(page, midi);
}
const shot = async (page: Page, name: string) => {
  if (process.env.LESSON_SHOTS) await page.screenshot({ path: `${process.env.LESSON_SHOTS}/${name}.png` });
};

const openBook = async (page: Page) => {
  const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
  await clickButton(page, 'profiles', await profileButton(page, 'TUVI'));
  await waitForScene(page, 'profile');
  await openFromStand(page, 'Lessons');
  await waitForScene(page, 'lessonBook');
  return errors;
};

test.describe('theory lessons (ft_1_39)', () => {
  test('ft_1_39.AC1 the book lists every topic of the open areas; a placeholder says not yet; Right turns the page', async ({ page }) => {
    const errors = await openBook(page);
    const texts = await sceneTexts(page, 'lessonBook');
    expect(texts).toEqual(expect.arrayContaining(['Half steps', 'Whole steps', 'Next']));
    await shot(page, 'book');
    await clickButton(page, 'lessonBook', await sceneButton(page, 'lessonBook', 'Whole steps'));
    await waitForScene(page, 'lesson');
    await page.keyboard.press('Escape');
    await waitForScene(page, 'lessonBook');
    // a placeholder of area D
    await clickButton(page, 'lessonBook', await sceneButton(page, 'lessonBook', 'Sharps, flats and naturals'));
    await expect.poll(() => sceneTexts(page, 'lessonBook')).toContain('Not written yet');
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => sceneTexts(page, 'lessonBook')).not.toContain('Half steps');
    expectNoErrors(errors);
  });

  test('ft_1_39.AC3 ft_1_39.AC5 Enter opens the suggested lesson; its six steps run on the keys and end with a medal and XP', async ({ page }) => {
    const errors = await openBook(page);
    await page.keyboard.press('Enter');
    await waitForScene(page, 'lesson');
    await page.waitForTimeout(1500);
    await shot(page, 'show');
    await expect.poll(async () => (await run(page)).step, { timeout: 10_000 }).toBe('copy');
    const before = await totalXp(page);
    await shot(page, 'copy');
    await playItem(page);
    await expect.poll(async () => (await run(page)).step).toBe('pitfall');
    await shot(page, 'pitfall');
    await playItem(page);
    await expect.poll(async () => (await run(page)).step).toBe('try');
    const awaited = (await run(page)).current!.answer[0]!;
    // the neighbour key: the pitfall's reason brings its card back, the step drawn as keys (d312)
    await press(page, awaited + 1);
    await expect.poll(() => page.evaluate(() => {
      type Node = { name?: string; visible: boolean; list?: Node[] };
      const has = (nodes: Node[]): boolean => nodes.some((o) => o.visible && (o.name === 'pitfallKeys' || (o.list !== undefined && has(o.list))));
      return has(window.__game.scene.getScene('lesson').children.list as unknown as Node[]);
    })).toBe(true);
    await shot(page, 'try-pitfall-card');
    while ((await run(page)).step === 'try') await playItem(page);
    await shot(page, 'play-along');
    await playItem(page);
    await expect.poll(async () => (await run(page)).step).toBe('check');
    await shot(page, 'check');
    while ((await run(page)).step === 'check') await playItem(page);
    await expect.poll(async () => (await run(page)).medal).toBe('gold');
    expect(await sceneTexts(page, 'lesson')).toContain('8/8');
    await shot(page, 'done');
    expect(await totalXp(page)).toBeGreaterThan(before);
    expectNoErrors(errors);
  });
});
