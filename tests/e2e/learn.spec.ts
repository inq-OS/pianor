// Covers ft_1_32.AC4, ft_1_32.AC5, ft_1_32.AC6, ft_1_32.AC11, ft_1_32.AC12, ft_1_32.AC13, ft_1_32.AC14, ft_1_32.AC16, ft_1_32.AC17, ft_1_32.AC18, ft_1_32.AC23.
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { activeScenes, clickButton, clickToolbar, expectNoErrors, sceneTexts, isPieceLabel, menuLabels, letGameRun, openGame, openPiece, pieceXp, playWithKeys, sceneButton, showMenuPageWith, waitForScene } from './helpers';

/** The bars the practice screen shows now (0-based, of the whole piece), and the notes to play in them in order. */
async function shown(page: Page): Promise<{ bars: number; first: number; midis: number[] }> {
  return page.evaluate(() => {
    const scene = window.__game.scene.getScene('practice') as unknown as {
      chart: { bars: unknown[]; notes: { tick: number; midi: number; track: string }[]; tracks: { id: string; role: string }[] };
      learn: { run: { firstBar: number } } | null;
    };
    const play = new Set(scene.chart.tracks.filter((t) => t.role === 'play').map((t) => t.id));
    const midis = scene.chart.notes.filter((n) => play.has(n.track)).sort((a, b) => a.tick - b.tick).map((n) => n.midi);
    return { bars: scene.chart.bars.length, first: scene.learn?.run.firstBar ?? -1, midis };
  });
}

const progress = (page: Page) => page.evaluate(() => window.__game.registry.get('context').profiles.learnProgressOf('little-steps') as { step: number; misses: number; unsteady?: number; wholeStreak: number });
/** The next learning run has started (the scene restarted after a run that ended), with nothing said between them. */
const nextRunStarted = (page: Page) => page.evaluate(() => {
  const scene = window.__game.scene.getScene('practice') as unknown as { afterLearnRun: boolean; leaving: boolean };
  return scene.afterLearnRun && !scene.leaving;
});
const kiurSays = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { startMessage: string }).startMessage);

/** From the piece book to the room: Kiur on the bed pressed, and his question open. */
async function askKiur(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__game.scene.stop('menu');
    window.__game.scene.start('profile');
  });
  await waitForScene(page, 'profile');
  await expect.poll(() => sceneButton(page, 'profile', 'Kiur')).toBeGreaterThanOrEqual(0);
  await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Kiur'));
  await expect.poll(() => sceneButton(page, 'profile', 'Learn')).toBeGreaterThanOrEqual(0);
}

/** A piece opened to be learned bar by bar: Kiur pressed in the room, Learn, and the piece picked in the book (ft_1_32 rule 14). */
async function learnPiece(page: Page, title: string): Promise<void> {
  await askKiur(page);
  await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Learn'));
  await waitForScene(page, 'menu');
  await openPiece(page, title);
}

/** A half-learned piece opened through Kiur's Learn: the practice screen pauses under the go-on-or-start-over question (ft_1_32.AC16). */
async function learnPieceAsked(page: Page, title: string): Promise<void> {
  await askKiur(page);
  await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Learn'));
  await waitForScene(page, 'menu');
  await clickButton(page, 'menu', await showMenuPageWith(page, title));
  await waitForScene(page, 'learnResume');
}

test('ft_1_32.AC13 the piano is a sandbox: a piece picked there plays in full with no learning', async ({ page }) => {
  const errors = await openGame(page, '?device=virtual&learn=1');
  await openPiece(page, 'Little Steps');
  const whole = await page.evaluate(() => (window.__game.registry.get('context').pieces.find('little-steps').chart.bars as unknown[]).length);
  expect(await shown(page)).toMatchObject({ bars: whole, first: -1 });
  expectNoErrors(errors);
});

