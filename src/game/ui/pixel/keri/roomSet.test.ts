import { describe, expect, it } from 'vitest';
import { blockCorners, lookThrough, pieceCorners, projectBounds, projectPoint, roomPlan, ROOM, type WallPiece } from '../../../../core/layout/room';
import { MUSIC_STACKS, musicStacks, SHEET } from './roomPapers';
import { BASKET, CHART_ROLLS, FOREGROUND, roomSet } from './roomSet';

const plan = roomPlan();
const { scene } = roomSet({ phase: 'day', lamps: false });

/** Whether the thing seen at fine pixel (x, y) of the picture is one of the foreground. */
function near(x: number, y: number): boolean {
  const ray = lookThrough(plan.camera, x + 0.5, y + 0.5);
  const shape = scene.first(plan.camera.x, plan.camera.y, plan.camera.z, ray.x, ray.y, ray.z, 0.05, 400);
  return !!shape && shape.group >= FOREGROUND;
}

/** The share of a box of the picture that the foreground covers (every fourth pixel). */
function share(box: { x: number; y: number; w: number; h: number }): number {
  let n = 0, all = 0;
  for (let y = box.y; y < box.y + box.h; y += 4) for (let x = box.x; x < box.x + box.w; x += 4) {
    all++;
    if (near(x, y)) n++;
  }
  return n / all;
}

