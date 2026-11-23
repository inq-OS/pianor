// Covers ft_1_21.AC2, AC4, AC5, AC7, AC8, AC15 and AC16 (WP-13): the tug opened from Puuvaim's conversation, over the knoll.
import { expect, test, type Page } from '@playwright/test';
import { activeScenes, buttonPoint, clickButton, expectNoErrors, letGameRun, openGame, playWithVirtualPiano, sceneButton, showMenuPageWith, waitForScene, type PageErrors } from './helpers';

interface TugView { who: 'character' | 'student' | null; turn: number; standing: number; outcome?: 'won' | 'lost' | 'left'; saying: string | null; closing: boolean; level: number; mode: 'wait' | 'tempo' }
interface TalkState { showing: 'line' | 'student' | 'choices'; node: string }

const knoll = 'knoll';
const tug = (page: Page) => page.evaluate((k) => (window.__game.scene.getScene(k) as unknown as { tugState: TugView | null }).tugState, knoll);
const talk = (page: Page) => page.evaluate((k) => (window.__game.scene.getScene(k) as unknown as { talkState: TalkState | null }).talkState, knoll);
const inventory = (page: Page) => page.evaluate((k) => (window.__game.scene.getScene(k) as unknown as { bandInventory: string[] }).bandInventory, knoll);
const endPhrase = (page: Page) => page.evaluate((k) => (window.__game.scene.getScene(k) as unknown as { endTugPhrase(): void }).endTugPhrase(), knoll);
const world = (page: Page) => page.evaluate(async () => {
  const { profiles } = window.__game.registry.get('context');
  return (await profiles.worldOf(profiles.profile.id)) as { items: string[]; met: Record<string, { tugs: { won: number; lost: number }; lastLostTug?: { piece: string } }> };
});
const battles = (page: Page) => page.evaluate(() => (window.__game.registry.get('context').profiles.profile.battles as { monsterId: string; won: boolean; xp: number }[]));

/** Puuvaim's first phrase, its first two bars: what the student plays back at level 1. */
const PHRASE = [64, 64, 65, 64, 62, 62, 60];
const WRONG = [61, 61, 61, 61, 61, 61, 61];

/** Puuvaim's level 2 piece: its bars' notes, and the student's phrase in it (bars 3 and 4). */
const LEVEL_2 = { piece: 'puuvaim-2', bars: [4, 4, 3, 3] };

/**
 * `times` whole plays of a piece in the room (by default Puuvaim's first, four bars of 4, 3, 4 and 3 notes), each with
 * every bar right first try (`clean`), in `mode` (Tempo mode on time).
 */
async function practise(page: Page, times: number, clean = true, piece = { piece: 'puuvaim-1', bars: [4, 3, 4, 3] }, mode: 'wait' | 'tempo' = 'wait'): Promise<void> {
  await page.evaluate(async ({ times, clean, piece, mode }) => {
    const { profiles } = window.__game.registry.get('context');
    const notes = piece.bars;
    const start = Date.now() - times * 10; // every play ended just before now
    const plays = Array.from({ length: times }, (_, n) => notes.map((count, bar) => ({
      at: new Date(start + n * 10 + bar).toISOString(), pieceId: piece.piece, bar, notes: count, firstTry: clean ? count : 0,
      timing: mode === 'tempo' ? (clean ? 100 : 0) : null, mode, tempoPercent: 100, section: null, misses: [],
    }))).flat();
    await profiles.recordBarPlays(plays);
  }, { times, clean, piece, mode });
}

/** The knoll with Puuvaim standing (`?actors=1`), his talk opened and the tug picked from his menu (after `practised` clean plays). */
async function openTug(page: Page, practised = 3): Promise<PageErrors> {
  const errors = await openGame(page, '?device=virtual&actors=1');
  if (practised > 0) await practise(page, practised);
  // he offers the tug once his phrase was taught, and from the talk after the one that sent the student to practise
  await page.evaluate(async () => {
    const { profiles } = window.__game.registry.get('context');
    const world = await profiles.worldOf(profiles.profile.id);
    await profiles.saveWorld(profiles.profile.id, {
      ...world,
      flags: ['met-puuvaim', 'puuvaim-taught-said', 'known-puuvaim'],
      met: { puuvaim: { firstDay: '1998-11-19', lastDay: '1998-11-19', taught: ['puuvaim-1'], tugs: { won: 0, lost: 0, bestLevel: 0 } } },
    });
  });
  await page.evaluate((k) => {
    window.__game.scene.stop('menu');
    window.__game.scene.start(k);
  }, knoll);
  await waitForScene(page, knoll);
  await letGameRun(page, 3, 50);
  await pickTug(page);
  return errors;
}

