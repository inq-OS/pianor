import { readFileSync } from 'node:fs';
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * The hardware spike page against the simulated EZ-220: proves the page works before a person takes it to the real
 * keyboard. Nothing here says anything about how the real keyboard behaves.
 */

interface SpikeWindow {
  __spike: {
    device: {
      press(midi: number, velocity?: number, timeStamp?: number): void;
      release(midi: number, timeStamp?: number): void;
      activeSensing(): void;
      disconnect(): void;
      connect(): void;
      output: { sent: { data: number[] }[] };
    };
    state: { tap: { running: boolean; clicks: number[] } };
  };
}

async function openSpike(page: Page, query = ''): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    // This machine's audio device sometimes reports trouble to Chrome; that is the environment, not the page.
    if (m.type() === 'error' && !m.text().includes('AudioContext encountered an error from the audio device')) errors.push(`console: ${m.text()}`);
  });
  await page.goto(`/spike.html?device=virtual${query}`);
  await expect(page.locator('#midi-status')).toHaveText('MIDI access: allowed');
  return errors;
}

const device = (page: Page) => ({
  press: (midi: number, velocity = 80) => page.evaluate(([m, v]) => (window as unknown as SpikeWindow).__spike.device.press(m!, v), [midi, velocity]),
  release: (midi: number) => page.evaluate((m) => (window as unknown as SpikeWindow).__spike.device.release(m), midi),
  sent: () => page.evaluate(() => (window as unknown as SpikeWindow).__spike.device.output.sent.map((s) => s.data)),
});

const rows = (page: Page) => page.locator('#log-rows tr').allTextContents();

