import { expect, test, type Page } from '@playwright/test';
import { clickButton, expectNoErrors, openGame, playWithVirtualPiano, sceneButton, waitForScene, type PageErrors } from './helpers';

/** What the intro's spotlight shows now (`IntroScene.showing`), or null while it is not up. */
interface Showing { opening: number; step: number; page: number; text: string; spot: { x: number; y: number; w: number; h: number } | null }
const showing = (page: Page) => page.evaluate(() => {
  const g = window.__game;
  if (!g.scene.getScenes(true).some((s) => s.scene.key === 'intro')) return null;
  return (g.scene.getScene('intro') as unknown as { showing: Showing | null }).showing;
});
const room = <T>(page: Page, field: string) => page.evaluate((f) => (window.__game.scene.getScene('profile') as unknown as Record<string, unknown>)[f], field) as Promise<T>;
const roomTalk = (page: Page) => room<{ who: string; text: string } | null>(page, 'talkState');
const roomTug = (page: Page) => room<{ who: string | null; outcome: string | null; saying: string | null; closing: boolean } | null>(page, 'tugState');
const flags = (page: Page) => page.evaluate(async () => {
  const { profiles } = window.__game.registry.get('context');
  return ((await profiles.worldOf(profiles.profile.id)) as { flags: string[] }).flags;
});

/** Twinkle's first four bars: C C G G | A A G | F F E E | D D C. */
const LESSON = [60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60];
/** The tug's line at level 1: the first half of the lesson (ft_1_21.AC3), its one line of two bars, played back each turn. */
const LINE = LESSON.slice(0, 7);

/** A new player's first visit to the room, with the intro left to come by itself (the helper turns it off for other tests). */
async function newPlayer(page: Page): Promise<PageErrors> {
  const errors = await openGame(page, '?device=virtual&intro=auto', 'en', 'profiles');
  await clickButton(page, 'profiles', 0);
  // the room runs, or is already paused under the tour's first spotlight (it can open before a poll sees the room running)
  await page.waitForFunction(() => window.__game.scene.getScenes(false).some((s) => s.scene.key === 'profile' && (s.sys.isActive() || s.sys.isPaused())));
  return errors;
}

/**
 * Reads every page of one opening of the spotlight (Space), the next one after `after`; returns each step as it first
 * showed. It stops when that opening closes, not when the spotlight is down, because the next one (the map's after the
 * room's tour, the knock's after the map's) can open before a poll sees the screen without it.
 */
async function readSpotlight(page: Page, after: number): Promise<{ steps: Showing[]; opening: number }> {
  const steps: Showing[] = [];
  await expect.poll(async () => (await showing(page))?.opening ?? 0).toBeGreaterThan(after);
  const opening = (await showing(page))!.opening;
  for (let guard = 0; guard < 40; guard++) {
    const now = await showing(page);
    if (now?.opening !== opening) return { steps, opening };
    if (now.page === 0) steps.push(now);
    await page.keyboard.press('Space');
    await expect.poll(async () => JSON.stringify(await showing(page))).not.toBe(JSON.stringify(now));
  }
  throw new Error('the spotlight did not close');
}

/** A reader of the spotlight's openings one after another in one test (`readSpotlight`). */
function spotlights(page: Page): () => Promise<Showing[]> {
  let opened = 0;
  return async () => {
    const read = await readSpotlight(page, opened);
    opened = read.opening;
    return read.steps;
  };
}

/** Clicks the intro's skip button on the screen `scene` (the spotlight's, the room's or the practice screen's) with the mouse. */
async function clickSkip(page: Page, scene: string): Promise<void> {
  await expect.poll(() => sceneButton(page, scene, 'Skip intro')).toBeGreaterThanOrEqual(0);
  await clickButton(page, scene, await sceneButton(page, scene, 'Skip intro'));
}

/** From a new player's first visit to the teacher's first line at the knock: the room's tour, the map's, the knock's spotlight. */
async function toTheKnock(page: Page, spotlight: () => Promise<Showing[]>): Promise<void> {
  await spotlight();
  await page.waitForFunction(() => window.__game.scene.getScenes(false).some((s) => s.scene.key === 'keriMap' && (s as unknown as { sys: { isPaused(): boolean } }).sys.isPaused()));
  await spotlight();
  await spotlight();
  await expect.poll(() => roomTalk(page)).not.toBeNull();
}

/** The intro is over and kept as done; the room is the player's again. */
async function expectIntroDone(page: Page): Promise<void> {
  await expect.poll(() => flags(page)).toContain('intro.done');
  await expect.poll(() => room(page, 'introState')).toBeNull();
  await expect.poll(() => showing(page)).toBeNull();
  // the room is the player's again on this visit: Kiur on the bed can be pressed, the way into learning (ft_1_32 rule 14)
  await expect.poll(() => sceneButton(page, 'profile', 'Kiur')).toBeGreaterThanOrEqual(0);
}