/** Puuvaim's talk opened and "Let's take turns playing!" picked; his invitation said. */
async function pickTug(page: Page): Promise<void> {
  expect(await page.evaluate((k) => (window.__game.scene.getScene(k) as unknown as { talkTo(id: string): Promise<boolean> }).talkTo('puuvaim'), knoll)).toBe(true);
  for (let i = 0; i < 12 && (await talk(page))?.showing !== 'choices'; i++) await page.keyboard.press('Space');
  await page.keyboard.press('2'); // "Let's take turns playing!"
  for (let i = 0; i < 6 && (await talk(page)) !== null; i++) await page.keyboard.press('Space');
  expect(await talk(page)).toBeNull();
}

/**
 * Tempo mode: once the student's phrase is on the tug's clock, its keys are pressed at their times (`phrase`, or none to
 * miss them all); the tug after the fact on it.
 */
async function roundInTime(page: Page, notes: 'phrase' | 'none'): Promise<TugView> {
  const before = (await tug(page))!.turn;
  await expect.poll(() => page.evaluate((k) => (window.__game.scene.getScene(k) as unknown as { tugTransport: unknown }).tugTransport !== null, knoll)).toBe(true);
  if (notes === 'phrase') {
    await page.evaluate((k) => {
      const scene = window.__game.scene.getScene(k) as unknown as { tugTransport: { timeOfTick(t: number): number }; tugPhrase: { notes: { tick: number; midi: number }[] } };
      const clock = window.__game.registry.get('context').audio.clock as { nowMs(): number };
      const transport = scene.tugTransport;
      for (const note of scene.tugPhrase.notes) {
        const due = transport.timeOfTick(note.tick) - clock.nowMs();
        // the key carries its own time stamp (as a real MIDI message does), sent a little early: a timer that fires late
        // on a busy machine does not make the note late
        const stamp = performance.now() + due;
        setTimeout(() => { window.__virtualDevice!.press(note.midi, 80, stamp); setTimeout(() => window.__virtualDevice!.release(note.midi), 400); }, Math.max(0, due - 40));
      }
    }, knoll);
  }
  // the fact after the student's phrase
  await expect.poll(async () => { const v = await tug(page); return v !== null && v.turn > before && v.saying !== null; }, { timeout: 30_000 }).toBe(true);
  return (await tug(page))!;
}

/** Plays one round: Puuvaim's phrase (ended at once), then the student's notes; the standing after it. */
async function round(page: Page, notes: number[]): Promise<TugView> {
  await expect.poll(async () => (await tug(page))?.who).toBe('character');
  await endPhrase(page);
  await expect.poll(async () => (await tug(page))?.who).toBe('student');
  await playWithVirtualPiano(page, notes);
  await expect.poll(async () => (await tug(page))?.saying ?? null).not.toBeNull();
  return (await tug(page))!;
}