test('ft_1_32.AC14 Kiur\'s Tug lists only the learned pieces, and his tug opens on one picked', async ({ page }) => {
  const errors = await openGame(page, '?device=virtual&learn=1');
  const tugBook = async () => {
    await askKiur(page);
    await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Tug'));
    await waitForScene(page, 'menu');
    return (await menuLabels(page)).filter(isPieceLabel);
  };
  // nothing learned yet: the book lists no piece
  expect(await tugBook()).toEqual([]);
  // Little Steps learned to its last step
  await page.evaluate(() => window.__game.registry.get('context').profiles.saveLearnProgress('little-steps', {
    step: 999, wholeStreak: 0, recall: false, confirm: false, misses: 0, medals: [], lastDay: '1998-11-21', stepBars: 1, handsApart: true,
  }));
  expect(await tugBook()).toEqual(['Little Steps']);
  await clickButton(page, 'menu', await showMenuPageWith(page, 'Little Steps'));
  await waitForScene(page, 'profile');
  await expect.poll(() => page.evaluate(() => (window.__game.scene.getScene('profile') as unknown as { tug: unknown }).tug !== null)).toBe(true);
  expectNoErrors(errors);
});

test('ft_1_32.AC23 a new piece is learned bar by bar with nothing said: one bar shown, a wrong key repeats it, a perfect run adds the next bar', async ({ page }) => {
  const errors = await openGame(page, '?device=virtual&learn=1');
  await learnPiece(page, 'Little Steps');
  const first = await shown(page);
  expect(first).toMatchObject({ bars: 1, first: 0 });
  expect(await kiurSays(page)).toBe(''); // Kiur says nothing while learning: the staff shows the bar

  // a wrong key ends the run at once: it stays on the staff, the same bar starts again, and progress keeps its miss
  const wrong = first.midis[0]! + 1;
  await playWithKeys(page, [wrong]);
  expect(await shown(page)).toMatchObject({ bars: 1, first: 0 });
  await expect.poll(() => nextRunStarted(page), { timeout: 10_000 }).toBe(true);
  expect(await progress(page)).toMatchObject({ step: 0, misses: 1 });
  expect(await kiurSays(page)).toBe(''); // the wrong key on the staff says what went wrong
  // the wrong key stays on the staff of the run started again, until its first key (ft_1_32.AC6)
  const playedShown = () => page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { playSession: { staffView: { played: unknown } } }).playSession.staffView.played !== null);
  expect(await playedShown()).toBe(true);

  // the same mistake again: the note it was for gets a mistake marker (ft_1_32.AC5, at the 2nd miss by default)
  await playWithKeys(page, [wrong]);
  await expect.poll(() => progress(page), { timeout: 10_000 }).toMatchObject({ misses: 2 });
  await expect.poll(() => page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { playSession: { staffView: { markersShown: number } } }).playSession.staffView.markersShown), { timeout: 10_000 }).toBeGreaterThanOrEqual(1);

  // every note right: the next step shows bars 1 and 2, and the first bar's note is earned
  await playWithKeys(page, first.midis.slice(0, 1));
  expect(await playedShown()).toBe(false); // the first right key takes the wrong one away
  await playWithKeys(page, first.midis.slice(1));
  await expect.poll(async () => (await shown(page)).bars, { timeout: 10_000 }).toBe(2);
  expect(await progress(page)).toMatchObject({ step: 1, misses: 0 });
  expect(await kiurSays(page)).toBe(''); // the new prize note says it, with no words
  const rewards = await page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { rewardsData: { chunks: { quarters: string[] }[] } }).rewardsData);
  expect(rewards.chunks[0]!.quarters).toEqual(['silver']); // two runs that did not count
  await letGameRun(page, 5);
  expectNoErrors(errors);
});

test('ft_1_32.AC23 a player who never saw the first-run hint gets no words as the first learning run starts', async ({ page }) => {
  const errors = await openGame(page, '?device=virtual&learn=1');
  await askKiur(page);
  await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Learn'));
  await waitForScene(page, 'menu');
  // the tests switch the first-run words off; from here on they are on, as for a new player who has not seen the hint
  await page.evaluate(() => { (window.__game.registry.get('context') as { flags: { intro: string } }).flags.intro = 'auto'; });
  await openPiece(page, 'Little Steps');
  await letGameRun(page, 5);
  expect(await sceneTexts(page, 'practice')).not.toContain('More tools: right-click the music, or press More');
  expect(await kiurSays(page)).toBe('');
  expectNoErrors(errors);
});

