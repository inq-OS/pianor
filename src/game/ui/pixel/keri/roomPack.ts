import { packLooks, packOverlay, unpackLooks, unpackOverlay, type Overlay, type PackedOverlay } from '../pack';
import { ROOM_OBJECTS, type RoomObject } from '../../../../core/layout/room';
import type { RoomPicture } from './roomPicture';

/**
 * The painted room as it travels from the build to the game (`tools/vite-keri.ts` gives it in `virtual:keri-pictures`):
 * painting takes a few seconds, so it is done once when the game is built, not when the room opens.
 */

const OVERLAYS = ['flames', 'shimmer', 'kiur', 'kiurAwake', 'zzz', 'steam', 'metronome', 'shield', 'plant', 'hover'] as const;
type OverlayName = (typeof OVERLAYS)[number];
/** The look of the fire's middle strength is kept whole, the two others as their difference from it. */
const MIDDLE = 1;

export type PackedRoom = { palette: readonly number[]; w: number; h: number; looks: string[]; awake: Record<RoomObject, PackedOverlay> } & Record<OverlayName, PackedOverlay>;

export function packRoom(picture: RoomPicture): PackedRoom {
  const middle = picture.looks[MIDDLE]!;
  const overlays = Object.fromEntries(OVERLAYS.map((name) => [name, packOverlay(picture[name])])) as Record<OverlayName, PackedOverlay>;
  const awake = Object.fromEntries(ROOM_OBJECTS.map((thing) => [thing, packOverlay(picture.awake[thing])])) as Record<RoomObject, PackedOverlay>;
  return { palette: picture.palette, w: middle.width, h: middle.height, looks: packLooks(picture.looks, MIDDLE), awake, ...overlays };
}

export function unpackRoom(packed: PackedRoom): RoomPicture {
  const overlays = Object.fromEntries(OVERLAYS.map((name) => [name, unpackOverlay(packed[name])])) as Record<OverlayName, Overlay>;
  const awake = Object.fromEntries(ROOM_OBJECTS.map((thing) => [thing, unpackOverlay(packed.awake[thing])])) as Record<RoomObject, Overlay>;
  return { palette: packed.palette, looks: unpackLooks(packed.looks, packed.w, packed.h, MIDDLE), awake, ...overlays };
}
