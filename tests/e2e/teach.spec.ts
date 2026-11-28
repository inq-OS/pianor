// Covers ft_1_22.AC3 (Puuvaim teaches his phrase in the knoll: on the staff, three tries, heard or not yet; with learning off)
// and ft_1_32.AC15 (with learning on, his teaching is learning bar by bar, and back to the knoll).
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { activeScenes, clickButton, expectNoErrors, letGameRun, openGame, playWithVirtualPiano, sceneButton, waitForScene, type PageErrors } from './helpers';

interface TalkState { showing: 'line' | 'student' | 'choices'; node: string }
interface Teach { who: 'character' | 'student' | null; piece: string; level: number; tries: boolean[]; outcome?: 'heard' | 'notYet'; saying: string | null; closing: boolean; staff: boolean; notFirst: number[] }

const knoll = 'knoll';
const teach = (page: Page) => page.evaluate((k) => (window.__game.scene.getScene(k) as unknown as { teachState: Teach | null }).teachState, knoll);
const talk = (page: Page) => page.evaluate((k) => (window.__game.scene.getScene(k) as unknown as { talkState: TalkState | null }).talkState, knoll);
const endPhrase = (page: Page) => page.evaluate((k) => (window.__game.scene.getScene(k) as unknown as { endTugPhrase(): void }).endTugPhrase(), knoll);
const taughtOn = (page: Page) => page.evaluate(async () => {
  const { profiles } = window.__game.registry.get('context');
  const world = (await profiles.worldOf(profiles.profile.id)) as { met: Record<string, { taughtOn?: Record<string, string> }> };
  return world.met['puuvaim']?.taughtOn ?? null;
});

const taught = (page: Page) => page.evaluate(async () => {
  const { profiles } = window.__game.registry.get('context');
  const world = (await profiles.worldOf(profiles.profile.id)) as { met: Record<string, { taught: string[] }> };
  return world.met['puuvaim']?.taught ?? null;
});

/** The oak spirit's first piece, `both-hands`, its keys in order (a chord as the right hand's key, then the left's). */
const TUNE = [60, 48, 64, 67, 52, 55, 65, 55, 62, 60, 48, 64, 48, 67, 55, 67, 52, 64, 48, 65, 55, 64, 62, 60, 60, 48];
/** Thirteen notes right first try of twenty-six (under level 1's 60 per cent): the first thirteen each after a wrong key. */
const MISSED = [...TUNE.slice(0, 13).flatMap((n) => [61, n]), ...TUNE.slice(13)];

/** The knoll with Puuvaim standing (`?actors=1`), his talk opened and "Teach me a tune!" picked. */
async function openTeach(page: Page, learn = false): Promise<PageErrors> {
  const errors = await openGame(page, `?device=virtual&actors=1${learn ? '&learn=1' : ''}`);
  await page.evaluate((k) => {
    window.__game.scene.stop('menu');
    window.__game.scene.start(k);
  }, knoll);
  await waitForScene(page, knoll);
  await letGameRun(page, 3, 50);
  expect(await page.evaluate((k) => (window.__game.scene.getScene(k) as unknown as { talkTo(id: string): Promise<boolean> }).talkTo('puuvaim'), knoll)).toBe(true);
  for (let i = 0; i < 12 && (await talk(page))?.showing !== 'choices'; i++) await page.keyboard.press('Space');
  await page.keyboard.press('2'); // "Teach me a tune!" (after "Who are you?", ft_1_22.AC10)
  for (let i = 0; i < 6 && (await activeScenes(page)).includes(knoll) && (await talk(page)) !== null; i++) await page.keyboard.press('Space');
  if (!learn) expect(await talk(page)).toBeNull();
  return errors;
}

/** One try: his playing cut short, then the student's notes; the view after the fact on it. */
async function tryIt(page: Page, notes: number[]): Promise<Teach> {
  await expect.poll(async () => (await teach(page))?.who).toBe('character');
  await endPhrase(page);
  await expect.poll(async () => (await teach(page))?.who).toBe('student');
  await playWithVirtualPiano(page, notes);
  await expect.poll(async () => (await teach(page))?.saying ?? null).not.toBeNull();
  return (await teach(page))!;
}