test('the learning is kept: the piece opens again on the step the player reached', async ({ page }) => {
  const errors = await openGame(page, '?device=virtual&learn=1');
  await learnPiece(page, 'Little Steps');
  await playWithKeys(page, (await shown(page)).midis);
  await expect.poll(async () => (await shown(page)).bars, { timeout: 10_000 }).toBe(2);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key)), { timeout: 10_000 }).toContain('menu');
  await learnPieceAsked(page, 'Little Steps');
  await page.keyboard.press('Escape'); // go on
  await waitForScene(page, 'practice');
  expect(await shown(page)).toMatchObject({ bars: 2, first: 0 });
  expectNoErrors(errors);
});

test('ft_1_32.AC11 a run that speeds up beyond the baseline tempo is stopped and asked again', async ({ page }) => {
  const errors = await openGame(page, '?device=virtual&learn=1');
  // a piece begun earlier, whose confirmation play measured a slow 40 BPM
  await page.evaluate(() => window.__game.registry.get('context').profiles.saveLearnProgress('little-steps', {
    step: 0, wholeStreak: 0, recall: false, confirm: false, misses: 0, medals: [], lastDay: '1998-11-21', bpm: [40], stepBars: 1,
  }));
  await learnPiece(page, 'Little Steps');
  // the keys pressed one right after the other: far faster than 40 BPM
  await playWithKeys(page, (await shown(page)).midis);
  await expect.poll(() => nextRunStarted(page), { timeout: 10_000 }).toBe(true);
  expect(await kiurSays(page)).toBe('');
  expect(await shown(page)).toMatchObject({ bars: 1, first: 0 });
  expect(await progress(page)).toMatchObject({ step: 0, misses: 0, unsteady: 1 }); // nothing lost, asked again
  expectNoErrors(errors);
});

const playStaves = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { chart: { tracks: { role: string; hand: string | null }[] } })
  .chart.tracks.filter((t) => t.role === 'play').map((t) => t.hand));

test('ft_1_32.AC12 a two-hand piece is learned with both hands together by default', async ({ page }) => {
  const errors = await openGame(page, '?device=virtual&learn=1');
  await learnPiece(page, 'Both Hands');
  expect(await kiurSays(page)).toBe(''); // Kiur says nothing while learning: the staff shows the bar
  expect((await playStaves(page)).sort()).toEqual(['LH', 'RH']);
  expectNoErrors(errors);
});

test('ft_1_32.AC12 ft_1_32.AC18 with hands apart chosen, the right hand is learned first, the left hand\'s staff shown grey and not awaited', async ({ page }) => {
  const errors = await openGame(page, '?device=virtual&learn=1');
  await page.evaluate(() => window.__game.registry.get('context').profiles.updateLearnSettings({ handsApart: true }));
  await learnPiece(page, 'Both Hands');
  expect(await kiurSays(page)).toBe('');
  expect(await playStaves(page)).toEqual(['RH']);
  // both staves are drawn, the resting left hand's marked so the view greys it
  const staves = await page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { playSession: { layout: { systems: { staves: { clef: string; resting?: boolean }[] }[] } } })
    .playSession.layout.systems[0]!.staves.map((st) => [st.clef, st.resting === true]));
  expect(staves).toEqual([['treble', false], ['bass', true]]);
  await playWithKeys(page, (await shown(page)).midis);
  await expect.poll(() => playStaves(page), { timeout: 10_000 }).toEqual(['LH']);
  expect(await kiurSays(page)).toBe('');
  expectNoErrors(errors);
});

test('ft_1_32.AC16 a half-learned piece opened again asks to go on or start over, with two pictures', async ({ page }) => {
  const errors = await openGame(page, '?device=virtual&learn=1');
  const halfway = () => page.evaluate(() => window.__game.registry.get('context').profiles.saveLearnProgress('little-steps', {
    step: 3, wholeStreak: 0, recall: false, confirm: false, misses: 0, medals: ['gold', 'gold', 'gold'], lastDay: '2999-01-01', stepBars: 1, handsApart: false,
  }));
  await halfway();
  await learnPieceAsked(page, 'Little Steps');
  // go on: Esc, the learning where it stopped
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await shown(page)).first).toBeGreaterThanOrEqual(0);
  expect(await progress(page)).toMatchObject({ step: 3 });
  // opened again: start over, from bar 1 with nothing learned
  await clickToolbar(page, 'back');
  await learnPieceAsked(page, 'Little Steps');
  await clickButton(page, 'learnResume', await sceneButton(page, 'learnResume', 'Start over from bar 1'));
  await expect.poll(async () => (await progress(page)).step).toBe(0);
  // the screen starts again on the first step: one bar from bar 1
  await expect.poll(async () => { const now = await shown(page); return [now.first, now.bars]; }, { timeout: 10_000 }).toEqual([0, 1]);
  expectNoErrors(errors);
});

