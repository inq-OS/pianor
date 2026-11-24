import { describe, expect, it } from 'vitest';
import { ART_DETAIL, BOARD_ROWS, FRAME_MIN } from './frame';
import { rectBottom, rectRight, type Rect } from './rect';

const rectsOverlap = (a: Rect, b: Rect): boolean => a.x < rectRight(b) && b.x < rectRight(a) && a.y < rectBottom(b) && b.y < rectBottom(a);
import {
  BEND, PORTRAIT_MAX, ROOM, ROOM_OBJECTS, ROOM_PICTURE, ROOM_PRESSABLES, STRIP_ROWS, blockCorners, leantPoint, lookThrough, onWall, pieceCorners, projectBounds,
  projectPoint, roomCamera, roomPlan, roomView, wallFrame,
} from './room';

/** The main areas the room is checked on (d105, d110): the target screen's first, then larger ones. */
const SCREENS = [{ w: 320, h: 157 }, { w: 320, h: 169 }, { w: 342, h: 169 }, { w: 384, h: 193 }, { w: 400, h: 202 }];
const RING = 2;
const ringed = (r: Rect): Rect => ({ x: r.x - RING, y: r.y - RING, w: r.w + 2 * RING, h: r.h + 2 * RING });
const inside = (r: Rect, area: Rect): boolean => r.x >= area.x && r.y >= area.y && r.x + r.w <= area.x + area.w && r.y + r.h <= area.y + area.h;

