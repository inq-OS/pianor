// Covers ft_Y_04.AC5.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { makeZip } from '../helpers/zip';

/** The analyser page (`?demo=analyse`): MusicXML files scored in the browser, plain and compressed. */
const FIXTURE = readFileSync(join(process.cwd(), 'tests/fixtures/musicxml/hands-together.musicxml'), 'utf-8');

test.describe('score analyser page', () => {
  test('ft_Y_04.AC5 scores dropped MusicXML and .mxl files, easiest first, and opens the difficulty panel', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?demo=analyse');
    const slow = FIXTURE.replace('<per-minute>60</per-minute>', '<per-minute>30</per-minute>').replace('tempo="60"', 'tempo="30"');
    await page.getByTestId('score-files').setInputFiles([
      { name: 'hands.musicxml', mimeType: 'application/xml', buffer: Buffer.from(FIXTURE) },
      { name: 'slow.mxl', mimeType: 'application/zip', buffer: Buffer.from(makeZip([{ name: 'META-INF/container.xml', text: '<container><rootfiles><rootfile full-path="s.xml"/></rootfiles></container>' }, { name: 's.xml', text: slow }])) },
      { name: 'broken.musicxml', mimeType: 'application/xml', buffer: Buffer.from('<score-partwise>') },
    ]);
    const table = page.getByTestId('score-table');
    await expect(table.getByTestId('score-row-hands.musicxml')).toContainText(/Hands Together\s*4\s*11\s*60\s*\d+\/100 beginner [\d.]+\*\s*[\d.]+/);
    await expect(table.getByTestId('score-row-slow.mxl')).toContainText(/Hands Together\s*4\s*11\s*30\s*/);
    await expect(table.getByTestId('score-row-broken.musicxml')).toContainText('not read: not readable XML');
    // easiest first: the same piece at half the speed before it, the unread file last
    const order = await table.locator('[data-testid^="score-row-"]').evaluateAll((rows) => rows.map((r) => (r as HTMLElement).dataset.testid));
    expect(order).toEqual(['score-row-slow.mxl', 'score-row-hands.musicxml', 'score-row-broken.musicxml']);
    await table.getByTestId('score-row-hands.musicxml').click();
    await expect(page.getByTestId('score-warnings')).toContainText('read with nothing left out');
    await expect(page.getByTestId('difficulty-whole')).toContainText(/difficulty \d+\/100, \w+ [\d.]+ stars/);
    await page.getByTestId('passage').fill('2-3');
    await expect(page.getByTestId('passage-result')).toContainText(/Passage 2-3: difficulty \d+\/100/);
    expect(errors).toEqual([]);
  });
});
