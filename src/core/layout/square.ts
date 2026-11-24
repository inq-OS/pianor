import { ART_DETAIL } from './frame';
import type { Rect } from './rect';
import { STRIP_ROWS } from './room';

/**
 * The plan of the village square (ft_1_19): the open ground between the houses at the lighthouse, seen from the
 * gallery on the lighthouse's stone foot, looking down south-east over the square to the southern pier. Pure: no Phaser, no DOM.
 *
 * The view is a stage set in the 1991 game's manner, not a camera's: each thing stands in the order and on the side
 * it has from that spot in the world model (`content/world/keri.json`), larger and nearer than to scale, and the
 * picture's lines are bent (`bend`).
 */

/** The scene's id in the world model (`scenes` in content/world/keri.json). */
export const SQUARE_ID = 'square';

/**
 * The scene's picture fills a scene's whole main area (ft_1_20: no band under a scene): 180 rows. What is pressed lies in
 * its upper 124 rows, so a board that opens over the foot (a conversation's choices, the tug) hides none of it.
 */
export const SQUARE_PICTURE = { w: 320, h: 180 } as const;

/** Where the picture and the strip under it go on a main area of `screen` layout cells: the picture from the top when it does not fit above the strip. */
export function squareView(screen: { w: number; h: number }, stripRows: number = STRIP_ROWS): { picture: Rect; strip: Rect } {
  const above = screen.h - stripRows;
  return {
    picture: { x: Math.floor((screen.w - SQUARE_PICTURE.w) / 2), y: Math.max(0, Math.floor((above - SQUARE_PICTURE.h) / 2)), w: SQUARE_PICTURE.w, h: SQUARE_PICTURE.h },
    strip: { x: 0, y: above, w: screen.w, h: stripRows },
  };
}

export interface SquarePlan {
  /** The picture, in fine pixels. */
  fine: { w: number; h: number };
  /** The horizon's row at the picture's middle. */
  horizon: number;
  /** The pier's box, for the screen's button (pressing the pier walks to the port). */
  pier: { x: number; y: number; w: number; h: number };
}

/** Where the viewer stands, metres east and north of the lighthouse, and the bearing of the picture's middle. */
export const SQUARE_VIEW = { x: 0, y: -3, bearing: 124 } as const;

export const SQUARE = {
  w: SQUARE_PICTURE.w * ART_DETAIL,
  h: SQUARE_PICTURE.h * ART_DETAIL,
  /** The row the view's bend ends at: the picture's foot. */
  fold: 360,
  /** The horizon's row: high, for the eye stands on the island's highest ground and looks down over the square. */
  horizon: 84,
  /** How far the picture's level lines bow down at its sides, fine pixels. */
  bow: 7,
  /** How far what stands up fans out from the middle at the picture's top, as a share of its distance from the middle. */
  splay: 0.09,
  /** The plaza's middle, where the flower bed lies. */
  lamp: { x: 300, y: 250 },
} as const;

/**
 * The bent view: a point of the flat plan to its place in the picture. Level lines bow down toward the sides and
 * what stands up fans out from the middle the higher it reaches, as nothing in the 1991 game is ruler-straight.
 */
export function bend(x: number, y: number): [number, number] {
  const side = (x - SQUARE.w / 2) / (SQUARE.w / 2);
  const up = Math.max(0, (SQUARE.fold - y) / SQUARE.fold);
  return [x + (x - SQUARE.w / 2) * SQUARE.splay * up * up, y + SQUARE.bow * side * side * Math.min(1, up * 1.6)];
}

export function squarePlan(): SquarePlan {
  return {
    fine: { w: SQUARE.w, h: SQUARE.h },
    horizon: SQUARE.horizon,
    pier: { x: 376, y: 76, w: 150, h: 60 },
  };
}
