/**
 * The plan of the village square (ft_1_19): the open ground between the houses at the lighthouse, seen from the
 * lighthouse's south-west foot, looking east-south-east over the square to the southern pier. Pure: no Phaser, no DOM.
 *
 * The view is a stage set in the 1991 game's manner, not a camera's: each thing stands in the order and on the side
 * it has from that spot in the world model (`content/world/keri.json`), larger and nearer than to scale, and the
 * picture's lines are bent (`bend`).
 */

export interface SquarePlan {
  /** The picture, in fine pixels. */
  fine: { w: number; h: number };
  /** The horizon's row at the picture's middle. */
  horizon: number;
  /** The pier's box, for the screen's button (pressing the pier walks to the port). */
  pier: { x: number; y: number; w: number; h: number };
}

/** Where the viewer stands, metres east and north of the lighthouse, and the bearing of the picture's middle. */
export const SQUARE_VIEW = { x: -3, y: -11, bearing: 113 } as const;

export const SQUARE = {
  w: 640,
  h: 248,
  /** The horizon's row: high, for the eye stands on the island's highest ground and looks down over the square. */
  horizon: 92,
  /** How far the picture's level lines bow down at its sides, fine pixels. */
  bow: 7,
  /** How far what stands up fans out from the middle at the picture's top, as a share of its distance from the middle. */
  splay: 0.05,
  /** The middle of the plaza's rings of flagstones, where the flower bed lies. */
  lamp: { x: 336, y: 206 },
} as const;

/**
 * The bent view: a point of the flat plan to its place in the picture. Level lines bow down toward the sides and
 * what stands up fans out from the middle the higher it reaches, as nothing in the 1991 game is ruler-straight.
 */
export function bend(x: number, y: number): [number, number] {
  const side = (x - SQUARE.w / 2) / (SQUARE.w / 2);
  const up = Math.max(0, (SQUARE.h - y) / SQUARE.h);
  return [x + (x - SQUARE.w / 2) * SQUARE.splay * up * up, y + SQUARE.bow * side * side * Math.min(1, up * 1.6)];
}

export function squarePlan(): SquarePlan {
  return {
    fine: { w: SQUARE.w, h: SQUARE.h },
    horizon: SQUARE.horizon,
    pier: { x: 436, y: 88, w: 130, h: 58 },
  };
}
