/**
 * The old wall telephone in the room (ft_1_34): a wooden crank telephone with two brass bells on top, the receiver
 * hanging on its left hook, the mouthpiece on its arm, the crank at its right and the battery box under it. Drawn here
 * by the builder as a first sketch on the fine grid (d110), laid over the room's picture at its place in the plan
 * (`roomPlan().phone`); no free pack has a crank telephone at this size (use-free-art-packs). Palette indices only.
 * TODO(painter, R2) in ft_1_34.
 */
import { fromAscii, type Bitmap } from './bitmap';
import { C } from './palette';

const LEGEND = { k: C.ink, b: C.night, w: C.brown, l: C.brownLight, d: C.brownDark, g: C.gold, G: C.goldLight, r: C.goldLight } as const;

const BELLS = [
  '...kk......kk...',
  '..kGgk....kGgk..',
  '..kggk....kggk..',
  '...kk......kk...',
];

const BODY = [
  '..kkkkkkkkkkkk..',
  '..kllllllllllk..',
  'kkklwwwwwwwwdk..',
  'kbklwwwwwwwwdk..',
  'kbklwwwkkwwwdkkk',
  'kbklwwkGgkwwdk.k',
  'kbklwwkggkwwdk.k',
  'kbklwwwkkwwwdk.g',
  'kbklwwwwwwwwdk..',
  'kkklwwwwwwwwdk..',
  '.kklwwwwwwwwdk..',
  '.kklwwwwwwwwdk..',
  '..kddddddddddk..',
  '..kkkkkkkkkkkk..',
  '.....kdddk......',
  '....kdddddk.....',
  '....kkkkkkk.....',
  '..kkkkkkkkkkkk..',
  '..kllllllllllk..',
  '..klwwwwwwwwdk..',
  '..klwwwwwwwwdk..',
  '..klwwwwwwwwdk..',
  '..kddddddddddk..',
  '..kkkkkkkkkkkk..',
];

/** The bells shaken one pixel to a side, with the ring's marks beside them. */
const shaken = (side: -1 | 1): string[] =>
  BELLS.map((row, y) => {
    const moved = side < 0 ? `${row.slice(1)}.` : `.${row.slice(0, -1)}`;
    if (y !== 1 && y !== 2) return moved;
    // the ring's marks: a short stroke beside the bell on the side it swings to
    return side < 0 ? `r${moved.slice(1)}` : `${moved.slice(0, -1)}r`;
  });

/** The telephone at rest. */
export function phoneAtRest(): Bitmap {
  return fromAscii([...BELLS, ...BODY], LEGEND);
}

/** The two looks of the ringing telephone, shown in turn: its bells shaken to the left, then to the right. */
export function phoneRinging(): [Bitmap, Bitmap] {
  return [fromAscii([...shaken(-1), ...BODY], LEGEND), fromAscii([...shaken(1), ...BODY], LEGEND)];
}
