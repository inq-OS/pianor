import { packFrames, packLiveWater, packOverlay, unpackFrames, unpackLiveWater, unpackOverlay, type PackedFrames, type PackedLiveWater, type PackedOverlay } from '../pack';
import type { LanternPicture } from './lanternPicture';

/** The painted lantern over Keri (the main menu's picture, ft_1_07) as it travels from the build to the game (`virtual:keri-pictures`), like the docks (`docksPack.ts`). */
export interface PackedLantern extends PackedFrames {
  fore: PackedOverlay;
  clouds: PackedOverlay[];
  light: PackedOverlay;
  water: PackedLiveWater;
}

export function packLantern(picture: LanternPicture): PackedLantern {
  return {
    ...packFrames(picture.palette, picture.frames),
    fore: packOverlay(picture.fore),
    clouds: picture.clouds.map((c) => packOverlay({ x: c.x, y: c.y, frames: [c.bitmap] })),
    light: packOverlay(picture.light),
    water: packLiveWater(picture.water),
  };
}

export function unpackLantern(packed: PackedLantern): LanternPicture {
  return {
    ...unpackFrames(packed),
    fore: unpackOverlay(packed.fore),
    clouds: packed.clouds.map((c) => {
      const { x, y, frames } = unpackOverlay(c);
      return { x, y, bitmap: frames[0]! };
    }),
    light: unpackOverlay(packed.light),
    water: unpackLiveWater(packed.water),
  };
}
