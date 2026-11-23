import { expect, test, type Page } from '@playwright/test';
import { clickButton, clickToolbar, expectNoErrors, openGame, openPiece, sceneButton, sceneTexts, toPieceList, toScoreScreen, waitForScene, reachButton } from './helpers';

/** Press the practice button `label` once it is drawn: the mode button starts the screen over, so wait for the new one. */
async function pressWhenShown(page: Page, label: string): Promise<void> {
  await expect.poll(() => sceneButton(page, 'practice', label)).toBeGreaterThanOrEqual(0);
  await clickButton(page, 'practice', await sceneButton(page, 'practice', label));
}

/** The settings screen's buttons, in the order it makes them: the timing view's button comes after the staff settings and the chord fingers (d088). */
const SCORE = 5;

const playSettings = (page: Page) => page.evaluate(() => window.__game.registry.get('context').profiles.playSettings as { mode: string; scoreView: string });

test.describe('tempo mode (slice c)', () => {
  test('is chosen on the practice screen with a real click, the score view in the settings, and both are kept for the player @smoke', async ({ page }) => {
    const errors = await openGame(page);
    expect(await playSettings(page)).toEqual({ mode: 'wait', scoreView: 'colour' });
    await openPiece(page, 'Little Steps');
    expect(await page.evaluate(() => window.__game.scene.getScene('practice').transport)).toBeNull();
    await pressWhenShown(page, 'Wait'); // the fermata: a press switches to the following clock
    await expect.poll(() => playSettings(page)).toMatchObject({ mode: 'tempo', tempoClock: 'follow' });
    await pressWhenShown(page, 'Tempo that follows you'); // and the next to Tempo
    await expect.poll(() => playSettings(page)).toEqual({ mode: 'tempo', scoreView: 'colour', tempoStart: 'anyKey', tempoClock: 'strict' });
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('practice').transport !== null)).toBe(true);
    expect(await sceneTexts(page, 'practice')).toContain('Press any key to start. One bar is counted in.');
    expect(await sceneButton(page, 'practice', 'Tempo')).toBeGreaterThanOrEqual(0); // now the metronome
    await page.keyboard.press('Escape');
    await waitForScene(page, 'menu');

    await clickToolbar(page, 'settings');
    await waitForScene(page, 'settings');
    expect(await sceneTexts(page, 'settings')).toContain('Note timing (Tempo)');
    expect(await sceneTexts(page, 'settings')).not.toContain('How to play');
    await clickButton(page, 'settings', SCORE);
    await expect.poll(() => playSettings(page)).toEqual({ mode: 'tempo', scoreView: 'number', tempoStart: 'anyKey', tempoClock: 'strict' });
    await page.reload();
    await page.waitForFunction(() => window.__game?.scene.getScenes(true).some((s: { scene: { key: string } }) => s.scene.key === 'profiles'));
    await toPieceList(page);
    expect(await playSettings(page)).toEqual({ mode: 'tempo', scoreView: 'number', tempoStart: 'anyKey', tempoClock: 'strict' });
    expectNoErrors(errors);
  });

  test('the first key starts a count-in, then a line runs and the notes played on time are scored', async ({ page }) => {
    test.slow(); // a bar counted in, then the whole piece at its own speed
    const errors = await openGame(page);
    await page.evaluate(() => window.__game.registry.get('context').profiles.updatePlaySettings({ mode: 'tempo', scoreView: 'number' }));
    await openPiece(page, 'Little Steps');
    expect(await sceneTexts(page, 'practice')).toContain('Press any key to start. One bar is counted in.');
    expect(await page.evaluate(() => window.__game.scene.getScene('practice').transport.started)).toBe(false);

    // the starting key: it is not a note
    await page.evaluate(() => {
      window.__virtualDevice!.press(60);
      window.__virtualDevice!.release(60);
    });
    expect(await page.evaluate(() => window.__game.scene.getScene('practice').transport.started)).toBe(true);
    // the count-in was shown: the scene saw a beat of it (the bubble says 1, 2, 3, 4 and is gone before this line may run)
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('practice').lastBeat)).toBeGreaterThanOrEqual(0);
    expect(await page.evaluate(() => window.__game.scene.getScene('practice').playSession.controller.getState().stepIndex)).toBe(0);

    // play every note when its time comes, on the game's own clock, and hold it to just before its end (core_01.AC6)
    await page.evaluate(
      (midis) =>
        new Promise<void>((resolve) => {
          const scene = window.__game.scene.getScene('practice');
          const clock = window.__game.registry.get('context').audio.clock;
          let next = 0;
          let down: { midi: number; upAt: number } | null = null;
          const frame = () => {
            const now = clock.nowMs();
            if (down && now >= down.upAt) {
              window.__virtualDevice!.release(down.midi);
              down = null;
            }
            const note = scene.chart.notes[next];
            if (!note && !down) return resolve();
            if (note && now >= scene.transport.timeOfTick(note.tick)) {
              if (down) window.__virtualDevice!.release(down.midi); // the same key again: up first
              window.__virtualDevice!.press(midis[next]!);
              down = { midi: midis[next]!, upAt: scene.transport.timeOfTick(note.tick + note.dur) - 40 };
              next++;
            }
            requestAnimationFrame(frame);
          };
          frame();
        }),
      [60, 62, 64, 65, 67, 65, 65, 64, 62, 60, 60],
    );
    await toScoreScreen(page);
    const result = await page.evaluate(() => window.__game.scene.getScene('results').result);
    expect(result).toMatchObject({ notes: 11, accuracy: 1, timing: { played: 11, missed: 0 } });
    expect(result.timing.score).toBeGreaterThan(60);
    // the history says how it was played; the score screen keeps no timing lines (ft_1_12.AC4, clean-screen rule)
    expect(await page.evaluate(() => window.__game.registry.get('context').profiles.profile.attempts[0].play)).toEqual({ mode: 'tempo', tempoPercent: 100 });
    expectNoErrors(errors);
  });

  test('without a single key after the start every note is missed, and the piece still ends, never failing the student', async ({ page }) => {
    test.slow();
    const errors = await openGame(page);
    await page.evaluate(() => window.__game.registry.get('context').profiles.updatePlaySettings({ mode: 'tempo' }));
    await openPiece(page, 'Little Steps');
    await page.evaluate(() => {
      window.__virtualDevice!.press(60);
      window.__virtualDevice!.release(60);
    });
    await toScoreScreen(page);
    const result = await page.evaluate(() => window.__game.scene.getScene('results').result);
    expect(result).toMatchObject({ notes: 11, accuracy: 0, timing: { played: 0, missed: 11, score: 0 } });
    expect(await sceneTexts(page, 'results')).not.toContain('Failed');
    expectNoErrors(errors);
  });

  test('core_01.AC8: a note let go at once changes its colour and its number when released', async ({ page }) => {
    const errors = await openGame(page);
    await page.evaluate(() => window.__game.registry.get('context').profiles.updatePlaySettings({ mode: 'tempo', scoreView: 'number' }));
    await openPiece(page, 'Little Steps');
    await page.evaluate(() => {
      window.__virtualDevice!.press(60);
      window.__virtualDevice!.release(60);
    });
    type Look = { timing: { hold?: number; score: number }; colour: unknown; number: string };
    // the first note, pressed on its time and let go 50 ms later: both key events carry their own times on the audio
    // clock (as a real MIDI event does), and both are sent in one task, so no frame runs between them and the result is
    // the same at any frame rate. Waiting for the release in a later round trip let a slow frame decide the hold
    // as full first.
    const { held, released } = await page.evaluate(() => new Promise<{ held: Look; released: Look }>((resolve) => {
      const scene = window.__game.scene.getScene('practice');
      const clock = window.__game.registry.get('context').audio.clock;
      const look = (): Look => {
        const session = scene.playSession;
        const timing = session.controller.getState().timings[0];
        const slot = session.staffView.layout.notes.findIndex((n: { index: number }) => n.index === 0);
        return { timing, colour: session.staffView.scoreColours[slot], number: session.staffView.scoreTexts[slot].text };
      };
      // the DOM time (performance.now) of a song time, as the autoplay scheduler maps it
      const domAt = (songMs: number) => { const now = performance.now(); return now + (songMs - clock.fromDomTime(now)); };
      const frame = () => {
        const due = scene.transport.timeOfTick(0) as number;
        // during the count-in, before the first note's window can close; the press is stamped with the note's own time
        if (clock.nowMs() >= due - 500) {
          window.__virtualDevice!.press(60, 80, domAt(due));
          const held = look();
          window.__virtualDevice!.release(60, domAt(due + 50));
          return resolve({ held, released: look() });
        }
        requestAnimationFrame(frame);
      };
      frame();
    }));
    expect(held.timing.hold).toBeUndefined();
    expect(held.number).toBe(String(held.timing.score));
    expect(released.timing.hold).toBeGreaterThan(0);
    expect(released.timing.hold).toBeLessThan(100);
    expect(released.timing.score).toBeLessThan(held.timing.score);
    expect(released.number).toBe(String(released.timing.score));
    expect(released.colour).not.toBe(held.colour);
    expectNoErrors(errors);
  });
});

