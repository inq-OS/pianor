import { defaultLetterCase, displayText, language } from '../../../core/text/language';
import { createBitmap, inkBounds, type Bitmap } from './bitmap';

/**
 * A pixel font drawn for this project: capitals seven pixels tall, small capitals five pixels tall (d086), lowercase five
 * pixels tall with ascenders and descenders, so a young student can tell `b` from `d` and `p` from `q`. Each glyph is rows of `#` and `.`, five wide;
 * a glyph with a tail (`g j p q y`) has two extra rows below the baseline. Glyphs are trimmed to their ink when drawn,
 * so `i` and `l` are narrow and `m` and `w` are wide.
 */
export const CAP_HEIGHT = 7;
/** Rows below the baseline, for the tails of `g j p q y`. */
export const TAIL = 2;
export const CELL_HEIGHT = CAP_HEIGHT + TAIL;
/** Space between two lines of text, below the cell. */
export const LINE_GAP = 2;
export const LINE_HEIGHT = CELL_HEIGHT + LINE_GAP;
const LETTER_GAP = 1;
const SPACE_WIDTH = 3;
/**
 * Small capitals (d086): five rows tall, standing on the baseline, for the lowercase letters of a text drawn in small
 * capitals. Õ Ä Ö Ü Š Ž are always drawn this size, with the mark in the two rows above, so every letter fits the
 * seven-row capital height and every label has the same height.
 */
const SMALL_HEIGHT = 5;

const g = (...rows: string[]): readonly string[] => rows;

