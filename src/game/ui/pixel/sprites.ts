import { ART_DETAIL } from '../../../core/layout/frame';
import { fromAscii, type Bitmap } from './bitmap';
import { KIUR_MOODS } from './kiur/kiurFrames';
import { paintKiur } from './kiur/kiurModel';
import { C } from './palette';

/**
 * The pictures of the game: one character and a few icons, made for this project (original art). An icon is rows of
 * letters, drawn pixel by pixel; the legend says which palette colour a letter is. Kiur is painted from his model.
 */

export type MascotFrame = 'idle' | 'cheer' | 'hmm';

/**
 * Kiur, the round friend: a tree pipit (metskiur), brown and streaked above, buff with dark drops on the breast, white
 * below, on pink legs (d114). At rest, singing with his bill open (the cheer) and looking up and aside (thinking). Each
 * frame is 48 x 40 on the fine grid (d110), a pose of the model in `kiur/kiurModel.ts`.
 */
export const MASCOT: Readonly<Record<MascotFrame, Bitmap>> = KIUR_MOODS;

/** The room Kiur takes on a screen, in layout cells: half his fine pixels each way. */
export const MASCOT_SIZE = { w: MASCOT.idle.width / ART_DETAIL, h: MASCOT.idle.height / ART_DETAIL } as const;

/**
 * Kiur at the door (ft_1_15): a firm stance, facing the student, his head and one wing pointing right at the door. Not
 * angry and never a frown: the gesture says it. 52 x 40 on the fine grid; the wing is `KIUR_DOOR_WING_ROW` rows down.
 */
export const KIUR_DOOR: Bitmap = paintKiur({ yaw: 0, headYaw: 55, wings: 'point', openSide: 1, w: 52, ox: 22 });
export const KIUR_DOOR_WING_ROW = 19;

const STAR_ROWS = [
  '....k....',
  '...kgk...',
  'kkkkgkkkk',
  'khhgggggk',
  '.kgggggk.',
  '..kgggk..',
  '.kgggggk.',
  '.kggkggk.',
  '.kk...kk.',
];

/** A star earned: gold. */
export const STAR_FULL: Bitmap = fromAscii(STAR_ROWS, { k: C.ink, g: C.gold, h: C.goldLight });
/** A star not earned yet: dark, never a cross or a gap that says "missed". */
export const STAR_EMPTY: Bitmap = fromAscii(STAR_ROWS, { k: C.ink, g: C.lock, h: C.lock });

/** A padlock: this piece is not open yet. */
export const LOCK: Bitmap = fromAscii(
  [
    '..kkkkk..',
    '.kk...kk.',
    '.k.....k.',
    '.k.....k.',
    'kkkkkkkkk',
    'kDDDDDDDk',
    'kDDDkDDDk',
    'kDDDkDDDk',
    'kDDDDDDDk',
    'kkkkkkkkk',
  ],
  { k: C.ink, D: C.dim },
);

/** A little sparkle, for a level-up. */
export const SPARKLE: Bitmap = fromAscii(['..g..', '.ggg.', 'ggggg', '.ggg.', '..g..'], { g: C.goldLight });

const HEART_ROWS = [
  '.kkk.kkk.',
  'kfffkfffk',
  'kfwfffffk',
  'kfffffffk',
  '.kfffffk.',
  '..kfffk..',
  '...kfk...',
  '....k....',
];

/** The heart beside the player's health bar in a battle: it says the bar is theirs without a word. */
export const HEART: Bitmap = fromAscii(HEART_ROWS, { k: C.ink, f: C.red, w: C.pink });
/** A lost life in the note trainer: the heart in the locked grey, like an unearned star. */
export const HEART_EMPTY: Bitmap = fromAscii(HEART_ROWS, { k: C.ink, f: C.lock, w: C.lock });

