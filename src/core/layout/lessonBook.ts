import { REGISTER, registerLayout, type RegisterLayout } from './register';
import type { Rect } from './rect';

/**
 * The lesson book (ft_1_39 rule 1): the open book over the main area, one area of the catalog a spread (its name at the
 * head of the left page, then its topics down the left page and on down the right), and a tab per area along the foot.
 * Pure: the scene writes and draws what this places. Layout cells.
 */
/** The least room a topic's row takes: one line of the pixel font. */
const MIN_ROW = 9;
/** Bare page kept inside the register's writing room, so no word touches the painted page's edge or the gutter. */
const INSET = 4;
/** A tab per area at the foot: its size and the room between two. */
const TAB = { w: 11, h: 11, gap: 2 } as const;

export interface LessonBookLayout {
  register: RegisterLayout;
  /** The area's name, at the head of the left page. */
  heading: { x: number; y: number; w: number };
  /** Where each topic is written, left page first. */
  rows: { x: number; y: number; w: number }[];
  tabs: Rect[];
  /** The page-turn arrows, either side of the tabs, for the mouse and the touch screen. */
  previous: Rect;
  next: Rect;
}

/** The book over a main area `width` by `height` for an area of `count` topics, with `areas` tabs along the foot. */
export function lessonBookLayout(width: number, height: number, count: number, areas: number): LessonBookLayout {
  const register = registerLayout(width, height);
  const tabsY = register.bottom - TAB.h;
  const pages = [register.left, register.right].map((p) => ({ x: p.x + INSET, w: p.w - 2 * INSET }));
  const first = register.top + REGISTER.row;
  const perPage = Math.ceil(count / 2);
  const step = Math.max(MIN_ROW, Math.min(REGISTER.row, Math.floor((tabsY - 4 - first) / Math.max(1, perPage))));
  // both pages' rows start under the heading's line (the frame's gear sits over the right page's top corner)
  const rows = Array.from({ length: count }, (_, k) => {
    const right = k >= perPage;
    const page = pages[right ? 1 : 0]!;
    const y = first + (right ? k - perPage : k) * step;
    return { x: page.x, y, w: page.w };
  });
  const span = areas * TAB.w + (areas - 1) * TAB.gap;
  const left = Math.max(register.book.x + TAB.w + 3 * TAB.gap, Math.floor(width / 2 - span / 2));
  const tabs = Array.from({ length: areas }, (_, k) => ({ x: left + k * (TAB.w + TAB.gap), y: tabsY, w: TAB.w, h: TAB.h }));
  const arrow = (x: number) => ({ x, y: tabsY, w: TAB.w, h: TAB.h });
  const previous = arrow(left - TAB.w - 3 * TAB.gap), next = arrow(left + span + 3 * TAB.gap);
  return { register, heading: { x: pages[0]!.x, y: register.top, w: pages[0]!.w }, rows, tabs, previous, next };
}
