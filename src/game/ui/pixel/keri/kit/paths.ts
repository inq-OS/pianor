import { clamp01, smoothstep as smooth } from '../../paint/ease';
import { fbm, hash2, noise2 } from '../../paint/noise';
import { runOf, type KitBrush, type KitFill } from './kit';
import { fleck } from './shape';

/**
 * Paths: the family's types, both fills (a path lies on the scene's ground and the grass grows up to it). The looks are
 * the picked ones, cobbled slabs plus earth trails: slab paths after the Phatt cottage's cobbles
 * (mi2-bg-2-038), footpaths after the Booty hut's sand (mi2-bg-1-051); Keri keeps its concrete, painted worn. The
 * crossroads was the first painted to them and they are lifted from it; both are `candidate` until the
 * maintainer has seen them beside the two rooms. The recipe in words: `projects/painter/artists-notes/paths.md`.
 *
 * A path's ground is the scene's answer about where the path runs, in its own terms: a slab path as cross-sections
 * along it (how far along, how wide, how many pixels to a metre there), a trail pixel by pixel (how far off its middle,
 * how far from its end). The scene keeps where its paths run; the kit keeps how a path looks.
 */

const MODEL = 'the crossroads (crossroadsPicture.ts), painted to the picked look: cobbled slabs plus earth trails';

/** What every path asks of the scene's ground: what is laid where already, so a seam keeps its line and the grass knows where to stop. */
export interface PathGround {
  /** The region's columns, 0 to `width` - 1, and its rows, 0 to `height` - 1. */
  width: number;
  height: number;
  /** What a path laid at a pixel: 0 nothing, 1 its surface, 2 a seam between slabs or a trail's ragged edge. */
  laid(x: number, y: number): number;
  lay(x: number, y: number, what: 1 | 2): void;
}

/** One cross-section of a slab path, from its left edge to its right one. */
export interface PathSection {
  /** Its two edges on the picture, in fine pixels. */
  left: { x: number; y: number };
  right: { x: number; y: number };
  /** How far along the path it lies (metres from its start), how wide the path is there (metres), and how many pixels a metre is there. */
  along: number;
  wide: number;
  perM: number;
  /** Tells one path's slabs from another's (a small whole number, the same for the whole path). */
  path: number;
}

/** The ground of a slab path. */
export interface SlabGround extends PathGround {
  /** The paths' cross-sections, far to near, close enough together that no row is missed. */
  sections: readonly PathSection[];
  /** Whether a slab may be laid at a pixel: inside the picture, on the land (not the sky, not the sea). */
  open(x: number, y: number): boolean;
}

/** Where a pixel lies on a trail. */
export interface TrailPlace {
  /** How far it lies from the trail's middle line, in metres, and on which side of it (1 the right, -1 the left, walking away from the viewer). */
  off: number;
  side: number;
  /** How far the trail runs on beyond it, in metres: it fades out over its last metres. */
  toEnd: number;
  /** The ground under it, in metres (across and ahead), so the trail's ragged edge stays put on the ground and does not crawl with the picture. */
  gx: number;
  gz: number;
}

/** The ground of a trail. */
export interface TrailGround extends PathGround {
  /** Where a pixel lies on a trail; null where none comes near, and off the land. */
  place(x: number, y: number): TrailPlace | null;
}

/** A plain ground for the sheet and the tests: a flat field seen from a standing eye, the path running away up it in a gentle bend. */
function fieldPatch(width: number, height: number): PathGround & { lens: number; horizon: number; eye: number; zOf: (y: number) => number; middle: (z: number) => number; far: number } {
  const laid = new Uint8Array(width * height);
  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height;
  const lens = width * 0.9, horizon = -0.35 * height, eye = 1.5;
  const zOf = (y: number): number => (lens * eye) / (y - horizon);
  return {
    width,
    height,
    lens,
    horizon,
    eye,
    zOf,
    far: zOf(0),
    middle: (z) => 0.25 * Math.sin(z * 0.5) - 0.1,
    laid: (x, y) => (inside(x, y) ? laid[y * width + x]! : 0),
    lay: (x, y, what) => { if (inside(x, y)) laid[y * width + x] = what; },
  };
}

export function slabPatch(width: number, height: number): SlabGround {
  const f = fieldPatch(width, height);
  const wide = 1;
  const at = (gx: number, z: number): { x: number; y: number } => ({ x: width / 2 + (f.lens * gx) / z, y: f.horizon + (f.lens * f.eye) / z });
  const sections: PathSection[] = [];
  const near = f.zOf(height + 2);
  for (let along = 0; near + along < f.far + 1; along += 0.012) {
    const z = near + along, mid = f.middle(z);
    sections.push({ left: at(mid - wide / 2, z), right: at(mid + wide / 2, z), along, wide, perM: f.lens / z, path: 1 });
  }
  sections.reverse();
  return { ...f, sections, open: (x, y) => x >= 0 && y >= 0 && x < width && y < height };
}

