// Covers ft_0_11.AC1.
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { activeScenes, playWithVirtualPiano, waitForScene } from './helpers';

/**
 * The piece preview page (`?demo=preview`, `npm run piece:preview`). These tests only read from the dev server and
 * never change a piece file: the approve button is tested against a stand-in for the server's answer.
 */
const URL = '/?demo=preview&device=virtual';

/** Hot Cross Buns: E D C D | E D C | C C D D | E D C */
const HOT_CROSS_BUNS = [64, 62, 60, 62, 64, 62, 60, 60, 60, 62, 62, 64, 62, 60];

async function openPreview(page: Page, hash = ''): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  await page.goto(`${URL}${hash}`);
  await page.waitForFunction(() => window.__game?.scene.getScenes(true).some((s) => s.scene.key === 'preview') && window.__game.registry.get('context')?.audio?.piano?.loaded === true);
  await expect(page.getByTestId('abc')).not.toHaveValue('');
  return errors;
}

const staff = (page: Page) =>
  page.evaluate(() => {
    const view = window.__game.scene.getScene('preview').view;
    return view ? { notes: view.layout.notes.length as number, fits: view.layout.fits as boolean, lit: [...view.cursors] as number[] } : null;
  });

test.describe('piece preview page', () => {
  test('lists every piece on disk with its status, level, difficulty and problem counts, plus a scratch piece', async ({ page }) => {
    const errors = await openPreview(page);
    const rows = page.locator('[data-testid^="piece-"]');
    expect(await rows.count()).toBeGreaterThanOrEqual(11);
    await expect(page.getByTestId('piece-hot-cross-buns')).toContainText('Hot Cross Buns');
    await expect(page.getByTestId('piece-hot-cross-buns')).toContainText('L1');
    await expect(page.getByTestId('piece-hot-cross-buns')).toContainText('0e');
    await expect(page.getByTestId('piece-take-turns')).toContainText('L4');
    await expect(page.getByTestId('piece-scratch')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('selecting a piece checks it and draws it with the real staff renderer', async ({ page }) => {
    const errors = await openPreview(page);
    await page.getByTestId('piece-ode-to-joy').click();
    await expect(page.getByTestId('abc')).toHaveValue(/Ode to Joy/);
    await expect(page.getByTestId('diagnostics')).toContainText('No errors or warnings.');
    await expect(page.locator('body')).toContainText('fits levels 1');
    await expect(page.locator('body')).toContainText(/difficulty \d+\/100, \w+ [\d.]+ stars, proposed \(not confirmed, score [\d.]+/); // core_08.AC3
    await expect(page.locator('body')).toContainText(/Parts: .+ \d+\/100/); // core_08.AC7
    expect(await staff(page)).toMatchObject({ notes: 30, fits: true });
    expect(page.url()).toContain('#ode-to-joy');
    expect(errors).toEqual([]);
  });

  test('the difficulty panel scores any passage, clicked or typed, and says why (core_08.AC8, core_08.AC10)', async ({ page }) => {
    const errors = await openPreview(page, '#ode-to-joy');
    const panel = page.getByTestId('difficulty');
    await expect(panel.getByTestId('difficulty-whole')).toContainText(/difficulty \d+\/100, \w+ [\d.]+ stars, proposed/);
    await expect(panel.locator('[data-testid^="difficulty-bar-"]')).toHaveCount(8);
    await panel.getByTestId('difficulty-bar-2').click();
    await panel.getByTestId('difficulty-bar-4').click({ modifiers: ['Shift'] });
    await expect(page.getByTestId('passage')).toHaveValue('2-4');
    await expect(page.getByTestId('passage-result')).toContainText(/Passage 2-4: difficulty \d+\/100/);
    await expect(panel).toContainText(/bar +3 +[\d.]+ +\d+ presses/);
    await page.getByTestId('passage').fill('7-8, 1');
    await expect(page.getByTestId('passage-result')).toContainText('Passage 7-8, 1:');
    await page.getByTestId('passage').fill('9');
    await expect(page.getByTestId('passage-result')).toContainText('9: this piece has bars 1 to 8');
    expect(errors).toEqual([]);
  });

  test('a two-hand piece is drawn as a grand staff', async ({ page }) => {
    const errors = await openPreview(page, '#both-hands');
    await expect.poll(async () => (await staff(page))?.notes).toBe(26);
    expect(await page.evaluate(() => window.__game.scene.getScene('preview').view.layout.systems[0].staves.length)).toBe(2);
    expect(errors).toEqual([]);
  });

  test('typing an error shows the linter message with its line, says so instead of a staff, and clicking it selects the line', async ({ page }) => {
    const errors = await openPreview(page);
    await page.getByTestId('piece-scratch').click();
    const abc = page.getByTestId('abc');
    const text = (await abc.inputValue()).replace('G2 F2', 'G2 C2'); // a fifth down: too big a jump for level 1
    await abc.fill(text);
    const diagnostics = page.getByTestId('diagnostics');
    await expect(diagnostics).toContainText('level 1 allows at most a step', { timeout: 5000 });
    await expect(diagnostics).toContainText('[leap]');
    await expect(diagnostics.locator('li').first()).toContainText('scratch/piece.abc:');
    // a syntax error: no chart, no staff, and the buttons that need one are off
    await abc.fill(text.replace('C4 |]', 'C4 $ |]'));
    await expect(diagnostics).toContainText('error', { timeout: 5000 });
    await expect(page.getByTestId('listen')).toBeDisabled();
    await expect(page.getByTestId('play-along')).toBeDisabled();
    expect(await staff(page)).toBeNull();
    // clicking a message selects its line in the box
    await diagnostics.locator('li').first().click();
    const selected = await abc.evaluate((box: HTMLTextAreaElement) => box.value.slice(box.selectionStart, box.selectionEnd));
    expect(selected.length).toBeGreaterThan(0);
    expect(text.replace('C4 |]', 'C4 $ |]')).toContain(selected);
    expect(errors).toEqual([]);
  });

  test('editing the scratch piece redraws the staff and keeps the text across a reload', async ({ page }) => {
    const errors = await openPreview(page);
    await page.getByTestId('piece-scratch').click();
    const before = await staff(page);
    expect(before?.notes).toBe(11);
    const abc = page.getByTestId('abc');
    await abc.fill((await abc.inputValue()).replace('C4 |]', 'C2 D2 | E4 |]'));
    await expect.poll(async () => (await staff(page))?.notes, { timeout: 5000 }).toBe(13);
    await page.reload();
    await page.waitForFunction(() => window.__game?.scene.getScene('preview'));
    await page.getByTestId('piece-scratch').click();
    await expect(page.getByTestId('abc')).toHaveValue(/E4 \|\]/);
    expect(errors).toEqual([]);
  });

  test('listen plays the piece through the sampler and lights the notes as they sound, and stop silences it', async ({ page }) => {
    const errors = await openPreview(page, '#hot-cross-buns');
    await expect.poll(async () => (await staff(page))?.notes).toBe(14);
    const voices = () => page.evaluate(() => window.__game.registry.get('context').audio.piano.voiceCount as number);
    await page.getByTestId('listen').click();
    await expect(page.getByTestId('listen')).toHaveText('Stop');
    await expect.poll(voices, { timeout: 5000 }).toBeGreaterThan(0);
    await expect.poll(async () => (await staff(page))?.lit.length ?? 0, { timeout: 5000 }).toBeGreaterThan(0);
    await page.getByTestId('listen').click();
    await expect(page.getByTestId('listen')).toHaveText('Listen');
    expect((await staff(page))?.lit).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('listen finishes by itself and goes back to Listen', async ({ page }) => {
    const errors = await openPreview(page);
    await page.getByTestId('piece-scratch').click();
    const abc = page.getByTestId('abc');
    await abc.fill((await abc.inputValue()).replace('Q:1/4=80', 'Q:1/4=300')); // 11 notes in about 4 seconds
    // wait until the page has taken the edit (it checks 250 ms after typing stops, and a new chart stops playback)
    await expect
      .poll(() => page.evaluate(() => window.__game.scene.getScene('preview').state().show.chart?.tempoMap[0].bpm), { timeout: 5000 })
      .toBe(300);
    await page.getByTestId('listen').click();
    await expect(page.getByTestId('listen')).toHaveText('Stop');
    await expect(page.getByTestId('listen')).toHaveText('Listen', { timeout: 15_000 });
    expect((await staff(page))?.lit).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('play along runs the real practice scene on the draft, earns no XP, and returns to the preview with the result', async ({ page }) => {
    const errors = await openPreview(page, '#hot-cross-buns');
    await expect.poll(async () => (await staff(page))?.notes).toBe(14);
    await page.getByTestId('play-along').click();
    await waitForScene(page, 'practice');
    await playWithVirtualPiano(page, HOT_CROSS_BUNS);
    await waitForScene(page, 'preview');
    await expect(page.getByTestId('status')).toContainText('Played along: 100% right, 0 mistake(s)', { timeout: 10_000 });
    expect(await page.evaluate(() => window.__game.registry.get('context').profiles.progress.totalXp)).toBe(0);
    expect(await page.evaluate(() => window.__game.registry.get('context').profiles.profile.attempts.length)).toBe(0);
    expect((await staff(page))?.notes).toBe(14); // the staff is back
    expect(errors).toEqual([]);
  });

  test('Back and Escape in a play-along return to the preview, not the menu', async ({ page }) => {
    const errors = await openPreview(page, '#hot-cross-buns');
    await page.getByTestId('play-along').click();
    await waitForScene(page, 'practice');
    await page.keyboard.press('Escape');
    await waitForScene(page, 'preview');
    expect(await activeScenes(page)).not.toContain('menu');
    expect(errors).toEqual([]);
  });

  test('hint boxes show note names and finger numbers on the staff', async ({ page }) => {
    const errors = await openPreview(page, '#hot-cross-buns');
    await expect.poll(async () => (await staff(page))?.notes).toBe(14);
    const visibleHints = () =>
      page.evaluate(() => {
        const scene = window.__game.scene.getScene('preview');
        return (scene.children.list as { type: string; text?: string; visible: boolean }[]).filter((o) => o.type === 'Text' && o.visible && o.text !== '').length;
      });
    expect(await visibleHints()).toBe(0);
    await page.getByLabel('note names').check();
    await page.getByLabel('fingers').check();
    expect(await visibleHints()).toBe(28); // a letter and a finger for each of the 14 notes
    expect(errors).toEqual([]);
  });
});

test.describe('approving a piece', () => {
  /** Stand-in for the dev server's answer, so that no test changes a file in content/pieces. */
  async function fakeServer(page: Page, reply: { status: number; body: unknown }) {
    const requests: { id: string; status: string }[] = [];
    await page.route('**/__pianor/status', async (route) => {
      requests.push(route.request().postDataJSON() as { id: string; status: string });
      await route.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify(reply.body) });
    });
    return requests;
  }

  test('asks first, then sends the request and shows the new state', async ({ page }) => {
    const errors = await openPreview(page);
    const requests = await fakeServer(page, { status: 200, body: { ok: true, id: 'stair-steps', status: 'approved', changed: true, warnings: 0 } });
    await page.getByTestId('piece-stair-steps').click();
    const approve = page.getByTestId('approve');
    await expect(approve).toHaveText('Approve for the student');
    await expect(approve).toBeEnabled();

    page.once('dialog', (dialog) => void dialog.dismiss()); // "Cancel": nothing is sent
    await approve.click();
    expect(requests).toEqual([]);

    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('Approve "Stair Steps" for the student?');
      void dialog.accept();
    });
    await approve.click();
    await expect(page.getByTestId('status')).toContainText('"stair-steps" is now approved.');
    expect(requests).toEqual([{ id: 'stair-steps', status: 'approved' }]);
    await expect(approve).toHaveText('Back to draft');
    await expect(page.getByTestId('meta')).toHaveValue(/"status": "approved"/);
    expect(errors).toEqual([]);
  });

  test.describe(() => {
    // the faked refusal is a 422, which Chrome logs as an error
    test.use({ allowPageErrors: true });
    test('shows the reason when the server refuses', async ({ page }) => {
      await openPreview(page);
      await fakeServer(page, { status: 422, body: { ok: false, message: '1 error(s), so it cannot be approved: nope' } });
      await page.getByTestId('piece-stair-steps').click();
      page.once('dialog', (dialog) => void dialog.accept());
      await page.getByTestId('approve').click();
      await expect(page.getByTestId('status')).toContainText('so it cannot be approved: nope');
      await expect(page.getByTestId('approve')).toHaveText('Approve for the student'); // still a draft
    });
  });

  test('cannot be pressed for a piece with errors or with edits that are not in the file', async ({ page }) => {
    await openPreview(page);
    await page.getByTestId('piece-stair-steps').click();
    await expect(page.getByTestId('approve')).toBeEnabled();
    const abc = page.getByTestId('abc');
    await abc.fill((await abc.inputValue()).replace('C4 |]', 'C4 $ |]'));
    await expect(page.getByTestId('approve')).toBeDisabled({ timeout: 5000 });
    await page.getByRole('button', { name: 'Undo my edits' }).click();
    await expect(page.getByTestId('approve')).toBeEnabled();
    await abc.fill(`${await abc.inputValue()}% a comment\n`); // still valid, but not saved to the file
    await expect(page.getByTestId('approve')).toBeDisabled({ timeout: 5000 });
    await expect(page.locator('body')).toContainText('your edits are not saved');
  });

  test('is not offered for the scratch piece', async ({ page }) => {
    await openPreview(page);
    await page.getByTestId('piece-scratch').click();
    await expect(page.getByTestId('approve')).toBeHidden();
  });
});

test.describe('the dev server side of the preview', () => {
  test('lists the pieces as JSON', async ({ request }) => {
    const response = await request.get('/__pianor/pieces');
    expect(response.status()).toBe(200);
    const data = (await response.json()) as { levels: string; pieces: { folder: string; abc: string; meta: string }[] };
    expect(data.pieces.map((p) => p.folder)).toContain('hot-cross-buns');
    expect(JSON.parse(data.levels).levels.length).toBeGreaterThanOrEqual(5);
  });

  test('refuses a status change that is not JSON, from another site, or for a piece that does not exist', async ({ request }) => {
    const form = await request.post('/__pianor/status', { headers: { 'content-type': 'text/plain' }, data: '{"id":"stair-steps","status":"approved"}' });
    expect(form.status()).toBe(415);
    const foreign = await request.post('/__pianor/status', { headers: { origin: 'http://evil.example' }, data: { id: 'stair-steps', status: 'approved' } });
    expect(foreign.status()).toBe(403);
    const missing = await request.post('/__pianor/status', { data: { id: 'no-such-piece', status: 'approved' } });
    expect(missing.status()).toBe(404);
  });
});
