// Covers ft_1_39.AC1.
import { describe, expect, it } from 'vitest';
import { lessonBookLayout } from './lessonBook';

describe('the lesson book layout (ft_1_39)', () => {
  it('ft_1_39.AC1 gives every topic of the longest area its own row above the tabs, half on each page', () => {
    // the main area of the 1920 x 1080 target at the game's zoom
    const layout = lessonBookLayout(320, 165, 20, 18);
    expect(layout.rows).toHaveLength(20);
    const tabsY = layout.tabs[0]!.y;
    for (const row of layout.rows) expect(row.y + 7).toBeLessThan(tabsY);
    expect(new Set(layout.rows.map((r) => r.x)).size).toBe(2);
    const left = layout.rows.filter((r) => r.x === layout.rows[0]!.x);
    for (let i = 1; i < left.length; i++) expect(left[i]!.y - left[i - 1]!.y).toBeGreaterThanOrEqual(9);
    expect(left[0]!.y).toBeGreaterThan(layout.heading.y);
  });

  it('puts one tab per area along the foot, left to right, between the page-turn arrows', () => {
    const layout = lessonBookLayout(320, 165, 6, 18);
    expect(layout.tabs).toHaveLength(18);
    for (let i = 1; i < 18; i++) expect(layout.tabs[i]!.x).toBeGreaterThan(layout.tabs[i - 1]!.x);
    expect(layout.tabs.at(-1)!.x + layout.tabs.at(-1)!.w).toBeLessThanOrEqual(320);
    // the page-turn arrows either side of the tabs, on the screen
    expect(layout.previous.x + layout.previous.w).toBeLessThan(layout.tabs[0]!.x);
    expect(layout.next.x).toBeGreaterThan(layout.tabs.at(-1)!.x + layout.tabs.at(-1)!.w);
    expect(layout.previous.x).toBeGreaterThanOrEqual(0);
    expect(layout.next.x + layout.next.w).toBeLessThanOrEqual(320);
  });
});
