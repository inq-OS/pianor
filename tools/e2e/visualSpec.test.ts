import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIXTURE_LAST_YEAR, FIXTURE_TIME } from '../test/fixtureTime';

/* Every screenshot baseline shows the test player on a fixed made-up day, so no picture holds a name or a real day (d165). */
const spec = readFileSync('tests/e2e/visual.spec.ts', 'utf8');
const helpers = readFileSync('tests/e2e/helpers.ts', 'utf8');
const tests = spec.split(/\n\s*test\(/).slice(1);

describe('the screenshot tests (d165)', () => {
  it('open every picture through one helper that fixes the clock and checks the test player', () => {
    const helper = /async function openForPicture[\s\S]*?\n}/.exec(spec)?.[0] ?? '';
    expect(helper).toContain('page.clock.setFixedTime(E2E_FIXED_TIME)');
    expect(helper).toContain('expectE2EPlayer(page)');
    expect(helper.indexOf('setFixedTime')).toBeLessThan(helper.indexOf('openGame('));
    const shots = tests.filter((t) => t.includes('toHaveScreenshot'));
    expect(shots.length).toBeGreaterThan(0);
    for (const t of shots) {
      expect(t).toContain('openForPicture(page');
      expect(t).not.toMatch(/\bopenGame\(|page\.goto\(/);
    }
  });

  it('start on the test players, on a day in the fixture years', () => {
    expect(helpers).toContain("if (!params.has('players')) params.set('players', 'test');");
    expect(helpers).toContain('export const E2E_FIXED_TIME = FIXTURE_TIME;');
    expect(spec).not.toMatch(/players=(?!test)/);
    expect(new Date(FIXTURE_TIME).getUTCFullYear()).toBeLessThanOrEqual(FIXTURE_LAST_YEAR);
  });
});
