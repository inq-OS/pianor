import { describe, expect, it } from 'vitest';
import { bricks, colour, mix, plain, planks, stripes } from './materials';
import { bayer, fbm, hash2, noise2 } from './noise';
import { lensPlace, lensRay, outlines, paint, WOBBLE, type Lamp, type Stage } from './painter';
import { Reducer } from './reduce';
import { Blob, Box, Cone, Flat, Leant, Scene, type Dab, type Skin } from './trace';

const skin = (): Skin => ({ nx: 0, ny: 0, nz: 0, u: 0, v: 0, face: 0 });
const dab = (over: Partial<Dab> = {}): Dab => ({ x: 0, y: 0, z: 0, fine: 0.01, nx: 0, ny: 1, nz: 0, u: 0, v: 0, face: 0, r: 0, g: 0, b: 0, emit: 0, ...over });
const GREY = plain(colour(0x808080), 0);

describe('the painter of the room: noise, shapes, light and the palette (ft_1_18.AC3)', () => {
  it('ft_1_18.AC3 the noise is the same numbers every time, stays in 0 to 1 and is smooth', () => {
    for (let i = 0; i < 200; i++) {
      const x = i * 0.37 - 20, y = i * 0.91 - 7;
      for (const v of [hash2(i, -i, 3), noise2(x, y, 2), fbm(x, y, 3, 1)]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
      expect(noise2(x, y, 2)).toBe(noise2(x, y, 2));
      expect(Math.abs(noise2(x + 0.01, y, 2) - noise2(x, y, 2))).toBeLessThan(0.05);
    }
    expect(hash2(1, 2, 3)).not.toBe(hash2(2, 1, 3));
    // the dither pattern holds each of its sixteen steps once in every 4 x 4 block
    const steps = new Set<number>();
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) steps.add(bayer(x + 8, y + 4));
    expect(steps.size).toBe(16);
  });

  it('ft_1_18.AC3 a ray meets a flat shape inside its edges only, not in a hole and not where the mask cuts it', () => {
    const wall = new Flat([0, 0, 0], [2, 0, 0], [0, 1, 0], GREY);
    expect(wall.hit(1, 0.5, 3, 0, 0, -1, 0, 100)).toBeCloseTo(3);
    expect(wall.hit(2.5, 0.5, 3, 0, 0, -1, 0, 100)).toBe(-1);
    expect(wall.hit(1, 0.5, 3, 0, 0, -1, 0, 2)).toBe(-1);
    expect(wall.hit(1, 0.5, 3, 1, 0, 0, 0, 100)).toBe(-1);
    wall.holes.push({ u0: 0.8, u1: 1.2, v0: 0.2, v1: 0.8 });
    expect(wall.hit(1, 0.5, 3, 0, 0, -1, 0, 100)).toBe(-1);
    expect(wall.hit(0.5, 0.5, 3, 0, 0, -1, 0, 100)).toBeCloseTo(3);
    wall.mask = (u) => u > 1;
    expect(wall.hit(0.5, 0.5, 3, 0, 0, -1, 0, 100)).toBe(-1);
    const s = skin();
    wall.skin(1.5, 0.25, 0, s);
    expect([s.u, s.v, s.nz]).toEqual([1.5, 0.25, 1]);
  });

  it('ft_1_18.AC3 a box, a cone and a blob are met on their near side, and their skin faces the ray', () => {
    const shapes = [
      new Box([0, 0.5, 0], [0.5, 0.5, 0.5], 0.4, GREY),
      new Cone([0, 0, 0], [0, 1, 0], 0.5, 0.2, GREY),
      new Blob([0, 0.5, 0], [0.5, 0.5, 0.5], 0, GREY),
    ];
    for (const shape of shapes) {
      const t = shape.hit(0.05, 0.5, 4, 0, 0, -1, 0, 100);
      expect(t).toBeGreaterThan(3.2);
      expect(t).toBeLessThan(3.8);
      const s = skin();
      shape.skin(0.05, 0.5, 4 - t, s);
      expect(s.nz).toBeGreaterThan(0.5);
      expect(Math.hypot(s.nx, s.ny, s.nz)).toBeCloseTo(1, 3);
      // a ray that passes beside it, and one that starts past it, meet nothing
      expect(shape.hit(3, 0.5, 4, 0, 0, -1, 0, 100)).toBe(-1);
      expect(shape.hit(0.05, 0.5, -4, 0, 0, -1, 0, 100)).toBe(-1);
      const b = shape.bounds();
      expect(b.x0).toBeLessThan(0);
      expect(b.y1).toBeGreaterThanOrEqual(1);
    }
    // the cone's ends are closed: from above the ray meets its top
    expect(shapes[1]!.hit(0, 3, 0, 0, -1, 0, 0, 100)).toBeCloseTo(2);
  });

  it('ft_1_18.AC3 a split post has a flat side where the part was split off, and nothing where that part was', () => {
    // a post standing on the floor, everything past z = 0.1 split off
    const half = new Cone([0, 0, 0], [0, 1, 0], 0.5, 0.5, GREY, [{ angle: 0, at: 0.1 }]);
    // from the split side the ray meets the flat face, which faces it
    const t = half.hit(0.05, 0.5, 4, 0, 0, -1, 0, 100);
    expect(t).toBeCloseTo(3.9, 5);
    const s = skin();
    half.skin(0.05, 0.5, 4 - t, s);
    expect(s.face).toBe(3);
    expect(s.nz).toBeCloseTo(1, 5);
    expect(s.v).toBeCloseTo(0.5, 5);
    // from the other side it is still round
    const back = half.hit(0.05, 0.5, -4, 0, 0, 1, 0, 100);
    expect(back).toBeCloseTo(4 - Math.sqrt(0.25 - 0.0025), 5);
    half.skin(0.05, 0.5, -4 + back, s);
    expect(s.face).toBe(0);
    expect(s.nz).toBeLessThan(-0.9);
    // where the part was split off there is nothing, from the side and from above; the rest keeps its top
    expect(half.hit(4, 0.5, 0.3, -1, 0, 0, 0, 100)).toBe(-1);
    expect(half.hit(0, 3, 0.3, 0, -1, 0, 0, 100)).toBe(-1);
    expect(half.hit(0, 3, 0, 0, -1, 0, 0, 100)).toBeCloseTo(2);
    // split twice it is a quarter: the second face is met where the first alone would leave wood
    const quarter = new Cone([0, 0, 0], [0, 1, 0], 0.5, 0.5, GREY, [{ angle: 0, at: 0.1 }, { angle: Math.PI / 2, at: 0 }]);
    expect(quarter.hit(4, 0.5, -0.2, -1, 0, 0, 0, 100)).toBeCloseTo(4, 5);
    expect(quarter.hit(0.2, 0.5, 4, 0, 0, -1, 0, 100)).toBe(-1);
    expect(quarter.hit(-0.2, 0.5, 4, 0, 0, -1, 0, 100)).toBeCloseTo(3.9, 5);
  });

  it('ft_1_18.AC3 a hole may lean: a window that is not plumb is open where its leaning sides say, not where a plumb one would be', () => {
    const wall = new Flat([0, 0, 0], [4, 0, 0], [0, 3, 0], GREY);
    wall.holes.push({ u0: 1, u1: 2, v0: 1, v1: 2, lean: 0.5 });
    const through = (x: number, y: number): boolean => wall.hit(x, y, 5, 0, 0, -1, 0, 100) === -1;
    // at its sill the hole is where it was cut; a metre up it has moved half a metre along
    expect(through(1.1, 1.05)).toBe(true);
    expect(through(1.1, 1.9)).toBe(false);
    expect(through(2.4, 1.9)).toBe(true);
    expect(through(2.4, 1.05)).toBe(false);
    expect(through(1.5, 2.5)).toBe(false);
  });

  it('ft_1_18.AC3 a leant shape stands where its matrix puts it: its foot stays, its top moves, a ray meets it there and its skin faces as the lean turns it', () => {
    // a post a metre high, leaning 0.5 m to the right for each metre it rises, and twice as tall as it was made
    const post = new Leant(new Box([0, 0.5, 0], [0.1, 0.5, 0.1], 0, GREY), [0, 0, 0], [1, 0.5, 0, 0, 2, 0, 0, 0, 1]);
    expect(post.moved(0, 0, 0)).toEqual([0, 0, 0]);
    expect(post.moved(0, 1, 0)).toEqual([0.5, 2, 0]);
    const b = post.bounds();
    // its bounds hold it as it leans (a box's own bounds are roomy to the sides)
    expect(b.x0).toBeLessThanOrEqual(-0.1);
    expect(b.x1).toBeGreaterThanOrEqual(0.6);
    expect(b.x1).toBeLessThan(0.8);
    expect([b.y0, b.y1]).toEqual([0, 2]);
    // from the front: at the foot the post is round x = 0, at its top round x = 0.5 (the top is at y = 2)
    expect(post.hit(0, 0.1, 5, 0, 0, -1, 0, 100)).toBeCloseTo(4.9, 6);
    expect(post.hit(0, 1.9, 5, 0, 0, -1, 0, 100)).toBe(-1);
    expect(post.hit(0.47, 1.9, 5, 0, 0, -1, 0, 100)).toBeCloseTo(4.9, 6);
    expect(post.hit(0.47, 2.1, 5, 0, 0, -1, 0, 100)).toBe(-1);
    // its right side faces right and a little down, as a leaning post's does; its front still faces the viewer
    const s = skin();
    post.skin(0.35, 1, 0, s);
    expect(s.nx).toBeGreaterThan(0.9);
    expect(s.ny).toBeLessThan(-0.1);
    expect(Math.hypot(s.nx, s.ny, s.nz)).toBeCloseTo(1, 6);
    post.skin(0.25, 1, 0.1, s);
    expect([s.nx, s.ny, s.nz].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0, 0, 1]);
    // in a scene it throws its shadow and is found as any shape is
    const scene = new Scene();
    scene.add(post, 3);
    expect(scene.first(0.47, 1.9, 5, 0, 0, -1, 0.01, 100)).toBe(post);
    expect(scene.blocked(0.47, 1.9, 5, 0, 0, -1, 0.01, 100)).toBe(true);
  });

  it('ft_1_18.AC3 a scene gives the nearest of many shapes, and only shapes that throw a shadow block light', () => {
    const scene = new Scene();
    const boxes = [...Array(12).keys()].map((i) => scene.add(new Box([i * 2, 0.5, -i], [0.4, 0.5, 0.4], 0, GREY)));
    const curtain = scene.add(new Box([4, 0.5, 2], [0.4, 0.5, 0.05], 0, GREY), 7);
    curtain.shadow = false;
    expect(boxes.map((b) => b.id)).toEqual([...Array(12).keys()].map((i) => i + 1));
    expect(curtain.group).toBe(7);
    expect(boxes[0]!.group).toBe(-1);
    for (let i = 0; i < 12; i++) {
      expect(scene.first(i * 2, 0.5, 9, 0, 0, -1, 0.01, 100)).toBe(i === 2 ? curtain : boxes[i]);
      expect(scene.blocked(i * 2 + 1, 0.5, 9, 0, 0, -1, 0.01, 100)).toBe(false);
    }
    expect(scene.t).toBeCloseTo(9 + 11 - 0.4);
    expect(scene.first(0, 5, 9, 0, 0, -1, 0.01, 100)).toBeNull();
    // the curtain alone does not block, the box behind it does
    expect(scene.blocked(4, 0.5, 9, 0, 0, -1, 0.01, 7.5)).toBe(false);
    expect(scene.blocked(4, 0.5, 9, 0, 0, -1, 0.01, 100)).toBe(true);
  });

  it('ft_1_18.AC3 materials: mortar between bricks, stripes of two colours, planks with dark joints; a line is never thinner than a pixel', () => {
    const red = colour(0xb04030), pale = colour(0xe0d8c8);
    expect(mix(red, pale, 0)).toEqual(red);
    expect(mix(red, pale, 1)).toEqual(pale);
    const wall = bricks(red, pale, 1);
    // mortar is pale in every channel, a brick is red: told apart by the green
    const joints = (u: number): number[] => {
      const out: number[] = [];
      let was = false;
      for (let v = 0; v < 1.2; v += 0.002) {
        const d = dab({ u, v });
        wall(d);
        const mortar = d.g > 0.5;
        if (mortar && !was) out.push(v);
        was = mortar;
      }
      return out;
    };
    const here = joints(0.11), there = joints(1.9);
    expect(here.length).toBeGreaterThan(6);
    expect(here.length).toBeLessThan(1.2 / 0.05);
    // laid by hand: a course rises and dips along the wall, so its joint is not at one height everywhere
    expect(here.slice(0, 6).some((v, i) => Math.abs(v - (there[i] ?? v)) > 0.004)).toBe(true);
    const cloth = stripes(red, pale, 0.1);
    const a = dab({ u: 0.02 }), b = dab({ u: 0.08 });
    cloth(a);
    cloth(b);
    expect(a.r).not.toBeCloseTo(b.r, 2);
    // far away, where a pixel is wider than the joint, the joint is still drawn
    const floor = planks(colour(0x9a6a40), 0.14, 2);
    const dark = (fine: number): number => {
      let least = 1;
      for (let u = 0; u < 0.3; u += fine / 2) {
        const d = dab({ u, v: 0.3, fine });
        floor(d);
        least = Math.min(least, d.r);
      }
      return least;
    };
    expect(dark(0.002)).toBeLessThan(0.45);
    expect(dark(0.03)).toBeLessThan(0.5);
  });

  const stage = (lamps: Lamp[], turn = 0): Stage => {
    const scene = new Scene();
    scene.add(new Flat([-4, 0, -4], [0, 0, 8], [8, 0, 0], GREY));
    scene.add(new Box([0, 0.5, 0], [0.5, 0.5, 0.5], turn, GREY));
    return {
      scene, lamps, ambient: [0.1, 0.1, 0.1], outdoors: { toSun: [0, 1, 0], sun: [1, 1, 1], ambient: [0.3, 0.3, 0.3] },
      sky: (_ox, _oy, _oz, _dx, dy, _dz, out) => { out.r = 0.2; out.g = 0.4; out.b = dy > 0 ? 0.9 : 0.5; out.emit = 0; },
      eye: { x: 0, y: 1.2, z: 5 }, lens: 60,
      look: (px, py) => {
        const x = (px - 32) / 60, y = (20 - py) / 60;
        const l = Math.hypot(x, y, 1);
        return { x: x / l, y: y / l, z: -1 / l };
      },
    };
  };
  const lamp = (over: Partial<Lamp>): Lamp => ({ x: 0, y: 0, z: 0, far: false, r: 1, g: 1, b: 1, reach: 3, size: 0.02, flickers: false, ...over });

  it('ft_1_18.AC3 a lamp lights the side that faces it, throws a shadow behind a thing, and the fire\'s light is kept apart', () => {
    const lit = paint(stage([lamp({ x: 3, y: 1.5, z: 0.2 }), lamp({ x: -3, y: 0.4, z: 1, flickers: true, r: 1, g: 0.5, b: 0.2 })]), 64, 48);
    const at = (layer: Float32Array, x: number, y: number): number => layer[(y * 64 + x) * 3]!;
    const row = 34; // the floor beside the box, at the box's depth
    const floorRight = at(lit.steady, 50, row), floorLeft = at(lit.steady, 14, row);
    // the steady lamp stands on the right: the floor left of the box lies in the box's shadow
    expect(floorRight).toBeGreaterThan(floorLeft * 1.5);
    // the fire stands on the left: its light is on the left floor, none of it in the box's shadow on the right
    expect(at(lit.fire, 14, row)).toBeGreaterThan(0.02);
    expect(at(lit.fire, 44, row)).toBeLessThan(at(lit.fire, 14, row) / 4);
    // the sky is seen above the floor's far edge, and marked as outdoors
    expect(lit.outside[0]).toBe(1);
    expect(lit.shape[0]).toBe(0);
    expect(lit.steady[2]).toBeCloseTo(0.9);
    expect(lit.shape[24 * 64 + 32]).toBe(2);
    expect(lit.depth[24 * 64 + 32]).toBeGreaterThan(4);
  });

  it('ft_1_18.AC3 the sun throws a sharp shadow, and a thing that shines is bright without any lamp', () => {
    const s = stage([lamp({ far: true, x: 1, y: 1, z: 0, size: 0.001 })]);
    const glowing = s.scene.add(new Box([-2, 0.3, 1], [0.2, 0.3, 0.2], 0, (d) => { d.r = d.g = d.b = 1; d.emit = 0.8; }));
    const flame = s.scene.add(new Box([2, 0.3, 1], [0.2, 0.3, 0.2], 0, (d) => { d.r = 1; d.g = 0.5; d.b = 0; d.emit = -1; }));
    const far = s.scene.add(new Box([0, 0.5, -3.5], [0.3, 0.5, 0.3], 0, GREY));
    far.outdoor = true;
    const lit = paint(s, 64, 48);
    const first = (id: number): number => lit.shape.indexOf(id);
    expect(lit.steady[first(glowing.id) * 3]).toBeGreaterThan(0.8);
    expect(lit.fire[first(flame.id) * 3]).toBeCloseTo(1);
    expect(lit.steady[first(flame.id) * 3]).toBe(0);
    expect(lit.outside[first(far.id)]).toBe(1);
    // left of the box, away from the sun, the floor is in shadow: only the room's own light is there
    // (where a still lens shows a place the wobbling lens shows it at `lensPlace`)
    const sun = (x: number, y: number): number => { const p = lensPlace(x, y); return lit.sun[(Math.round(p.y) * 64 + Math.round(p.x)) * 3]!; };
    const shadow = sun(20, 34), open = sun(50, 34);
    expect(shadow).toBe(0);
    expect(open).toBeGreaterThan(0.3);
  });

  it('ft_1_18.AC3 a dark line runs round a thing, on the thing and not on what lies behind it; a softer line marks a fold', () => {
    const lit = paint(stage([lamp({ x: 3, y: 1.5, z: 0.2 })], 0.7), 64, 48);
    const ink = outlines(lit);
    let onBox = 0, full = 0, soft = 0;
    ink.forEach((v, i) => {
      if (v === 1) { full++; if (lit.shape[i] === 2) onBox++; }
      if (v > 0 && v < 1) soft++;
    });
    expect(full).toBeGreaterThan(40);
    // the floor's far edge against the sky carries the rest
    expect(onBox).toBeGreaterThan(30);
    // the box is turned: two of its sides are seen and meet in a fold
    expect(soft).toBeGreaterThan(5);
    expect(ink.filter((v) => v > 0).length).toBeLessThan(64 * 48 / 4);
  });

  it('ft_1_18.AC3 the lens wobbles slowly: a pixel looks a few pixels from where a still lens would, its neighbour nearly the same way, and a sprite\'s place is moved to match', () => {
    const still = { look: (x: number, y: number) => ({ x, y, z: 0 }) };
    let moved = 0;
    for (let i = 0; i < 300; i++) {
      const px = (i * 37) % 640, py = (i * 91) % 248;
      const seen = lensRay(still, px, py);
      const off = Math.hypot(seen.x - px - 0.5, seen.y - py - 0.5);
      expect(off).toBeLessThan(WOBBLE * 1.42);
      if (off > 1) moved++;
      // a line bows, it does not break: the next pixel is off by nearly as much
      const next = lensRay(still, px + 1, py);
      expect(Math.hypot(next.x - seen.x - 1, next.y - seen.y)).toBeLessThan(0.35);
      // what a still lens shows at (px, py) the wobbling lens shows at `lensPlace`: looking there finds it again, within a pixel
      const place = lensPlace(px, py);
      const back = lensRay(still, place.x - 0.5, place.y - 0.5);
      expect(Math.hypot(back.x - px, back.y - py)).toBeLessThan(1);
    }
    expect(moved).toBeGreaterThan(150);
  });

  it('ft_1_18.AC3 a colour goes to the nearest palette colour it is allowed, and a shade between two is dithered from both', () => {
    const palette = [0x000000, 0x202020, 0xe0e0e0, 0xff0000, 0x00ff00];
    const greys = new Reducer(palette, [1, 2]);
    expect(greys.nearest(250, 240, 200)).toBe(2);
    expect(greys.nearest(0, 0, 0)).toBe(1);
    expect(new Reducer(palette, [0, 1, 2, 3, 4]).nearest(250, 10, 10)).toBe(3);
    const used = (spread: number): number[] => {
      const set = new Set<number>();
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) set.add(greys.pixel(0.5, 0.5, 0.5, x, y, spread));
      return [...set].sort();
    };
    expect(used(0)).toHaveLength(1);
    expect(used(0.4)).toEqual([1, 2]);
    // out of range colours are held at the ends
    expect(greys.pixel(9, 9, 9, 0, 0, 0.1)).toBe(2);
    expect(greys.pixel(-9, -9, -9, 0, 0, 0.1)).toBe(1);
  });
});
