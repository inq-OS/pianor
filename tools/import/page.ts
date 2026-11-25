/**
 * The staves, systems and bars of a flat page (ft_Y_04 slice 6): a page of a PDF, rendered level by the browser, or a flat
 * scan. The photo cleaner (`clean.ts`) is made for one phone photo at an angle and finds the staves by narrow bands, which
 * on a whole engraved page took note heads, ledger lines and beams for staves (0 of 12 pages right on public-domain scores
 * rendered at 300 dots an inch). A level page needs none of that: a staff line is a row with ink across most of the
 * staff's width, five such rows evenly spaced are a staff, staves joined by a line at their left end are a system, and a
 * line that runs from the system's top line to its bottom line is a bar line. Pure, so it is tested on synthetic pages.
 */
import type { PhotoLayout, PhotoSystem } from '../../src/core/editor/photoOverlay';
import type { Gray } from './clean';

/** A staff of the page: its five line rows, where its lines start and end, its staff space. */
export interface PageStaff {
  readonly lines: readonly number[];
  readonly left: number;
  readonly right: number;
  readonly interline: number;
}

/** How far from a system's start, in staff spaces, its clefs and key signature may reach (seven sharps take about ten). */
const HEADER = 12;

/** How far from a system's end a courtesy key, clef or meter after its last double line may reach, in staff spaces. */
const COURTESY = 8;

/** Ink: darker than this on a 0 to 255 scale (anti-aliased edges of a rendered page are lighter). */
const INK = 160;

const ink = (img: Gray, x: number, y: number): boolean => x >= 0 && y >= 0 && x < img.width && y < img.height && (img.data[y * img.width + x] ?? 255) < INK;

/** The longest run of ink along row `y`, as its first and last column. */
function longestRun(img: Gray, y: number): { from: number; to: number } {
  let best = { from: 0, to: -1 };
  let start = -1;
  let gap = 0;
  for (let x = 0; x <= img.width; x++) {
    // a staff line is drawn whole, but a rendering may leave a pixel out where a note head or a bar line meets it
    if (x < img.width && ink(img, x, y)) {
      if (start < 0) start = x;
      gap = 0;
    } else if (start >= 0 && (++gap > 2 || x === img.width)) {
      const to = x - gap;
      if (to - start > best.to - best.from) best = { from: start, to };
      start = -1;
      gap = 0;
    }
  }
  return best;
}

/** Rows that look like staff lines: an ink run at least a third of the page wide, neighbouring rows merged into one line. */
function lineRows(img: Gray): { y: number; from: number; to: number }[] {
  const lines: { y: number; from: number; to: number; rows: number }[] = [];
  for (let y = 0; y < img.height; y++) {
    const run = longestRun(img, y);
    if (run.to - run.from < img.width / 3) continue;
    const last = lines.at(-1);
    if (last && y - (last.y + last.rows - 1) <= 1 && Math.abs(run.from - last.from) < img.width / 50) {
      last.rows++;
      last.from = Math.min(last.from, run.from);
      last.to = Math.max(last.to, run.to);
    } else lines.push({ y, from: run.from, to: run.to, rows: 1 });
  }
  // a line drawn two or three pixels thick is one line: its middle row
  return lines.filter((l) => l.rows <= 6).map((l) => ({ y: l.y + (l.rows - 1) / 2, from: l.from, to: l.to }));
}

/** Five evenly spaced lines in a row, each a staff, top first; a line that fits no staff (a beam, a long tie) is passed by. */
export function stavesOf(img: Gray): PageStaff[] {
  const rows = lineRows(img);
  const staves: PageStaff[] = [];
  for (let i = 0; i + 4 < rows.length; ) {
    const five = rows.slice(i, i + 5);
    const gaps = five.slice(1).map((l, k) => l.y - (five[k]?.y ?? 0));
    const space = gaps.reduce((a, b) => a + b, 0) / 4;
    const even = space >= 4 && gaps.every((g) => Math.abs(g - space) <= Math.max(1.5, space * 0.15));
    const aligned = five.every((l) => Math.abs(l.from - (five[0]?.from ?? 0)) <= space * 2 && Math.abs(l.to - (five[0]?.to ?? 0)) <= space * 2);
    if (even && aligned) {
      staves.push({ lines: five.map((l) => l.y), left: Math.max(...five.map((l) => l.from)), right: Math.min(...five.map((l) => l.to)), interline: space });
      i += 5;
    } else i++;
  }
  return staves;
}