/** What the practice screen's Tempo clock and judge say now. */
const tempoState = (page: Page) => page.evaluate(() => {
  const scene = window.__game.scene.getScene('practice');
  const state = scene.playSession.controller.getState();
  return {
    tempo: scene.transport !== null, started: scene.transport?.started === true, countInBars: scene.transport?.countInBars as number | undefined,
    songStartMs: scene.transport?.songStartMs as number | null | undefined, stepIndex: state.stepIndex as number,
    firstVerdict: state.timings?.[0]?.verdict as string | undefined, watching: scene.missedBars !== null,
    nowMs: window.__game.registry.get('context').audio.clock.nowMs() as number,
  };
});

test.describe('tempo mode: the clock that follows the player (core_01 slice h)', () => {
  test('core_01.AC12 core_01.AC13: the mode button gives the following clock; a note played long after its time is still that note, and there is no click', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await pressWhenShown(page, 'Wait');
    await expect.poll(() => playSettings(page)).toMatchObject({ mode: 'tempo', tempoStart: 'firstNote', tempoClock: 'follow' });
    await expect.poll(() => tempoState(page).then((s) => s.countInBars)).toBe(0);
    expect(await sceneButton(page, 'practice', 'Tempo that follows you')).toBeGreaterThanOrEqual(0);
    const look = () => page.evaluate(() => {
      const scene = window.__game.scene.getScene('practice');
      const state = scene.playSession.controller.getState();
      return { clickOn: scene.clickOn as boolean, progress: state.noteProgress.slice(0, 3) as string[], verdicts: (state.timings as ({ verdict: string } | null)[]).slice(0, 3).map((x) => x?.verdict) };
    });
    expect((await look()).clickOn).toBe(false);

    // Little Steps: C D E ... in quarters at 70 bpm, so the second note's window is over 430 ms after its time
    await page.evaluate(() => {
      window.__virtualDevice!.press(60);
      window.__virtualDevice!.release(60);
    });
    expect((await tempoState(page)).started).toBe(true);
    await page.waitForTimeout(2500);
    expect((await look()).progress).toEqual(['correct', 'pending', 'pending']); // waited for, not missed
    await page.evaluate(() => {
      window.__virtualDevice!.press(62);
      window.__virtualDevice!.release(62);
    });
    await expect.poll(() => look()).toMatchObject({ progress: ['correct', 'correct', 'pending'], verdicts: ['on-time', 'late', undefined] });

    // the click's button says why it stays off
    await clickButton(page, 'practice', await reachButton(page, 'practice', 'Click'));
    expect((await look()).clickOn).toBe(false);
    expect(await sceneTexts(page, 'practice')).toContain('No click while the tempo follows you.');
    expectNoErrors(errors);
  });
});

