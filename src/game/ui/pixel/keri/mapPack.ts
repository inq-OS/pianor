import { packFrames, packOverlay, unpackFrames, unpackOverlay, type PackedFrames, type PackedOverlay } from '../pack';
import type { MapPicture } from './mapPicture';
import type { MapBeam } from './beam';

/** The painted map of Keri as it travels from the build to the game (`virtual:keri-pictures`), like the room (`roomPack.ts`). */
export interface PackedMap extends PackedFrames {
  beam: MapBeam;
  clouds: PackedOverlay[];
}

export function packMap(picture: MapPicture): PackedMap {
  return {
    ...packFrames(picture.palette, picture.frames),
    beam: picture.beam, clouds: picture.clouds.map((cloud) => packOverlay({ x: 0, y: 0, frames: [cloud] })),
  };
}

export function unpackMap(packed: PackedMap): MapPicture {
  return { ...unpackFrames(packed), beam: packed.beam, clouds: packed.clouds.map((cloud) => unpackOverlay(cloud).frames[0]!) };
}