describe('the foreground of the warden\'s room (ft_1_18.AC3)', () => {
  const { w: W, h: H } = plan.fine;
  const S = 64;

  it('ft_1_18.AC3 each corner of the picture is framed by a thing that stands near the viewer, not by a painted shadow', () => {
    const corners = { topLeft: { x: 0, y: 0 }, topRight: { x: W - S, y: 0 }, bottomLeft: { x: 0, y: H - S }, bottomRight: { x: W - S, y: H - S } };
    for (const [name, at] of Object.entries(corners)) expect(share({ ...at, w: S, h: S }), name).toBeGreaterThan(0.2);
    // the middle of the picture is free of it in the rows no board covers (the upper 248 fine rows); under them only
    // the low stack of music reaches in along the foot, from about 440 of 640
    expect(share({ x: W / 4, y: 0, w: W / 2, h: 248 })).toBe(0);
    expect(share({ x: W / 4, y: 248, w: W / 2, h: H - 248 })).toBeLessThan(0.2);
  });

  it('ft_1_18.AC3 the stacks of music by the door are ragged piles of thin sheaves with loose sheets on top, one of them slumped, no two pieces alike', () => {
    // the foreground holds stacks of music notation, not logs; the first try's
    // slabs looked like blocks of stone
    const pieces = musicStacks();
    expect(MUSIC_STACKS).toBe(3);
    for (let n = 0; n < MUSIC_STACKS; n++) {
      const stack = pieces.filter((p) => p.stack === n);
      // loose sheets lie on top, and under them many thin sheaves, not a few slabs
      expect(stack.at(-1)!.kind, `stack ${n}`).toBe('sheet');
      expect(stack.at(-1)!.hang, `stack ${n}`).toBeDefined();
      expect(stack.filter((p) => p.kind === 'sheaf').length, `stack ${n}`).toBeGreaterThan(2);
      for (const p of stack.slice(1)) expect(p.y1 - p.y0, `stack ${n} ${p.kind}`).toBeLessThanOrEqual((p.kind === 'sheet' ? SHEET : 0.065) + 1e-9);
    }
    expect(SHEET).toBeLessThanOrEqual(0.01);
    expect(pieces.some((p) => p.kind === 'book')).toBe(true);
    // a sheet hangs out of a pile's side here and there and droops
    expect(pieces.filter((p) => p.hang && p.hang.side !== 'none' && p.hang.out > 0.05).length).toBeGreaterThan(2);
    // one pile has slumped: its sheaves grow shorter upward and its top sheets lie down the stair they make
    const slumped = pieces.filter((p) => p.hang?.slope);
    expect(new Set(slumped.map((p) => p.stack)).size).toBe(1);
    const stair = pieces.filter((p) => p.stack === slumped[0]!.stack && p.kind === 'sheaf');
    expect(stair.at(-1)!.w).toBeLessThan(stair[0]!.w * 0.6);
    // no stack is a tidy block: each piece is turned and sized its own way
    expect(new Set(pieces.map((p) => `${p.w.toFixed(4)} ${p.d.toFixed(4)} ${p.turn.toFixed(2)}`)).size).toBe(pieces.length);
  });

  it('ft_1_18.AC3 the stacks stand far enough into the room for their sides to be seen, their tops where the reference outline puts them', () => {
    // in fine pixels of the tall picture: a tall block at the right edge with its top at about 270, a pile beside
    // it that peaks at about (519, 276), a low one whose top is at about 304: near the eye, in the lower right corner
    const pieces = musicStacks();
    const top = (n: number): { x: number; y: number } => {
      let best = { x: 0, y: Infinity };
      // (the sheaves and books: a loose sheet curls and hangs as it likes)
      for (const p of pieces.filter((q) => q.stack === n && q.kind !== 'sheet')) for (const c of blockCorners({ ...p, y0: p.y1 })) {
        const at = projectPoint(plan.camera, c[0], c[1], c[2]);
        if (at.y < best.y) best = at;
      }
      return best;
    };
    expect(Math.abs(top(0).y - 270)).toBeLessThan(6);
    expect(Math.abs(top(1).y - 276)).toBeLessThan(6);
    expect(Math.abs(top(1).x - 519)).toBeLessThan(30);
    expect(Math.abs(top(2).y - 304)).toBeLessThan(6);
    // the tall pile's front is in the picture for a hand's breadth and more below its top: leaf on leaf is seen
    const tall = pieces.filter((p) => p.stack === 0), high = Math.max(...tall.map((p) => p.y1));
    const front = blockCorners({ ...tall[0]!, y0: high - 0.12, y1: high }).map((c) => projectPoint(plan.camera, c[0], c[1], c[2]));
    expect(front.filter((c) => c.x < plan.fine.w && c.y < plan.fine.h).length).toBeGreaterThanOrEqual(2);
  });

  it('ft_1_18.AC3 every piece of a stack of music lies on the one under it, the lowest on the floor', () => {
    const pieces = musicStacks();
    for (let n = 0; n < MUSIC_STACKS; n++) {
      const stack = pieces.filter((p) => p.stack === n);
      expect(stack[0]!.y0).toBe(0);
      stack.slice(1).forEach((p, i) => {
        const under = stack[i]!;
        expect(p.y0, `stack ${n} piece ${i + 1}`).toBeCloseTo(under.y1, 9);
        // its middle is over the piece under it, so it does not hang in the air (a sheet that lies down a slumped
        // pile's stair rests on every step of it)
        if (!p.hang?.slope && !under.hang?.slope) expect(Math.hypot(p.x - under.x, p.z - under.z), `stack ${n} piece ${i + 1}`).toBeLessThan(Math.max(under.w, under.d) / 2);
      });
    }
  });

  it('ft_1_18.AC3 the rolled charts stand in their basket: each foot on its bottom, each leaning on its rim inside the wicker, no two alike', () => {
    for (const roll of CHART_ROLLS) {
      expect(Math.hypot(...roll.foot) + roll.r).toBeLessThanOrEqual(BASKET.foot);
      expect(Math.hypot(...roll.rim) + roll.r).toBeLessThanOrEqual(BASKET.mouth);
      // it stands more than it lies: it leans out by less than a third of the basket's height
      expect(Math.hypot(roll.rim[0] - roll.foot[0], roll.rim[1] - roll.foot[1])).toBeLessThan((BASKET.y1 - BASKET.y0) / 3);
      // and it is long enough to rise out of the basket
      expect(roll.len).toBeGreaterThan((BASKET.y1 - BASKET.y0) * 1.5);
    }
    for (const key of ['len', 'r', 'paper'] as const) expect(new Set(CHART_ROLLS.map((roll) => roll[key])).size, key).toBe(CHART_ROLLS.length);
  });

  it('ft_1_18.AC3 the foreground hides no button: the middle of each object is seen, and little of its box is covered', () => {
    for (const [name, cells] of Object.entries(plan.objects)) {
      const box = { x: cells.x * 2, y: cells.y * 2, w: cells.w * 2, h: cells.h * 2 };
      expect(near(box.x + box.w / 2, box.y + box.h / 2), name).toBe(false);
      expect(share(box), name).toBeLessThan(0.12);
    }
  });
});

