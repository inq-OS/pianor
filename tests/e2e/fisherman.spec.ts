// Covers ft_1_22.AC1 and AC10 for the second character, the Prangli fisherman (WP-17): he stands at the port, is "???"
// until asked who he is, and tells where his first tune comes from before teaching it.
import { expect, test, type Page } from '@playwright/test';
import { clickButton, expectNoErrors, letGameRun, openGame, sceneButton, waitForScene, type PageErrors } from './helpers';

interface TalkState { showing: 'line' | 'student' | 'choices'; node: string; line: string; choices: string[] }

const talk = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('port') as unknown as { talkState: TalkState | null }).talkState);
const world = (page: Page) => page.evaluate(async () => {
  const { profiles } = window.__game.registry.get('context');
  return (await profiles.worldOf(profiles.profile.id)) as { flags: string[] };
});

/** The port with its characters standing (`?actors=1`). */
async function openPort(page: Page): Promise<PageErrors> {
  const errors = await openGame(page, '?actors=1');
  await page.evaluate(() => {
    window.__game.scene.stop('menu');
    window.__game.scene.start('port');
  });
  await waitForScene(page, 'port');
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

test.describe('the Prangli fisherman at the port (WP-17)', () => {
  test('ft_1_22.AC10 the fisherman is "???" until asked who he is; then his name shows and he tells about his first tune', async ({ page }) => {
    const errors = await openPort(page);
    expect(await sceneButton(page, 'port', 'Fisherman')).toBe(-1);
    await clickButton(page, 'port', await sceneButton(page, 'port', '???'));
    await expect.poll(() => talk(page)).toMatchObject({ showing: 'line', node: 'hello', line: 'talk.fisherman.hello' });
    await pressToChoices(page);
    expect(await talk(page)).toMatchObject({ showing: 'choices', node: 'ask', choices: ['talk.fisherman.askWho', 'talk.fisherman.askTeach', 'talk.fisherman.askLater'] });
    await page.keyboard.press('Enter'); // "Who are you?"
    await pressToChoices(page);
    expect(await talk(page)).toMatchObject({ showing: 'choices', node: 'who' });
    expect((await world(page)).flags).toEqual(expect.arrayContaining(['met-fisherman', 'known-fisherman']));
    await page.keyboard.press('Enter'); // "Teach me a song!": he says where it comes from first
    await expect.poll(() => talk(page)).toMatchObject({ line: 'talk.fisherman.askTeach' });
    await page.keyboard.press('Space');
    expect(await talk(page)).toMatchObject({ showing: 'line', node: 'teach', line: 'piece.fisherman-1.about' });
    await waitForScene(page, 'port');
    expectNoErrors(errors);
  });
});
