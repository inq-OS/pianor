import type { Rect } from './rect';
import type { Size } from './talk';

/**
 * The spotlight of the first-run intro (ft_1_31.AC2, AC3): the screen darkened all round the one thing shown, a frame on
 * it, an arrow pointing at it, and Kiur with his line beside him in the larger free part of the screen, on the side away
 * from it, his wing pointing towards it. Pure, in art pixels of the whole screen; the overlay only draws it.
 */
export const SPOTLIGHT = {
  /** Room left round the thing shown, inside the light. */
  pad: 2,
  /** Kiur and his line keep this far from the screen's edges. */
  margin: 4,
  /** Between Kiur and his line, and between the arrow and the light. */
  gap: 3,
  /** The arrow's size (pointing down; pointing up it is the same turned over). */
  arrow: { w: 18, h: 14 },
} as const;

export interface SpotlightLayout {
  /** The dark parts: the whole screen with no thing shown, else the four parts round the light. */
  readonly shades: readonly Rect[];
  /** The light, framed; null with no thing shown. */
  readonly light: Rect | null;
  /** Where the arrow is and which way it points; null with no thing shown. */
  readonly arrow: { readonly x: number; readonly y: number; readonly points: 'up' | 'down' } | null;
  /** Kiur's top-left corner; `facing` is the way his pointing wing goes. */
  readonly kiur: { readonly x: number; readonly y: number; readonly facing: 'left' | 'right' };
  /** The line's top-left corner. */
  readonly line: { readonly x: number; readonly y: number };
  /** The skip button's top-left corner (a way out at every step), in a free corner; null when not asked for. */
  readonly skip: { readonly x: number; readonly y: number } | null;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function spotlightLayout(input: { screen: Size; spot: Rect | null; kiur: Size; line: Size; skip?: Size }): SpotlightLayout {
  const plan = placeShown(input);
  return { ...plan, skip: input.skip ? skipCorner(input.screen, input.skip, taken(plan, input)) : null };
}

/** What the skip button must stay clear of: the light, the arrow, Kiur and his line. */
function taken(plan: Omit<SpotlightLayout, 'skip'>, input: { kiur: Size; line: Size }): Rect[] {
  return [
    ...(plan.light ? [plan.light] : []),
    ...(plan.arrow ? [{ x: plan.arrow.x, y: plan.arrow.y, ...SPOTLIGHT.arrow }] : []),
    { x: plan.kiur.x, y: plan.kiur.y, ...input.kiur },
    { x: plan.line.x, y: plan.line.y, ...input.line },
  ];
}

/** The first corner, top right, bottom right, top left, bottom left, where the button covers none of `busy`; else top right. */
function skipCorner(screen: Size, size: Size, busy: readonly Rect[]): { x: number; y: number } {
  const { margin } = SPOTLIGHT;
  const right = screen.w - margin - size.w, bottom = screen.h - margin - size.h;
  const corners = [{ x: right, y: margin }, { x: right, y: bottom }, { x: margin, y: margin }, { x: margin, y: bottom }];
  const clear = (c: { x: number; y: number }) => busy.every((b) => !(c.x < b.x + b.w && b.x < c.x + size.w && c.y < b.y + b.h && b.y < c.y + size.h));
  return corners.find(clear) ?? corners[0]!;
}

function placeShown(input: { screen: Size; spot: Rect | null; kiur: Size; line: Size }): Omit<SpotlightLayout, 'skip'> {
  const { screen, kiur, line } = input;
  const { pad, margin, gap, arrow } = SPOTLIGHT;
  const rowH = Math.max(kiur.h, line.h);
  const rowW = kiur.w + gap + line.w;
  if (input.spot === null) {
    // nothing shown: Kiur and his line in the middle of the screen
    const x = Math.floor((screen.w - rowW) / 2);
    const y = clamp(Math.floor((screen.h - rowH) / 2), margin, screen.h - rowH - margin);
    return { shades: [{ x: 0, y: 0, w: screen.w, h: screen.h }], light: null, arrow: null, kiur: { x, y: y + rowH - kiur.h, facing: 'right' }, line: { x: x + kiur.w + gap, y: y + Math.floor((kiur.h - line.h) / 2) } };
  }
  const s = input.spot;
  const x0 = clamp(s.x - pad, 0, screen.w), y0 = clamp(s.y - pad, 0, screen.h);
  const x1 = clamp(s.x + s.w + pad, x0, screen.w), y1 = clamp(s.y + s.h + pad, y0, screen.h);
  const light: Rect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  const shades: Rect[] = [
    { x: 0, y: 0, w: screen.w, h: y0 },
    { x: 0, y: y1, w: screen.w, h: screen.h - y1 },
    { x: 0, y: y0, w: x0, h: y1 - y0 },
    { x: x1, y: y0, w: screen.w - x1, h: y1 - y0 },
  ].filter((r) => r.w > 0 && r.h > 0);
  // Kiur and his line go where there is more room, above or below the light, with the arrow between them and it
  const below = screen.h - y1 >= y0;
  const points = below ? 'up' : 'down';
  const cx = Math.round((x0 + x1) / 2);
  const arrowAt = { x: clamp(cx - Math.floor(arrow.w / 2), 0, screen.w - arrow.w), y: below ? clamp(y1 + 1, 0, screen.h - arrow.h) : clamp(y0 - 1 - arrow.h, 0, screen.h - arrow.h), points } as const;
  const free = below ? { top: y1 + arrow.h + gap, bottom: screen.h - margin } : { top: margin, bottom: y0 - arrow.h - gap };
  const rowTop = clamp(Math.floor((free.top + free.bottom - rowH) / 2), margin, screen.h - rowH - margin);
  // on the side away from the light, his wing towards it
  const kiurLeft = cx >= screen.w / 2;
  const kx = kiurLeft ? margin : screen.w - margin - kiur.w;
  const lineX = kiurLeft ? clamp(kx + kiur.w + gap, margin, screen.w - margin - line.w) : clamp(kx - gap - line.w, margin, screen.w - margin - line.w);
  return {
    shades,
    light,
    arrow: arrowAt,
    kiur: { x: kx, y: rowTop + rowH - kiur.h, facing: kiurLeft ? 'right' : 'left' },
    line: { x: lineX, y: rowTop + Math.max(0, Math.floor((kiur.h - line.h) / 2)) },
  };
}
