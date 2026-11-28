import type Phaser from 'phaser';
import type { Rect } from '../../core/layout/rect';
import { ICONS } from '../ui/pixel/iconArt';
import { PixelImage } from '../ui/pixel/PixelObjects';

/** How long the student's turn waits with no note before the character says once whose turn it is. AX-3 provisional. */
export const NUDGE_MS = 20_000;

/**
 * The press catcher of a tug or a teaching drawn over a scene: it takes every press on the screen, so the scene and the
 * band under it take none, except on the corner door (`door`, the screen's Back): there the press reaches Back, which
 * leaves as Esc does. The door is drawn clear over the catcher so it is seen to be there.
 */
export function overlayCatcher(
  scene: Phaser.Scene,
  add: <T extends Phaser.GameObjects.GameObject>(object: T) => T,
  area: { readonly w: number; readonly h: number },
  door: Rect | undefined,
  onPress: () => void,
): void {
  const top = -area.h;
  const inDoor = (x: number, y: number): boolean => door !== undefined && x >= door.x && x < door.x + door.w && y + top >= door.y && y + top < door.y + door.h;
  const catcher = add(scene.add.zone(0, top, area.w, area.h * 3).setOrigin(0));
  catcher.setInteractive({ hitArea: { x: 0, y: 0, width: area.w, height: area.h * 3 }, hitAreaCallback: (_hit: unknown, x: number, y: number) => x >= 0 && y >= 0 && x < area.w && y < area.h * 3 && !inDoor(x, y) });
  catcher.on('pointerup', onPress);
  if (!door) return;
  const icon = ICONS.quit;
  add(new PixelImage(scene, door.x + Math.floor((door.w - icon.width) / 2), door.y + Math.floor((door.h - icon.height) / 2), icon).setName('overlayDoor'));
}
