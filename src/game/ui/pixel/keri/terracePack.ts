import type { BlownKind } from '../sway';
import { packFrames, packLiveWater, packOverlay, unpackFrames, unpackLiveWater, unpackOverlay, type PackedFrames, type PackedLiveWater, type PackedOverlay } from '../pack';
import type { SmokeTones } from '../paint/smoke';
import type { TerracePicture } from './terracePicture';

/** The painted terrace as it travels from the build to the game (`virtual:keri-pictures`), like the docks (`docksPack.ts`). */
export interface PackedTerrace extends PackedFrames {
  fore: PackedOverlay;
  clouds: PackedOverlay[];
  lamp: PackedOverlay;
  coals: PackedOverlay;
  torches: PackedOverlay[];
  water: PackedLiveWater;
  gull: number;
  smoke: SmokeTones;
  /** What the wind moves (`sway.ts`), each a one-frame overlay with how the wind takes it. */
  blown: { kind: BlownKind; picture: PackedOverlay }[];
}

export function packTerrace(picture: TerracePicture): PackedTerrace {
  return {
    ...packFrames(picture.palette, picture.frames),
    fore: packOverlay(picture.fore),
    clouds: picture.clouds.map((c) => packOverlay({ x: c.x, y: c.y, frames: [c.bitmap] })),
    lamp: packOverlay(picture.lamp),
    coals: packOverlay(picture.coals),
    torches: picture.torches.map(packOverlay),
    water: packLiveWater(picture.water),
    gull: picture.gull,
    smoke: picture.smoke,
    blown: picture.blown.map((b) => ({ kind: b.kind, picture: packOverlay({ x: b.x, y: b.y, frames: [b.bitmap] }) })),
  };
}

export function unpackTerrace(packed: PackedTerrace): TerracePicture {
  return {
    ...unpackFrames(packed),
    fore: unpackOverlay(packed.fore),
    clouds: packed.clouds.map((c) => {
      const { x, y, frames } = unpackOverlay(c);
      return { x, y, bitmap: frames[0]! };
    }),
    lamp: unpackOverlay(packed.lamp),
    coals: unpackOverlay(packed.coals),
    torches: packed.torches.map(unpackOverlay),
    water: unpackLiveWater(packed.water),
    gull: packed.gull,
    smoke: packed.smoke,
    blown: packed.blown.map((b) => {
      const { x, y, frames } = unpackOverlay(b.picture);
      return { kind: b.kind, x, y, bitmap: frames[0]! };
    }),
  };
}