const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  A: g('.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'),
  B: g('####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'),
  C: g('.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'),
  D: g('####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'),
  E: g('#####', '#....', '#....', '####.', '#....', '#....', '#####'),
  F: g('#####', '#....', '#....', '####.', '#....', '#....', '#....'),
  G: g('.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'),
  H: g('#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'),
  I: g('.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'),
  J: g('..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'),
  K: g('#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'),
  L: g('#....', '#....', '#....', '#....', '#....', '#....', '#####'),
  M: g('#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'),
  N: g('#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'),
  O: g('.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'),
  P: g('####.', '#...#', '#...#', '####.', '#....', '#....', '#....'),
  Q: g('.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'),
  R: g('####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'),
  S: g('.####', '#....', '#....', '.###.', '....#', '....#', '####.'),
  T: g('#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'),
  U: g('#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'),
  V: g('#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'),
  W: g('#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'),
  X: g('#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'),
  Y: g('#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'),
  Z: g('#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'),

  a: g('.....', '.....', '.###.', '....#', '.####', '#...#', '.####'),
  b: g('#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'),
  c: g('.....', '.....', '.###.', '#...#', '#....', '#...#', '.###.'),
  d: g('....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'),
  e: g('.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'),
  f: g('..##.', '.#...', '####.', '.#...', '.#...', '.#...', '.#...'),
  g: g('.....', '.....', '.####', '#...#', '#...#', '#...#', '.####', '....#', '.###.'),
  h: g('#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'),
  i: g('..#..', '.....', '.##..', '..#..', '..#..', '..#..', '.###.'),
  j: g('...#.', '.....', '..##.', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'),
  k: g('#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.'),
  l: g('.##..', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'),
  m: g('.....', '.....', '##.#.', '#.#.#', '#.#.#', '#...#', '#...#'),
  n: g('.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'),
  o: g('.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'),
  p: g('.....', '.....', '####.', '#...#', '#...#', '#...#', '####.', '#....', '#....'),
  q: g('.....', '.....', '.####', '#...#', '#...#', '#...#', '.####', '....#', '....#'),
  r: g('.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'),
  s: g('.....', '.....', '.####', '#....', '.###.', '....#', '####.'),
  t: g('.#...', '.#...', '####.', '.#...', '.#...', '.#..#', '..##.'),
  u: g('.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####'),
  v: g('.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'),
  w: g('.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'),
  x: g('.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'),
  y: g('.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####', '....#', '.###.'),
  z: g('.....', '.....', '#####', '...#.', '..#..', '.#...', '#####'),

  '0': g('.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'),
  '1': g('..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'),
  '2': g('.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'),
  '3': g('####.', '....#', '....#', '.###.', '....#', '....#', '####.'),
  '4': g('...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'),
  '5': g('#####', '#....', '####.', '....#', '....#', '#...#', '.###.'),
  '6': g('..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'),
  '7': g('#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'),
  '8': g('.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'),
  '9': g('.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'),

  '.': g('.....', '.....', '.....', '.....', '.....', '.....', '..#..'),
  ',': g('.....', '.....', '.....', '.....', '.....', '..#..', '..#..', '.#...'),
  ':': g('.....', '.....', '..#..', '.....', '.....', '..#..', '.....'),
  '|': g('..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'),
  ';': g('.....', '.....', '..#..', '.....', '.....', '..#..', '..#..', '.#...'),
  '!': g('..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'),
  '?': g('.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'),
  "'": g('..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'),
  '"': g('.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'),
  '-': g('.....', '.....', '.....', '.###.', '.....', '.....', '.....'),
  '+': g('.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'),
  // the Shift key, as keyboards print it, for a key on a bubble's option (ft_1_20): Shift+R is written ⇧R
  '⇧': g('..#..', '.#.#.', '#...#', '##.##', '.#.#.', '.#.#.', '.###.'),
  '^': g('..#..', '.#.#.', '#...#', '.....', '.....', '.....', '.....'),
  '=': g('.....', '.....', '#####', '.....', '#####', '.....', '.....'),
  // vim keys on F1 (ft_1_02e): $ the bar's end, ~ the accidental
  '$': g('..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'),
  '~': g('.....', '.....', '.#...', '#.#.#', '...#.', '.....', '.....'),
  '/': g('....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'),
  '(': g('...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'),
  ')': g('.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'),
  '[': g('.###.', '.#...', '.#...', '.#...', '.#...', '.#...', '.###.'),
  ']': g('.###.', '...#.', '...#.', '...#.', '...#.', '...#.', '.###.'),
  '%': g('##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'),
  '<': g('...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'),
  '>': g('.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'),
  // the start mark of a play started from a bar (core_03 rule 8)
  '▶': g('#....', '##...', '###..', '####.', '###..', '##...', '#....'),
  '*': g('.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'),
  '#': g('.#.#.', '#####', '.#.#.', '.#.#.', '#####', '.#.#.', '.....'),
  // the flat sign, for key names (ft_1_28): the same shape as the flat on the staff, so "B♭" never reads as two letters
  '♭': g('#....', '#....', '#....', '###..', '#..#.', '#.#..', '##...'),
  // a quarter note, for a tempo (ft_1_36 rule 3: "♩ 80")
  '♩': g('...#.', '...#.', '...#.', '...#.', '.###.', '####.', '.##..'),
  '&': g('.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'),
  _: g('.....', '.....', '.....', '.....', '.....', '.....', '.....', '#####'),
  // Estonian letters (ft_0_18, d086): a small capital with its mark in the two rows above it, inside the capital height.
  // The tilde of Õ is a plain line, which still reads apart from the two dots of Ö.
  'Õ': g('.###.', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'),
  'Ä': g('.#.#.', '.....', '.###.', '#...#', '#####', '#...#', '#...#'),
  'Ö': g('.#.#.', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'),
  'Ü': g('.#.#.', '.....', '#...#', '#...#', '#...#', '#...#', '.###.'),
  'Š': g('.#.#.', '..#..', '.####', '#....', '.###.', '....#', '####.'),
  'Ž': g('.#.#.', '..#..', '#####', '...#.', '..#..', '.#...', '#####'),
  // a solid block for a missing character
  '\u0000': g('#####', '#...#', '#...#', '#...#', '#...#', '#...#', '#####'),
};

const SMALL: Readonly<Record<string, readonly string[]>> = {
  A: g('.###.', '#...#', '#####', '#...#', '#...#'),
  B: g('####.', '#...#', '####.', '#...#', '####.'),
  C: g('.####', '#....', '#....', '#....', '.####'),
  D: g('####.', '#...#', '#...#', '#...#', '####.'),
  E: g('#####', '#....', '####.', '#....', '#####'),
  F: g('#####', '#....', '####.', '#....', '#....'),
  G: g('.####', '#....', '#..##', '#...#', '.###.'),
  H: g('#...#', '#...#', '#####', '#...#', '#...#'),
  I: g('.###.', '..#..', '..#..', '..#..', '.###.'),
  J: g('..###', '...#.', '...#.', '#..#.', '.##..'),
  K: g('#...#', '#..#.', '###..', '#..#.', '#...#'),
  L: g('#....', '#....', '#....', '#....', '#####'),
  M: g('#...#', '##.##', '#.#.#', '#...#', '#...#'),
  N: g('#...#', '##..#', '#.#.#', '#..##', '#...#'),
  O: g('.###.', '#...#', '#...#', '#...#', '.###.'),
  P: g('####.', '#...#', '####.', '#....', '#....'),
  Q: g('.###.', '#...#', '#.#.#', '#..#.', '.##.#'),
  R: g('####.', '#...#', '####.', '#..#.', '#...#'),
  S: g('.####', '#....', '.###.', '....#', '####.'),
  T: g('#####', '..#..', '..#..', '..#..', '..#..'),
  U: g('#...#', '#...#', '#...#', '#...#', '.###.'),
  V: g('#...#', '#...#', '#...#', '.#.#.', '..#..'),
  W: g('#...#', '#...#', '#.#.#', '##.##', '#...#'),
  X: g('#...#', '.#.#.', '..#..', '.#.#.', '#...#'),
  Y: g('#...#', '.#.#.', '..#..', '..#..', '..#..'),
  Z: g('#####', '...#.', '..#..', '.#...', '#####'),
};

/** Characters of the Private Use Area stand for the small capitals, so measuring, wrapping and drawing need no other mode. */
const SMALL_BASE = 0xe000;
const smallChar = (capital: string): string => String.fromCharCode(SMALL_BASE + capital.charCodeAt(0) - 'A'.charCodeAt(0));
const padTop = Array.from({ length: CAP_HEIGHT - SMALL_HEIGHT }, () => '.....');
const SMALL_GLYPHS: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Object.entries(SMALL).map(([capital, rows]) => [smallChar(capital), [...padTop, ...rows]]),
);
/** The letters with a mark: one glyph, the small capital with its mark, for both cases. */
const MARKED = new Set(['Õ', 'Ä', 'Ö', 'Ü', 'Š', 'Ž']);

/**
 * The text as the font draws it in small capitals (d086): an uppercase letter stays a capital, a lowercase letter becomes
 * its small capital. Õ Ä Ö Ü Š Ž are the small capital with its mark in either case. Other characters stay as they are.
 */
function smallCaps(text: string): string {
  let out = '';
  for (const ch of text) {
    const upper = ch.toLocaleUpperCase('et');
    if (MARKED.has(upper)) out += upper;
    else if (upper !== ch && SMALL[upper] !== undefined) out += smallChar(upper);
    else out += ch;
  }
  return out;
}

/**
 * The characters a text is drawn with, in the active language's case (ft_0_18, d086): what `PixelText` draws, and what to
 * `measure` when a width must fit the drawn text. `keepCase` draws the text as written.
 */
export function drawnText(text: string, keepCase = false): string {
  const letterCase = keepCase ? 'normal' : defaultLetterCase(language());
  return letterCase === 'smallCaps' ? smallCaps(text) : markedAsOne(displayText(text, letterCase));
}

/** Õ Ä Ö Ü Š Ž have one glyph for both cases, so a lowercase one (a German title in English) draws as that glyph. */
function markedAsOne(text: string): string {
  let out = '';
  for (const ch of text) {
    const upper = ch.toLocaleUpperCase('et');
    out += MARKED.has(upper) ? upper : ch;
  }
  return out;
}

export interface Glyph {
  /** Rows of the glyph with empty columns removed on both sides. */
  rows: readonly string[];
  width: number;
}

const cache = new Map<string, Glyph>();

/** True when the font has a glyph for this character (a space always has). */
export function hasGlyph(ch: string): boolean {
  return ch === ' ' || GLYPHS[ch] !== undefined || SMALL_GLYPHS[ch] !== undefined;
}

function trim(rows: readonly string[]): Glyph {
  let left = 5;
  let right = -1;
  for (const row of rows) {
    const first = row.indexOf('#');
    if (first >= 0) left = Math.min(left, first);
    right = Math.max(right, row.lastIndexOf('#'));
  }
  if (right < 0) return { rows: [], width: 0 };
  return { rows: rows.map((row) => row.slice(left, right + 1)), width: right - left + 1 };
}

/** The glyph for a character; a block stands in for one the font does not have. */
export function glyphFor(ch: string): Glyph {
  const found = cache.get(ch);
  if (found) return found;
  const glyph = ch === ' ' ? { rows: [], width: SPACE_WIDTH - LETTER_GAP } : trim(GLYPHS[ch] ?? SMALL_GLYPHS[ch] ?? GLYPHS['\u0000']!);
  cache.set(ch, glyph);
  return glyph;
}

/** Width in art pixels of a single line of text. */
export function measure(text: string): number {
  let width = 0;
  for (const ch of text) width += glyphFor(ch).width + LETTER_GAP;
  return Math.max(0, width - LETTER_GAP);
}

/** Break text into lines no wider than `maxWidth` art pixels, at spaces. A word wider than the line stays whole on its own line. */
export function wrap(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const trial = line === '' ? word : `${line} ${word}`;
      if (line !== '' && measure(trial) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = trial;
      }
    }
    lines.push(line);
  }
  return lines;
}