export function trailPatch(width: number, height: number): TrailGround {
  const f = fieldPatch(width, height);
  return {
    ...f,
    place(x, y) {
      if (y < 0 || y >= height) return null;
      const gz = f.zOf(y), gx = ((x - width / 2) * gz) / f.lens, from = gx - f.middle(gz);
      const off = Math.abs(from);
      return off > 0.7 ? null : { off, side: from > 0 ? 1 : -1, toEnd: f.far - gz + 3, gx, gz };
    },
  };
}

export interface SlabsOptions {
  /** A slab's length along the path, in metres. */
  long: number;
  /** How round its corners are, in metres. */
  round: number;
}

/** The concrete's run, dark to light: the seams' grey, the stone's greys through its body and the smoke's cool pale at its light end. */
export function concrete(b: KitBrush): readonly number[] {
  const stone = runOf(b.fine, 'stone', slabs.id), smoke = runOf(b.fine, 'smoke', slabs.id);
  return [stone[3]!, stone[6]!, stone[7]!, stone[8]!, stone[9]!, smoke[5]!, smoke[6]!];
}

/**
 * A path of concrete slabs, Keri's, painted as the Phatt cottage's cobbles: each slab its own stone, a little narrower
 * than the path on either side, its corners rounded; a tone off its neighbours, mottled in flat blotches, lighter in its
 * middle, toward its far end and on its sunny side, darker along its near edge and sides; a sunk one darker all over. Dark
 * seams one or two pixels wide between the slabs with moss in a few, a crack across some, moss on a worn slab's top.
 */
export const slabs: KitFill<SlabsOptions, SlabGround> = {
  id: 'paths/slabs',
  family: 'paths',
  about: 'Keri\'s concrete slab path as cobbles: each slab its own mottled stone, rounded, dark seams with moss, cracks',
  state: 'candidate',
  model: `${MODEL} (slabs after mi2-bg-2-038)`,
  note: 'paths.md',
  atlas: 'cottage, path, town,day',
  uses: ['stone', 'smoke', 'far', 'grass'],
  options: { long: 1.3, round: 0.22 },
  variants: { worn: {} },
  sample: (_o, width, height) => slabPatch(width, height),
  paint(b, ground, o, seed) {
    const run = concrete(b), far = runOf(b.run, 'far', slabs.id), grass = runOf(b.run, 'grass', slabs.id);
    const SLAB = o.long;
    for (const sec of ground.sections) {
      const p = sec.path + seed, s0 = sec.along;
      // slabs of uneven lengths: the seams are not evenly spaced
      const s = s0 + 0.3 * Math.sin(s0 * 1.3 + p) + 0.15 * Math.sin(s0 * 2.9 + p * 2);
      const slab = Math.floor(s / SLAB + 0.3 * hash2(Math.floor(s / SLAB), p, 71));
      const into = s / SLAB - Math.floor(s / SLAB);
      const tilt = (hash2(slab, p, 72) - 0.5) * 0.08;
      const { left: pa, right: pb } = sec;
      const n = Math.ceil(Math.hypot(pb.x - pa.x, pb.y - pa.y) * 1.6) + 1;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const x = Math.round(pa.x + (pb.x - pa.x) * u), y = Math.round(pa.y + (pb.y - pa.y) * u + tilt * (u - 0.5) * 4);
        if (!ground.open(x, y)) continue;
        // each slab its own stone: a little narrower than the path on either side, its corners rounded
        const id = hash2(slab, p, 81);
        const inL = 0.04 + 0.16 * hash2(slab, p, 82), inR = 0.04 + 0.16 * hash2(slab, p, 83);
        const fromEdge = Math.min(u - inL, 1 - inR - u) * sec.wide;
        if (fromEdge < 0.04 * fbm(s * 3, u * 2 + p, 2, 73)) continue;
        const along = Math.min(into, 1 - into) * SLAB, round = o.round;
        if (fromEdge < round && along < round && Math.hypot(round - fromEdge, round - along) > round) continue;
        // the seam between two slabs: one or two pixels, in the run's dark grey
        const seam = along < Math.max(0.012, 1.1 / sec.perM);
        // one crack across some slabs, from one edge to the other, a little crooked
        const c0 = hash2(slab, p, 77), c1 = hash2(slab, p, 78);
        const crackAt = c0 * 0.7 + 0.15 + (c1 - 0.5) * 0.6 * u + (noise2(u * 6, slab, 79) - 0.5) * 0.08;
        const crack = hash2(slab, p, 80) > 0.55 && Math.abs(into - crackAt) < 0.45 / (sec.perM * SLAB);
        const worn = fbm(u * 4 + slab, s * 2.4, 2, 75);
        // mottled: each slab a tone off its neighbours, lighter in its middle and toward its far edge, darker along its
        // near edge and its sides, in blotches a few pixels across; a sunk one darker all over; its sunny side lighter
        const tip = (hash2(slab, p, 74) - 0.5) * 0.3;
        const blotch = Math.round((fbm(x / 7, y / 3.2, 2, 84) - 0.5) * 4) / 4;
        const sunk = id > 0.86 ? 0.2 : 0;
        const sun = (b.side / 1.5) * (u - 0.5);
        const t = clamp01(0.62 + (id - 0.5) * 0.45 + (into - 0.5) * 0.24 - (into < 0.18 ? 0.14 : 0) - (fromEdge < 0.12 ? 0.16 : 0) + blotch * 0.5 + (worn - 0.5) * 0.2 + (sun + tip) * 0.35 - sunk);
        // a seam keeps its line: a nearer step of the same slab does not paint over it
        if (!seam && ground.laid(x, y) === 2 && Math.abs(into - 0.5) > 0.4) continue;
        b.put(x, y, seam ? run[0]! : crack ? run[1]! : fleck(run, run[1 + Math.round(t * (run.length - 2))]!, x, y, 0.05));
        ground.lay(x, y, seam ? 2 : 1);
        // moss in a few seams, and on the far slabs' worn tops in patches
        if (seam && hash2(x, y, 85) > 0.86) b.put(x, y, hash2(x, y, 86) > 0.5 ? far[1]! : grass[2]!);
        if (!seam && worn < 0.24 && hash2(x, y, 76) > 0.5) b.put(x, y, far[1]!);
      }
    }
  },
};

