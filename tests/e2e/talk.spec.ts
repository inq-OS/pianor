// Covers ft_1_22.AC1 and AC10 (WP-09): pressing a character opens a conversation over the scene; choices by mouse and keys.
import { expect, test, type Page } from '@playwright/test';
import { activeScenes, clickButton, expectNoErrors, letGameRun, openGame, sceneButton, waitForScene, type PageErrors } from './helpers';

interface TalkState { showing: 'line' | 'student' | 'choices'; node: string; line: string; page: number; choices: string[]; lit: number }

const talk = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('knoll') as unknown as { talkState: TalkState | null }).talkState);
const world = (page: Page) => page.evaluate(async () => {
  const { profiles } = window.__game.registry.get('context');
  return (await profiles.worldOf(profiles.profile.id)) as { flags: string[]; met: Record<string, unknown> };
});

/** The knoll with its characters standing (`?actors=1`; later they come by presence, WP-11). */
async function openKnoll(page: Page): Promise<PageErrors> {
  const errors = await openGame(page, '?actors=1');
  await page.evaluate(() => {
    window.__game.scene.stop('menu');
    window.__game.scene.start('knoll');
  });
  await waitForScene(page, 'knoll');
  await letGameRun(page, 3, 50);
  return errors;
}

/** Press Space until the talk shows its choices (or ends). */
async function pressToChoices(page: Page): Promise<void> {
  for (let i = 0; i < 12; i++) {
    const state = await talk(page);
    if (!state || state.showing === 'choices') return;
    await page.keyboard.press('Space');
  }
}

