import { packFrames, packLiveWater, packOverlay, unpackFrames, unpackLiveWater, unpackOverlay, type PackedFrames, type PackedLiveWater, type PackedOverlay } from '../pack';
import type { KnollPicture } from './knollPicture';
import type { SmokeTones } from '../paint/smoke';

/** The painted knoll as it travels from the build to the game (`virtual:keri-pictures`), like the room (`roomPack.ts`). */
export interface PackedKnoll extends PackedFrames {
  fore: PackedOverlay;
  clouds: PackedOverlay[];
  embers: PackedOverlay;
  smoke: SmokeTones;
  water: PackedLiveWater;
  gull: number;
}

export function packKnoll(picture: KnollPicture): PackedKnoll {
  return {
    ...packFrames(picture.palette, picture.frames),
    fore: packOverlay(picture.fore),
    clouds: picture.clouds.map((c) => packOverlay({ x: c.x, y: c.y, frames: [c.bitmap] })),
    embers: packOverlay(picture.embers),
    smoke: picture.smoke,
    water: packLiveWater(picture.water),
    gull: picture.gull,
  };
}

export function unpackKnoll(packed: PackedKnoll): KnollPicture {
  return {
    ...unpackFrames(packed),
    fore: unpackOverlay(packed.fore),
    clouds: packed.clouds.map((c) => {
      const { x, y, frames } = unpackOverlay(c);
      return { x, y, bitmap: frames[0]! };
    }),
    embers: unpackOverlay(packed.embers),
    smoke: packed.smoke,
    water: unpackLiveWater(packed.water),
    gull: packed.gull,
  };
}