test.describe('hardware spike page with the simulated keyboard', () => {
  test('says it is simulated, and lists the keyboard as an input and an output', async ({ page }) => {
    const errors = await openSpike(page);
    await expect(page.locator('.badge')).toHaveText('Simulated keyboard');
    const ports = page.locator('table').first().locator('tbody tr');
    await expect(ports).toHaveCount(2);
    await expect(ports.nth(0)).toContainText('Virtual EZ-220 (simulated)');
    await expect(ports.nth(0)).toContainText('connected');
    expect(errors).toEqual([]);
  });

  test('logs key presses and releases with note, velocity and channel, and hides active sensing until asked', async ({ page }) => {
    const errors = await openSpike(page);
    await device(page).press(60, 77);
    await device(page).release(60);
    await page.evaluate(() => (window as unknown as SpikeWindow).__spike.device.activeSensing());
    await expect(page.locator('#log-summary')).toContainText('Key presses 1, releases 1 (as note-on velocity 0: 1, as note-off: 0); velocity 77 to 77; active sensing 1');
    const shown = await rows(page);
    expect(shown).toHaveLength(2);
    expect(shown[0]).toContain('Key up C4 (sent as note-on with velocity 0), channel 1');
    expect(shown[1]).toContain('Key down C4, velocity 77, channel 1');
    expect(shown[1]).toContain('90 3C 4D');
    await page.locator('#show-system').check();
    await expect(page.locator('#log-rows tr').first()).toContainText('Active sensing');
    expect(errors).toEqual([]);
  });

  test('follows unplugging and plugging back in without a reload', async ({ page }) => {
    const errors = await openSpike(page);
    await page.getByRole('button', { name: 'Unplug' }).click();
    await expect(page.locator('table').first().locator('tbody tr').nth(0)).toContainText('disconnected');
    await expect(page.locator('#plug-events li')).toHaveCount(2);
    await page.getByRole('button', { name: 'Plug in' }).click();
    await expect(page.locator('table').first().locator('tbody tr').nth(0)).not.toContainText('disconnected');
    await expect(page.locator('#plug-events li')).toHaveCount(4);
    await device(page).press(64);
    await expect(page.locator('#log-summary')).toContainText('Key presses 1');
    expect(errors).toEqual([]);
  });

  test('sends notes for the key lights on the chosen channel, a scale, Local Control and all notes off', async ({ page }) => {
    const errors = await openSpike(page);
    const row = page.locator('section', { hasText: 'Key lights and Local Control' });
    const inputs = row.locator('input[type=number]');
    await inputs.nth(3).fill('150'); // length in ms
    await page.getByRole('button', { name: 'Send note' }).click();
    await expect.poll(() => device(page).sent()).toEqual([[0x90, 60, 64], [0x80, 60, 0]]);
    await expect(page.locator('#virtual-lit')).toContainText('none');

    await inputs.nth(0).fill('2'); // channel 2
    await inputs.nth(1).fill('67'); // G4
    await inputs.nth(2).fill('1'); // velocity 1
    await expect(row).toContainText('G4');
    await page.getByRole('button', { name: 'Hold note' }).click();
    await expect(page.locator('#virtual-lit')).toContainText('G4');
    await page.getByRole('button', { name: 'Local Control off (CC 122)' }).click();
    await page.getByRole('button', { name: 'Local Control on' }).click();
    await page.getByRole('button', { name: 'All notes off' }).click();
    const sent = await device(page).sent();
    expect(sent.slice(2, 5)).toEqual([[0x91, 67, 1], [0xb1, 122, 0], [0xb1, 122, 127]]);
    expect(sent[5]).toEqual([0x81, 67, 0]); // the held note is released first
    expect(sent.slice(6).filter((m) => (m[0]! & 0xf0) === 0xb0 && m[1] === 123)).toHaveLength(16);
    await expect(page.locator('#virtual-lit')).toContainText('none');

    await inputs.nth(0).fill('1');
    await page.getByRole('button', { name: 'Light C4 to C5' }).click();
    await expect.poll(async () => (await device(page).sent()).filter((m) => m[0] === 0x90).map((m) => m[1]), { timeout: 8000 })
      .toEqual([60, 60, 62, 64, 65, 67, 69, 71, 72]);
    expect(errors).toEqual([]);
  });

  test('the volume buttons send channel volume 0 and 100 (CC 7) on the chosen channel', async ({ page }) => {
    const errors = await openSpike(page);
    const row = page.locator('section', { hasText: 'Key lights and Local Control' });
    await page.getByRole('button', { name: 'Volume 0 (CC 7)' }).click();
    await row.locator('input[type=number]').nth(0).fill('3'); // channel 3
    await page.getByRole('button', { name: 'Volume 100 (CC 7)' }).click();
    expect(await device(page).sent()).toEqual([[0xb0, 7, 0], [0xb2, 7, 100]]);
    await expect(page.locator('#log-rows tr').first()).toContainText('Volume = 100, channel 3');
    expect(errors).toEqual([]);
  });

  test('echoes keys back to the keyboard when asked', async ({ page }) => {
    const errors = await openSpike(page);
    await page.locator('#echo').check();
    await device(page).press(62, 90);
    await device(page).release(62);
    await expect.poll(() => device(page).sent()).toEqual([[0x90, 62, 90], [0x80, 62, 0]]);
    expect(errors).toEqual([]);
  });

  test('the tap test measures how long after each click the key presses came', async ({ page }) => {
    const errors = await openSpike(page, '&clicks=6');
    await page.getByRole('button', { name: 'Start the tap test' }).click();
    await page.waitForFunction(() => (window as unknown as SpikeWindow).__spike.state.tap.running);
    // A steady player 25 ms after every click (timestamps as the keyboard would give them).
    await page.evaluate(() => {
      const spike = (window as unknown as SpikeWindow).__spike;
      for (const click of spike.state.tap.clicks) {
        spike.device.press(60, 80, click + 25);
        spike.device.release(60, click + 150);
      }
    });
    await expect(page.locator('#tap-results li')).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator('#tap-results li')).toContainText('25 ms after the click (spread 0 ms; 4 clicks matched');
    await expect(page.locator('#midi-status').locator('xpath=..')).toContainText('Audio: ');
    expect(errors).toEqual([]);
  });

  test('downloads the log as JSON, with the raw bytes and a replay draft marked synthetic', async ({ page }) => {
    const errors = await openSpike(page);
    await device(page).press(60, 70);
    await device(page).release(60);
    await device(page).press(62, 72);
    await device(page).release(62);
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download the log (JSON)' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^pianor-midi-log-.*\.json$/);
    const data = JSON.parse(readFileSync(await download.path(), 'utf-8'));
    expect(data).toMatchObject({ format: 'pianor-midi-log', version: 1, source: 'virtual', summary: { notesOn: 2, notesOff: 2 } });
    expect(data.entries.map((e: { bytes: number[] }) => e.bytes)).toEqual([[0x90, 60, 70], [0x90, 60, 0], [0x90, 62, 72], [0x90, 62, 0]]);
    expect(data.replay.synthetic).toBe(true);
    expect(data.replay.events.map((e: { kind: string; midi: number }) => `${e.kind}${e.midi}`)).toEqual(['on60', 'off60', 'on62', 'off62']);
    expect(data.ports).toHaveLength(2);
    expect(errors).toEqual([]);
  });

  test('makes a summary for the hardware notes, with the answers, that says it is simulated', async ({ page }) => {
    const errors = await openSpike(page);
    await device(page).press(60, 70);
    await device(page).release(60);
    await page.locator('input[name=lights][value=partly]').check();
    await page.locator('#lights-how').fill('only on channel 1');
    await page.locator('input[name=hotplug][value=yes]').check();
    await page.getByRole('button', { name: 'Make the summary' }).click();
    const report = await page.locator('#report').inputValue();
    expect(report).toContain('Simulated keyboard: this checks the page, it is not a hardware result.');
    expect(report).toContain('Input: Virtual EZ-220 (simulated)');
    expect(report).toContain('Key releases arrive as note-on with velocity 0 (1 of 1)');
    expect(report).toContain('Keys light up when the computer sends notes: partly (only on channel 1)');
    expect(report).toContain('Unplug and plug back in works without reloading: yes');
    expect(report).toContain('The keyboard also sounds the notes the computer sends: not checked');
    expect(errors).toEqual([]);
  });
});