export interface TrailOptions {
  /** Half its width, in metres, before its edge breaks into the grass. */
  half: number;
  /** How many of the pixels along its right edge are small stones, 0 to 1. */
  pebbles: number;
}

/**
 * The trail's sand and earth, dark to light: the earth, the rust, the earth's light, then the pale sand from the smoke's
 * and the shingle's warm pales, as the Booty hut's sand is cream more than tan.
 */
export function sand(b: KitBrush): readonly number[] {
  const earth = runOf(b.fine, 'earth', trail.id), bloom = runOf(b.run, 'bloom', trail.id), smoke = runOf(b.fine, 'smoke', trail.id), shingle = runOf(b.fine, 'shingle', trail.id);
  return [earth[4]!, bloom[2]!, earth[6]!, smoke[1]!, smoke[3]!, smoke[4]!, shingle[7]!, shingle[8]!];
}

/**
 * A trodden earth footpath, as the Booty hut's sandy path: warm blotches of sand and earth, pale where feet go and
 * darker and redder toward its edges, rust and ochre patches, darker crumbs and lighter grains here and there, small
 * grey stones along its right edge; it breaks into the grass in patches at its far end and along its edges.
 */
export const trail: KitFill<TrailOptions, TrailGround> = {
  id: 'paths/trail',
  family: 'paths',
  about: 'a trodden footpath as sand: warm blotches, pale where feet go, rust and ochre patches, stones along an edge',
  state: 'candidate',
  model: `${MODEL} (footpaths after mi2-bg-1-051)`,
  note: 'paths.md',
  atlas: 'booty,hut, dinky,path, mansion,outdoor',
  uses: ['earth', 'bloom', 'smoke', 'shingle', 'dry', 'stone'],
  options: { half: 0.4, pebbles: 0.3 },
  variants: { footpath: {} },
  sample: (_o, width, height) => trailPatch(width, height),
  paint(b, ground, o, seed) {
    const run = sand(b), dry = runOf(b.fine, 'dry', trail.id), stone = runOf(b.fine, 'stone', trail.id);
    const ochre = [run[1]!, dry[2]!, dry[4]!];
    const k = o.half / 0.4;
    for (let y = 0; y < ground.height; y++) for (let x = 0; x < ground.width; x++) {
      const at = ground.place(x, y);
      if (!at) continue;
      const d = (at.off - 0.18 * noise2(at.gx * 2, at.gz * 2, 418 + seed)) / k;
      if (d > 0.4) continue;
      // it fades into the grass in broken patches toward its far end, and at its edges
      const end = smooth(14, 0, at.toEnd);
      if (fbm(x / 6, y / 3, 2, 420 + seed) < end * 0.9 + smooth(0.28, 0.4, d) * 0.4) continue;
      // warm blotches: pale where feet go, darker and redder at the edges, patches of a few pixels, never stripes
      const blotch = Math.round((fbm(x / 5, y / 2.6, 2, 419 + seed) - 0.5) * 4) / 4;
      const t = clamp01(0.9 - d * 1.5 + blotch * 0.55);
      let c = run[Math.round(t * (run.length - 1))]!;
      if (fbm(x / 7 + 3, y / 3, 2, 424 + seed) > 0.57) c = ochre[Math.min(2, Math.round(t * 2.4))]!;
      // crumbs: a darker pebble or a lighter grain here and there, and small stones along its right edge
      const crumb = hash2(x, y, 421 + seed);
      if (crumb < 0.025) c = run[1]!;
      else if (crumb > 0.975) c = run[run.length - 1]!;
      if (d > 0.27 && at.side > 0 && hash2(x >> 1, y, 422 + seed) < o.pebbles) c = hash2(x, y, 423 + seed) > 0.5 ? stone[8]! : stone[7]!;
      b.put(x, y, c);
      ground.lay(x, y, d < 0.2 ? 1 : 2);
    }
  },
};
