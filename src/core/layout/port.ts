import type { World, WorldPoint } from '../world/world';
import { ART_DETAIL } from './frame';
import type { Rect } from './rect';
import { ROOM_PICTURE, roomView } from './room';

/**
 * The southern port (ft_1_19, AX-3 provisional): where most visitors land on Keri, at the slipway south of the
 * lighthouse (most visitors arrive at the southern docks, a wider stone dock; the north jetty is
 * the warden's). Painted in the manner of the 1991 game, not as the place is (it need not look
 * one to one, and should look nice in the manner of the 1991 game): a big, heavy stone quay seen side-on from the west, looking east,
 * with nothing else in view (only the pier, the water and any boats that visitors
 * came with). The boats lie on the quay's far side (boats land on the other side), so they show over it.
 *
 * Two stages (a normal one, the pier with no underwater scenery, and an underwater one, where clicking on the water
 * spans the view downwards and opens the rich underwater world): the picture is one tall cut through the quay, of which the
 * screen shows the top (the surface: the near water opaque) or, after a dive, the part from `PORT.dive` down (the
 * water cut open, the quay's foundation, the reef on the bed). Pure numbers; the painter is
 * `game/ui/pixel/keri/portPicture.ts`.
 */

/** The scene's id in the world model (`scenes` in content/world/keri.json). */
export const PORT_ID = 'port';

/** The scene's picture has the room's size: a low wide band over the same strip. */
export const PORT_PICTURE = ROOM_PICTURE;
export const portView = roomView;

const FINE = { w: PORT_PICTURE.w * ART_DETAIL, h: PORT_PICTURE.h * ART_DETAIL } as const;

/**
 * The rows of the cut, in fine pixels from the tall picture's top: the horizon; the quay's far edge and near edge on its
 * top (the eye stands a little over it, so its top shows as a strip); the water at the quay's face; how far the view goes
 * down in a dive; the sand of the bed. The quay's head (its seaward end, to the south) is at column `head`; it runs off
 * the picture's left edge toward the island, which is not in view. `eye` is the eye's height over the sea in metres and
 * `lens` fine pixels per radian, for what lies on the water.
 */
export const PORT = {
  horizon: 68,
  far: 124,
  deck: 136,
  water: 194,
  dive: 160,
  bed: 376,
  head: 548,
  eye: 3.0,
  lens: 470,
} as const;

/** The tall picture: the screen's height and the dive under it. */
export const PORT_TALL = FINE.h + PORT.dive;

/** The kinds of boats that can lie at the quay: whoever came, came in one (docs/architect/cast-and-phrases.md). */
export const BOAT_KINDS = ['launch', 'row', 'rib', 'sail', 'motor', 'houseboat', 'galleon'] as const;
export type BoatKind = (typeof BOAT_KINDS)[number];

/**
 * The berths on the quay's far side, left to right: where a boat's stern meets the water (fine pixels) and how long a
 * boat it takes. The 1991 game's way, not the eye's: a boat shows big over the quay's far edge, and the parapet there
 * hides its waterline, so it lies behind the quay and does not stand on it.
 */
export const PORT_BERTHS: readonly { x: number; water: number; room: number }[] = [
  { x: 20, water: 125, room: 252 },
  { x: 286, water: 125, room: 236 },
];

/**
 * Which boats lie at the berths when the scene opens. AX-3 provisional: the visitors' presence (ft_1_25) does not pick
 * them yet; the work item that will is in `docs/keri/scene-port.md` (Open). The galleon is the teacher's and is not
 * here while she is away: it sails in with her arrival script (ft_1_27.AC2) to the second berth.
 */
export const PORT_MOORED: readonly BoatKind[] = ['houseboat'];

/**
 * The berth in the near water at the low landing on the quay's end, for a small boat: its waterline in the near water,
 * so it lies before the quay and shows whole, its bow at the landing's foot, where its skipper steps up onto the landing.
 */
export const PORT_LANDING_BERTH = { x: 395, water: PORT.water + 30 } as const;

/**
 * Which boat lies at the landing: the Prangli fisherman's tarred rowing boat; he stands on the landing beside it (the
 * scene's place `landing`). AX-3 provisional: it lies there every day, as the houseboat does, until the visitors'
 * presence (ft_1_25) moors it only on his days (`docs/keri/scene-port.md`, Open).
 */
export const PORT_AT_LANDING: BoatKind | null = 'row';

/** Where the beacon's lantern hangs at the quay's head (fine pixels): its light glows round it at dusk and night. */
/** Where the fire pan on the beacon post at the quay's head sits (fine pixels): the middle of its rim. It burns at dusk and night. */
const LAMP = { x: PORT.head - 2, y: 76 } as const;

/** Where the light falls in pools on the sand of the bed (centres, fine pixels of the tall picture). */
const SAND_LIGHT = [{ x: 150, y: PORT.bed + 14 }, { x: 470, y: PORT.bed + 16 }] as const;

export interface PortPlan {
  /** The screen's picture, fine pixels. */
  fine: { w: number; h: number };
  /** The whole cut, fine pixels: the screen's picture and the dive under it. */
  tall: { w: number; h: number };
  horizon: number;
  /** The rows of the quay's top (far and near edge) and of the water at its face. */
  far: number;
  deck: number;
  water: number;
  /** How far down a dive goes, fine pixels: the underwater view is the tall picture from here. */
  dive: number;
  bed: number;
  head: number;
  lamp: { x: number; y: number };
  berths: readonly { x: number; water: number; room: number }[];
  /** The pools of light on the sand of the bed. */
  sandLight: readonly { x: number; y: number }[];
  /** Where a press dives (the near water) and where one rises again (the deep stage's top, over the water), layout cells. */
  diveAt: Rect;
  riseAt: Rect;
}

export function portPlan(): PortPlan {
  return {
    fine: { ...FINE },
    tall: { w: FINE.w, h: PORT_TALL },
    horizon: PORT.horizon,
    far: PORT.far,
    deck: PORT.deck,
    water: PORT.water,
    dive: PORT.dive,
    bed: PORT.bed,
    head: PORT.head,
    lamp: { ...LAMP },
    berths: PORT_BERTHS.map((b) => ({ ...b })),
    sandLight: SAND_LIGHT.map((p) => ({ ...p })),
    diveAt: { x: 0, y: Math.ceil((PORT.water + 4) / ART_DETAIL), w: PORT_PICTURE.w, h: PORT_PICTURE.h - Math.ceil((PORT.water + 4) / ART_DETAIL) },
    riseAt: { x: 0, y: 0, w: PORT_PICTURE.w, h: Math.floor((PORT.water - PORT.dive) / ART_DETAIL) },
  };
}

/** How far ahead a row of the water lies (metres): the sea seen from the eye, flat to the horizon. */
export function portWaterAt(row: number): number {
  return (PORT.lens * PORT.eye) / Math.max(0.5, row - PORT.horizon);
}

/** Where the port is on the island: the scene's place in the world model. */
export function portPlace(world: World): WorldPoint {
  const scene = (world.scenes ?? []).find((s) => s.id === PORT_ID);
  if (!scene) throw new Error(`the world model has no scene "${PORT_ID}"`);
  return { x: scene.x, y: scene.y };
}
