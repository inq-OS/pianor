import { packFrames, packLiveWater, packOverlay, unpackFrames, unpackLiveWater, unpackOverlay, type PackedFrames, type PackedLiveWater, type PackedOverlay } from '../pack';
import type { DocksPicture } from './docksPicture';

/** The painted docks as they travel from the build to the game (`virtual:keri-pictures`), like the knoll (`knollPack.ts`). */
export interface PackedDocks extends PackedFrames {
  fore: PackedOverlay;
  clouds: PackedOverlay[];
  lamp: PackedOverlay;
  water: PackedLiveWater;
  gull: number;
}

export function packDocks(picture: DocksPicture): PackedDocks {
  return {
    ...packFrames(picture.palette, picture.frames),
    fore: packOverlay(picture.fore),
    clouds: picture.clouds.map((c) => packOverlay({ x: c.x, y: c.y, frames: [c.bitmap] })),
    lamp: packOverlay(picture.lamp),
    water: packLiveWater(picture.water),
    gull: picture.gull,
  };
}

export function unpackDocks(packed: PackedDocks): DocksPicture {
  return {
    ...unpackFrames(packed),
    fore: unpackOverlay(packed.fore),
    clouds: packed.clouds.map((c) => {
      const { x, y, frames } = unpackOverlay(c);
      return { x, y, bitmap: frames[0]! };
    }),
    lamp: unpackOverlay(packed.lamp),
    water: unpackLiveWater(packed.water),
    gull: packed.gull,
  };
}
