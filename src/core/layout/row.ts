/** A row of boxes laid side by side with a fixed gap, left to right (or right to left from a right edge). */
export interface Row {
  /** Place a box `width` wide and return its left edge; the row moves past it and the gap. */
  take(width: number): number;
  /** Leave `room` empty before the next box (on top of the gap). */
  skip(room: number): void;
  /** Where the next box starts: its left edge (left to right) or its right edge (right to left). */
  readonly next: number;
  /** The far edge of the last box placed: its right edge (left to right) or its left edge (right to left). */
  readonly end: number;
}

/** A row starting at `start` (a left edge, or a right edge when `direction` is -1). Art pixels; pure. */
export function row(start: number, gap: number, direction: 1 | -1 = 1): Row {
  let next = start;
  let end = start;
  return {
    take(width) {
      const left = direction === 1 ? next : next - width;
      end = direction === 1 ? left + width : left;
      next = end + direction * gap;
      return left;
    },
    skip(room) {
      next += direction * room;
    },
    get next() {
      return next;
    },
    get end() {
      return end;
    },
  };
}
