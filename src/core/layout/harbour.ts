import { ART_DETAIL } from './frame';
import { pictureView } from './room';

/**
 * The southern port seen from a raised eye (ft_1_19; the viewpoint of the 1990s towns, the painter's
 * `vocabulary/viewpoint.md`): the eye stands a storey up on the quay's root, the horizon lies in the upper quarter, and
 * the quay is a shape on the water that curls out to sea and away, its beacon small and far at its end; what the eye
 * stands on is dark along the picture's foot. Pure numbers; the painter is `game/ui/pixel/keri/harbourPicture.ts`.
 *
 * The quay is laid out on the sea in metres (x to the right, z ahead from the eye) and seen through a pinhole: a point
 * `h` metres over the water stands at row `horizon + lens * (eye - h) / z`.
 */
export const HARBOUR_PICTURE = { w: 320, h: 180 } as const;
export const harbourView = pictureView(HARBOUR_PICTURE);

const FINE = { w: HARBOUR_PICTURE.w * ART_DETAIL, h: HARBOUR_PICTURE.h * ART_DETAIL } as const;

/** The eye: the horizon's row (fine pixels), its height over the sea (metres) and fine pixels per radian. */
export const HARBOUR = { horizon: 78, eye: 7, lens: 560 } as const;

/**
 * The quay's middle line on the sea, from its root under the eye to the beacon at its head (metres): it runs out and to
 * the right, then curls back to the left. AX-3 provisional: painted in the 1991 game's manner, not as the place is.
 */
export const HARBOUR_QUAY: readonly (readonly [number, number])[] = [[-2, 3], [3, 16], [10, 36], [15, 58], [14, 80], [8, 100]];
/** The quay's width and the height of its top over the water (metres). */
export const QUAY = { wide: 7, high: 2.4 } as const;
/** The beacon's platform at the quay's head, its side and how far it stands over the quay's top (metres). */
export const HARBOUR_BEACON = { side: 5, high: 2.6 } as const;
/** How far uprights fan out from a point under the picture: a wall's top stands out from the middle by this share per eye height. */
export const SPLAY = 0.14;

export interface HarbourPlan {
  fine: { w: number; h: number };
  horizon: number;
  /** The beacon's pan, where its fire burns (fine pixels). */
  lamp: { x: number; y: number };
  /** Where the houseboat's stern meets the water (fine pixels): alongside the quay, on its open side. */
  berth: { x: number; water: number };
}

/** Where a point `h` metres over the sea at (`x`, `z`) stands in the picture (fine pixels). */
export function harbourAt(x: number, z: number, h = 0): { x: number; y: number } {
  const across = (HARBOUR.lens * x) / z;
  return { x: FINE.w / 2 + across * (1 + (SPLAY * h) / HARBOUR.eye), y: HARBOUR.horizon + (HARBOUR.lens * (HARBOUR.eye - h)) / z };
}

/** How far ahead the sea lies at a row (metres). */
export function harbourWaterAt(row: number): number {
  return (HARBOUR.lens * HARBOUR.eye) / Math.max(0.5, row - HARBOUR.horizon);
}

export function harbourPlan(): HarbourPlan {
  const [hx, hz] = HARBOUR_QUAY[HARBOUR_QUAY.length - 1]!;
  const pan = harbourAt(hx, hz, QUAY.high + HARBOUR_BEACON.high);
  const berth = harbourAt(2, 30);
  return { fine: { ...FINE }, horizon: HARBOUR.horizon, lamp: { x: Math.round(pan.x), y: Math.round(pan.y) - 2 }, berth: { x: Math.round(berth.x) - 250, water: Math.round(berth.y) } };
}
