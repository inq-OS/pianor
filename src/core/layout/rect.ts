/** A rectangle in art pixels (x, y is the top-left corner). Pure: layout code names its boxes and derives the next one from them. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export const rectRight = (r: Rect): number => r.x + r.w;
export const rectBottom = (r: Rect): number => r.y + r.h;

/** The same box as a button wants it: centre x and y plus width and height. */
export function rectCentre(r: Rect): { x: number; y: number; width: number; height: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2, width: r.w, height: r.h };
}