/** The ink of column `x` over rows `top` to `bottom` (a pixel either side counts, for a line rendered between columns). */
function columnInk(img: Gray, x: number, top: number, bottom: number): number {
  let n = 0;
  for (let y = top; y <= bottom; y++) if (ink(img, x - 1, y) || ink(img, x, y) || ink(img, x + 1, y)) n++;
  return n / Math.max(1, bottom - top + 1);
}

/** Whether a line at the staves' left end joins staff `a` to staff `b` below it (a system's left line, or a brace beside it). */
function joined(img: Gray, a: PageStaff, b: PageStaff): boolean {
  const top = Math.round(a.lines[0] ?? 0);
  const bottom = Math.round(b.lines[4] ?? 0);
  const left = Math.round(Math.max(a.left, b.left));
  for (let x = left - Math.round(a.interline * 2); x <= left + Math.round(a.interline); x++) if (columnInk(img, x, top, bottom) >= 0.95) return true;
  return false;
}

/** The staves grouped into systems: staves joined at their left end are one system (a piano's two staves). */
export function systemsOf(img: Gray, staves: readonly PageStaff[]): PageStaff[][] {
  const systems: PageStaff[][] = [];
  for (const staff of staves) {
    const current = systems.at(-1);
    const above = current?.at(-1);
    if (current && above && joined(img, above, staff)) current.push(staff);
    else systems.push([staff]);
  }
  return systems;
}

/** Whether column `x` has ink all the way from the outer line to a staff space past it, above or below. */
function reachesPast(img: Gray, x: number, top: number, bottom: number, space: number): boolean {
  const reach = Math.round(space);
  return columnInk(img, x, top - reach, top - 1) >= 0.95 || columnInk(img, x, bottom + 1, bottom + reach) >= 0.95;
}

/**
 * The bar lines of a system: thin columns with ink from its top line to its bottom line (a stem never reaches over the
 * gap between two staves, and in a one-staff system it is shorter than the staff with its head).
 */
function barLines(img: Gray, system: readonly PageStaff[]): number[] {
  const first = system[0];
  const last = system.at(-1);
  if (!first || !last) return [];
  const top = Math.round(first.lines[0] ?? 0);
  const bottom = Math.round(last.lines[4] ?? 0);
  const left = Math.max(...system.map((s) => s.left));
  const right = Math.min(...system.map((s) => s.right));
  const space = first.interline;
  const found: number[] = [];
  let start = -1;
  for (let x = Math.floor(left); x <= Math.ceil(right) + 1; x++) {
    // a bar line stops at the outer lines; an arpeggio's line or bracket, which may run the same height, reaches past them
    const full = x <= right && columnInk(img, x, top, bottom) >= 0.97 && !reachesPast(img, x, top, bottom, space);
    if (full && start < 0) start = x;
    if (!full && start >= 0) {
      if (x - start <= Math.max(4, space * 0.7)) found.push((start + x - 1) / 2);
      start = -1;
    }
  }
  return found;
}

/**
 * The page's layout as the piece maker's photo overlay takes it (`PhotoLayout`): its systems, each with its staves and bars,
 * left to right. The lines at the staves' ends and the second line of a double bar line make no bar of their own.
 */
export function pageLayout(img: Gray): PhotoLayout {
  const systems: PhotoSystem[] = systemsOf(img, stavesOf(img)).map((group) => {
    const space = group[0]?.interline ?? 10;
    const left = Math.max(...group.map((s) => s.left));
    const right = Math.min(...group.map((s) => s.right));
    const lines = barLines(img, group).filter((x) => x > left + space && x < right - space);
    // a double line or a repeat sign close to the system's start (after its clefs and key) starts the system's first bar
    const start = lines[1] !== undefined && lines[1] - (lines[0] ?? 0) <= 1.2 * space && (lines[0] ?? 0) < left + HEADER * space ? lines[1] : left;
    // and a double line or repeat sign close to its end, before a courtesy key, clef or meter, ends its last bar
    const a = lines.at(-2);
    const b = lines.at(-1);
    const end = a !== undefined && b !== undefined && b - a <= 1.2 * space && b > right - COURTESY * space ? a : right;
    const edges = [start, ...lines.filter((x) => x > start && x < end), end];
    const bars: { x1: number; x2: number }[] = [];
    for (let k = 1; k < edges.length; k++) {
      const x1 = edges[k - 1] ?? 0;
      const x2 = edges[k] ?? 0;
      if (x2 - x1 >= 1.5 * space) bars.push({ x1, x2 });
    }
    return { staves: group.map((s) => ({ top: s.lines[0] ?? 0, bottom: s.lines[4] ?? 0 })), bars };
  });
  return { width: img.width, height: img.height, systems };
}