export interface TextOptions {
  /** Palette index of the letters. */
  color: number;
  /** Palette index of a one-pixel shadow below and to the right, so text reads on any background. */
  shadow?: number;
  /** Wrap at this width in art pixels. */
  maxWidth?: number;
  /** Draw the text as written, not in the active language's capitals (ft_0_18). Used by `PixelText`, not by `renderText`. */
  keepCase?: boolean;
  align?: 'left' | 'center' | 'right';
}

/** Draw text into a bitmap: letters in `color`, an optional shadow, lines wrapped and aligned. */
export function renderText(text: string, options: TextOptions): Bitmap {
  const lines = options.maxWidth === undefined ? text.split('\n') : wrap(text, options.maxWidth);
  const widths = lines.map(measure);
  const inner = Math.max(1, ...widths);
  const extra = options.shadow === undefined ? 0 : 1;
  const bitmap = createBitmap(inner + extra, Math.max(1, lines.length * LINE_HEIGHT - LINE_GAP) + extra);

  const put = (x: number, y: number, index: number) => {
    if (x >= 0 && y >= 0 && x < bitmap.width && y < bitmap.height) bitmap.pixels[y * bitmap.width + x] = index;
  };
  const stamp = (offset: number, color: number) => {
    lines.forEach((line, row) => {
      const slack = inner - widths[row]!;
      let x = options.align === 'center' ? Math.floor(slack / 2) : options.align === 'right' ? slack : 0;
      for (const ch of line) {
        const glyph = glyphFor(ch);
        glyph.rows.forEach((bits, gy) => {
          [...bits].forEach((bit, gx) => {
            if (bit === '#') put(x + gx + offset, row * LINE_HEIGHT + gy + offset, color);
          });
        });
        x += glyph.width + LETTER_GAP;
      }
    });
  };
  if (options.shadow !== undefined) stamp(1, options.shadow);
  stamp(0, options.color);
  return bitmap;
}

/**
 * The box a label's letters fill in its text picture: from the top of the capitals to the bottom of the last line, the
 * tails included only when a letter has one, so labels with and without tails share a baseline.
 */
export function letterBoxOf(bitmap: Bitmap): { left: number; top: number; right: number; bottom: number } {
  const ink = inkBounds(bitmap);
  const noTails = Math.max(0, bitmap.height - TAIL);
  if (ink === null) return { left: 0, top: 0, right: bitmap.width, bottom: noTails };
  return { left: ink.left, top: 0, right: ink.right, bottom: Math.max(noTails, ink.bottom) };
}

/**
 * The first text that fits on one line of `maxWidth` art pixels; when none does, the last one cut short with "...".
 * For a title in a bar of fixed height, where a second line would run out of the bar.
 */
export function fitLine(candidates: readonly string[], maxWidth: number): string {
  const fitting = candidates.find((c) => measure(c) <= maxWidth);
  if (fitting !== undefined) return fitting;
  const last = candidates[candidates.length - 1] ?? '';
  for (let n = last.length - 1; n > 0; n--) {
    const cut = `${last.slice(0, n).trimEnd()}...`;
    if (measure(cut) <= maxWidth) return cut;
  }
  return '';
}