test('ft_1_32.AC17 the live tempo is off by default; turned on in the settings, the strip at the foot shows the run measured while it is played', async ({ page }) => {
  const errors = await openGame(page, '?device=virtual&learn=1');
  const live = async () => (await sceneTexts(page, 'practice')).filter((text) => /^(Tempo|Spread) /.test(text));
  await learnPiece(page, 'Little Steps');
  expect(await live()).toEqual([]); // off unless turned on: nothing over the student's staff
  // turned on (the Learning page of the settings saves the same): the screen draws it from then on
  await page.evaluate(async () => {
    await window.__game.registry.get('context').profiles.updateLearnSettings({ liveTempo: true });
    (window.__game.scene.getScene('practice') as unknown as { redraw: () => void }).redraw();
  });
  await expect.poll(live).toEqual(['Tempo -', 'Spread - Wobble -']);
  // in the slim strip at the foot, never in the top bar: both lines in the screen's lowest tenth, at its right side
  const where = await page.evaluate(() => {
    type Node = { type: string; text?: string; pixelText?: boolean; visible: boolean; list?: Node[]; getBounds?: () => { x: number; y: number; height: number } };
    const scene = window.__game.scene.getScene('practice') as unknown as { children: { list: Node[] }; scale: { width: number; height: number } };
    const found: { x: number; y: number; bottom: number }[] = [];
    const visit = (nodes: Node[]) => {
      for (const o of nodes) {
        if (!o.visible) continue;
        if ((o.type === 'Text' || o.pixelText === true) && /^(Tempo|Spread) /.test(o.text ?? '') && o.getBounds) { const b = o.getBounds(); found.push({ x: b.x, y: b.y, bottom: b.y + b.height }); }
        if (o.type === 'Container' && o.list) visit(o.list);
      }
    };
    visit(scene.children.list);
    return { boxes: found, width: scene.scale.width, height: scene.scale.height };
  });
  expect(where.boxes).toHaveLength(2);
  for (const box of where.boxes) {
    expect(box.y).toBeGreaterThan(where.height * 0.9);
    expect(box.bottom).toBeLessThanOrEqual(where.height);
    expect(box.x).toBeGreaterThan(where.width / 2);
  }
  const { midis } = await shown(page);
  expect(midis.length).toBeGreaterThan(3);
  await playWithKeys(page, midis.slice(0, 3));
  await expect.poll(async () => (await live())[0]).toMatch(/^Tempo \d+$/);
  expect((await live())[1]).toMatch(/^Spread \d+% Wobble \d+%$/);
  // the stats pane no longer holds it
  await page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { toggleStatsPane: () => void }).toggleStatsPane());
  await expect.poll(async () => (await live()).length).toBe(2);
  expectNoErrors(errors);
});

