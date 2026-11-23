import { blit, createBitmap, fromAscii, type Bitmap } from './bitmap';
import { C } from './palette';
import { HEART } from './sprites';

/**
 * The icons on buttons (ft_1_08). Pencil, keyboard and quit are original, drawn for this project; person, key and gear
 * are from the Kenney 1-Bit Pack (CC0, kenney.nl/assets/1-bit-pack), imported to rows and given the kit's ink outline
 * (d084, `docs/assets.md`). Each fits inside an 18 pixel button with its frame.
 */
const LEGEND = { k: C.ink, w: C.white, s: C.dim, g: C.gold, y: C.goldLight, p: C.pink, c: C.cream, n: C.brown } as const;

export type IconId = 'maker' | 'freePlay' | 'newPlayer' | 'credits' | 'admin' | 'settings' | 'quit' | 'ear' | 'up' | 'down' | 'backpack';

const ROWS: Readonly<Record<Exclude<IconId, 'credits'>, readonly string[]>> = {
  // a pencil writing a note on staff lines (own art)
  maker: ['.........kk.', '........kppk', '.......kgykk', '......kgygk.', '.....kgygk..', 'sss.kgygksss', '...kcgkk....', 'ssskckksssss', '..kkk.......', 'skkssssssss.', '.kwk........', '..k.........'],
  // four white keys with the two-black-key group (own art)
  freePlay: ['kkkkkkkkkkkkkkkkk', 'kwwkkkwkkkwwwkwwk', 'kwwkkkwkkkwwwkwwk', 'kwwkkkwkkkwwwkwwk', 'kwwkkkwkkkwwwkwwk', 'kwwwkwwwkwwwkwwwk', 'kwwwkwwwkwwwkwwwk', 'kwwwkwwwkwwwkwwwk', 'kkkkkkkkkkkkkkkkk'],
  // a person (Kenney 1-Bit Pack, CC0)
  newPlayer: ['...kkkk...', '..kwwwwk..', '.kwwwwwwk.', '.kwwwwwwk.', '.kwwwwwwk.', '.kwwwwwwk.', '..kkkkkk..', '.kwwwwwwk.', 'kwwwwwwwwk', 'kwwwwwwwwk', 'kwwwwwwwwk', 'kwwwwwwwwk', '.kwwwwwwk.', '..kkkkkk..'],
  // a key (Kenney 1-Bit Pack, CC0)
  admin: ['..kkkk..........', '.kggggk.........', 'kggggggkkkkkkkk.', 'kgg..ggkgggggggk', 'kgg..ggkgggggggk', 'kggggggkkkkkkkk.', '.kggggk..kggggk.', '..kkkk...kgkggk.', '..........k.kk..'],
  // a gear (Kenney 1-Bit Pack, CC0)
  settings: ['..kk..kk..kk..', '.ksskksskkssk.', 'kssssssssssssk', 'kssssssssssssk', '.ksss....sssk.', '.kss......ssk.', 'ksss..ss..sssk', 'ksss..ss..sssk', '.kss......ssk.', '.ksss....sssk.', 'kssssssssssssk', 'kssssssssssssk', '.ksskksskkssk.', '..kk..kk..kk..'],
  // an ear (own art; the 1-bit pack has none) for the ear trainer (ft_1_10)
  ear: ['..kkkk...', '.kccccck.', 'kcckkkcck', 'kck...kck', 'kck..kck.', 'kcck.kck.', '.kcckkck.', '..kcckck.', '...kkcck.', '.....kkk.'],
  // the inventory's arrows (ft_1_20): a plain triangle each way (own art; the painter draws the band's kit)
  up: ['....k....', '...kwk...', '..kwwwk..', '.kwwwwwk.', 'kkkkkkkkk'],
  down: ['kkkkkkkkk', '.kwwwwwk.', '..kwwwk..', '...kwk...', '....k....'],
  // a backpack with its strap, flap and buckle (own art; the painter draws its look, ft_1_20)
  backpack: ['....kkkk....', '...kk..kk...', '..kkkkkkkk..', '.knnnnnnnnk.', 'kcccccccccck', 'knnnnggnnnnk', 'knnnnggnnnnk', 'knnnnnnnnnnk', 'knccccccccnk', 'knnnnnnnnnnk', 'knnnnnnnnnnk', '.kkkkkkkkkk.'],
  // a door with an arrow going out (own art)
  quit: ['kkkkkkk....', 'knnnnnk....', 'knnnnnk..k.', 'knnnnnkkkwk', 'knnngnwwwwk', 'knnnnnkkkwk', 'knnnnnk..k.', 'knnnnnk....', 'knnnnnk....', 'kkkkkkk....'],
};

/** A small pencil for an 11 pixel button: an own piece's edit button on its card (ft_1_12; own art). */
export const PENCIL: Bitmap = fromAscii(['.....kk', '....kpk', '...kgk.', '..kgk..', '.kgk...', 'kck....', 'kk.....'], LEGEND);

/** The New piece card's pencil, a size up from `PENCIL` (own art): eraser top right, the lead bottom left. */
const BIG_PENCIL: Bitmap = fromAscii([
  '.........kk.',
  '........kppk',
  '.......kgykk',
  '......kgygk.',
  '.....kgygk..',
  '....kgygk...',
  '...kgygk....',
  '..kcgyk.....',
  '.kccgk......',
  '.kcck.......',
  'kkkk........',
  'kk..........',
], LEGEND);

/** Room between the New piece staff's lines, in art pixels. */
const NEW_PIECE_GAP = 4;
/** The New piece picture's height: five lines `NEW_PIECE_GAP` apart with a pixel of room above and below. */
export const NEW_PIECE_HEIGHT = 4 * NEW_PIECE_GAP + 3;

/**
 * The piece maker's New piece card: an empty five-line staff as wide as a piece card, with a
 * pencil at its right end writing on the second line from the bottom. Drawn for the card's width, since the list's
 * columns follow the window (own art).
 */
export function newPieceArt(width: number): Bitmap {
  const art = createBitmap(width, NEW_PIECE_HEIGHT);
  for (let line = 0; line < 5; line++) art.pixels.fill(LEGEND.k, (1 + line * NEW_PIECE_GAP) * width, (2 + line * NEW_PIECE_GAP) * width);
  // the lead's point on the fourth line, the pencil leaning up and to the right off the staff's end
  blit(art, BIG_PENCIL, width - BIG_PENCIL.width, 1 + 3 * NEW_PIECE_GAP - (BIG_PENCIL.height - 1));
  return art;
}

/**
 * A speech bubble, 11 by 8: a piece a character of Keri teaches (the piece book's character group;
 * own art, a standard symbol: the 1-bit pack could not be fetched to compare). White inside: the book tints it in the
 * character's colour.
 */
export const BUBBLE: Bitmap = fromAscii(['.kkkkkkkkk.', 'kwwwwwwwwwk', 'kwwwwwwwwwk', 'kwwwwwwwwwk', 'kwwwwwwwwwk', '.kkwkkkkkk.', '..kwk......', '..kk.......'], LEGEND);

export const ICONS: Readonly<Record<IconId, Bitmap>> = {
  ...(Object.fromEntries(Object.entries(ROWS).map(([id, rows]) => [id, fromAscii(rows, LEGEND)])) as Record<Exclude<IconId, 'credits'>, Bitmap>),
  // the game's own heart
  credits: HEART,
};