test.describe('a conversation in the scene (ft_1_22.AC1, WP-09)', () => {
  test('ft_1_22.AC1 pressing Puuvaim opens his greeting and his music; Space turns the lines; his choices show over the band; leaving closes it and he remembers', async ({ page }) => {
    const errors = await openKnoll(page);
    // click the tree spirit where he stands: not asked who he is yet, he is "???" (ft_1_22.AC10)
    expect(await sceneButton(page, 'knoll', 'Oak spirit')).toBe(-1);
    const spirit = await sceneButton(page, 'knoll', '???');
    expect(spirit).toBeGreaterThanOrEqual(0);
    await clickButton(page, 'knoll', spirit);
    await expect.poll(() => talk(page)).toMatchObject({ showing: 'line', node: 'hello', line: 'talk.puuvaim.hello' });
    await pressToChoices(page);
    // before his phrase is taught he offers no tug (learn before show, ft_1_22.AC3)
    expect(await talk(page)).toMatchObject({ showing: 'choices', node: 'ask', choices: ['talk.puuvaim.askWho', 'talk.puuvaim.askTeach', 'talk.puuvaim.askLater'], lit: 0 });
    // the arrows move the lit choice, and wrap round
    await page.keyboard.press('ArrowDown');
    expect((await talk(page))!.lit).toBe(1);
    await page.keyboard.press('ArrowDown');
    expect((await talk(page))!.lit).toBe(2);
    await page.keyboard.press('ArrowDown');
    expect((await talk(page))!.lit).toBe(0);
    await page.keyboard.press('ArrowUp');
    expect((await talk(page))!.lit).toBe(2);
    // Enter picks the lit "I will come later" (a number key picks too: the tug's test), and the student says it first
    await page.keyboard.press('Enter');
    expect(await talk(page)).toMatchObject({ showing: 'student', line: 'talk.puuvaim.askLater' });
    await page.keyboard.press('Space'); // the student's line said, his goodbye follows
    expect(await talk(page)).toMatchObject({ showing: 'line', node: 'bye' });
    await page.keyboard.press('Space');
    expect(await talk(page)).toBeNull();
    await waitForScene(page, 'knoll'); // the talk ended in the scene; Back did not leave it
    const w = await world(page);
    expect(w.flags).toContain('met-puuvaim');
    expect(Object.keys(w.met)).toContain('puuvaim');
    // talking and leaving is not enough: he is still "???"
    expect(w.flags).not.toContain('known-puuvaim');
    expect(await sceneButton(page, 'knoll', '???')).toBeGreaterThanOrEqual(0);
    expectNoErrors(errors);
  });

  test('ft_1_22.AC10 asked "Who are you?", he says who he is and his name shows from then on, also on the next visit', async ({ page }) => {
    const errors = await openKnoll(page);
    await clickButton(page, 'knoll', await sceneButton(page, 'knoll', '???'));
    await pressToChoices(page);
    await page.keyboard.press('1'); // "Who are you?"
    expect(await talk(page)).toMatchObject({ showing: 'student', line: 'talk.puuvaim.askWho' });
    await page.keyboard.press('Space');
    await expect.poll(() => talk(page)).toMatchObject({ node: 'who', line: 'talk.puuvaim.who' });
    // his name is on him at once, and kept in the world
    await expect.poll(() => sceneButton(page, 'knoll', 'Oak spirit')).toBeGreaterThanOrEqual(0);
    expect(await sceneButton(page, 'knoll', '???')).toBe(-1);
    await expect.poll(async () => (await world(page)).flags).toContain('known-puuvaim');
    await page.keyboard.press('Escape');
    expect(await talk(page)).toBeNull();
    // the next visit: named as soon as the world is read, and his menu has no "Who are you?"
    await page.evaluate(() => { window.__game.scene.stop('knoll'); window.__game.scene.start('knoll'); });
    await waitForScene(page, 'knoll');
    await expect.poll(() => sceneButton(page, 'knoll', 'Oak spirit')).toBeGreaterThanOrEqual(0);
    expect(await page.evaluate(() => (window.__game.scene.getScene('knoll') as unknown as { talkTo(id: string): Promise<boolean> }).talkTo('puuvaim'))).toBe(true);
    await pressToChoices(page);
    expect(await talk(page)).toMatchObject({ node: 'menu', choices: ['talk.puuvaim.askTeach', 'talk.puuvaim.askLater'] });
    expectNoErrors(errors);
  });

  test('ft_1_22.AC1 a choice is picked with the mouse, and a second visit skips the greeting; Esc leaves the talk, not the scene', async ({ page }) => {
    const errors = await openKnoll(page);
    const open = () => page.evaluate(() => (window.__game.scene.getScene('knoll') as unknown as { talkTo(id: string): Promise<boolean> }).talkTo('puuvaim'));
    expect(await open()).toBe(true);
    await pressToChoices(page);
    // a click on the picture beside the choices picks nothing (a student's stray tap)
    const canvas = (await page.locator('canvas').boundingBox())!;
    await page.mouse.click(canvas.x + canvas.width * 0.7, canvas.y + canvas.height * 0.3);
    await letGameRun(page, 3, 50);
    expect(await talk(page)).toMatchObject({ showing: 'choices' });
    // click the third choice (later) on the board: its words are drawn there
    const at = await page.evaluate(() => {
      const scene = window.__game.scene.getScene('knoll') as unknown as { children: { list: { list?: { name: string; getBounds(): { x: number; y: number; width: number; height: number } }[] }[] } };
      const words = scene.children.list.flatMap((c) => c.list ?? []).find((o) => o.name === 'talkChoice:2');
      if (!words) return null;
      const b = words.getBounds();
      const canvas = document.querySelector('canvas')!;
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + ((b.x + b.width / 2) / canvas.width) * rect.width, y: rect.top + ((b.y + b.height / 2) / canvas.height) * rect.height };
    });
    expect(at).not.toBeNull();
    await page.mouse.click(at!.x, at!.y);
    await expect.poll(() => talk(page)).toMatchObject({ showing: 'student', line: 'talk.puuvaim.askLater' });
    await page.keyboard.press('Escape');
    expect(await talk(page)).toBeNull();
    await letGameRun(page, 3, 50);
    expect(await activeScenes(page)).toContain('knoll');
    // met before: the greeting is skipped, the talk opens on his menu (still with "Who are you?", AC10)
    expect(await open()).toBe(true);
    expect(await talk(page)).toMatchObject({ node: 'ask' });
    expectNoErrors(errors);
  });
});
