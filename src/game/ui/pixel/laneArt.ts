import { fromAscii, type Bitmap } from './bitmap';
import { C } from './palette';

/**
 * The pictures of a beat lane's bubble (core_13 rule 10): where it runs (above the staff or between two), each kind of its
 * dots (the dotted line, the click's beats, a note of the top staff over its dot, one of the bottom staff under its dot),
 * the wave's height and width, its place up or down, the blink, a new lane and the next lane. White on the bubble, the part each one tunes
 * in gold. Original, a few pixels each; each fits a bubble option (10 rows at most).
 */
export type LaneIconId = 'above' | 'between' | 'ghost' | 'beat' | 'top' | 'bottom' | 'height' | 'reach' | 'move' | 'blink' | 'add' | 'next';

const LEGEND = { w: C.white, g: C.goldLight, d: C.dim } as const;

const ICONS: Readonly<Record<LaneIconId, readonly string[]>> = {
  // a staff of three lines, the lane over it
  above: ['g.g.g.g.g.g.g', '.............', '.............', 'wwwwwwwwwwwww', '.............', 'wwwwwwwwwwwww', '.............', 'wwwwwwwwwwwww'],
  // two lines of a staff above and below, the lane between
  between: ['wwwwwwwwwwwww', '.............', 'wwwwwwwwwwwww', '.............', 'g.g.g.g.g.g.g', '.............', 'wwwwwwwwwwwww', '.............', 'wwwwwwwwwwwww'],
  // the dotted line
  ghost: ['.............', '.............', '.............', 'g.g.g.g.g.g.g', '.............', '.............'],
  // the click's beats, bigger dots on the dotted line
  beat: ['gg...gg...gg.', 'gg...gg...gg.', '..d.d..d.d..d'],
  // a note of the top staff over its dot
  top: ['....w...', '....w...', '....w...', '.www....', 'wwww....', '.ww.....', '........', '.gg.....', '.gg.....'],
  // a note of the bottom staff under its dot
  bottom: ['.gg.....', '.gg.....', '........', '.www....', 'wwww....', '.ww.w...', '....w...', '....w...', '....w...'],
  // a tall wave over the lane, an arrow up its side
  height: ['g......w......', 'g.....w.w.....', 'g....w...w....', 'g....w...w....', 'g...w.....w...', 'g..w.......w..', 'g.w.........w.', 'ww...........w'],
  // a wide wave, an arrow along its foot
  reach: ['.....www.....', '...ww...ww...', '..w.......w..', '.w.........w.', 'w...........w', '.............', 'g...........g', 'ggggggggggggg', 'g...........g'],
  // the lane with an arrow up and an arrow down
  move: ['......g......', '.....ggg.....', '....g.g.g....', '......g......', 'w.w.w.w.w.w.w', '......g......', '....g.g.g....', '.....ggg.....', '......g......'],
  // a note with light round its head
  blink: ['g......w..', '..g....w..', '.......w..', 'g..www.w..', '..wwwwww..', '..wwwww..g', '...www....', 'g.......g.', '...g..g...'],
  // the lanes, the next one lit, an arrow down to it
  next: ['w.w.w.w.w.w.w', '..........g..', '..........g..', 'g.g.g.g..ggg.', '..........g..', 'w.w.w.w.w.w.w'],
  // a lane and a plus
  add: ['.........g...', '.........g...', '.......ggggg.', '.........g...', '.........g...', '.............', 'w.w.w.w.w.w.w'],
};

export const LANE_ICONS: Readonly<Record<LaneIconId, Bitmap>> = Object.fromEntries(Object.entries(ICONS).map(([id, rows]) => [id, fromAscii(rows, LEGEND)])) as Record<LaneIconId, Bitmap>;
