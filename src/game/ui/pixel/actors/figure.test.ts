import { describe, expect, it } from 'vitest';
import type { ActorState } from '../../../../core/scene/actor';
import { FEATURE_SET, generateFeatures, lookFromFeatures, SAMPLE_CHILDREN, SAMPLE_PEOPLE, unknownFeatures, type FeatureKey } from './features';
import { FIGURE_GRID, figureFrames, templateActorNumbers, type FigureFrame } from './figure';
import { BODY_A, BODY_CHILD } from './figureModel';
import { ghostly, ramp } from './ramps';
import { TEMPLATE_STATES } from './states';

/** The template character (WP-05, d142, d144): one body, drawn on MI2's grid, every look from features. */

const STATES = Object.keys(TEMPLATE_STATES) as ActorState[];
const opaque = (f: FigureFrame, x: number, y: number): boolean => f.rgba[(y * f.w + x) * 4 + 3]! > 0;

function box(f: FigureFrame): { minX: number; maxX: number; minY: number; maxY: number; count: number } {
  let minX = f.w, maxX = -1, minY = f.h, maxY = -1, count = 0;
  for (let y = 0; y < f.h; y++)
    for (let x = 0; x < f.w; x++)
      if (opaque(f, x, y)) {
        count++;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
  return { minX, maxX, minY, maxY, count };
}

/** Every block of the grid is one colour: the figure is cast at MI2's resolution, never finer. */
function onGrid(f: FigureFrame): boolean {
  const g = FIGURE_GRID;
  for (let y = 0; y < f.h; y++)
    for (let x = 0; x < f.w; x++) {
      const at = (y * f.w + x) * 4;
      const corner = (Math.floor(y / g) * g * f.w + Math.floor(x / g) * g) * 4;
      for (let c = 0; c < 4; c++) if (f.rgba[at + c] !== f.rgba[corner + c]) return false;
    }
  return true;
}

const same = (a: FigureFrame[], b: FigureFrame[]): boolean =>
  a.length === b.length && a.every((f, i) => Buffer.from(f.rgba).equals(Buffer.from(b[i]!.rgba)));

describe('the template character', () => {
  it('draws every sample person in every state on MI2\'s grid, standing at the anchor, clear of the frame\'s edge', () => {
    for (const { name, features } of SAMPLE_PEOPLE) {
      const numbers = templateActorNumbers(features);
      for (const state of STATES) {
        const frames = figureFrames(features, state);
        expect(frames.length, `${name} ${state}`).toBe(numbers.states[state].frames);
        for (const f of frames) {
          expect({ w: f.w, h: f.h }).toEqual(numbers.size);
          expect(f.anchor).toEqual(numbers.anchor);
          const b = box(f);
          expect(b.count, `${name} ${state}`).toBeGreaterThan(400);
          // the feet stand on the anchor's row (a ghost fades out above it)
          if (features.kind === 'ghost') expect(b.maxY).toBeLessThanOrEqual(f.anchor.y);
          else expect(b.maxY, `${name} ${state}`).toBe(f.anchor.y);
          expect(b.minX).toBeGreaterThanOrEqual(2);
          expect(b.minY).toBeGreaterThanOrEqual(2);
          expect(b.maxX).toBeLessThan(f.w - 2);
          expect(onGrid(f), `${name} ${state}`).toBe(true);
        }
      }
    }
  });

  it('is the same person, byte for byte, from the same features or the same seed', () => {
    const teacher = SAMPLE_PEOPLE[0]!.features;
    expect(same(figureFrames(teacher, 'talk'), figureFrames({ ...teacher }, 'talk'))).toBe(true);
    expect(generateFeatures('walker-7')).toEqual(generateFeatures('walker-7'));
    const people = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(generateFeatures(i))));
    expect(people.size).toBe(20);
  });

  it('draws every option of every feature, and each shape option changes the picture', () => {
    const plain = figureFrames({}, 'idle')[0]!;
    const shapes: FeatureKey[] = ['skin', 'hair', 'headwear', 'beard', 'nose', 'face', 'top', 'bottom', 'feet', 'neckwear', 'held', 'pocket', 'build', 'height', 'belly', 'stoop', 'kind', 'age'];
    for (const key of Object.keys(FEATURE_SET) as FeatureKey[])
      for (const value of FEATURE_SET[key] as readonly string[]) {
        const f = figureFrames({ [key]: value }, 'idle')[0]!;
        expect(box(f).count, `${key}: ${value}`).toBeGreaterThan(400);
        expect(onGrid(f)).toBe(true);
        const isDefault = Buffer.from(f.rgba).equals(Buffer.from(plain.rgba));
        if (shapes.includes(key) && JSON.stringify(lookFromFeatures({ [key]: value })) !== JSON.stringify(lookFromFeatures({})))
          expect(isDefault, `${key}: ${value}`).toBe(false);
      }
    // It paints every option of every feature: alone it takes seconds, but beside the picture tests on a busy runner it passed 30 s.
  }, 120_000);

  it('draws the defaults for an unknown feature and names it for a content check', () => {
    const odd = { hair: 'mohawk', wings: 'yes', top: 'coat' };
    expect(unknownFeatures(odd)).toEqual(['hair: mohawk', 'wings: yes']);
    expect(lookFromFeatures(odd).hair).toBe(lookFromFeatures({}).hair);
    expect(lookFromFeatures(odd).top).toBe('coat');
    expect(unknownFeatures(SAMPLE_PEOPLE[1]!.features as Record<string, string>)).toEqual([]);
  });

  it('generates islanders from the feature set, never a ghost, a held thing or a pocket', () => {
    for (let i = 0; i < 60; i++) {
      const f = generateFeatures(i);
      expect(unknownFeatures(f as Record<string, string>)).toEqual([]);
      expect(f.kind ?? 'living').toBe('living');
      expect(f.held ?? 'none').toBe('none');
      expect(f.pocket ?? 'none').toBe('none');
    }
  });

  it('plays only with an instrument; anyone else stays idle', () => {
    const visitor = SAMPLE_PEOPLE[3]!.features;
    const guard = SAMPLE_PEOPLE[1]!.features;
    expect(same(figureFrames(visitor, 'play'), figureFrames(visitor, 'idle'))).toBe(true);
    expect(templateActorNumbers(visitor).states.play).toEqual({ frames: 4, fps: TEMPLATE_STATES.idle.fps, loop: true });
    expect(templateActorNumbers(guard).states.play).toEqual({ frames: 4, fps: 4, loop: true });
    expect(same(figureFrames(guard, 'play'), figureFrames(guard, 'idle'))).toBe(false);
  });

  it('takes the scene\'s hour light, as the pictures do; a ghost keeps its own glow', () => {
    const farmer = SAMPLE_PEOPLE[5]!.features;
    const ghost = SAMPLE_PEOPLE[2]!.features;
    expect(same(figureFrames(farmer, 'idle', { hour: 'day' }), figureFrames(farmer, 'idle'))).toBe(true);
    const night = figureFrames(farmer, 'idle', { hour: 'night' })[0]!;
    expect(same([night], figureFrames(farmer, 'idle').slice(0, 1))).toBe(false);
    expect(box(night).count).toBe(box(figureFrames(farmer, 'idle')[0]!).count);
    expect(same(figureFrames(ghost, 'idle', { hour: 'night' }), figureFrames(ghost, 'idle'))).toBe(true);
  });

  it('draws the sample children in every state on MI2\'s grid, standing at the anchor, clear of the frame\'s edge (d154)', () => {
    for (const { name, features } of SAMPLE_CHILDREN) {
      expect(unknownFeatures(features as Record<string, string>), name).toEqual([]);
      const numbers = templateActorNumbers(features);
      for (const state of STATES)
        for (const f of figureFrames(features, state)) {
          expect({ w: f.w, h: f.h }).toEqual(numbers.size);
          const b = box(f);
          expect(b.count, `${name} ${state}`).toBeGreaterThan(250);
          expect(b.maxY, `${name} ${state}`).toBe(f.anchor.y);
          expect(b.minX).toBeGreaterThanOrEqual(2);
          expect(b.maxX).toBeLessThan(f.w - 2);
          expect(onGrid(f), `${name} ${state}`).toBe(true);
        }
    }
  });

  it('draws a child about two thirds of a grown-up\'s height, with a grown-up\'s head: about three heads tall (d154)', () => {
    const height = (features: Record<string, string>) => { const b = box(figureFrames(features, 'idle')[0]!); return b.maxY - b.minY + 1; };
    const ratio = height({ age: 'child' }) / height({});
    expect(ratio).toBeGreaterThan(0.6);
    expect(ratio).toBeLessThan(0.75);
    const heads = (body: typeof BODY_A) => (body.foot + body.leg + body.torso + body.neck + body.head) / body.head;
    expect(heads(BODY_CHILD)).toBeGreaterThan(2.9);
    expect(heads(BODY_CHILD)).toBeLessThan(3.4);
    expect(heads(BODY_A)).toBeGreaterThan(4.5);
    // the student's body by default, any body when asked
    expect(same(figureFrames({ age: 'child' }, 'idle'), figureFrames({ age: 'child' }, 'idle', { body: BODY_CHILD }))).toBe(true);
    expect(same(figureFrames({ age: 'child' }, 'idle'), figureFrames({ age: 'child' }, 'idle', { body: BODY_A }))).toBe(false);
  });

  it('gives a child a child\'s face: never a beard or a stoop, the same snub nose whatever the nose (d154)', () => {
    const child = { age: 'child' } as const;
    expect(same(figureFrames({ ...child, beard: 'full', stoop: 'stooped' }, 'idle'), figureFrames(child, 'idle'))).toBe(true);
    expect(same(figureFrames({ ...child, nose: 'hook' }, 'talk'), figureFrames({ ...child, nose: 'bulb' }, 'talk'))).toBe(true);
    // a grown-up on the student's body is not a child: the face is what tells them apart too
    expect(same(figureFrames(child, 'idle'), figureFrames({}, 'idle', { body: BODY_CHILD }))).toBe(false);
    expect(lookFromFeatures(child).child).toBe(true);
    expect(lookFromFeatures({}).child).toBe(false);
  });

  it('draws a striped top in rows of its trim, sleeves too, and a stocking cap past the back of the head (the student)', () => {
    const colours = (f: FigureFrame) => { const c = new Set<number>(); for (let i = 0; i < f.rgba.length; i += 4) if (f.rgba[i + 3]) c.add((f.rgba[i]! << 16) | (f.rgba[i + 1]! << 8) | f.rgba[i + 2]!); return c; };
    const trim = lookFromFeatures({ trimColour: 'navy' }).ramps.trim;
    const plain = colours(figureFrames({ top: 'shirt', topColour: 'sail', trimColour: 'navy' }, 'idle')[0]!);
    const striped = colours(figureFrames({ top: 'striped', topColour: 'sail', trimColour: 'navy' }, 'idle')[0]!);
    expect(trim.filter((c) => striped.has(c)).length).toBeGreaterThan(trim.filter((c) => plain.has(c)).length);
    const student = { age: 'child', headwear: 'stocking' } as const;
    const bare = box(figureFrames({ age: 'child' }, 'idle')[0]!);
    expect(box(figureFrames(student, 'idle')[0]!).minX).toBeLessThan(bare.minX);
  });

  it('is drawn at a standing place\'s size, never scaled as a bitmap, and stays clear of the edge', () => {
    const guard = SAMPLE_PEOPLE[1]!.features;
    const small = figureFrames(guard, 'idle', { scale: 0.5 })[0]!;
    const big = figureFrames(guard, 'walk', { scale: 1.5 })[2]!;
    const normal = figureFrames(guard, 'idle')[0]!;
    expect(small.h).toBeLessThan(normal.h);
    expect(big.h).toBeGreaterThan(normal.h);
    expect(templateActorNumbers(guard, 0.5).size).toEqual({ w: small.w, h: small.h });
    for (const f of [small, big]) {
      const b = box(f);
      expect(b.maxY).toBe(f.anchor.y);
      expect(b.minX).toBeGreaterThanOrEqual(2);
      expect(b.maxX).toBeLessThan(f.w - 2);
      expect(b.minY).toBeGreaterThanOrEqual(2);
      expect(onGrid(f)).toBe(true);
    }
  });
});

describe('the template\'s colour ramps', () => {
  const lightness = (c: number): number => Math.max((c >> 16) & 255, (c >> 8) & 255, c & 255) + Math.min((c >> 16) & 255, (c >> 8) & 255, c & 255);

  it('makes five tones round the mid, from deep to high', () => {
    const r = ramp(0x2c3a74);
    expect(r).toHaveLength(5);
    expect(r[2]).toBe(0x2c3a74);
    for (let i = 1; i < 5; i++) expect(lightness(r[i]!)).toBeGreaterThan(lightness(r[i - 1]!));
    expect(ramp(0x808080)[0]).not.toBe(0x808080);
  });

  it('turns any colour a ghost\'s pale sea-green', () => {
    for (const mid of [0xc8302a, 0x2c3a74, 0xe4a01c]) {
      const tone = ghostly(mid)[2];
      const [r, g, b] = [(tone >> 16) & 255, (tone >> 8) & 255, tone & 255];
      expect(g).toBeGreaterThan(r);
      expect(b).toBeGreaterThan(r);
    }
  });
});