test('ft_1_32.AC15 ft_1_32.AC22 a piece learned keeps its reward until a key, its clef grown to twice its size, then the book opens and the clef drops onto the card of the piece', async ({ page }) => {
  const errors = await openGame(page, '?device=virtual&learn=1');
  await learnPiece(page, 'Little Steps');
  const [steps, runs] = await page.evaluate(() => {
    const { plan } = (window.__game.scene.getScene('practice') as unknown as { learn: { plan: { runs: number }[] } }).learn;
    return [plan.length, plan[plan.length - 1]!.runs];
  });
  await page.keyboard.press('Escape');
  await waitForScene(page, 'menu');
  // the piece one run from learned: the last step's last run is all that is left
  await page.evaluate(({ step, streak }) => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return window.__game.registry.get('context').profiles.saveLearnProgress('little-steps', {
      step, wholeStreak: streak, recall: false, confirm: false, misses: 0, medals: [], lastDay: today, bpm: [100], stepBars: 1,
    });
  }, { step: steps - 1, streak: runs - 1 });
  await learnPieceAsked(page, 'Little Steps');
  await page.keyboard.press('Escape'); // go on
  await waitForScene(page, 'practice');
  // every note at its own time, at an even 100 BPM
  const notes = await page.evaluate(() => {
    const scene = window.__game.scene.getScene('practice') as unknown as { chart: { notes: { tick: number; midi: number; track: string }[]; tracks: { id: string; role: string }[] } };
    const play = new Set(scene.chart.tracks.filter((t) => t.role === 'play').map((t) => t.id));
    return scene.chart.notes.filter((n) => play.has(n.track)).sort((a, b) => a.tick - b.tick).map((n) => ({ tick: n.tick, midi: n.midi }));
  });
  let at = notes[0]!.tick;
  for (const n of notes) {
    if (n.tick > at) await page.waitForTimeout(((n.tick - at) / 480) * 600);
    at = n.tick;
    await page.evaluate((m) => { window.__virtualDevice!.press(m, 80); window.__virtualDevice!.release(m); }, n.midi);
  }
  await expect.poll(() => progress(page), { timeout: 10_000 }).toMatchObject({ step: steps });
  // the learned moment stays: still the practice screen, well after the next run would have started
  await page.waitForTimeout(3000);
  expect(await activeScenes(page)).toContain('practice');
  expect(await kiurSays(page)).toBe(''); // the grown clef is the message
  // the clef has lifted off the prize column and grown to twice its size where it stood
  expect(await page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { playSession: { clef: { scale: number } | null } }).playSession.clef?.scale)).toBe(2);
  // a key goes on: the book opens at the piece, and the clef drops from where it was onto the piece's card
  await page.evaluate(() => { window.__virtualDevice!.press(60, 80); window.__virtualDevice!.release(60); });
  await waitForScene(page, 'menu');
  const clefs = () => page.evaluate(() => {
    const scene = window.__game.scene.getScene('menu') as unknown as { children: { list: { name: string; list?: { name: string }[] }[] } };
    return scene.children.list.flatMap((o) => [o, ...(o.list ?? [])]).map((o) => o.name).filter((n) => n.startsWith('clef'));
  });
  await expect.poll(clefs).toContain('clefFlight');
  await expect.poll(clefs, { timeout: 5_000 }).not.toContain('clefFlight');
  expect((await clefs()).filter((n) => /^clefPrize:(gold|silver|bronze)$/.test(n))).toHaveLength(1);
  // a piece Kiur was asked to teach then goes back to the room, where Kiur waits with the tug
  await waitForScene(page, 'profile');
  expectNoErrors(errors);
});

test('ft_1_32.AC2 the whole piece three times: the first plays go on past a wrong key and count, the third starts again on a mistake and stays the third', async ({ page }) => {
  const errors = await openGame(page, '?device=virtual&learn=1');
  await learnPiece(page, 'Little Steps');
  const [steps, runs] = await page.evaluate(() => {
    const { plan } = (window.__game.scene.getScene('practice') as unknown as { learn: { plan: { runs: number }[] } }).learn;
    return [plan.length, plan[plan.length - 1]!.runs];
  });
  expect(runs).toBe(3);
  await page.keyboard.press('Escape');
  await waitForScene(page, 'menu');
  const seed = (streak: number) => page.evaluate(({ step, streak }) => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return window.__game.registry.get('context').profiles.saveLearnProgress('little-steps', {
      // asked again for its pace once already: quick keys are never stopped for speed here
      step, wholeStreak: streak, recall: false, confirm: false, misses: 0, unsteady: 1, medals: [], lastDay: today, bpm: [100], stepBars: 1,
    });
  }, { step: steps - 1, streak });
  const open = async () => {
    await learnPieceAsked(page, 'Little Steps');
    await page.keyboard.press('Escape'); // go on
    await waitForScene(page, 'practice');
  };
  // the first play: a wrong key in the middle, Wait mode waits for the right one, and the play counts
  await seed(0);
  await open();
  const { midis } = await shown(page);
  await playWithKeys(page, midis.slice(0, 2));
  await playWithKeys(page, [midis[2]! + 1]);
  await playWithKeys(page, midis.slice(2));
  await expect.poll(() => progress(page), { timeout: 10_000 }).toMatchObject({ step: steps - 1, wholeStreak: 1, misses: 1 });
  await page.keyboard.press('Escape');
  await waitForScene(page, 'menu');

  // the third play: a wrong key stops it, and it starts again from the first bar, still the third play
  await seed(2);
  await open();
  await playWithKeys(page, [midis[0]! + 1]);
  await expect.poll(() => nextRunStarted(page), { timeout: 10_000 }).toBe(true);
  expect(await progress(page)).toMatchObject({ step: steps - 1, wholeStreak: 2, misses: 1 });
  expect(await shown(page)).toMatchObject({ first: 0 });
  expect(await kiurSays(page)).toBe('');
  expectNoErrors(errors);
});