test.describe('the tug in the knoll (ft_1_21, WP-13)', () => {
  test('ft_1_21.AC16 the tug opens from the conversation; ft_1_21.AC5 three won phrases win it; ft_1_21.AC15 the plain oak leaf, the first rung of its ladder (ft_1_21.AC18), is given and stands in the band', async ({ page }) => {
    const errors = await openTug(page);
    expect(await tug(page)).toMatchObject({ who: 'character', standing: 0 });
    const first = await round(page, PHRASE);
    // ft_1_21.AC7 the fact after the phrase: the notes right first try
    expect(first).toMatchObject({ standing: 1, saying: '7 of 7 notes right' });
    expect((await round(page, PHRASE)).standing).toBe(2);
    await round(page, PHRASE);
    // won at +3: his closing line, then a press ends the tug in the scene
    await expect.poll(async () => (await tug(page))?.outcome).toBe('won');
    await expect.poll(async () => (await tug(page))?.saying).toContain('Oak leaf');
    await page.keyboard.press('Space');
    await expect.poll(() => tug(page)).toBeNull();
    expect(await activeScenes(page)).toContain(knoll);
    await expect.poll(async () => (await world(page)).items).toEqual(['oak-leaf']);
    expect((await world(page)).met['puuvaim']!.tugs).toMatchObject({ won: 1, lost: 0 });
    // ft_1_21.AC15 the leaf is in the band's inventory at once, and again on the next visit
    expect(await inventory(page)).toEqual(['oak-leaf']);
    await page.evaluate((k) => { window.__game.scene.stop(k); window.__game.scene.start(k); }, knoll);
    await waitForScene(page, knoll);
    await expect.poll(() => inventory(page)).toEqual(['oak-leaf']);
    // ft_1_21.AC8 the prize is kept as before (AC9: under the battle's keys)
    expect(await battles(page)).toEqual([expect.objectContaining({ monsterId: 'puuvaim', won: true, xp: 30 })]);
    expectNoErrors(errors);
  });

  test('ft_1_21.AC18 the prize ladder stands in the band as its best rung, in the first rung\'s place, every rung kept in the world', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await page.evaluate(async () => {
      const { profiles } = window.__game.registry.get('context');
      const world = await profiles.worldOf(profiles.profile.id);
      await profiles.saveWorld(profiles.profile.id, { ...world, items: ['oak-leaf', 'acorn'] });
    });
    await page.evaluate((k) => { window.__game.scene.stop('menu'); window.__game.scene.start(k); }, knoll);
    await waitForScene(page, knoll);
    await expect.poll(() => inventory(page)).toEqual(['acorn']);
    expect((await world(page)).items).toEqual(['oak-leaf', 'acorn']);
    expectNoErrors(errors);
  });

  test('ft_1_21.AC5 three lost phrases lose the tug: no leaf, the cool-down starts; ft_1_21.AC8 a loss takes nothing away', async ({ page }) => {
    const errors = await openTug(page);
    const first = await round(page, WRONG);
    expect(first).toMatchObject({ standing: -1, saying: '0 of 7 notes right' });
    await round(page, WRONG);
    await round(page, WRONG);
    await expect.poll(async () => (await tug(page))?.outcome).toBe('lost');
    await expect.poll(async () => (await tug(page))?.saying).toContain('0 of 3');
    await page.keyboard.press('Space');
    await expect.poll(() => tug(page)).toBeNull();
    await expect.poll(async () => (await world(page)).met['puuvaim']?.lastLostTug?.piece).toBe('puuvaim-1');
    expect((await world(page)).items).toEqual([]);
    expect(await battles(page)).toEqual([expect.objectContaining({ won: false, xp: 0 })]);
    expect(await inventory(page)).toEqual([]);
    expectNoErrors(errors);
  });

  test('Esc leaves the tug in the scene, with nothing kept', async ({ page }) => {
    const errors = await openTug(page);
    await round(page, PHRASE);
    await page.keyboard.press('Escape');
    await expect.poll(() => tug(page)).toBeNull();
    await letGameRun(page, 3, 50);
    expect(await activeScenes(page)).toContain(knoll);
    expect((await world(page)).met['puuvaim']!.tugs).toMatchObject({ won: 0, lost: 0 });
    expect(await battles(page)).toEqual([]);
    expectNoErrors(errors);
  });
  test('ft_1_06.AC15 the tug waits for practice: under three plays in the room Puuvaim says how many more, and nothing is played', async ({ page }) => {
    const errors = await openTug(page, 1);
    await expect.poll(async () => (await tug(page))?.saying).toBe('Practice my tune in your room first: 2 more plays.');
    expect((await tug(page))!.who).toBeNull();
    await page.keyboard.press('Space');
    await expect.poll(() => tug(page)).toBeNull();
    expect(await battles(page)).toEqual([]);
    expectNoErrors(errors);
  });

  test('ft_1_21.AC13 after a lost tug he waits for three clean plays of the piece, then plays again', async ({ page }) => {
    const errors = await openTug(page);
    for (let i = 0; i < 3; i++) await round(page, WRONG);
    await expect.poll(async () => (await tug(page))?.saying).toContain('0 of 3');
    await page.keyboard.press('Space');
    await expect.poll(() => tug(page)).toBeNull();
    await expect.poll(async () => (await world(page)).met['puuvaim']?.lastLostTug?.piece).toBe('puuvaim-1');
    await pickTug(page);
    await expect.poll(async () => (await tug(page))?.saying).toBe('Play my tune clean in your room 3 more times, then we try again.');
    await page.keyboard.press('Space');
    await expect.poll(() => tug(page)).toBeNull();
    await practise(page, 3);
    await pickTug(page);
    await expect.poll(async () => (await tug(page))?.who).toBe('character');
    expectNoErrors(errors);
  });

  test('ft_1_21.AC6 a won level opens level 2 in Tempo mode: his phrase, then the student\'s on the beat after it, judged on time', async ({ page }) => {
    test.slow(); // three Wait rounds, then two rounds at the piece's tempo
    const errors = await openTug(page);
    for (let i = 0; i < 3; i++) await round(page, PHRASE);
    await expect.poll(async () => (await tug(page))?.closing).toBe(true);
    await page.keyboard.press('Space');
    await expect.poll(() => tug(page)).toBeNull();
    await expect.poll(async () => (await world(page)).met['puuvaim']?.tugs.won).toBe(1);
    // level 2 waits for practice of its own piece in Tempo mode (ft_1_06.AC15)
    await practise(page, 3, true, LEVEL_2, 'tempo');
    await pickTug(page);
    await expect.poll(async () => (await tug(page))?.who).toBe('character');
    expect(await tug(page)).toMatchObject({ level: 2, mode: 'tempo', standing: 0 });
    const won = await roundInTime(page, 'phrase');
    expect(won).toMatchObject({ standing: 1, saying: '6 of 6 notes on time' });
    // the next pass swaps the turns: the student plays first, the first two bars, after the count-in
    const missed = await roundInTime(page, 'none');
    expect(missed).toMatchObject({ standing: 0, saying: '0 of 8 notes on time' });
    await page.keyboard.press('Escape');
    await expect.poll(() => tug(page)).toBeNull();
    expectNoErrors(errors);
  });
});

