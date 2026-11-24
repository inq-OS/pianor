import { BOARD_ROWS } from './frame';
import type { Rect } from './rect';

/**
 * The conversation's layout (ft_1_22.AC1, WP-09, the painter's part CT-P4), in the manner of MI2: the speaker's line floats
 * over their head in their own colour, with no box, a page of at most two rows at a time; while the student chooses, the
 * band's cells give way to a board with their lines written on it, each after a small note. Pure: the view only draws it.
 * Coordinates are layout cells: the line's in the main area, the choices' from the band's top-left corner.
 *
 * AX-3 provisional (ft_1_22): the widths and rows are the painter's first fit for the knoll and the docks; the students's
 * try-out (ft_1_22.AC9) may move them, and these tests move with them.
 */
export const TALK = {
  /** The widest a spoken line wraps to: about two thirds of the screen, as MI2's lines. */
  lineWidth: 200,
  /** Rows on one page of a spoken line; a longer line goes on in pages. */
  lineRows: 2,
  /** Cells between a line's foot and the speaker's head. */
  aboveHead: 4,
  /** A line keeps this far from the main area's edges. */
  margin: 5,
  /** Cells between the head and a line put beside it (a head too near the top). */
  besideHead: 8,
  /** Room a line keeps round another actor's head point, so it never covers a face. */
  headClear: 6,
  /** The choices' notes stand this far in from the band's left edge, and the words end as far from its right edge. */
  choiceLeft: 10,
  /** From a note's left edge to its choice's words. */
  textIndent: 10,
  /** The board's rows above the first choice and below the last, at least. */
  boardTop: 3,
  boardBottom: 3,
  /** The most a gap between two choices grows to when the band has room. */
  choiceGap: 6,
} as const;

export interface Point {
  readonly x: number;
  readonly y: number;
}
export interface Size {
  readonly w: number;
  readonly h: number;
}

const SENTENCE_END = /(?<=[.!?…])\s+/u;

/**
 * A spoken line in pages, each its wrapped rows (at most `rows`): sentences are kept together on a page while they fit,
 * a sentence too long for one page is cut between rows. `wrap` is the game font's (`font.ts`), so this stays pure.
 */
export function talkPages(text: string, wrap: (text: string, width: number) => string[], width: number = TALK.lineWidth, rows: number = TALK.lineRows): string[][] {
  const sentences = text.trim().split(SENTENCE_END).filter((s) => s !== '');
  const pages: string[][] = [];
  let page = '';
  const flush = () => {
    if (page === '') return;
    // a page's sentences each on their own row when each fits one (no word left alone on a row), else wrapped as one text
    const own = page.split(SENTENCE_END).map((one) => wrap(one, width));
    const wrapped = own.length > 1 && own.every((r) => r.length === 1) && own.length <= rows ? own.flat() : wrap(page, width);
    for (let at = 0; at < wrapped.length; at += rows) pages.push(wrapped.slice(at, at + rows));
    page = '';
  };
  for (const sentence of sentences) {
    const trial = page === '' ? sentence : `${page} ${sentence}`;
    if (page !== '' && wrap(trial, width).length > rows) {
      flush();
      page = sentence;
    } else {
      page = trial;
    }
  }
  flush();
  return pages;
}

const clamp = (v: number, low: number, high: number): number => Math.max(low, Math.min(high, v));

/**
 * Where a line of `size` floats for a speaker whose head is at `head`: centred over it, its foot `aboveHead` above it, kept
 * inside the area's margins. When the area's top leaves no room over the head, the line goes beside the head (to the side
 * with more room), so it never covers the face. `avoid` are the other actors' heads: a line that would cover one moves
 * beside its speaker, then to the speaker's other side; with no way round, it stays over its own speaker.
 */
export function lineSpot(input: { head: Point; size: Size; area: Size; avoid?: readonly Point[] }): Point {
  const { head, size, area } = input;
  const m = TALK.margin;
  const xCentred = clamp(Math.round(head.x - size.w / 2), m, area.w - m - size.w);
  const yOver = head.y - TALK.aboveHead - size.h;
  const ySide = clamp(Math.round(head.y - size.h / 2), m, area.h - m - size.h);
  const left = clamp(head.x - TALK.besideHead - size.w, m, area.w - m - size.w);
  const right = clamp(head.x + TALK.besideHead, m, area.w - m - size.w);
  const nearSide = head.x > area.w / 2 ? left : right, farSide = head.x > area.w / 2 ? right : left;
  const covers = (spot: Point, p: Point): boolean => {
    const c = TALK.headClear;
    return p.x >= spot.x - c && p.x <= spot.x + size.w + c && p.y >= spot.y - c && p.y <= spot.y + size.h + c;
  };
  // the spot over the head is clear of it by construction; a spot beside the head must keep off it
  const clear = (spot: Point): boolean => (spot === over || !covers(spot, head)) && !(input.avoid ?? []).some((p) => covers(spot, p));
  const over = yOver >= m ? { x: xCentred, y: yOver } : null;
  const candidates: Point[] = [...(over ? [over] : []), { x: nearSide, y: ySide }, { x: farSide, y: ySide }];
  return candidates.find(clear) ?? over ?? candidates[0]!;
}

/** The student has no figure in the scene: their chosen line rises from the band, at the foot of the picture's middle. */
export function studentHead(area: Size): Point {
  return { x: Math.round(area.w / 2), y: area.h };
}

export interface ChoiceSpot {
  /** The note before the choice's words (its top-left). */
  bullet: Point;
  /** The words' top-left. */
  text: Point;
  /** Where a press or the pointer picks this choice: the band's whole width along its rows. */
  hit: Rect;
}

/**
 * The student's choices on the band (ft_1_22.AC1): `rows` is each choice's wrapped rows at `textWidth`, top to bottom.
 * The block is centred in the band's rows with even gaps; `overflow` says the rows do not fit (the writer shortens a
 * choice: at most four rows in all, so three choices take one row each and one of them may take two).
 */
export function choiceLayout(input: { rows: readonly number[]; lineHeight: number; width: number }): { choices: ChoiceSpot[]; textWidth: number; overflow: boolean } {
  const { rows, lineHeight, width } = input;
  const textX = TALK.choiceLeft + TALK.textIndent;
  const textWidth = width - textX - TALK.choiceLeft;
  const heights = rows.map((r) => Math.max(1, r) * lineHeight - 2);
  const inner = BOARD_ROWS - TALK.boardTop - TALK.boardBottom;
  const used = heights.reduce((a, b) => a + b, 0);
  const free = inner - used;
  const overflow = free < 0 || (rows.length > 1 && free < rows.length - 1);
  const gap = rows.length <= 1 ? 0 : clamp(Math.floor(free / (rows.length + 1)), 1, TALK.choiceGap);
  let y = TALK.boardTop + Math.max(0, Math.floor((inner - used - gap * (rows.length - 1)) / 2));
  const choices = heights.map((h) => {
    const hitTop = y - Math.floor(gap / 2);
    const spot: ChoiceSpot = {
      bullet: { x: TALK.choiceLeft, y },
      text: { x: textX, y },
      hit: { x: 0, y: hitTop, w: width, h: h + gap },
    };
    y += h + gap;
    return spot;
  });
  return { choices, textWidth, overflow };
}
