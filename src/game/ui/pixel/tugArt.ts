/**
 * The tug's look (ft_1_21.AC7, WP-10, the painter's part CT-P6; take B of sketch 1): while a tug plays, the
 * band gives way to a dark board (the talk's, `talkBoard`) with a hemp rope across it, tied behind two round wooden
 * tokens: the student's with a white note on the left, the character's with its face (or a note in its own colour) on
 * the right. A red rag on the rope marks the standing; chalk marks on the board show every place it can go. The token
 * whose turn it is gets a ring of its player's colour and a note bobbing over it, and notes rise from the character
 * while it plays. Where it all goes is `core/layout/tug.ts`; `tugView.ts` draws it. Art pixels (layout cells), palette
 * indices; painted in MI2's manner: flat bands, a dark line round each thing, no gradients.
 */
import { chalkOf, ropeTop, TUG, tugBoard, type TugBoard } from '../../../core/layout/tug';
import { blit, createBitmap, fromAscii, type Bitmap } from './bitmap';
import { hash2 } from './paint/noise';
import { C } from './palette';
import { talkBoard, talkColour } from './talkArt';

/** The rope's hemp, dark to light, and the dark line round it (the darkest of the band's wood, as round the band's cells). */
export const ROPE_INK = { hemp: [C.buffDeep, C.buffDark, C.buff, C.buffLight], line: C.groove } as const;
/** The rag: red cloth, dark to light, with an ink line. */
export const RAG_INK = { cloth: [C.redDark, C.red, C.redLight], line: C.ink } as const;
/** The chalk on the board: the steps faint, the middle and the ends brighter. */
export const CHALK_INK = { step: C.buffDeep, mark: C.buff } as const;

/** Each strand's tone along the twist, and how each row of the rope is shaded (lit from above). */
const TWIST = [3, 2, 1, 1] as const;
const ROW_SHADE = [0, 0, -1, -1] as const;

/** The star chalked at each end of the board, where the tug is won: in the colour of the player who wins there. */
const STAR = ['..#..', '..#..', '#####', '.###.', '.#.#.'] as const;

/**
 * The board under a tug in a band `width` cells wide, with its rope and chalk marks for `steps` steps each way, and at
 * each end a star in the colour of the player who wins there (`ends`: the student's left, the character's right), so a
 * student sees which end is theirs. The rag and the tokens are separate pictures (they change as it plays).
 */
export function tugBoardPicture(width: number, steps: number, ends: { readonly student: number; readonly character: number }): Bitmap {
  const board = tugBoard(width, steps);
  const picture = createBitmap(width, talkBoard(width).height);
  blit(picture, talkBoard(width), 0, 0);
  const put = (x: number, y: number, c: number) => { if (x >= 0 && y >= 0 && x < width && y < picture.height) picture.pixels[y * width + x] = c; };
  planks(put, width);
  board.places.forEach((x, i) => chalk(put, x, chalkOf(board, i), i === 0 ? ends.student : ends.character));
  rope(put, board);
  return picture;
}

/** The board is planks: a seam with its lit lip across it, and a knot or two in the wood, inside the board's frame. */
function planks(put: (x: number, y: number, c: number) => void, width: number): void {
  for (const seam of [17, 35]) {
    for (let x = 3; x < width - 3; x++) {
      // a seam is not ruled: it wanders a row here and there
      const y = seam + (hash2(Math.floor(x / 37), seam, 91) > 0.7 ? 1 : 0);
      put(x, y, C.groove);
      if (hash2(x, y, 92) > 0.3) put(x, y + 1, C.panelDark);
    }
  }
  for (const [kx, ky] of [[width * 0.21, 9], [width * 0.63, 27], [width * 0.86, 46]] as const) {
    const x = Math.round(kx);
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, -1], [0, 1]] as const) put(x + dx, ky + dy, dx === 0 && dy === 0 ? C.groove : C.panelDark);
  }
}

/**
 * A chalk mark under the rope: a short stroke for a step, a longer one for the middle (where it starts), a star at each
 * end in the colour of the player who wins there (`colour`).
 */
function chalk(put: (x: number, y: number, c: number) => void, x: number, kind: 'middle' | 'end' | 'step', colour: number): void {
  const y0 = TUG.chalkY;
  if (kind === 'step') {
    for (let k = 0; k < TUG.chalk; k++) put(x, y0 + k, CHALK_INK.step);
  } else if (kind === 'middle') {
    for (let k = 0; k < TUG.chalkLong; k++) put(x, y0 + k - 1, CHALK_INK.mark);
    put(x - 1, y0 + TUG.chalkLong - 2, CHALK_INK.step);
    put(x + 1, y0 + TUG.chalkLong - 2, CHALK_INK.step);
  } else {
    STAR.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') put(x - 2 + i, y0 - 1 + j, colour); }));
  }
}

/** The twisted rope, its strands leaning one way, a dark line over and under it. */
function rope(put: (x: number, y: number, c: number) => void, board: TugBoard): void {
  const { x0, x1 } = board.rope;
  for (let x = x0; x <= x1; x++) {
    const top = ropeTop(board, x);
    put(x, top - 1, ROPE_INK.line);
    put(x, top + TUG.ropeThick, ROPE_INK.line);
    for (let k = 0; k < TUG.ropeThick; k++) {
      // the twist follows the rope's own rows, so it runs on unbroken where the sag steps down a row
      const tone = Math.max(0, Math.min(3, TWIST[(x + top + k) % 4]! + ROW_SHADE[k]!));
      put(x, top + k, ROPE_INK.hemp[tone]!);
    }
  }
  // the rope's ends are bound with a turn of darker twine
  for (const x of [x0 + 1, x0 + 2, x1 - 2, x1 - 1]) {
    const top = ropeTop(board, x);
    for (let k = 0; k < TUG.ropeThick; k++) put(x, top + k, k === 0 ? C.buffDark : C.buffDeep);
  }
}