test('a play of the whole piece in learning is saved as a pass of the piece itself, with its XP', async ({ page }) => {
  const errors = await openGame(page, '?device=virtual&learn=1');
  await learnPiece(page, 'Little Steps');
  const steps = await page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { learn: { plan: unknown[] } }).learn.plan.length);
  await page.keyboard.press('Escape');
  await waitForScene(page, 'menu');
  // the first of the whole piece's three plays is next; asked again for its pace once already, so any pace counts
  await page.evaluate((step) => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return window.__game.registry.get('context').profiles.saveLearnProgress('little-steps', {
      step, wholeStreak: 0, recall: false, confirm: false, misses: 0, unsteady: 1, medals: [], lastDay: today, bpm: [100], stepBars: 1,
    });
  }, steps - 1);
  await learnPieceAsked(page, 'Little Steps');
  await page.keyboard.press('Escape'); // go on
  await waitForScene(page, 'practice');
  await playWithKeys(page, (await shown(page)).midis);
  await expect.poll(() => progress(page), { timeout: 10_000 }).toMatchObject({ wholeStreak: 1 });
  const record = (id: string) => page.evaluate((i) => window.__game.registry.get('context').profiles.recordFor(i)?.completions ?? 0, id);
  await expect.poll(() => record('little-steps'), { timeout: 10_000 }).toBe(1);
  expect(await pieceXp(page, 'little-steps')).toBeGreaterThan(0);
  expect(await record('little-steps#bars-1-4')).toBe(0);
  expectNoErrors(errors);
});

test('ft_1_32.AC22 Esc at the learned moment goes on as a key does: the book opens and the clef drops onto the piece', async ({ page }) => {
  const errors = await openGame(page, '?device=virtual&learn=1');
  await learnPiece(page, 'Little Steps');
  const [steps, runs] = await page.evaluate(() => {
    const { plan } = (window.__game.scene.getScene('practice') as unknown as { learn: { plan: { runs: number }[] } }).learn;
    return [plan.length, plan[plan.length - 1]!.runs];
  });
  await page.keyboard.press('Escape');
  await waitForScene(page, 'menu');
  // the piece one run from learned; asked again for its pace once already, so any pace counts
  await page.evaluate(({ step, streak }) => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return window.__game.registry.get('context').profiles.saveLearnProgress('little-steps', {
      step, wholeStreak: streak, recall: false, confirm: false, misses: 0, unsteady: 1, medals: [], lastDay: today, bpm: [100], stepBars: 1,
    });
  }, { step: steps - 1, streak: runs - 1 });
  await learnPieceAsked(page, 'Little Steps');
  await page.keyboard.press('Escape'); // go on
  await waitForScene(page, 'practice');
  await playWithKeys(page, (await shown(page)).midis);
  await expect.poll(() => progress(page), { timeout: 10_000 }).toMatchObject({ step: steps });
  // the learned moment: the clef grown, waiting
  await expect.poll(() => page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { learnedGoOn: unknown }).learnedGoOn !== null), { timeout: 10_000 }).toBe(true);
  await page.keyboard.press('Escape');
  await waitForScene(page, 'menu');
  expectNoErrors(errors);
});
