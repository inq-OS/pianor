import { packFrames, packLiveWater, packOverlay, unpackFrames, unpackLiveWater, unpackOverlay, type PackedFrames, type PackedLiveWater, type PackedOverlay } from '../pack';
import type { CrossroadsPicture } from './crossroadsPicture';

/** The painted crossroads as it travels from the build to the game (`virtual:keri-pictures`), like the knoll (`knollPack.ts`). */
export interface PackedCrossroads extends PackedFrames {
  fore: PackedOverlay;
  clouds: PackedOverlay[];
  water: PackedLiveWater;
  gull: number;
}

export function packCrossroads(picture: CrossroadsPicture): PackedCrossroads {
  return {
    ...packFrames(picture.palette, picture.frames),
    fore: packOverlay(picture.fore),
    clouds: picture.clouds.map((c) => packOverlay({ x: c.x, y: c.y, frames: [c.bitmap] })),
    water: packLiveWater(picture.water),
    gull: picture.gull,
  };
}

export function unpackCrossroads(packed: PackedCrossroads): CrossroadsPicture {
  return {
    ...unpackFrames(packed),
    fore: unpackOverlay(packed.fore),
    clouds: packed.clouds.map((c) => {
      const { x, y, frames } = unpackOverlay(c);
      return { x, y, bitmap: frames[0]! };
    }),
    water: unpackLiveWater(packed.water),
    gull: packed.gull,
  };
}
