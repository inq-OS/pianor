import type Phaser from 'phaser';
import { frameView } from '../../../core/layout/frame';
import { sheetForStaff, type SheetPlan } from '../../../core/layout/sheet';
import type { StaffLayout } from '../../../core/layout/staff';
import { toRgba } from '../pixel/bitmap';
import { paintParchment, PARCHMENT_PALETTE } from '../pixel/paint/parchment';

/**
 * The sheet of parchment under a staff (d119), as a picture on the screen: painted once for each size and kept as a
 * texture that every staff of that size shares. The piece maker makes a new staff view after every note; without the
 * sharing each would paint and upload the sheet again.
 */

/** Sheets no staff shows any more that are kept, in case their size comes back (a window dragged wider and back). */
const SPARE = 4;
const users = new Map<string, number>();

const keyOf = (plan: SheetPlan): string => `parchment:${plan.width}x${plan.height}:${plan.desk.left},${plan.desk.right},${plan.desk.top},${plan.desk.bottom}:${plan.turn}`;

/** Drop the oldest sheets nobody shows, down to `SPARE` of them. */
function tidy(textures: Phaser.Textures.TextureManager): void {
  const idle = [...users].filter(([, count]) => count === 0).map(([key]) => key);
  for (const key of idle.slice(0, Math.max(0, idle.length - SPARE))) {
    users.delete(key);
    textures.remove(key);
  }
}

/**
 * The picture of the sheet for `layout`, whose top-left corner is at `origin` (screen pixels). The sheet covers the
 * layout's area, or from `ground.x` over `ground.width` for a staff moved in from the sides. `release` it with its staff.
 */
export function addSheet(scene: Phaser.Scene, layout: StaffLayout, origin: { x: number; y: number }, ground: { x: number; width: number } = { x: origin.x, width: layout.width }): { image: Phaser.GameObjects.Image; release: () => void } {
  const fine = frameView(scene.scale.width, scene.scale.height).fine;
  const plan = sheetForStaff(layout, fine, { before: origin.x - ground.x, width: ground.width });
  const key = keyOf(plan);
  if (!scene.textures.exists(key)) {
    const rgba = toRgba(paintParchment(plan), PARCHMENT_PALETTE);
    if (!scene.textures.addUint8Array(key, new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength), plan.width, plan.height)) throw new Error('could not create the sheet\'s texture');
    users.delete(key);
  }
  users.set(key, (users.get(key) ?? 0) + 1);
  tidy(scene.textures);
  const image = scene.add.image(ground.x, origin.y, key).setOrigin(0, 0).setScale(fine);
  const textures = scene.textures;
  let released = false;
  return {
    image,
    release: () => {
      if (released) return;
      released = true;
      image.destroy();
      users.set(key, Math.max(0, (users.get(key) ?? 1) - 1));
      tidy(textures);
    },
  };
}
