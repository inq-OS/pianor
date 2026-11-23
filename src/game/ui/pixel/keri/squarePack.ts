import { packFrames, packOverlay, unpackFrames, unpackOverlay, type PackedFrames, type PackedOverlay } from '../pack';
import type { SquarePicture } from './squarePicture';

/** The painted village square as it travels from the build to the game (`virtual:keri-pictures`), like the docks (`docksPack.ts`). */
export interface PackedSquare extends PackedFrames {
  fore: PackedOverlay;
  clouds: PackedOverlay[];
  lamp: PackedOverlay;
  gull: number;
}

export function packSquare(picture: SquarePicture): PackedSquare {
  return {
    ...packFrames(picture.palette, picture.frames),
    fore: packOverlay(picture.fore),
    clouds: picture.clouds.map((c) => packOverlay({ x: c.x, y: c.y, frames: [c.bitmap] })),
    lamp: packOverlay(picture.lamp),
    gull: picture.gull,
  };
}

export function unpackSquare(packed: PackedSquare): SquarePicture {
  return {
    ...unpackFrames(packed),
    fore: unpackOverlay(packed.fore),
    clouds: packed.clouds.map((c) => {
      const { x, y, frames } = unpackOverlay(c);
      return { x, y, bitmap: frames[0]! };
    }),
    lamp: unpackOverlay(packed.lamp),
    gull: packed.gull,
  };
}