/** The rag's knot sits on the rope this far from the picture's top-left: x its middle, y the rope's top. */
export const RAG_KNOT = { x: 4, y: 1 } as const;

/**
 * The red rag tied round the rope, in two looks: its tails hang, then one lifts in the draught (the shared wind's step, or
 * still when motion is off).
 */
export function tugRag(frame: 0 | 1): Bitmap {
  const rows = frame === 0
    ? ['..####...', '.#RLLR#..', '#rRLLRr#.', '#rRRRRr#.', '.#rRRr#..', '.#rR#rR#.', '#rR#.#rR#', '#rR#..#r#', '.#R#..#rR', '.#r#...#.', '..#......']
    : ['..####...', '.#RLLR#..', '#rRLLRr#.', '#rRRRRr#.', '.#rRRr###', '.#rR##rR#', '#rR#.#rr#', '#rR#.#r#.', '.#R#.#r#.', '.#r#..#..', '..#......'];
  return fromAscii(rows, { '#': RAG_INK.line, r: RAG_INK.cloth[0], R: RAG_INK.cloth[1], L: RAG_INK.cloth[2] });
}

/** A quaver, five by seven. */
const QUAVER = ['..##.', '..#.#', '..#..', '..#..', '.##..', '###..', '.#...'] as const;

/** A quaver in `colour` with an ink line one pixel round it, readable over any picture (as the spoken lines). */
export function outlinedNote(colour: number): Bitmap {
  const w = QUAVER[0].length + 2, h = QUAVER.length + 2;
  const out = createBitmap(w, h);
  const on = (x: number, y: number) => x >= 0 && y >= 0 && y < QUAVER.length && x < QUAVER[0].length && QUAVER[y]![x] === '#';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (on(x - 1, y - 1)) out.pixels[y * w + x] = colour;
      else if ([-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => on(x - 1 + dx, y - 1 + dy)))) out.pixels[y * w + x] = C.ink;
    }
  }
  return out;
}

/** The tokens' wood, dark to light (the band's own), and the side of the board they stand for. */
const TOKEN_WOOD = [C.panelDark, C.panel, C.panelLit, C.panelLight] as const;
export type TokenOf = 'student' | { readonly character: string };

/** The tokens are this wide and high: a disc of `TUG.tokenRadius` and its line. */
export const TOKEN_SIZE = 2 * TUG.tokenRadius + 3;

/**
 * A player's token: a round of the band's wood, lit from the upper left, with the player's picture on it: the student's a
 * note (white when it is their turn, honey otherwise), a character's its small face (`CHARACTER_FACES`) or, without one, a
 * note in its own colour. `lit` (their turn) rings it in their colour, so a student sees whose turn it is without words.
 */
export function tugToken(of: TokenOf, lit: boolean): Bitmap {
  const r = TUG.tokenRadius;
  const size = TOKEN_SIZE, c = size / 2 - 0.5;
  const out = createBitmap(size, size);
  const colour = of === 'student' ? talkColour('student') : talkColour('character', of.character);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d > r + 1) continue;
      let ink: number;
      if (d > r) ink = C.ink;
      else if (lit && d > r - 2) ink = colour;
      else if (d > r - (lit ? 3 : 1)) ink = C.groove;
      else {
        // flat bands of the wood: lit on the upper left, shaded on the lower right
        const light = (-(x - c) - (y - c)) / r;
        ink = TOKEN_WOOD[light > 0.55 ? 3 : light > -0.1 ? 2 : light > -0.7 ? 1 : 0]!;
      }
      out.pixels[y * size + x] = ink;
    }
  }
  const face = of === 'student' ? null : CHARACTER_FACES[of.character];
  if (face) blit(out, face, Math.round(c - face.width / 2 + 0.5), Math.round(c - face.height / 2 + 0.5));
  else {
    const note = fromAscii(QUAVER, { '#': of === 'student' && !lit ? C.honey : colour });
    blit(out, note, Math.round(c - 2), Math.round(c - 3));
  }
  return out;
}

/**
 * The characters' faces on their tokens, by character id: drawn small by hand, never sampled from the figure (MI2 sets a
 * face pixel by pixel). Puuvaim: a burl of bark with its brow, two round eyes, a broken branch for a nose and a beard of
 * grey-green lichen, as his face on the knoll's tree (`keri/puuvaim.ts`).
 */
export const CHARACTER_FACES: Readonly<Record<string, Bitmap>> = {
  puuvaim: fromAscii([
    '...#####...',
    '..#hhhhh#..',
    '.#hlllllh#.',
    '#llhhhhhll#',
    '#d###d###d#',
    '#dwk#d#wkd#',
    '#d###n###d#',
    '#ddddnNdddd',
    '#dddd#nNdd#',
    '.#gGgGg#d#.',
    '..#gGgGg#..',
    '...#g#g#...',
  ], { '#': C.umberDeep, h: C.umberLight, l: C.umber, d: C.umberDark, w: C.cream, k: C.ink, n: C.brownLight, N: C.buffLight, g: C.moonDark, G: C.moon }),
};
