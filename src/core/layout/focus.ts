/**
 * Keyboard focus over a screen's buttons (ft_Y_13). Pure: it works on button rectangles and says which one is
 * focused next, so the scene only has to draw the outline. The same moves can later come from another source
 * (piano keys, a gamepad), because they are abstract directions.
 */

export type FocusMove = 'up' | 'down' | 'left' | 'right';

export interface FocusRect {
  x: number;
  y: number;
  width: number;
  height: number;
  disabled?: boolean;
  /** In a step through the screen (`cycleFocus`): -1 before the rest (the way back in its corner), 1 after it (the corners on the right). */
  group?: -1 | 1;
}

const centre = (r: FocusRect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
const enabled = (r: FocusRect) => r.disabled !== true;

/** The first enabled button in the order the scene made them, or -1 when there is none. */
export function initialFocus(rects: readonly FocusRect[]): number {
  return rects.findIndex(enabled);
}

/** Distance from `from` to `to` along the move (positive when `to` lies in its direction) and sideways. */
function offsets(from: FocusRect, to: FocusRect, move: FocusMove): { along: number; across: number } {
  const a = centre(from);
  const b = centre(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  switch (move) {
    case 'up': return { along: -dy, across: Math.abs(dx) };
    case 'down': return { along: dy, across: Math.abs(dx) };
    case 'left': return { along: -dx, across: Math.abs(dy) };
    case 'right': return { along: dx, across: Math.abs(dy) };
  }
}

/**
 * The index focused after `move` from `current`: the nearest enabled button in that direction (sideways drift counts
 * double, so a button straight ahead beats one far to the side). With nothing ahead the focus wraps to the far side
 * (the enabled button farthest back, nearest in line) when `wrap` is true, and stays put otherwise. With no valid
 * current focus the first enabled button is chosen; with nothing enabled the answer is -1.
 */
export function moveFocus(rects: readonly FocusRect[], current: number, move: FocusMove, wrap = true): number {
  const from = rects[current];
  if (from === undefined || !enabled(from)) return initialFocus(rects);
  let best = -1;
  let bestScore = Infinity;
  let far = -1;
  let farScore = -Infinity;
  rects.forEach((r, i) => {
    if (i === current || !enabled(r)) return;
    const { along, across } = offsets(from, r, move);
    if (along > 0) {
      const score = along + 2 * across;
      if (score < bestScore) {
        best = i;
        bestScore = score;
      }
    } else if (wrap) {
      const score = -along * 1000 - across;
      if (score > farScore) {
        far = i;
        farScore = score;
      }
    }
  });
  if (best >= 0) return best;
  return wrap && far >= 0 ? far : current;
}

/**
 * The index focused after one step (`1` on, `-1` back) through every enabled button in order across the screen: by its
 * `group`, then the centre's x, then its y, wrapping at the ends. For a screen of scattered objects (the room, the map), where the nearest
 * button in a direction can leave some unreachable. With no valid current focus the first enabled button is chosen.
 */
export function cycleFocus(rects: readonly FocusRect[], current: number, step: 1 | -1): number {
  const from = rects[current];
  if (from === undefined || !enabled(from)) return initialFocus(rects);
  const order = rects.map((r, i) => ({ i, c: centre(r), on: enabled(r) })).filter((r) => r.on).sort((a, b) => (rects[a.i]!.group ?? 0) - (rects[b.i]!.group ?? 0) || a.c.x - b.c.x || a.c.y - b.c.y);
  const at = order.findIndex((r) => r.i === current);
  return order[(at + step + order.length) % order.length]!.i;
}

/**
 * Where the focus goes after the screen was drawn again with new buttons: the enabled button nearest to where the old
 * focused one was, so a redraw keeps the player's place. No previous focus gives the first enabled button.
 */
export function refocus(previous: FocusRect | null, rects: readonly FocusRect[]): number {
  if (previous === null) return initialFocus(rects);
  const p = centre(previous);
  let best = -1;
  let bestDistance = Infinity;
  rects.forEach((r, i) => {
    if (!enabled(r)) return;
    const c = centre(r);
    const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
    if (d < bestDistance) {
      best = i;
      bestDistance = d;
    }
  });
  return best;
}