/** Reads the teacher's lines in the room to their end. */
async function readTalk(page: Page): Promise<string[]> {
  const said: string[] = [];
  await expect.poll(() => roomTalk(page)).not.toBeNull();
  for (let guard = 0; guard < 20; guard++) {
    const now = await roomTalk(page);
    if (now === null) return said;
    said.push(now.who);
    await page.keyboard.press('Space');
    await expect.poll(async () => JSON.stringify(await roomTalk(page))).not.toBe(JSON.stringify(now));
  }
  throw new Error('the talk did not end');
}

/** The practice screen is open, paused under the intro's spotlight. */
async function practiceUnderSpotlight(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const practice = window.__game.scene.getScene('practice') as unknown as { sys: { isPaused(): boolean } };
    return practice.sys.isPaused() && window.__game.scene.getScenes(true).some((s) => s.scene.key === 'intro');
  });
}

/** One lap of the lesson on the practice screen (Wait mode: the notes in order). */
async function playLesson(page: Page): Promise<void> {
  await playWithVirtualPiano(page, LESSON);
}

test.describe('the first-run intro (ft_1_31)', () => {
  test('ft_1_31.AC1 ft_1_31.AC2 ft_1_31.AC3 ft_1_31.AC4 ft_1_31.AC6 a new player is shown the room and the map and walked through learn, practise and the tug on Twinkle', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = await newPlayer(page);
    const spotlight = spotlights(page);

    // the tour: Kiur under the spotlight, every object of the room shown, then the teacher from the doorway
    const tour = await spotlight();
    expect(tour.length).toBeGreaterThanOrEqual(6);
    expect(tour[0]!.spot).toBeNull();
    expect(tour.slice(1).every((s) => s.spot !== null && s.spot.w > 0 && s.spot.h > 0)).toBe(true);
    await expect.poll(() => flags(page)).toContain('intro.started');

    // the map (ft_1_31.AC6): the island, the first open place and the way home, then back to the room for the knock
    await page.waitForFunction(() => window.__game.scene.getScenes(false).some((s) => s.scene.key === 'keriMap' && (s as unknown as { sys: { isPaused(): boolean } }).sys.isPaused()));
    const map = await spotlight();
    expect(map.map((s) => s.spot !== null)).toEqual([false, true, true]);
    // back in the room, paused at once under the knock's spotlight (so not waited for as a running scene)
    await page.waitForFunction(() => window.__game.scene.getScenes(false).some((s) => s.scene.key === 'profile') && !window.__game.scene.getScenes(true).some((s) => s.scene.key === 'keriMap'));
    const knock = await spotlight();
    expect(knock.length).toBe(2);
    expect(await readTalk(page)).toContain('teacher');

    // learn: the teacher's next line followed at once (the talk above read it); the piano opens with the lesson's bars,
    // paused under the spotlight: Kiur shows the staff, the next note, Listen and the way back first
    await practiceUnderSpotlight(page);
    const learnTour = await spotlight();
    expect(learnTour.length).toBe(4);
    expect(learnTour.every((s) => s.spot !== null)).toBe(true);
    // the staff's light is wider than the next note's
    expect(learnTour[0]!.spot!.w).toBeGreaterThan(learnTour[1]!.spot!.w);
    // only Listen, Start over and the intro's skip: no tools strip, and mode, tempo and section keys change nothing (ft_1_31.AC3)
    const asWritten = await page.evaluate(() => {
      const practice = window.__game.scene.getScene('practice') as unknown as { switchMode(): void; setPercent(p: number): void; startPicking(): void; percent: number; picking: unknown; startData: { intro?: unknown }; toolbarButtons: { items: unknown[] }; buttons: unknown[] };
      const before = practice.buttons.length;
      practice.switchMode();
      practice.setPercent(50);
      practice.startPicking();
      return { percent: practice.percent, picking: practice.picking, intro: practice.startData.intro !== undefined, actions: practice.toolbarButtons.items.length, buttons: practice.buttons.length === before };
    });
    expect(asWritten).toEqual({ percent: 100, picking: null, intro: true, actions: 3, buttons: true });
    expect((await page.evaluate(() => window.__game.registry.get('context').profiles.playSettings.mode)) as string).toBe('wait');
    await playLesson(page);

    // practise: back in the room the teacher asks for two more plays
    await waitForScene(page, 'profile');
    await readTalk(page);
    await practiceUnderSpotlight(page);
    await spotlight();
    await playLesson(page);
    await expect.poll(() => page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { startData: { lap?: number } }).startData.lap ?? 0)).toBe(1);
    await playLesson(page);

    // the tug: the teacher plays the line, the student plays it back from memory; two right turns win
    await waitForScene(page, 'profile');
    await readTalk(page);
    await expect.poll(() => roomTug(page)).not.toBeNull();
    // the skip button stays over the tug too (ft_1_31.AC5)
    await expect.poll(() => sceneButton(page, 'profile', 'Skip intro')).toBeGreaterThanOrEqual(0);
    for (let round = 0; round < 2; round++) {
      await expect.poll(async () => (await roomTug(page))?.who).toBe('character');
      await page.evaluate(() => (window.__game.scene.getScene('profile') as unknown as { endTugPhrase(): void }).endTugPhrase());
      await expect.poll(async () => (await roomTug(page))?.who).toBe('student');
      await playWithVirtualPiano(page, LINE);
      await expect.poll(async () => (await roomTug(page))?.saying ?? null).not.toBeNull();
    }
    await expect.poll(async () => (await roomTug(page))?.outcome ?? null).toBe('won');
    // the tug's closing line, then the teacher's last word and Kiur's
    await expect.poll(async () => (await roomTug(page))?.closing).toBe(true);
    await page.keyboard.press('Space');
    await expect.poll(() => roomTug(page)).toBeNull();
    await readTalk(page);
    await spotlight();
    await expect.poll(() => flags(page)).toContain('intro.done');
    expect(await room(page, 'introState')).toBeNull();
    expectNoErrors(errors);
  });

  test('ft_1_31.AC5 Esc skips the intro, kept as done: the room does not offer it again', async ({ page }) => {
    const errors = await newPlayer(page);
    await expect.poll(() => showing(page)).not.toBeNull();
    await page.keyboard.press('Escape');
    await expect.poll(() => flags(page)).toContain('intro.done');
    expect(await room(page, 'introState')).toBeNull();
    await expect.poll(() => sceneButton(page, 'profile', 'Kiur')).toBeGreaterThanOrEqual(0);
    // a visit again: no intro
    await page.evaluate(() => { window.__game.scene.start('profile'); });
    await waitForScene(page, 'profile');
    await page.waitForTimeout(300);
    expect(await showing(page)).toBeNull();
    expectNoErrors(errors);
  });

  test('ft_1_31.AC5 the skip button on Kiur\'s spotlight ends the intro at once, kept as done', async ({ page }) => {
    const errors = await newPlayer(page);
    await expect.poll(() => showing(page)).not.toBeNull();
    await clickSkip(page, 'intro');
    await expectIntroDone(page);
    // the room is not left for the map: the skip ends the intro where it is
    expect(await page.evaluate(() => window.__game.scene.getScenes(true).some((s) => s.scene.key === 'keriMap'))).toBe(false);
    expectNoErrors(errors);
  });

  test('ft_1_31.AC5 the skip button over the teacher\'s talk in the room ends the intro, and no lesson follows', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = await newPlayer(page);
    await toTheKnock(page, spotlights(page));
    await clickSkip(page, 'profile');
    await expectIntroDone(page);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__game.scene.getScenes(true).some((s) => s.scene.key === 'practice'))).toBe(false);
    expectNoErrors(errors);
  });

  test('ft_1_31.AC5 the lesson on the practice screen has the skip button in its band, back to the room with the intro ended', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = await newPlayer(page);
    const spotlight = spotlights(page);
    await toTheKnock(page, spotlight);
    await readTalk(page);
    await practiceUnderSpotlight(page);
    // Esc there skips only Kiur's tour of the practice screen; the band's skip ends the intro
    await page.keyboard.press('Escape');
    await expect.poll(() => showing(page)).toBeNull();
    await clickSkip(page, 'practice');
    await waitForScene(page, 'profile');
    await expectIntroDone(page);
    expectNoErrors(errors);
  });

  test('ft_1_31.AC5 the skip button over the tug ends the intro there, with no end stage after it', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = await newPlayer(page);
    const spotlight = spotlights(page);
    await toTheKnock(page, spotlight);
    // the knock's talk runs on into learn's line, then the lesson: learn once, practise twice
    await readTalk(page);
    await practiceUnderSpotlight(page);
    await spotlight();
    await playLesson(page);
    await waitForScene(page, 'profile');
    await readTalk(page);
    await practiceUnderSpotlight(page);
    await spotlight();
    await playLesson(page);
    await expect.poll(() => page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { startData: { lap?: number } }).startData.lap ?? 0)).toBe(1);
    await playLesson(page);
    await waitForScene(page, 'profile');
    await readTalk(page);
    await expect.poll(() => roomTug(page)).not.toBeNull();
    await clickSkip(page, 'profile');
    await expect.poll(() => roomTug(page)).toBeNull();
    await expectIntroDone(page);
    // the teacher's last word and Kiur's are not said: the skip ends it where it is
    await page.waitForTimeout(300);
    expect(await roomTalk(page)).toBeNull();
    expectNoErrors(errors);
  });
});
