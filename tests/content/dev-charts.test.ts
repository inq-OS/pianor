import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseChart } from '../../src/core/chart';
import { layoutStaff } from '../../src/core/layout/staff';

const dir = join(__dirname, '../../content/dev/charts');
const files = readdirSync(dir).filter((f) => f.endsWith('.chart.json'));

const VIEWPORTS = [
  { width: 1366, height: 768 }, // ThinkPad T420 class laptop (assumed 1366x768)
  { width: 1280, height: 720 },
  { width: 1024, height: 600 },
];

describe('dev sample charts', () => {
  it('has the sample pieces', () => {
    expect(files.length).toBeGreaterThanOrEqual(4);
  });

  describe.each(files)('%s', (file) => {
    const parsed = parseChart(JSON.parse(readFileSync(join(dir, file), 'utf-8')));

    it('is a valid chart', () => {
      expect(parsed.ok, parsed.ok ? '' : parsed.errors.join('; ')).toBe(true);
    });

    it.each(VIEWPORTS)('lays out and fits at $width x $height', (viewport) => {
      if (!parsed.ok) throw new Error('invalid chart');
      const layout = layoutStaff(parsed.chart, { viewport });
      expect(layout.fits).toBe(true);
      expect(layout.notes).toHaveLength(parsed.chart.notes.length);
      // Big enough for a small student: at least 16 px between staff lines on a laptop-sized screen.
      if (viewport.width >= 1280) expect(layout.staffSpace).toBeGreaterThanOrEqual(16);
    });
  });
});