describe('the warden\'s room: the plan and its camera (ft_1_18.AC3)', () => {
  const plan = roomPlan();
  const whole: Rect = { x: 0, y: 0, w: ROOM_PICTURE.w, h: ROOM_PICTURE.h };

  it('ft_1_18.AC3 the picture fills the main area of the target screen, and what is pressed in it stays above the rows a board covers', () => {
    expect(ROOM_PICTURE).toEqual({ w: FRAME_MIN.width, h: FRAME_MIN.height });
    for (const box of [...Object.values(plan.objects), plan.phone]) expect(box.y + box.h).toBeLessThanOrEqual(ROOM_PICTURE.h - BOARD_ROWS);
    expect(plan.fine).toEqual({ w: ROOM_PICTURE.w * ART_DETAIL, h: ROOM_PICTURE.h * ART_DETAIL });
    for (const screen of SCREENS) {
      const { picture, strip } = roomView(screen);
      expect(picture.y).toBeGreaterThanOrEqual(0);
      expect([picture.w, picture.h]).toEqual([ROOM_PICTURE.w, ROOM_PICTURE.h]);
      expect(strip).toEqual({ x: 0, y: screen.h - STRIP_ROWS, w: screen.w, h: STRIP_ROWS });
      // in the middle of the room it has
      expect(Math.abs(picture.x * 2 + picture.w - screen.w)).toBeLessThanOrEqual(1);
    }
  });

  it('ft_1_20.AC2 under the action and inventory band the room keeps no strip of its own: the picture fills the main area', () => {
    const { picture, strip } = roomView({ w: 320, h: 180 }, 0);
    expect(picture).toEqual({ x: 0, y: 0, w: ROOM_PICTURE.w, h: ROOM_PICTURE.h });
    expect(strip.h).toBe(0);
  });

  it('ft_1_20.AC14 the things a press reaches are the objects in their order, then the shield (the window is none)', () => {
    expect(ROOM_PRESSABLES).toEqual([...ROOM_OBJECTS, 'shield']);
  });

  it('ft_1_08.AC7 every button and its focus ring is inside the picture, and no ring lies on another button', () => {
    const buttons = [...ROOM_OBJECTS.map((o) => plan.objects[o])];
    for (const b of buttons) {
      expect(b.w).toBeGreaterThanOrEqual(12);
      expect(b.h).toBeGreaterThanOrEqual(12);
      expect(inside(ringed(b), whole)).toBe(true);
    }
    for (let i = 0; i < buttons.length; i++) for (let j = i + 1; j < buttons.length; j++) expect(rectsOverlap(ringed(buttons[i]!), buttons[j]!)).toBe(false);
  });

  it('ft_1_18.AC3 the piano stands between the two sea windows, the lighthouse window and its chest to the left, the easel and the door to the right', () => {
    const { piano, door, easel } = plan.objects;
    const camera = plan.camera;
    const left = projectBounds(camera, pieceCorners('back', ROOM.windowLeft)), right = projectBounds(camera, pieceCorners('back', ROOM.windowRight));
    const side = projectBounds(camera, pieceCorners('left', ROOM.windowSide));
    expect(left.x + left.w).toBeLessThan(piano.x * ART_DETAIL);
    expect(right.x).toBeGreaterThan((piano.x + piano.w) * ART_DETAIL);
    expect(side.x + side.w).toBeLessThan(left.x);
    expect(side.x).toBeGreaterThan(0);
    const chest = projectBounds(camera, blockCorners(ROOM.chest, ROOM.leans.chest));
    expect(chest.x + chest.w).toBeLessThan(piano.x * ART_DETAIL);
    expect(easel.x).toBeGreaterThan(piano.x + piano.w);
    expect(door.x).toBeGreaterThan(easel.x + easel.w);
  });

  it('ft_1_18.AC3 the note board stands beside the piano by the back wall, not out in the middle of the room (next to the piano)', () => {
    const { piano, easel } = plan.objects;
    // a few art pixels of wall between them, and its feet about as far up the floor as the piano's
    expect(easel.x - (piano.x + piano.w)).toBeLessThan(8);
    expect(easel.y + easel.h).toBeLessThan(piano.y + piano.h + 6);
  });

  it('ft_1_08.AC10 ft_1_09.AC3 the largest portrait and the rank shield hang over the piano, inside the picture, clear of each other and of the windows', () => {
    const fine: Rect = { x: 0, y: 0, w: plan.fine.w, h: plan.fine.h };
    const pianoTop = projectPoint(plan.camera, ROOM.piano.x, ROOM.piano.y1, ROOM.piano.z).y;
    for (const size of [PORTRAIT_MAX, { w: 40, h: 50 }, { w: 16, h: 16 }]) {
      const { portrait, shield } = roomPlan(size);
      expect([portrait.w, portrait.h]).toEqual([size.w, size.h]);
      expect(inside(portrait, fine)).toBe(true);
      expect(inside(shield, fine)).toBe(true);
      expect(portrait.y + portrait.h).toBeLessThanOrEqual(pianoTop + 1);
      expect(rectsOverlap(portrait, shield)).toBe(false);
      for (const win of [ROOM.windowLeft, ROOM.windowRight]) {
        const glass = projectBounds(plan.camera, pieceCorners('back', win));
        expect(rectsOverlap(portrait, glass)).toBe(false);
        expect(rectsOverlap(shield, glass)).toBe(false);
      }
    }
  });

  it('ft_1_18.AC3 the camera: a point lands where its pixel looks, nearer things are larger, uprights stay upright', () => {
    const camera = roomCamera();
    for (const [x, y, z] of [[0, 1, 0], [-2.4, 0.2, 1.5], [2.6, 2.2, 0.4], [1, 0, 3]] as const) {
      const p = projectPoint(camera, x, y, z);
      const dir = lookThrough(camera, p.x, p.y);
      const t = Math.hypot(x - camera.x, z - camera.z);
      expect(camera.x + dir.x * t).toBeCloseTo(x, 6);
      expect(camera.y + dir.y * t).toBeCloseTo(y, 6);
      expect(camera.z + dir.z * t).toBeCloseTo(z, 6);
    }
    expect(projectPoint(camera, 0, 0, 3).scale).toBeGreaterThan(projectPoint(camera, 0, 0, 0).scale);
    // the lens bows a level line: the back wall's top is higher on the picture in the corners than in the middle
    expect(projectPoint(camera, ROOM.half, ROOM.height, 0).y).toBeGreaterThan(projectPoint(camera, camera.x, ROOM.height, 0).y);
  });

  it('ft_1_18.AC3 the view is bent as a hand draws a room: uprights fan out toward the top, the more the farther from the middle, and none tips over', () => {
    const camera = roomCamera();
    const fan = (x: number): number => projectPoint(camera, x, ROOM.height, 1).x - projectPoint(camera, x, 0, 1).x;
    expect(BEND.fan).toBeGreaterThan(0);
    expect(fan(2.4)).toBeGreaterThan(fan(1.2));
    expect(fan(1.2)).toBeGreaterThan(1);
    expect(fan(-2.4)).toBeLessThan(fan(-1.2));
    expect(fan(-1.2)).toBeLessThan(-1);
    // a thing in the middle stands upright, and the widest fan is a lean, not a fall
    expect(Math.abs(fan(camera.x))).toBeLessThan(1);
    const rise = projectPoint(camera, 2.4, 0, 1).y - projectPoint(camera, 2.4, ROOM.height, 1).y;
    expect(Math.abs(fan(2.4))).toBeLessThan(rise / 5);
    // the unbent lens keeps uprights upright
    const even = { ...camera, bend: { ...camera.bend, fan: 0, bow: 0 } };
    expect(projectPoint(even, 1.3, 0, 1).x).toBeCloseTo(projectPoint(even, 1.3, 2.4, 1).x, 6);
  });

  it('ft_1_18.AC3 a button lies round its thing as the thing leans: a lean moves a box\'s top and keeps its foot', () => {
    const made = blockCorners(ROOM.easel), leant = blockCorners(ROOM.easel, ROOM.leans.easel);
    made.forEach((p, i) => {
      const q = leant[i]!;
      // a foot keeps its place on the floor plan (a tilt may lift one side of it); a top corner goes sideways with the lean
      expect([q[0] - p[0], q[2] - p[2]].map((v) => Math.round(v * 1e9) / 1e9)).toEqual(p[1] === 0 ? [0, 0] : [Math.round((ROOM.leans.easel.x ?? 0) * p[1] * 1e9) / 1e9, 0]);
    });
    expect(leantPoint({ at: [1, 0, 2], x: 0.1, z: -0.2, tilt: 0.5, fat: 2, tall: 3 }, { x: 2, y: 1, z: 3 })).toEqual({ x: 1 + 2 + 0.1, y: 0.5 + 3, z: 2 - 0.2 + 2 });
    const plumb = pieceCorners('right', ROOM.door), door = pieceCorners('right', ROOM.door, ROOM.lean.door);
    expect(door[0]).toEqual(plumb[0]);
    expect(Math.hypot(door[1]![0] - plumb[1]![0], door[1]![2] - plumb[1]![2])).toBeCloseTo(ROOM.lean.door * ROOM.door.y1, 9);
  });

  it('ft_1_18.AC3 the side walls open toward the viewer, and a wall\'s points lie on it', () => {
    const left = wallFrame('left'), right = wallFrame('right');
    expect(left.ax).toBeLessThan(0);
    expect(right.ax).toBeGreaterThan(0);
    expect(onWall('back', 1.5)).toEqual({ x: 1.5, z: 0 });
    expect(onWall('left', 0)).toEqual({ x: -ROOM.half, z: 0 });
    const far = onWall('right', 2), off = onWall('right', 2, 0.5);
    expect(far.x).toBeGreaterThan(ROOM.half);
    expect(off.x).toBeLessThan(far.x);
    expect(Math.hypot(off.x - far.x, off.z - far.z)).toBeCloseTo(0.5, 6);
    // a turned block keeps its size: the chest lies along the left wall
    const corners = blockCorners(ROOM.chest);
    expect(corners).toHaveLength(8);
    const [a, , b] = corners;
    expect(Math.hypot(a![0] - b![0], a![2] - b![2])).toBeCloseTo(ROOM.chest.d, 6);
  });
});