test.describe('Puuvaim teaches his phrase in the knoll (ft_1_22.AC3, WP-12)', () => {
  test('ft_1_22.AC3 he plays it with the staff shown; a missed try, then one that passes: the phrase is heard and kept with him', async ({ page }) => {
    const errors = await openTeach(page);
    expect(await teach(page)).toMatchObject({ who: 'character', piece: 'both-hands', level: 1, tries: [], staff: true });
    // the fact names the first wrong key's reason (C sharp for C: the key next door)
    const missed = await tryIt(page, MISSED);
    expect(missed).toMatchObject({ tries: [false], saying: '13 of 26 notes right. You played the key next door' });
    // the staff marks the thirteen notes found only after a wrong key, not every note as right
    expect(missed.notFirst).toHaveLength(13);
    expect(await tryIt(page, TUNE)).toMatchObject({ tries: [false, true], outcome: 'heard', saying: '26 of 26 notes right' });
    await expect.poll(async () => (await teach(page))?.saying).toContain('You played my tune');
    expect((await teach(page))!.staff).toBe(false);
    await page.keyboard.press('Space');
    await expect.poll(() => teach(page)).toBeNull();
    await expect.poll(() => taught(page)).toEqual(['both-hands']);
    // the day it was taught is kept: heard becomes mine on a later day (ft_1_22.AC5)
    expect(Object.keys((await taughtOn(page)) ?? {})).toEqual(['both-hands']);
    expect(await activeScenes(page)).toContain(knoll);
    expectNoErrors(errors);
  });

  test('ft_1_22.AC3 three missed tries: not yet, nothing kept and nothing lost', async ({ page }) => {
    const errors = await openTeach(page);
    for (let i = 0; i < 3; i++) await tryIt(page, MISSED);
    await expect.poll(async () => (await teach(page))?.outcome).toBe('notYet');
    await expect.poll(async () => (await teach(page))?.saying).toBe('Not yet: 13 of 26 notes right. Practice it in your room, then come back.');
    await page.keyboard.press('Space');
    await expect.poll(() => teach(page)).toBeNull();
    expect(await taught(page)).toEqual([]);
    expectNoErrors(errors);
  });

  test('the corner Back is pressable over the teaching and leaves it as Esc does, with nothing kept', async ({ page }) => {
    const errors = await openTeach(page);
    await expect.poll(async () => (await teach(page))?.who).toBe('character');
    await endPhrase(page);
    await expect.poll(async () => (await teach(page))?.who).toBe('student');
    await clickButton(page, knoll, await sceneButton(page, knoll, 'Back'));
    await expect.poll(() => teach(page)).toBeNull();
    expect(await activeScenes(page)).toContain(knoll);
    expect(await taught(page)).toEqual([]);
    expectNoErrors(errors);
  });

  test('a try with no note played for a while: he says once whose turn it is, and the first note ends the line', async ({ page }) => {
    const errors = await openTeach(page);
    await expect.poll(async () => (await teach(page))?.who).toBe('character');
    await endPhrase(page);
    await expect.poll(async () => (await teach(page))?.who).toBe('student');
    expect((await teach(page))!.saying).toBeNull();
    // the scene's clock runs fast, so the twenty seconds pass in one
    await page.evaluate((k) => { (window.__game.scene.getScene(k) as unknown as { time: { timeScale: number } }).time.timeScale = 40; }, knoll);
    await expect.poll(async () => (await teach(page))?.saying, { timeout: 10_000 }).toBe('Your turn: play my line.');
    await playWithVirtualPiano(page, [TUNE[0]!]);
    await expect.poll(async () => (await teach(page))?.saying).toBeNull();
    expectNoErrors(errors);
  });

  test('Esc leaves the teaching in the scene, with nothing kept', async ({ page }) => {
    const errors = await openTeach(page);
    await expect.poll(async () => (await teach(page))?.who).toBe('character');
    await page.keyboard.press('Escape');
    await expect.poll(() => teach(page)).toBeNull();
    expect(await activeScenes(page)).toContain(knoll);
    expect(await taught(page)).toEqual([]);
    expectNoErrors(errors);
  });
});

test.describe('Puuvaim teaches his phrase bar by bar (ft_1_32.AC15)', () => {
  const learning = (page: Page) => page.evaluate(() => {
    const scene = window.__game.scene.getScene('practice') as unknown as { learn: { run: { firstBar: number } } | null; chart: { id: string } };
    return { piece: scene.chart.id, first: scene.learn?.run.firstBar ?? null };
  });

  test('ft_1_32.AC15 "Teach me" opens his piece in learning bar by bar, and Back returns to the knoll', async ({ page }) => {
    const errors = await openTeach(page, true);
    await waitForScene(page, 'practice');
    expect(await learning(page)).toEqual({ piece: 'both-hands#bars-1-1', first: 0 });
    await page.keyboard.press('Escape');
    await waitForScene(page, knoll);
    expect(await activeScenes(page)).not.toContain('practice');
    expect(await taught(page)).toEqual([]);
    expectNoErrors(errors);
  });

  test('ft_1_32.AC15 his piece once learned is kept as taught when the knoll opens again', async ({ page }) => {
    const errors = await openTeach(page, true);
    await waitForScene(page, 'practice');
    await page.evaluate(() => window.__game.registry.get('context').profiles.saveLearnProgress('both-hands', {
      step: 999, wholeStreak: 0, recall: false, confirm: false, misses: 0, medals: [], lastDay: '1998-11-21', stepBars: 1, handsApart: true,
    }));
    await page.keyboard.press('Escape');
    await waitForScene(page, knoll);
    await expect.poll(() => taught(page)).toEqual(['both-hands']);
    expectNoErrors(errors);
  });
});