describe('the windows of the warden\'s room (ft_1_18.AC3)', () => {
  /** The groups of the things first seen along a row across the middle of a window, inside its frame (0 where the ray goes out through it). */
  const across = (wall: 'back' | 'left', piece: WallPiece, lean: number): number[] => {
    const r = projectBounds(plan.camera, pieceCorners(wall, piece, lean));
    const seen: number[] = [];
    for (let x = r.x + r.w * 0.25; x < r.x + r.w * 0.75; x++) {
      const ray = lookThrough(plan.camera, x, r.y + r.h * 0.55);
      seen.push(scene.first(plan.camera.x, plan.camera.y, plan.camera.z, ray.x, ray.y, ray.z, 0.05, 400)?.group ?? 0);
    }
    return seen;
  };

  // the reference for the windows: the 1991 rooms' windows have a fat frame with one thick cross
  it('ft_1_18.AC3 each sea window is crossed in its middle by its frame, and nothing crosses the lighthouse window, so the tower stands whole', () => {
    // across the middle of a sea window: the view out on both sides of the frame's upright
    for (const [piece, lean, group] of [[ROOM.windowLeft, ROOM.lean.windowLeft, 300], [ROOM.windowRight, ROOM.lean.windowRight, 310]] as const) {
      const seen = across('back', piece, lean);
      expect(seen, `window ${group}`).toContain(group);
      const upright = seen.indexOf(group, seen.length / 4);
      expect(upright, `window ${group}`).toBeGreaterThan(0);
      expect(seen.slice(0, upright), `window ${group}`).toContain(0);
      expect(seen.slice(seen.lastIndexOf(group)), `window ${group}`).toContain(0);
    }
    // the lighthouse window seen aslant: one unbroken view out until its frame's far side, which shows its thickness
    const side = across('left', ROOM.windowSide, ROOM.lean.windowSide), frame = side.indexOf(320);
    expect(side.slice(0, frame < 0 ? side.length : frame).every((g) => g === 0)).toBe(true);
    expect(frame < 0 ? side.length : frame).toBeGreaterThan(side.length * 0.6);
  });
});

describe('the lamps of the warden\'s room (ft_1_18.AC3)', () => {
  it('ft_1_18.AC3 by day only the daylight lights the room; at night the stove, the desk lamp, the lantern and the piano\'s two candles burn, each a warm light', () => {
    const day = roomSet({ phase: 'day', lamps: false }).lamps, night = roomSet({ phase: 'night', lamps: true }).lamps;
    const warm = (lamps: typeof day) => lamps.filter((l) => !l.far && l.r > l.b * 2 && l.r > 0.5);
    // the stove burns only at dusk and by night
    expect(warm(day)).toHaveLength(0);
    for (const phase of ['dawn', 'day'] as const) expect(roomSet({ phase, lamps: phase === 'dawn' }).lamps.some((l) => l.flickers), phase).toBe(false);
    // its light is a small red pool before its mouth, not a light for the whole room: at most a reddish glow on the floor before it
    for (const phase of ['dusk', 'night'] as const) {
      const fire = roomSet({ phase, lamps: true }).lamps.filter((l) => l.flickers);
      expect(fire, phase).toHaveLength(1);
      expect(fire[0]!.reach).toBeLessThan(1);
      expect(fire[0]!.r).toBeGreaterThan(3 * fire[0]!.g);
    }
    expect(warm(night).length).toBeGreaterThanOrEqual(5);
    // the candles stand on the piano, either side of its music desk, and do not flicker with the fire
    const candles = warm(night).filter((l) => Math.abs(l.x) < 0.8 && l.z < 1 && l.y > 0.9 && l.y < 1.3);
    expect(candles).toHaveLength(2);
    expect(candles.every((l) => !l.flickers)).toBe(true);
    expect(candles[0]!.x * candles[1]!.x).toBeLessThan(0);
  });
});

describe('the mug of tea on the table (ft_1_08.AC9)', () => {
  it('ft_1_08.AC9 the mug is painted into the set in the room\'s light, right where its steam rises', () => {
    const set = roomSet({ phase: 'day', lamps: false });
    const m = set.spots.mug;
    const at = projectPoint(plan.camera, m.x, m.y + 0.05, m.z);
    const ray = lookThrough(plan.camera, at.x, at.y);
    const shape = set.scene.first(plan.camera.x, plan.camera.y, plan.camera.z, ray.x, ray.y, ray.z, 0.05, 400);
    expect(shape?.group).toBe(111); // the things on the tea table (its group, 11, plus 100)
  });
});
