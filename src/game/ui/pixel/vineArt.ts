import { flipX, flipY, fromAscii, type Bitmap } from './bitmap';
import { C } from './palette';

/**
 * The vine in the screen corners of the menus (ft_1_08): a five-line staff whose stalks are the staff lines and
 * whose leaves, buds and blossoms are note heads, stems and flags. Near the end of each arm the whole staff turns and runs
 * out over the screen edge, so the music never stops. Original, drawn for this project (preview variant B,
 * chosen). One picture for the top left corner; the other three are its mirrors.
 */
const VINE_LEGEND = { d: C.leafDark, l: C.leaf, L: C.leafLight, p: C.pinkDark, P: C.pink, q: C.pinkLight, y: C.goldLight } as const;
const VINE_ROWS = [
  '......................................ddld......ddd.ddll.d.dd.',
  '.......dddddddddd...............dddddd..l.ddddddd.ddd.l.dd.d..',
  '....ppdpp........ddddldddddddddd......ddld......ddd.ll.dd.dd..',
  '...pPPpPPpddddddd....l..........dddddd..l.ddddddd..ll.dd.dd...',
  '...pPPpPPp.......ddddldddddddddl.....lLLll......llll.dd.dd....',
  '..d.ppyppllllllll....l.........llllllllll.lllllll..ddd.dd.....',
  '..dpPPpPPp.......lllllllllllllll.l.dlllldd...Pqq.ddd..dd......',
  '.d.pPPpPPpddddddd.lLL..........ldLddddd...ddPPPPPd..dd........',
  '.d.dpp.pp........llllldddddddddl......dddd.pPPPPpdddd.........',
  '.d.d.l.d.ddddddddlllld......lLL.dddddd....dddppddd............',
  '.d.d.l.d.d.......ddddddddddlllll..............................',
  '.d.d.l.d.d................dlllld..............................',
  '.d.d.l.d.d..................dd................................',
  '.d.d.l.d.d....................................................',
  '.d.d.l.d.dd...................................................',
  '.d.d.l.d.ll...................................................',
  '.d.d.l.dllld..................................................',
  '..d.d.l.Llld..................................................',
  '..d.d.l.Lll...................................................',
  '..dllllldld...................................................',
  '..d.d.l.d.d...................................................',
  '..d.d.l.d.d...................................................',
  '..d.d.ldd.d...................................................',
  '..d.d.lld.d...................................................',
  '..d.dllld.d...................................................',
  '.d.d.Llldd....................................................',
  '.d.d.Lll.d....................................................',
  'llllllld.d....................................................',
  '.l.d.l.d.d....................................................',
  '.dlL.l.dpd....................................................',
  'ddddll.PPd....................................................',
  'd.d.l.PPPp....................................................',
  'ddd.l.qPPp....................................................',
  '.d.lldqPP.....................................................',
  'ddll.d.Pp.....................................................',
  'd.l.dd.d......................................................',
  'll.dd.d.......................................................',
  'l.dd.dd.......................................................',
  '.dd.dd........................................................',
  'dd.dd.........................................................',
  '..dd..........................................................',
  'ddd...........................................................',
  'd.............................................................',
];

export const VINE_TOP_LEFT: Bitmap = fromAscii(VINE_ROWS, VINE_LEGEND);

export type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

export const VINE_CORNERS: Readonly<Record<Corner, Bitmap>> = {
  topLeft: VINE_TOP_LEFT,
  topRight: flipX(VINE_TOP_LEFT),
  bottomLeft: flipY(VINE_TOP_LEFT),
  bottomRight: flipX(flipY(VINE_TOP_LEFT)),
};

export interface CornerArt {
  corner: Corner;
  x: number;
  y: number;
  bitmap: Bitmap;
}

/** Where the four corner pictures go on a screen of `width` x `height` art pixels: each flush with its corner. */
export function vinePlacements(width: number, height: number): CornerArt[] {
  return (Object.keys(VINE_CORNERS) as Corner[]).map((corner) => {
    const bitmap = VINE_CORNERS[corner];
    return {
      corner,
      bitmap,
      x: corner.endsWith('Left') ? 0 : width - bitmap.width,
      y: corner.startsWith('top') ? 0 : height - bitmap.height,
    };
  });
}
