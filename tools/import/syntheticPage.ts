/**
 * synthetic: a level page of piano systems drawn in code, for the page finder's and the book's tests (photos and scans of real
 * sheets are never committed). Each system is two staves joined at the left, with bar lines through both, note heads, stems,
 * a beam and a ledger line in the way, and optionally a title row of text-like blobs above.
 */
import { blank, type Gray } from './clean';

export interface SyntheticPage {
  /** Bars per system, top to bottom. */
  readonly systems: readonly number[];
  readonly width?: number;
  /** Staff space in pixels. */
  readonly space?: number;
  /** Staves a system: 2 for a piano, 1 for one hand. */
  readonly staves?: number;
  /** Draw a double bar line at the end of this system (index), and a repeat sign at its start. */
  readonly doubleAfter?: number;
}

export function syntheticPage(p: SyntheticPage): Gray {
  const width = p.width ?? 1600;
  const space = p.space ?? 16;
  const staves = p.staves ?? 2;
  const systemHeight = staves * 4 * space + (staves - 1) * 8 * space + 10 * space;
  const height = 8 * space + p.systems.length * systemHeight;
  const img = blank(width, height);
  const dot = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < width && y < height) img.data[Math.round(y) * width + Math.round(x)] = 0;
  };
  const hline = (y: number, x1: number, x2: number) => { for (let x = x1; x <= x2; x++) dot(x, y); };
  const vline = (x: number, y1: number, y2: number, w = 2) => { for (let y = y1; y <= y2; y++) for (let d = 0; d < w; d++) dot(x + d, y); };
  const head = (x: number, y: number) => { for (let dy = -space / 2; dy <= space / 2; dy++) for (let dx = -space * 0.6; dx <= space * 0.6; dx++) if ((dx / (space * 0.6)) ** 2 + (dy / (space / 2)) ** 2 <= 1) dot(x + dx, y + dy); };
  // a title: blobs of text
  for (let x = width / 3; x < (2 * width) / 3; x += space) for (let y = space * 2; y < space * 3; y++) for (let d = 0; d < space * 0.6; d++) dot(x + d, y);
  const left = 3 * space;
  const right = width - 3 * space;
  p.systems.forEach((bars, s) => {
    const top = 6 * space + s * systemHeight;
    const staffTops = Array.from({ length: staves }, (_, k) => top + k * 12 * space);
    for (const t of staffTops) for (let l = 0; l < 5; l++) hline(t + l * space, left, right);
    const bottom = (staffTops.at(-1) ?? top) + 4 * space;
    vline(left, top, bottom);
    vline(right - 1, top, bottom);
    const header = 6 * space;
    const barWidth = (right - left - header) / bars;
    for (let b = 1; b < bars; b++) vline(Math.round(left + header + b * barWidth), top, bottom);
    if (p.doubleAfter === s) vline(right - 1 - Math.round(space * 0.6), top, bottom, 4);
    for (let b = 0; b < bars; b++) {
      const x0 = left + header + b * barWidth;
      for (const [k, t] of staffTops.entries()) {
        const notes = [0.25, 0.5, 0.75].map((f) => x0 + f * barWidth);
        notes.forEach((x, i) => {
          const y = t + ((i + b + k) % 5) * space;
          head(x, y);
          vline(Math.round(x + space * 0.5), Math.round(y - 3.5 * space), Math.round(y), 1);
        });
        // a beam over the stems, and a ledger line above the staff
        for (let d = 0; d < space / 2; d++) hline(t - 3 * space + d, Math.round(notes[0]! + space * 0.5), Math.round(notes[2]! + space * 0.5));
        hline(t - space, Math.round(notes[1]! - space), Math.round(notes[1]! + space));
      }
    }
  });
  return img;
}