/** The tug Kiur practises in the room (ft_1_21.AC14), for the tests. */
const roomTug = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('profile') as unknown as { tugState: TugView | null }).tugState);

/** The room, after three clean plays of Puuvaim's first piece; no character met. */
async function toRoomWithKiur(page: Page): Promise<PageErrors> {
  const errors = await openGame(page, '?device=virtual');
  await practise(page, 3);
  await page.evaluate(() => {
    window.__game.scene.stop('menu');
    window.__game.scene.start('profile');
  });
  await waitForScene(page, 'profile');
  await letGameRun(page, 3, 50);
  return errors;
}

/** Kiur pressed on the bed, then Tug: the piece book opens; the piece picked there comes back to the room, where his tug opens. */
async function pressKiur(page: Page, title = 'Runo Song'): Promise<void> {
  await expect.poll(() => sceneButton(page, 'profile', 'Kiur')).toBeGreaterThanOrEqual(0);
  await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Kiur'));
  await expect.poll(() => sceneButton(page, 'profile', 'Tug')).toBeGreaterThanOrEqual(0);
  await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Tug'));
  await waitForScene(page, 'menu');
  await clickButton(page, 'menu', await showMenuPageWith(page, title));
  await waitForScene(page, 'profile');
  await expect.poll(() => roomTug(page)).not.toBeNull();
}

/** A round of the practice tug in the room: Kiur's phrase cut short, then the student's `notes`; the tug after the fact. */
async function roomRound(page: Page, notes: number[]): Promise<TugView> {
  await expect.poll(async () => (await roomTug(page))?.who).toBe('character');
  await page.evaluate(() => (window.__game.scene.getScene('profile') as unknown as { endTugPhrase(): void }).endTugPhrase());
  await expect.poll(async () => (await roomTug(page))?.who).toBe('student');
  await playWithVirtualPiano(page, notes);
  await expect.poll(async () => (await roomTug(page))?.saying ?? null).not.toBeNull();
  return (await roomTug(page))!;
}

test.describe('Kiur the trainer in the room (ft_1_21.AC14)', () => {
  test('ft_1_21.AC14 Kiur tugs any piece picked from the piece book: won and lost at 2, nothing kept, no cool-down', async ({ page }) => {
    const errors = await toRoomWithKiur(page);
    // the pointer on Kiur wakes him: his awake look shows (alpha 1), clear while he sleeps
    const kiurAwake = () => page.evaluate(() => (window.__game.scene.getScene('profile') as unknown as { root: { list: { name: string; alpha: number }[] } }).root.list.find((o) => o.name === 'awake:kiur')?.alpha);
    await expect.poll(() => sceneButton(page, 'profile', 'Kiur')).toBeGreaterThanOrEqual(0);
    expect(await kiurAwake()).toBe(0);
    const at = await buttonPoint(page, 'profile', await sceneButton(page, 'profile', 'Kiur'));
    await page.mouse.move(at.x, at.y);
    await expect.poll(kiurAwake).toBe(1);
    await page.mouse.move(2, 2);
    await expect.poll(kiurAwake).toBe(0);
    // no character met: he trains all the same
    await pressKiur(page);
    expect(await roomTug(page)).toMatchObject({ who: 'character', standing: 0, level: 1 });
    expect(await roomRound(page, WRONG)).toMatchObject({ standing: -1, saying: '0 of 7 notes right' });
    await roomRound(page, WRONG);
    await expect.poll(async () => (await roomTug(page))?.outcome).toBe('lost');
    await expect.poll(async () => (await roomTug(page))?.saying).toContain('Practice the piece more');
    await page.keyboard.press('Space');
    await expect.poll(() => roomTug(page)).toBeNull();
    // nothing kept: no character record and no battle record
    expect((await world(page)).met).toEqual({});
    expect(await battles(page)).toEqual([]);
    // no cool-down: he tugs again at once; Esc leaves it, and the room stays
    await pressKiur(page);
    await expect.poll(async () => (await roomTug(page))?.who).toBe('character');
    await page.keyboard.press('Escape');
    await expect.poll(() => roomTug(page)).toBeNull();
    expect(await activeScenes(page)).toContain('profile');
    expectNoErrors(errors);
  });
});
