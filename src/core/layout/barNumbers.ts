/**
 * Bar numbers on the staff: off, on the first bar only, on every bar, or on every 2nd or 4th bar. Small,
 * above the bar line. Saved per player (`core/progression`, profile version 10); off is the default, so nothing changes until
 * the player chooses. `every` was added later without a new profile version: it is a new value, and every value an older
 * save holds still means what it meant.
 */
import { z } from 'zod';

export const BAR_NUMBER_MODES = ['off', 'first', 'every', 'every2', 'every4'] as const;
export type BarNumberMode = (typeof BAR_NUMBER_MODES)[number];

export const barNumberSettingsSchema = z.object({
  mode: z.enum(BAR_NUMBER_MODES),
});

export type BarNumberSettings = z.infer<typeof barNumberSettingsSchema>;

export const DEFAULT_BAR_NUMBER_SETTINGS: BarNumberSettings = { mode: 'off' };

export interface BarNumber {
  /** The bar in the chart that is drawn (0-based). */
  index: number;
  /** The number to print: the bar's number in the whole piece, as printed (a pick-up is 0, the first full bar 1; d120). */
  number: number;
}

/**
 * Which bars of a chart of `barCount` bars get a number. `firstBar` is the 0-based place of the chart's first bar in the whole
 * piece (0 unless a section is practised, see `sliceChart`), so a section shows the numbers of the piece, the ones the
 * section chord asks for. Every 2nd bar means bars 1, 3, 5 ... and every 4th bar 1, 5, 9 ... of the piece (each line of 2 or 4
 * bars then starts with a number); the first bar drawn always has one, so a section never starts without.
 * `firstPrinted` is the whole piece's `firstPrintedBar`: 0 when it starts with a pick-up, which is then bar 0 and the first
 * full bar 1, as a printed score numbers them (core_09.AC25).
 */
export function barNumbersToShow(mode: BarNumberMode, barCount: number, firstBar = 0, firstPrinted: 0 | 1 = 1): BarNumber[] {
  if (mode === 'off') return [];
  const every = mode === 'every' ? 1 : mode === 'every2' ? 2 : mode === 'every4' ? 4 : Infinity;
  const out: BarNumber[] = [];
  for (let index = 0; index < barCount; index++) {
    const number = firstBar + index + firstPrinted;
    if (index === 0 || (every !== Infinity && number >= 1 && (number - 1) % every === 0)) out.push({ index, number });
  }
  return out;
}
