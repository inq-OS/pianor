import type { Speaker } from '../../../core/dialogue/conversation';
import { BOARD_ROWS } from '../../../core/layout/frame';
import { TALK, talkPages } from '../../../core/layout/talk';
import { createBitmap, fromAscii, type Bitmap } from './bitmap';
import { drawnText, renderText, wrap } from './font';
import { C } from './palette';

/**
 * The conversation's look (ft_1_22.AC1, WP-09, the painter's part CT-P4; take A2 of sketch 1 picked): MI2's
 * manner in the band's warm colours. The speaker's line floats over their head in their own colour, outlined in ink, with
 * no box; while the student chooses, the band's cells give way to a dark board with their lines on it, each after a small
 * note, honey at rest and lit cream under the pointer or the focus. Where everything goes is `core/layout/talk.ts`; the
 * conversation view (the 10x dev's) draws these pictures there. Art pixels (layout cells), palette indices.
 */

/**
 * Each speaker's own colour, as in MI2 (every person speaks in theirs): the student white, Kiur the gold of his breast,
 * a character its colour below. AX-3 provisional: the characters' colours are the painter's first picks, each one apart
 * from the others and readable over the knoll and the docks at every hour.
 */
export const TALK_INK: Readonly<Record<Exclude<Speaker, 'character'>, number>> = {
  student: C.white,
  kiur: C.goldLight,
};

/** The characters' colours, by character id (`content/characters/<id>.json`); one not listed speaks in `teal`. */
export const CHARACTER_INK: Readonly<Record<string, number>> = {
  puuvaim: C.leafLight, // the tree's young leaves
  fisherman: C.orangeLight, // his oilskin's yellow
};
const CHARACTER_FALLBACK = C.teal;

/** The colour a speaker's lines are written in; `character` is the speaking character's id when the speaker is one. */
export function talkColour(speaker: Speaker, character?: string): number {
  if (speaker !== 'character') return TALK_INK[speaker];
  return (character !== undefined ? CHARACTER_INK[character] : undefined) ?? CHARACTER_FALLBACK;
}

/**
 * The colour a scene script's speaker says its line in (ft_1_24, WP-07): Kiur's gold, a character's own colour found by
 * its actor, the fallback for anyone else (the teacher, a boat).
 */
export function scriptInk(actor: string, characters: Iterable<{ readonly id: string; readonly actor: string }>): number {
  if (actor === 'kiur') return talkColour('kiur');
  for (const c of characters) if (c.actor === actor) return talkColour('character', c.id);
  return talkColour('character');
}

/** A spoken line in pages of drawn rows (`talkPages` with the game's font and letter case): one page shows at a time. */
export function spokenPages(text: string): string[][] {
  return talkPages(drawnText(text), wrap);
}

/**
 * One page of a spoken line: its rows centred on each other in `colour`, with an ink line one pixel round every letter
 * (MI2's lines, readable over any picture at any hour). The outline adds one pixel on every side.
 */
export function spokenLine(rows: readonly string[], colour: number): Bitmap {
  const words = renderText(rows.join('\n'), { color: colour, align: 'center' });
  const w = words.width + 2, h = words.height + 2;
  const out = createBitmap(w, h);
  const inked = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < words.width && y < words.height && words.pixels[y * words.width + x] !== 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (inked(x - 1, y - 1)) { out.pixels[y * w + x] = colour; continue; }
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) near = inked(x - 1 + dx, y - 1 + dy);
      if (near) out.pixels[y * w + x] = C.ink;
    }
  }
  return out;
}

/**
 * The choices' colours on the board: warm honey at rest, cream under the pointer (MI2's dim and lit magenta, in our wood's
 * colours). Neither is a speaker's colour: in MI2 the choices have their own ink (art review 1).
 */
export const CHOICE_INK = { rest: C.buffDark, lit: C.cream } as const;

/** The note before each choice: a quaver, five by seven, standing on the first row's baseline. */
const QUAVER_ROWS = ['..##.', '..#.#', '..#..', '..#..', '.##..', '###..', '.#...'] as const;
export function choiceNote(lit: boolean): Bitmap {
  return fromAscii(QUAVER_ROWS, { '#': lit ? CHOICE_INK.lit : CHOICE_INK.rest });
}

/** A choice's words, wrapped to `width`, dim or lit; written straight on the board, so no outline. */
export function choiceWords(text: string, width: number, lit: boolean): Bitmap {
  return renderText(drawnText(text), { color: lit ? CHOICE_INK.lit : CHOICE_INK.rest, maxWidth: width });
}

/** How many rows a choice takes at `width`: what `choiceLayout` places. */
export function choiceRows(text: string, width: number): number {
  return wrap(drawnText(text), width).length;
}

/**
 * The band while the student chooses (`BOARD_ROWS` high): the band's own frame (the groove and the walnut lip), and inside it
 * one dark board instead of the cells and slots, as MI2's interface turns into the list of lines.
 */
export function talkBoard(width: number): Bitmap {
  const h = BOARD_ROWS;
  const board = createBitmap(width, h);
  const fill = (x0: number, y0: number, w: number, hh: number, colour: number) => {
    for (let y = y0; y < y0 + hh; y++) for (let x = x0; x < x0 + w; x++) board.pixels[y * width + x] = colour;
  };
  fill(0, 0, width, h, C.panel);
  fill(0, 0, width, 1, C.groove);
  const inset = { x: 2, y: 2, w: width - 4, h: h - 4 };
  fill(inset.x, inset.y, inset.w, inset.h, C.night);
  fill(inset.x, inset.y, inset.w, 1, C.groove); // the board sits a little below the band's face: its shade on top
  fill(inset.x, inset.y, 1, inset.h, C.groove);
  fill(inset.x, inset.y + inset.h - 1, inset.w, 1, C.panelLit); // and the light catches its lower lip
  fill(inset.x + inset.w - 1, inset.y + 1, 1, inset.h - 1, C.panelDark);
  return board;
}

/** The note sits this far from its choice's words: `TALK.textIndent` less the quaver's width. */
export const NOTE_WIDTH = QUAVER_ROWS[0].length;
export const NOTE_TO_WORDS = TALK.textIndent - NOTE_WIDTH;
