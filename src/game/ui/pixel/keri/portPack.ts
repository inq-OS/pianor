import { BOAT_KINDS, type BoatKind } from '../../../../core/layout/port';
import { packFrames, packLiveWater, packOverlay, unpackFrames, unpackLiveWater, unpackOverlay, type PackedFrames, type PackedLiveWater, type PackedOverlay } from '../pack';
import type { LeapTones } from '../leap';
import type { Blown, BlownKind } from '../sway';
import type { PortPicture } from './portPicture';

/** A thing the wind or the current moves (`sway.ts`): its kind and its picture at its place. */
interface PackedBlown { kind: BlownKind; part: PackedOverlay }
const packBlown = (b: Blown): PackedBlown => ({ kind: b.kind, part: packOverlay({ x: b.x, y: b.y, frames: [b.bitmap] }) });
const unpackBlown = ({ kind, part }: PackedBlown): Blown => { const { x, y, frames } = unpackOverlay(part); return { kind, x, y, bitmap: frames[0]! }; };

/** The painted southern port as it travels from the build to the game (`virtual:keri-pictures`), like the docks (`docksPack.ts`). */
export interface PackedPort extends PackedFrames {
  fore: PackedOverlay;
  clouds: PackedOverlay[];
  front: PackedOverlay;
  lamp: PackedOverlay;
  water: PackedLiveWater;
  gull: number;
  leap: LeapTones;
  /** The underwater stage's looks, in the same palette. */
  deep: PackedFrames;
  /** What steps from look to look over them. */
  deepThings: PackedOverlay;
  /** What swims down there: each sprite with its row (`PortSwimmers`). */
  swimmers: { fish: { sprite: PackedOverlay; y: number }[]; school: PackedOverlay; schoolY: number; jellies: PackedOverlay[]; bubble: PackedOverlay; bubbleFrom: { x: number; y: number } };
  /** Each boat, and what the wind moves on it (`sway.ts`): its kind and its picture at its place. */
  boats: Record<BoatKind, PackedOverlay & { blown: PackedBlown[] }>;
  /** The deep view's kelp, swayed by the game. */
  kelp: PackedBlown[];
}

export function packPort(picture: PortPicture): PackedPort {
  return {
    ...packFrames(picture.palette, picture.frames),
    fore: packOverlay(picture.fore),
    clouds: picture.clouds.map((c) => packOverlay({ x: c.x, y: c.y, frames: [c.bitmap] })),
    front: packOverlay(picture.front),
    lamp: packOverlay(picture.lamp),
    water: packLiveWater(picture.water),
    gull: picture.gull,
    leap: picture.leap,
    deep: packFrames(picture.palette, picture.deep),
    deepThings: packOverlay(picture.deepThings),
    swimmers: {
      fish: picture.swimmers.fish.map((f) => ({ sprite: packOverlay({ x: 0, y: 0, frames: [f.bitmap] }), y: f.y })),
      school: packOverlay({ x: 0, y: 0, frames: [picture.swimmers.school] }),
      schoolY: picture.swimmers.schoolY,
      jellies: picture.swimmers.jellies.map((j) => packOverlay(j)),
      bubble: packOverlay({ x: 0, y: 0, frames: [picture.swimmers.bubble] }),
      bubbleFrom: picture.swimmers.bubbleFrom,
    },
    boats: Object.fromEntries(BOAT_KINDS.map((kind) => [kind, { ...packOverlay(picture.boats[kind]), blown: picture.boats[kind].blown.map(packBlown) }])) as PackedPort['boats'],
    kelp: picture.kelp.map(packBlown),
  };
}

export function unpackPort(packed: PackedPort): PortPicture {
  return {
    ...unpackFrames(packed),
    fore: unpackOverlay(packed.fore),
    clouds: packed.clouds.map((c) => {
      const { x, y, frames } = unpackOverlay(c);
      return { x, y, bitmap: frames[0]! };
    }),
    front: unpackOverlay(packed.front),
    lamp: unpackOverlay(packed.lamp),
    water: unpackLiveWater(packed.water),
    gull: packed.gull,
    leap: packed.leap,
    deep: unpackFrames(packed.deep).frames,
    deepThings: unpackOverlay(packed.deepThings),
    swimmers: {
      fish: packed.swimmers.fish.map((f) => ({ bitmap: unpackOverlay(f.sprite).frames[0]!, y: f.y })),
      school: unpackOverlay(packed.swimmers.school).frames[0]!,
      schoolY: packed.swimmers.schoolY,
      jellies: packed.swimmers.jellies.map((j) => unpackOverlay(j)),
      bubble: unpackOverlay(packed.swimmers.bubble).frames[0]!,
      bubbleFrom: packed.swimmers.bubbleFrom,
    },
    boats: Object.fromEntries(BOAT_KINDS.map((kind) => [kind, {
      ...unpackOverlay(packed.boats[kind]),
      blown: packed.boats[kind].blown.map(unpackBlown),
    }])) as unknown as PortPicture['boats'],
    kelp: packed.kelp.map(unpackBlown),
  };
}
