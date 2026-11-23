import type Phaser from 'phaser';
import { PixelImage } from './PixelObjects';
import { HEART, HEART_EMPTY } from './sprites';

/** The lives: hearts at twice the sprite size, centred at the top of the main area (pictures, not text). */
const HEARTS_Y = 6;
const HEARTS_ZOOM = 2;
const HEART_GAP = 3;

/** A row of `total` hearts across `width` (art pixels), the first `lit` red and the rest grey; the trainers' lives. */
export function heartRow(scene: Phaser.Scene, width: number, lit: number, total: number): PixelImage[] {
  const heartsWidth = (total * (HEART.width + HEART_GAP) - HEART_GAP) * HEARTS_ZOOM;
  const left = Math.round((width - heartsWidth) / 2);
  return Array.from({ length: total }, (_, i) => new PixelImage(scene, left + i * (HEART.width + HEART_GAP) * HEARTS_ZOOM, HEARTS_Y, i < lit ? HEART : HEART_EMPTY).setScale(HEARTS_ZOOM));
}
