import { describe, expect, it } from 'vitest';
import { ROOM, pieceCorners, projectBounds, roomPlan } from '../../../../core/layout/room';
import { SKY_PHASES } from '../../../../core/sky/skyPhase';
import { PALETTE } from '../palette';
import { paintView, VIEW, type RoomPanes } from './roomView';

// the room's own windows, as its picture has them
const plan = roomPlan();
const SIZE = plan.fine;
const pane = (wall: 'back' | 'left', piece: typeof ROOM.windowSide) => projectBounds(plan.camera, pieceCorners(wall, piece));
const PANES: RoomPanes = { side: pane('left', ROOM.windowSide), left: pane('back', ROOM.windowLeft), right: pane('back', ROOM.windowRight) };
const HORIZON = plan.camera.cy;
const R = VIEW.run;

/** How many pixels of `pane` are one of `colours`. */
function count(pixels: Uint8Array, pane: { x: number; y: number; w: number; h: number }, colours: readonly number[]): number {
  let n = 0;
  for (let y = pane.y; y < pane.y + pane.h; y++) for (let x = pane.x; x < pane.x + pane.w; x++) if (colours.includes(pixels[y * SIZE.w + x]!)) n++;
  return n;
}

describe('the island behind the room\'s windows (ft_1_18.AC3)', () => {
  const views = Object.fromEntries(SKY_PHASES.map((phase) => [phase, paintView(SIZE, PANES, HORIZON, phase)]));

  it('ft_1_18.AC3 the view is painted from the island\'s shared palette alone, the same picture every time', () => {
    for (const phase of SKY_PHASES) {
      const view = views[phase]!;
      expect([view.width, view.height]).toEqual([SIZE.w, SIZE.h]);
      const length = VIEW.at(phase).length;
      for (const pane of Object.values(PANES)) {
        for (let y = pane.y; y < pane.y + pane.h; y++) for (let x = pane.x; x < pane.x + pane.w; x++) {
          const p = view.pixels[y * SIZE.w + x]!;
          expect(p === R.ink || (p >= PALETTE.length && p < length)).toBe(true);
        }
      }
      expect(paintView(SIZE, PANES, HORIZON, phase).pixels).toEqual(view.pixels);
    }
    expect(VIEW.at('day').length).toBeLessThan(256 - 60);
  });

  it('ft_1_18.AC3 the sea windows show sky over a level horizon and sea under it, at every hour (the horizon had been curved)', () => {
    for (const phase of SKY_PHASES) {
      const view = views[phase]!;
      for (const pane of [PANES.left, PANES.right]) {
        const sky = [...VIEW.fine.sky, ...VIEW.fine.cloud], sea = VIEW.fine.sea;
        const above = { ...pane, h: HORIZON - 12 - pane.y }, below = { x: pane.x, y: HORIZON + 2, w: pane.w, h: 6 };
        expect(count(view.pixels, above, sky)).toBeGreaterThan(above.w * above.h * 0.8);
        expect(count(view.pixels, below, sea)).toBeGreaterThan(below.w * below.h * 0.8);
        // the horizon is one row in both windows: no sea above it anywhere
        expect(count(view.pixels, { x: pane.x, y: HORIZON - 4, w: pane.w, h: 3 }, sea.slice(0, 2))).toBe(0);
      }
    }
  });

  it('ft_1_18.AC3 the lighthouse stands big in the left wall\'s window, from the roses up past the window\'s top third; the sea windows have none', () => {
    const tower = [...VIEW.fine.lime, ...VIEW.fine.iron];
    for (const phase of SKY_PHASES) {
      const view = views[phase]!;
      // the tower is a column on a drum, so it fills a sixth of the opening's box while standing its whole height
      expect(count(view.pixels, PANES.side, tower)).toBeGreaterThan(PANES.side.w * PANES.side.h * 0.15);
      expect(count(view.pixels, { ...PANES.side, h: Math.floor(PANES.side.h / 3) }, tower)).toBeGreaterThan(30);
      expect(count(view.pixels, PANES.left, tower)).toBe(0);
      expect(count(view.pixels, PANES.right, tower)).toBe(0);
    }
  });

  it('ft_1_18.AC3 the night outside is the island\'s night: stars and a moon in the sea windows, and the lighthouse\'s lantern lit with a halo; by day none of them', () => {
    const lights = [...VIEW.fine.ember];
    const night = views.night!, day = views.day!;
    expect(count(night.pixels, PANES.side, lights)).toBeGreaterThan(60);
    expect(count(day.pixels, PANES.side, lights)).toBe(0);
    const stars = [R.star[0]!, R.star[1]!, R.moon[0]!, R.moon[1]!];
    expect(count(night.pixels, { ...PANES.left, h: 40 }, stars) + count(night.pixels, { ...PANES.right, h: 40 }, stars)).toBeGreaterThan(8);
    expect(count(day.pixels, { ...PANES.left, h: 40 }, stars)).toBe(0);
  });

  it('ft_1_18.AC3 the second look of the sea moves its dashes and glints and nothing above the horizon', () => {
    const still = views.night!, moved = paintView(SIZE, PANES, HORIZON, 'night', 1);
    let above = 0, below = 0;
    still.pixels.forEach((p, i) => {
      if (p === moved.pixels[i]) return;
      if (Math.floor(i / SIZE.w) <= HORIZON) above++;
      else below++;
    });
    expect(above).toBe(0);
    expect(below).toBeGreaterThan(50);
  });
});
