/**
 * How a player likes the staff: how many lines are on the screen at once and how many bars a line holds. Saved per player
 * (`core/progression`, profile version 2); `layoutForSettings` turns it into a staff layout.
 */
import { z } from 'zod';
import type { Chart } from '../chart/schema.ts';
import { PPQ } from '../chart/time.ts';
import { layoutStaff, type StaffLayout, type StaffLayoutOptions } from './staff.ts';

/**
 * The staff space, in pixels, below which "auto" gives a piece of sixteenths one bar on a line (core_09.AC44): the size
 * bundled pieces keep on the laptop with one line at a time. A line's width is set by its shortest note, so sixteenths
 * make a two-bar line twice as wide as eighths. AX-3 provisional: one bar a line, not tighter spacing.
 */
export const READABLE_STAFF_SPACE = 20;

export const staffSettingsSchema = z.object({
  /** Lines shown at once; the staff turns a page when the cursor reaches a line that is not shown. "all" fits the whole piece. */
  lines: z.union([z.literal(1), z.literal(2), z.literal('all')]),
  /**
   * Bars on a line. "auto" takes 2 or 4, whichever draws the bigger notes (4 when they are equal); a piece with notes
   * shorter than an eighth may get 1 (core_09.AC44).
   */
  barsPerLine: z.union([z.literal('auto'), z.literal(2), z.literal(4)]),
});

export type StaffSettings = z.infer<typeof staffSettingsSchema>;

/**
 * Two lines on the screen: more bars ahead of the cursor, so the student can prepare what comes next. Notes are
 * smaller than with one line (see ft_0_16). New players only: a saved player keeps their
 * choice, and the migration from version 1 still fills in one line.
 */
export const DEFAULT_STAFF_SETTINGS: StaffSettings = { lines: 2, barsPerLine: 'auto' };

/** Lay a chart out the way the settings ask. `options` gives the viewport and anything else `layoutStaff` takes. */
export function layoutForSettings(chart: Chart, options: StaffLayoutOptions, settings: StaffSettings): StaffLayout {
  const lines = settings.lines === 'all' ? {} : { linesPerPage: settings.lines };
  if (settings.barsPerLine === 'auto' && settings.lines === 'all') return layoutStaff(chart, options);
  const choices = settings.barsPerLine === 'auto' ? [4, 2] : [settings.barsPerLine];
  let best: StaffLayout | null = null;
  for (const barsPerLine of choices) {
    const layout = layoutStaff(chart, { ...options, ...lines, barsPerLine });
    // what fits beats what does not; then bigger notes; on a tie the earlier choice (more bars, fewer page turns) stays
    if (best === null || (layout.fits && !best.fits) || (layout.fits === best.fits && layout.staffSpace > best.staffSpace)) best = layout;
  }
  if (settings.barsPerLine === 'auto' && best!.staffSpace < READABLE_STAFF_SPACE && chart.notes.some((n) => n.dur < PPQ / 2)) {
    const one = layoutStaff(chart, { ...options, ...lines, barsPerLine: 1 });
    if (one.fits && one.staffSpace > best!.staffSpace) best = one;
  }
  return best!;
}

/**
 * A section of a piece (`sliceChart`) laid out at the size of the whole piece: the same staff space, so the clef and
 * the notes keep their size, the same bars per line and the same lines per page. Choosing a section changes which bars
 * are shown, not how big they are. `whole` is the whole piece laid out with the same viewport and settings.
 */
export function layoutSection(section: Chart, whole: StaffLayout, options: StaffLayoutOptions, settings: StaffSettings): StaffLayout {
  const lines = settings.lines === 'all' ? {} : { linesPerPage: settings.lines };
  return layoutStaff(section, { ...options, ...lines, barsPerLine: whole.systems[0]!.barCount, staffSpace: whole.staffSpace, keepBarWidth: true });
}