test.describe('tempo mode: the start on the first note and the auto reset (core_01 slice g)', () => {
  test('core_01.AC10: the mode button cycles to Tempo from the first note; a wrong key waits, the first note starts it with no count-in', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await pressWhenShown(page, 'Wait');
    await expect.poll(() => playSettings(page)).toMatchObject({ mode: 'tempo', tempoClock: 'follow' });
    await pressWhenShown(page, 'Tempo that follows you');
    await expect.poll(() => playSettings(page)).toMatchObject({ mode: 'tempo', tempoStart: 'anyKey' });
    await expect.poll(() => tempoState(page).then((s) => s.tempo)).toBe(true);
    await pressWhenShown(page, 'Tempo');
    await expect.poll(() => playSettings(page)).toMatchObject({ mode: 'tempo', tempoStart: 'firstNote' });
    await expect.poll(() => tempoState(page).then((s) => s.countInBars)).toBe(0);
    expect(await sceneTexts(page, 'practice')).not.toContain('Press any key to start. One bar is counted in.');
    expect(await sceneButton(page, 'practice', 'Tempo from the first note')).toBeGreaterThanOrEqual(0);

    await page.evaluate(() => {
      window.__virtualDevice!.press(61);
      window.__virtualDevice!.release(61);
    });
    expect((await tempoState(page)).started).toBe(false);
    await page.evaluate(() => window.__virtualDevice!.press(60));
    expect((await tempoState(page)).started).toBe(true);
    expect((await tempoState(page)).stepIndex).toBe(1);
    expect((await tempoState(page)).firstVerdict).toBe('on-time');
    await page.evaluate(() => window.__virtualDevice!.release(60));

    // a third press: back to Wait
    await pressWhenShown(page, 'Tempo from the first note');
    await expect.poll(() => playSettings(page)).toMatchObject({ mode: 'wait' });
    expectNoErrors(errors);
  });

  test('core_01.AC11: switched on, two bars with nothing played start the piece over, and it waits for the start again', async ({ page }) => {
    test.slow(); // three bars of Little Steps at 70 bpm
    const errors = await openGame(page);
    await page.evaluate(() => window.__game.registry.get('context').profiles.updatePlaySettings({ mode: 'tempo', tempoStart: 'firstNote' }));
    await openPiece(page, 'Little Steps');
    // the switch is a lit item in Tempo mode only, and is saved for the player
    await pressWhenShown(page, 'Start over after 2 bars not played');
    await expect.poll(() => playSettings(page)).toMatchObject({ autoReset: true });
    await expect.poll(() => tempoState(page).then((s) => s.watching)).toBe(true);

    await page.evaluate(() => {
      window.__virtualDevice!.press(60);
      window.__virtualDevice!.release(60);
    });
    expect((await tempoState(page)).started).toBe(true);
    const startedAt = (await tempoState(page)).songStartMs!;
    // nothing more is played: bar 1 still had a right note, bars 2 and 3 have none, and the play starts over once bar 3's last note has passed
    await expect.poll(() => tempoState(page).then((s) => s.started), { timeout: 20_000 }).toBe(false);
    const after = await tempoState(page);
    expect(after.nowMs - startedAt).toBeGreaterThan(2 * 4 * (60000 / 70)); // past bar 2, at the last note of bar 3
    expect(after.stepIndex).toBe(0);
    // it waits: no count-in runs and the first note starts it again
    await page.waitForTimeout(500);
    expect((await tempoState(page)).started).toBe(false);
    await page.evaluate(() => window.__virtualDevice!.press(60));
    expect((await tempoState(page)).started).toBe(true);
    expectNoErrors(errors);
  });
});
