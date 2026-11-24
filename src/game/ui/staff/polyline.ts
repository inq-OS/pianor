import type Phaser from 'phaser';

/** Strokes a line through the points in the graphics' current line style (a tie, a slur or a preview of one). */
export function strokePolyline(g: Phaser.GameObjects.Graphics, points: readonly { x: number; y: number }[]): void {
  const [first, ...rest] = points;
  if (!first) return;
  g.beginPath().moveTo(first.x, first.y);
  for (const p of rest) g.lineTo(p.x, p.y);
  g.strokePath();
}
