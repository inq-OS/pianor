/**
 * The template character (WP-05, d142, d144): one body, every person in the game. A person is the body with chosen
 * layers (hair, headwear, beard, nose, top, bottom, feet, neckwear, a held thing, a pocket) and colour ramps, in a pose.
 * The body is a puppet: a few joints (arms and legs by two-bone IK), each layer a few simple shapes (capsules, ellipses,
 * polygons) in fine pixels. It is cast to pixels the way the 1991 game's people are drawn: sampled on MI2's own grid
 * (2 x 2 fine pixels, locked in), no line round the figure, flat bands of a material's own
 * tones lit from the upper front, the shaded edge in its darkest tone, a contact shadow where one thing lies on another,
 * and a face set by hand (one pixel for an eye, one for a mouth).
 *
 * Pure TypeScript (no Phaser, no DOM). The numbers were set by eye in review (passes in projects/painter/notes/
 * characters.md); change one and look at the sheet: `npm run art:render -- figures`.
 */
/** A point in fine pixels: x toward where the figure faces, y up, the feet on y = 0. */
export type P = [number, number];
/** deep (the shaded edge), dark, mid, light, high */
export type Ramp = readonly [number, number, number, number, number];

type Clip = (x: number, y: number) => boolean;
interface Base {
  z: number;
  mat: Mat;
  clip?: Clip;
  /** a fixed band */
  band?: number;
  /** move the band by this many tones (the far limbs lie in shade) */
  shift?: number;
  /** may show the highest tone */
  gloss?: boolean;
  /** no contact shadow cast onto this shape */
  flatContact?: boolean;
}
type Shape =
  | (Base & { kind: 'cap'; a: P; b: P; r1: number; r2: number })
  | (Base & { kind: 'ell'; c: P; rx: number; ry: number })
  | (Base & { kind: 'poly'; pts: P[] });
type Mat = 'skin' | 'hair' | 'top' | 'bottom' | 'feet' | 'accent' | 'held' | 'trim' | 'legwear';

export interface Body {
  head: number;
  neck: number;
  torso: number;
  leg: number;
  foot: number;
  shoulder: number;
  hip: number;
  upperArm: number;
  foreArm: number;
  hand: number;
  thigh: number;
  arm: number;
  footLen: number;
  headW: number;
}
/** Body A, the picked one: about five heads, as the 1991 game's people. */
export const BODY_A: Body = { head: 18, neck: 2.5, torso: 26, leg: 36, foot: 3.5, shoulder: 21, hip: 16, upperArm: 14, foreArm: 13, hand: 3.2, thigh: 4.2, arm: 3.2, footLen: 11, headW: 0.82 };
/**
 * The student's body, pick A for the student (d154): about three heads and two thirds of body A's
 * height, as a young student beside a grown-up; the head as big as a grown-up's and rounder, almost no neck, short limbs.
 */
export const BODY_CHILD: Body = { head: 18, neck: 0.5, torso: 16, leg: 20, foot: 3, shoulder: 14, hip: 12, upperArm: 9, foreArm: 8.5, hand: 2.7, thigh: 3.3, arm: 2.6, footLen: 8.5, headW: 0.98 };

export interface Look {
  name: string;
  ramps: Record<'skin' | 'hair' | 'top' | 'bottom' | 'feet' | 'accent' | 'held' | 'trim', Ramp>;
  hair: 'none' | 'short' | 'bun' | 'long' | 'bald' | 'curly';
  headwear: 'none' | 'cap' | 'brimhat' | 'beanie' | 'stocking';
  beard: 'none' | 'full' | 'moustache';
  nose: 'button' | 'long' | 'hook' | 'bulb';
  top: 'shirt' | 'coat' | 'longcoat' | 'jacket' | 'sweater' | 'vest' | 'striped';
  bottom: 'trousers' | 'skirt' | 'longskirt';
  feet: 'boots' | 'shoes';
  neckwear: 'none' | 'scarf';
  held: 'none' | 'folder' | 'sax' | 'lantern';
  /** girth: 0.85 thin to 1.3 stout */
  build?: number;
  /** height: 0.9 short to 1.08 tall (legs and torso) */
  tall?: number;
  /** a belly, 0 to 1 */
  belly?: number;
  /** a stoop, 0 to 1 */
  stoop?: number;
  /** what peeks out of a pocket */
  pocket?: 'none' | 'metronome';
  lips?: boolean;
  ghost?: boolean;
  /** a child's face (d154): a snub nose whatever `nose` says, the face set low under a big skull, a rosy cheek */
  child?: boolean;
}

export interface Hand {
  /** where the hand is, relative to its shoulder; undefined hangs it */
  at?: P;
  /** the elbow bends back (-1) or forward (1) */
  bend?: number;
}
export interface Pose {
  bob?: number;
  lean?: number;
  headFwd?: number;
  headDy?: number;
  near?: Hand;
  far?: Hand;
  /** the ankles, relative to the hip's middle */
  nearFoot?: P;
  farFoot?: P;
  /** the toe of a foot lifted off the ground, for walking */
  nearToe?: number;
  farToe?: number;
  mouth?: 'shut' | 'open' | 'round';
  eyes?: 'open' | 'shut' | 'down';
  brows?: 'flat' | 'up';
  /** how the held thing sits: 'play' for an instrument at the mouth */
  holding?: 'carry' | 'play';
  sway?: number;
  /** hands clasped in front (listening) */
  clasp?: boolean;
}

const INK = 0x1a100c;
const MOUTH = 0x4a1612;
const LIPS = 0xa83a34;
/** A child's rosy cheek: one pixel under and behind the eye. */
const CHEEK = 0xe0806a;

function inPoly(x: number, y: number, pts: P[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!;
    const [xj, yj] = pts[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** Where the light comes from: above and in front of a figure facing right. */
const LV: readonly [number, number, number] = (() => {
  const n = Math.hypot(0.38, 0.62, 0.62);
  return [0.38 / n, 0.62 / n, 0.62 / n] as const;
})();
function lit(nx: number, ny: number): number {
  const d = nx * nx + ny * ny;
  const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, d)));
  return nx * LV[0] + ny * LV[1] + nz * LV[2];
}
function hit(s: Shape, x: number, y: number): number | null {
  if (s.clip && !s.clip(x, y)) return null;
  if (s.kind === 'cap') {
    const dx = s.b[0] - s.a[0];
    const dy = s.b[1] - s.a[1];
    const l2 = dx * dx + dy * dy || 1e-6;
    const t = Math.max(0, Math.min(1, ((x - s.a[0]) * dx + (y - s.a[1]) * dy) / l2));
    const ox = x - (s.a[0] + t * dx);
    const oy = y - (s.a[1] + t * dy);
    const r = s.r1 + (s.r2 - s.r1) * t;
    const d = Math.hypot(ox, oy);
    return d > r ? null : lit(ox / r, oy / r);
  }
  if (s.kind === 'ell') {
    const ox = (x - s.c[0]) / s.rx;
    const oy = (y - s.c[1]) / s.ry;
    return ox * ox + oy * oy > 1 ? null : lit(ox, oy);
  }
  if (!inPoly(x, y, s.pts)) return null;
  let lo = x;
  let hi = x;
  while (lo > x - 40 && inPoly(lo - 0.5, y, s.pts)) lo -= 0.5;
  while (hi < x + 40 && inPoly(hi + 0.5, y, s.pts)) hi += 0.5;
  const u = hi > lo ? ((x - lo) / (hi - lo)) * 2 - 1 : 0;
  return lit(u * 0.92, 0.1);
}
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function ik(S: P, T: P, l1: number, l2: number, bend: number): { e: P; w: P } {
  const dx = T[0] - S[0];
  const dy = T[1] - S[1];
  const d = Math.max(0.5, Math.min(Math.hypot(dx, dy), l1 + l2 - 0.05));
  const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const th = Math.atan2(dy, dx) + bend * a;
  const e: P = [S[0] + l1 * Math.cos(th), S[1] + l1 * Math.sin(th)];
  const t2 = Math.atan2(T[1] - e[1], T[0] - e[0]);
  return { e, w: [e[0] + l2 * Math.cos(t2), e[1] + l2 * Math.sin(t2)] };
}
const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export interface Figure {
  w: number;
  h: number;
  rgba: Uint8Array;
  ox: number;
  oy: number;
}

type Put = (px: number, py: number, c: number, a?: number) => void;

function rigOf(B0: Body, k: Look, pose: Pose, g: number) {
  const b = k.build ?? 1;
  const tall = k.tall ?? 1;
  const B: Body = { ...B0, leg: B0.leg * tall, torso: B0.torso * (0.5 + tall * 0.5) };
  const stoop = k.stoop ?? 0;
  // geometry is in fine pixels; it is sampled on a grid of g x g fine pixels (2: MI2's own 320-wide grid)
  // the frame grows with the body's size (`StandingPlace.scale`), on whole grid blocks, with a margin for the held
  // things, which keep their size; 72 x 104 at size 1
  const size = B0.head / BODY_A.head;
  const W = Math.ceil((56 * size + 16) / g) * g;
  const H = Math.ceil((96 * size + 8) / g) * g;
  const ox = Math.round(26 * size + 8);
  const oy = H - 3;
  const w = W / g;
  const h = H / g;
  const shapes: Shape[] = [];
  const add = (s: Shape): void => void shapes.push(s);

  const bob = pose.bob ?? 0;
  const lean = (pose.lean ?? 0.6) + stoop * 2.5;
  const hipY = B.foot + B.leg + bob;
  const shY = hipY + B.torso;
  const sx = (y: number) => lean * Math.max(0, (y - hipY) / B.torso); // the torso's lean at height y
  const sh = (B.shoulder * b) / 2;
  const hp = (B.hip * b) / 2;
  const waistY = hipY + B.torso * 0.36;
  const neckTop: P = [sx(shY) * 1.25 + 0.6, shY + B.neck];
  const hr = B.head / 2;
  const hw = hr * B.headW;
  const head: P = [neckTop[0] + (pose.headFwd ?? 0.6) + stoop * 1.8, neckTop[1] + hr - 1.5 + (pose.headDy ?? 0) - stoop * 1.4];

  const skirt = k.bottom !== 'trousers';
  const legMat: Mat = skirt ? 'legwear' : 'bottom';
  const T = (x: number, y: number): P => [x + sx(y), y];
  const coat = k.top === 'coat' || k.top === 'longcoat';
  const topMat: Mat = k.top === 'vest' ? 'accent' : 'top';
  // --- the held thing's place, so the hands can find it
  const playing = pose.holding === 'play';
  const sway = pose.sway ?? 0;
  const mouth: P = [head[0] + hw * 0.66, head[1] - hr * 0.58];
  const sxN: P = [mouth[0] + 2.6, mouth[1] - 2.8];
  const sxB: P = [hp * 0.7 + 3 + sway, hipY + 3];
  const sxU: P = [hp * 0.7 + 4 + sway, hipY - 3.5];
  const sxBell: P = [hp * 0.7 + 9.5 + sway * 1.5, hipY + 4.5];

  return { B, k, pose, g, b, stoop, lean, hipY, shY, sx, sh, hp, waistY, neckTop, hr, hw, head, skirt, legMat, T, coat, topMat, playing, sway, mouth, sxN, sxB, sxU, sxBell, add, shapes, w, h, ox, oy };
}
type Rig = ReturnType<typeof rigOf>;

function legShapes(r: Rig): void {
  const { B, k, pose, b, hipY, legMat, add } = r;
  // --- legs (IK, knees forward), with boots or shoes
  const legs = [
    { key: 'far', hipAt: [-2.3 * b, hipY] as P, foot: pose.farFoot ?? ([-4.6 * b, 0] as P), toe: pose.farToe ?? 0, z: 1, shift: -1 },
    { key: 'near', hipAt: [2.4 * b, hipY] as P, foot: pose.nearFoot ?? ([5.4 * b, 0] as P), toe: pose.nearToe ?? 0, z: 3, shift: 0 },
  ];
  for (const l of legs) {
    const ankle: P = [l.foot[0], B.foot + 0.5 + l.foot[1]];
    const { e: knee } = ik(l.hipAt, ankle, B.leg * 0.5, B.leg * 0.5 - 0.5, 1);
    add({ kind: 'cap', z: l.z, mat: legMat, shift: l.shift, a: l.hipAt, b: knee, r1: B.thigh * b, r2: B.thigh * 0.78 });
    add({ kind: 'cap', z: l.z, mat: legMat, shift: l.shift, a: knee, b: ankle, r1: B.thigh * 0.78, r2: B.thigh * 0.6 });
    const gy = l.foot[1];
    const lift = l.toe;
    const fl = k.feet === 'boots' ? B.footLen : B.footLen * 0.8;
    // the foot: heel at the ankle, toe forward; a lifted toe tips it up
    add({ kind: 'poly', z: l.z + 0.4, mat: 'feet', shift: l.shift, gloss: true, pts: [
      [ankle[0] - 2.6, gy + 3.4], [ankle[0] + 1.8, gy + 3.6], [ankle[0] + fl * 0.72, gy + 2 + lift], [ankle[0] + fl * 0.8, gy + 0.2 + lift],
      [ankle[0] + fl * 0.5, gy + lift * 0.6], [ankle[0] - 2.8, gy],
    ] });
    if (k.feet === 'boots') {
      const top = lerp(ankle, knee, 0.42);
      add({ kind: 'cap', z: l.z + 0.5, mat: 'feet', shift: l.shift, gloss: true, a: ankle, b: top, r1: B.thigh * 0.82, r2: B.thigh * 0.95 });
      // the boot's turned-down cuff
      add({ kind: 'cap', z: l.z + 0.6, mat: 'feet', shift: l.shift, band: 3 + l.shift, a: [top[0] - B.thigh * 1.05, top[1] - 0.2], b: [top[0] + B.thigh * 1.05, top[1] + 0.3], r1: 1.1, r2: 1.1 });
    }
  }

}

function bodyShapes(r: Rig): void {
  const { B, k, b, hipY, shY, sh, hp, waistY, skirt, T, topMat, add } = r;
  // --- torso, leaning
  const torso: P[] = [
    T(-sh * 0.42, shY + 0.7), T(-sh * 0.92, shY - 2.0), T(-sh * 0.9, shY - 6), T(-hp * 0.98, waistY), T(-hp * 1.04, hipY - 1),
    T(hp * 1.04, hipY - 1), T(hp * 1.0 + (b - 1) * 5, waistY - 1), T(sh * 0.84 + (b - 1) * 2, shY - 6.5), T(sh * 0.96, shY - 2.2),
    T(sh * 0.5, shY + 1),
  ];
  add({ kind: 'poly', z: 4, mat: topMat, pts: torso });
  if (k.top === 'vest') {
    add({ kind: 'poly', z: 4.2, mat: 'top', pts: [T(-sh * 0.9, shY - 2.5), T(sh * 0.15, shY - 1), T(sh * 0.45, waistY - 2), T(hp * 0.7, hipY + 1), T(-hp * 1.04, hipY - 0.5), T(-hp * 0.98, waistY)] });
    add({ kind: 'cap', z: 4.3, mat: 'trim', band: 3, a: T(hp * 0.55, hipY + 3.5), b: T(hp * 0.55, shY - 6), r1: 0.45, r2: 0.45 });
  }
  if ((k.belly ?? 0) > 0) {
    const be = k.belly ?? 0;
    add({ kind: 'ell', z: 4.05, mat: topMat, c: T(hp * 0.55, waistY - 2.5), rx: hp * 0.75 + be * 2.5, ry: 4 + be * 2.2 });
  }
  if (!skirt) {
    add({ kind: 'poly', z: 4.1, mat: 'bottom', pts: [T(-hp * 1.04, hipY + 2.5), T(hp * 1.04, hipY + 2.5), T(hp * 1.08, hipY - 3), T(-hp * 1.08, hipY - 3)] });
  } else {
    const hem = k.bottom === 'skirt' ? B.foot + B.leg * 0.4 : B.foot + 5;
    add({ kind: 'poly', z: 4.1, mat: 'bottom', pts: [T(-hp * 1.05, hipY + 3), T(hp * 1.05, hipY + 3), [hp + 4.5, hem + 1], [hp + 3, hem - 0.5], [-hp - 2.5, hem - 0.5], [-hp - 3.2, hem + 1]] });
    // folds
    for (const f of [-0.35, 0.3, 0.75]) add({ kind: 'cap', z: 4.15, mat: 'bottom', band: 1, a: [hp * f, hipY - 3], b: [hp * f * 1.4 + 0.8, hem + 1], r1: 0.4, r2: 0.6 });
  }
}

function topShapes(r: Rig): void {
  const { B, k, hipY, shY, sh, hp, waistY, skirt, T, coat, add } = r;
  if (k.top === 'shirt' || k.top === 'vest' || k.top === 'jacket' || k.top === 'sweater' || k.top === 'striped') {
    // belt
    if (!skirt || k.top !== 'sweater') add({ kind: 'cap', z: 4.5, mat: 'trim', a: T(-hp * 1.04, hipY + 1.6), b: T(hp * 1.06, hipY + 1.6), r1: 1.0, r2: 1.0 });
    add({ kind: 'ell', z: 4.6, mat: 'held', gloss: true, c: T(hp * 0.55, hipY + 1.6), rx: 1.3, ry: 1.2 });
  }
  if (k.top === 'sweater') add({ kind: 'cap', z: 4.4, mat: 'top', band: 1, a: T(-hp * 1.05, hipY + 0.5), b: T(hp * 1.08, hipY + 0.5), r1: 1.3, r2: 1.3 });
  if (k.top === 'jacket') {
    add({ kind: 'poly', z: 4.3, mat: 'top', pts: [T(-hp - 1, hipY + 3), T(hp + 1.4, hipY + 3), [hp + 2.2, hipY - 4.5], [-hp - 1.6, hipY - 4.5]] });
    add({ kind: 'poly', z: 4.35, mat: 'accent', pts: [T(sh * 0.2, shY - 0.5), T(sh * 0.62, shY - 1), T(hp * 0.92, waistY - 3), T(hp * 0.62, hipY - 4), T(hp * 0.36, hipY - 4)] });
    add({ kind: 'cap', z: 4.36, mat: 'top', band: 3, a: T(sh * 0.62, shY - 1.2), b: T(hp * 0.95, hipY - 4), r1: 0.5, r2: 0.5 });
    for (let i = 0; i < 3; i++) add({ kind: 'ell', z: 4.4, mat: 'held', gloss: true, c: T(hp * 0.25, shY - 5 - i * 5), rx: 0.6, ry: 0.6 });
  }
  if (coat) {
    const hem = k.top === 'longcoat' ? B.foot + B.leg * 0.25 : B.foot + B.leg * 0.48;
    add({ kind: 'poly', z: 4.3, mat: 'top', pts: [T(-hp - 0.8, hipY + 3), T(hp + 1, hipY + 3), [hp + 5.5, hem + 1.5], [hp + 3.5, hem], [-hp - 1, hem - 0.6], [-hp - 4, hem + 1]] });
    // the open front: the lining in the accent, the lit edge of the lapel, buttons
    add({ kind: 'poly', z: 4.35, mat: 'accent', pts: [T(sh * 0.22, shY - 0.2), T(sh * 0.55, shY - 0.5), T(hp * 0.78, waistY - 4), T(hp * 0.85, hipY), [hp + 2.4, hem + 3], [hp + 1.2, hem + 3], T(hp * 0.45, hipY), T(hp * 0.32, waistY - 3)] });
    add({ kind: 'cap', z: 4.37, mat: 'top', band: 3, a: T(sh * 0.58, shY - 0.6), b: T(hp * 0.92, waistY - 4), r1: 0.6, r2: 0.6 });
    add({ kind: 'cap', z: 4.37, mat: 'top', band: 3, a: T(hp * 0.92, waistY - 4), b: [hp + 3.3, hem + 2], r1: 0.5, r2: 0.5 });
    for (let i = 0; i < 3; i++) add({ kind: 'ell', z: 4.4, mat: 'held', gloss: true, c: T(hp * 0.2, shY - 6 - i * 5), rx: 0.6, ry: 0.6 });
    for (const f of [-0.5, 0.15]) add({ kind: 'cap', z: 4.36, mat: 'top', band: 1, a: [hp * f, hipY - 2], b: [hp * f * 1.5 - 0.4, hem + 1.5], r1: 0.4, r2: 0.6 });
  }

}

/** How far a child's eye, nose and mouth sit below a grown-up's, in head radii. */
const CHILD_FACE_LOW = 0.2;
/** A child's snub nose: short, one block past the face so the head shows which way it looks. */
const CHILD_NOSE = { len: 1.1, drop: 1.9, tip: 1.3 };

function headShapes(r: Rig): P {
  const { k, g, b, shY, neckTop, hr, hw, head, add } = r;
  // --- neck, head, face shapes
  add({ kind: 'cap', z: 5, mat: 'skin', a: [neckTop[0] - 0.6, shY - 1], b: [neckTop[0] - 0.2, neckTop[1] + 1.5], r1: 2.0 * Math.min(b, 1.2), r2: 1.8 });
  add({ kind: 'ell', z: 6, mat: 'skin', gloss: true, c: head, rx: hw, ry: hr });
  add({ kind: 'ell', z: 6.05, mat: 'skin', gloss: true, c: [head[0] + hw * 0.22, head[1] - hr * 0.42], rx: hw * 0.66, ry: hr * 0.52 });
  add({ kind: 'ell', z: 6.1, mat: 'skin', shift: -1, c: [head[0] - hw * 0.3, head[1] - hr * 0.06], rx: 1.1, ry: 1.7 });
  // a child's face sits low under a big skull (d154)
  const low = k.child ? hr * CHILD_FACE_LOW : 0;
  const nb: P = [head[0] + hw * 0.68, head[1] + hr * 0.02 - low];
  const nose = k.child ? CHILD_NOSE : {
    button: { len: 1.6, drop: 3.0, tip: 1.3 },
    long: { len: 3.4, drop: 4.2, tip: 1.2 },
    hook: { len: 3.0, drop: 4.6, tip: 1.0 },
    bulb: { len: 2.4, drop: 4.0, tip: 1.9 },
  }[k.nose];
  // on MI2's grid the nose is drawn bigger, as the 1991 game's are, or it melts into the cheek
  const nz = g > 1 ? 1.5 : 1;
  const tip: P = [nb[0] + nose.len * nz + (nz - 1) * 1.2, nb[1] - nose.drop * (g > 1 ? 1.15 : 1)];
  add({ kind: 'poly', z: 6.5, mat: 'skin', gloss: true, pts: [[nb[0] - 1.6, nb[1] + 0.5], [nb[0] + 0.2, nb[1] + 0.5], [tip[0] + (k.nose === 'hook' ? 0.6 : 0), tip[1] + 0.8], [tip[0] - 0.2, tip[1] - 0.6], [nb[0] - 1.6, tip[1] - 0.8]] });
  add({ kind: 'ell', z: 6.55, mat: 'skin', gloss: true, c: [tip[0] - 0.5, tip[1] - 0.1], rx: nose.tip * nz, ry: nose.tip * 0.9 * nz });

  return tip;
}

function hairShapes(r: Rig, tip: P): void {
  const { k, shY, hr, hw, head, add } = r;
  // hair: a cap over the skull that leaves the face, with styles
  // the hairline: over the brow in front, down the sideburn in front of the ear, the whole back of the head
  const faceFree: Clip = (x, y) => y > head[1] + hr * 0.42 - Math.max(0, head[0] - hw * 0.2 - x) * 0.6 || x < head[0] - hw * 0.5;
  const hairCap = (extra: number, z = 6.8) =>
    add({ kind: 'ell', z, mat: 'hair', gloss: true, c: [head[0] - hw * 0.12, head[1] + hr * 0.14], rx: hw * (1.06 + extra), ry: hr * (1.04 + extra * 0.6), clip: faceFree });
  if (k.hair === 'short') hairCap(0.02);
  if (k.hair === 'bun') {
    hairCap(0.04);
    add({ kind: 'ell', z: 6.75, mat: 'hair', gloss: true, c: [head[0] - hw * 0.98, head[1] + hr * 0.62], rx: hw * 0.55, ry: hr * 0.46 });
  }
  if (k.hair === 'long') {
    hairCap(0.12);
    add({ kind: 'poly', z: 3.6, mat: 'hair', pts: [[head[0] - hw * 1.2, head[1] + hr * 0.3], [head[0] + hw * 0.1, head[1] + hr * 0.1], [head[0] + hw * 0.0, shY - 5], [head[0] - hw * 0.6, shY - 8], [head[0] - hw * 1.35, shY - 5]] });
  }
  if (k.hair === 'curly') {
    for (const [dx, dy, r] of [[-0.9, 0.5, 0.42], [-0.4, 0.95, 0.42], [0.25, 0.95, 0.4], [-1.0, -0.1, 0.38], [0.6, 0.65, 0.34]] as const)
      add({ kind: 'ell', z: 6.8, mat: 'hair', gloss: true, c: [head[0] + hw * dx, head[1] + hr * dy], rx: hw * r * 1.1, ry: hr * r, clip: faceFree });
  }
  if (k.hair === 'bald')
    add({ kind: 'ell', z: 6.8, mat: 'hair', c: [head[0] - hw * 0.4, head[1] - hr * 0.02], rx: hw * 0.78, ry: hr * 0.48, clip: (x, y) => x < head[0] - hw * 0.12 && y < head[1] + hr * 0.3 });
  if (k.beard === 'full')
  {
    add({ kind: 'ell', z: 6.6, mat: 'hair', gloss: true, c: [head[0] + hw * 0.12, head[1] - hr * 0.78], rx: hw * 0.72, ry: hr * 0.52, clip: (x, y) => y < head[1] - hr * 0.42 && x > head[0] - hw * 0.5 && x < head[0] + hw * 0.78 });
    add({ kind: 'cap', z: 6.6, mat: 'hair', gloss: true, a: [head[0] + hw * 0.15, head[1] - hr * 0.9], b: [head[0] + hw * 0.25, head[1] - hr * 1.45], r1: hw * 0.5, r2: 1.0 });
  }
  if (k.beard === 'full' || k.beard === 'moustache')
    add({ kind: 'cap', z: 6.7, mat: 'hair', gloss: true, a: [tip[0] - 3.5, tip[1] - 1.6], b: [tip[0] - 0.3, tip[1] - 1.8], r1: 1.1, r2: 0.9 });
}

function wearShapes(r: Rig): void {
  const { k, b, shY, sh, neckTop, hr, hw, head, T, add } = r;
  if (k.headwear === 'cap') {
    add({ kind: 'ell', z: 7, mat: 'top', c: [head[0] - hw * 0.05, head[1] + hr * 0.66], rx: hw * 1.12, ry: hr * 0.44 });
    add({ kind: 'cap', z: 7.1, mat: 'trim', a: [head[0] - hw * 1.02, head[1] + hr * 0.38], b: [head[0] + hw * 0.92, head[1] + hr * 0.38], r1: 1.1, r2: 1.1 });
    add({ kind: 'poly', z: 7.2, mat: 'feet', gloss: true, pts: [[head[0] + hw * 0.4, head[1] + hr * 0.44], [head[0] + hw * 1.5, head[1] + hr * 0.22], [head[0] + hw * 1.45, head[1] + hr * 0.08], [head[0] + hw * 0.4, head[1] + hr * 0.24]] });
  }
  if (k.headwear === 'beanie') {
    add({ kind: 'ell', z: 7, mat: 'accent', c: [head[0] - hw * 0.12, head[1] + hr * 0.5], rx: hw * 1.1, ry: hr * 0.62, clip: (_x, y) => y > head[1] + hr * 0.18 });
    add({ kind: 'cap', z: 7.1, mat: 'accent', band: 1, a: [head[0] - hw * 1.12, head[1] + hr * 0.3], b: [head[0] + hw * 0.95, head[1] + hr * 0.3], r1: 1.3, r2: 1.3 });
  }
  if (k.headwear === 'stocking') {
    // a knitted stocking cap, the student's (a red hat): a snug crown, a ribbed cuff, and the long
    // tip flopped back and down behind the head, our own shape (no brim, no bobble)
    add({ kind: 'ell', z: 7, mat: 'accent', c: [head[0] - hw * 0.12, head[1] + hr * 0.5], rx: hw * 1.04, ry: hr * 0.58, clip: (_x, y) => y > head[1] + hr * 0.2 });
    add({ kind: 'cap', z: 7.1, mat: 'accent', band: 2, a: [head[0] - hw * 1.1, head[1] + hr * 0.26], b: [head[0] + hw * 0.62, head[1] + hr * 0.3], r1: 1.5, r2: 1.4 });
    add({ kind: 'cap', z: 6.95, mat: 'accent', a: [head[0] - hw * 0.55, head[1] + hr * 0.7], b: [head[0] - hw * 1.55, head[1] - hr * 0.45], r1: hw * 0.42, r2: 1.2 });
    add({ kind: 'ell', z: 7.06, mat: 'accent', band: 1, c: [head[0] - hw * 1.6, head[1] - hr * 0.55], rx: 1.4, ry: 1.6 });
  }
  if (k.headwear === 'brimhat') {
    add({ kind: 'ell', z: 7, mat: 'accent', c: [head[0] - hw * 0.1, head[1] + hr * 0.75], rx: hw * 0.95, ry: hr * 0.5 });
    add({ kind: 'ell', z: 7.1, mat: 'accent', gloss: true, c: [head[0] + hw * 0.05, head[1] + hr * 0.42], rx: hw * 1.9, ry: 1.4 });
  }
  if (k.neckwear === 'scarf') {
    add({ kind: 'ell', z: 5.5, mat: 'trim', c: [neckTop[0] - 0.2, shY + 0.6], rx: 4.4 * b, ry: 2.6 });
    add({ kind: 'cap', z: 5.6, mat: 'trim', a: T(sh * 0.3, shY), b: T(sh * 0.42, shY - 11), r1: 1.8, r2: 1.5 });
    add({ kind: 'cap', z: 5.6, mat: 'trim', band: 1, a: T(sh * 0.42, shY - 11.5), b: T(sh * 0.48, shY - 12.5), r1: 1.4, r2: 1.4 });
  }

}

function armShapes(r: Rig): P {
  const { B, k, pose, b, hipY, shY, sh, hp, T, coat, topMat, playing, sxN, sxB, add } = r;
  // --- arms
  const ua = B.upperArm;
  const fa = B.foreArm;
  const shN: P = T(sh - 2.6, shY - 2);
  const shF: P = T(-sh + 2.8, shY - 2);
  const place = (S: P, hd: Hand | undefined, rest: P, restBend: number) =>
    hd?.at ? ik(S, [S[0] + hd.at[0], S[1] + hd.at[1]], ua, fa, hd.bend ?? -1) : ik(S, [S[0] + rest[0], S[1] + rest[1]], ua, fa, restBend);
  let far = place(shF, pose.far, [-0.6, -(ua + fa) * 0.93], -1);
  let near = place(shN, pose.near, [4.4, -(ua + fa) * 0.9], -1);
  if (pose.clasp) {
    const c = T(hp * 0.75 + 1.5, hipY + 2.5);
    near = ik(shN, [c[0] + 0.5, c[1]], ua, fa, -1);
    far = ik(shF, [c[0] - 1.2, c[1] + 0.8], ua, fa, -1);
  }
  const farZ = 2;
  let farHandZ = pose.clasp ? 8.7 : 2.2;
  if (k.held === 'sax' && playing) {
    far = ik(shF, lerp(sxN, sxB, 0.3), ua, fa, -1);
    near = ik(shN, lerp(sxN, sxB, 0.82), ua, fa, -1);
    farHandZ = 8.5;
  } else if (k.held === 'lantern' && !pose.near?.at) {
    near = ik(shN, [sh + 5, hipY + 3], ua, fa, -1);
  }
  const arm = (S: P, a: { e: P; w: P }, z: number, zf: number, shift: number) => {
    add({ kind: 'cap', z, mat: topMat === 'accent' ? 'accent' : 'top', shift, a: S, b: a.e, r1: B.arm * b, r2: B.arm * 0.88 });
    add({ kind: 'cap', z: zf, mat: topMat === 'accent' ? 'accent' : 'top', shift, a: a.e, b: a.w, r1: B.arm * 0.88, r2: B.arm * 0.8 });
    if (coat || k.top === 'sweater' || k.top === 'jacket') {
      const c0 = lerp(a.e, a.w, 0.78);
      add({ kind: 'cap', z: zf + 0.1, mat: coat ? 'accent' : 'top', shift, ...(coat ? {} : { band: 1 + shift }), a: c0, b: a.w, r1: B.arm * 1.0, r2: B.arm * 1.0 });
    }
    const hand: P = lerp(a.e, a.w, 1.2);
    add({ kind: 'ell', z: zf + 0.2, mat: 'skin', shift, c: hand, rx: B.hand, ry: B.hand * 1.15 });
    return hand;
  };
  arm(shF, far, farZ, farHandZ, -1);
  const handN = arm(shN, near, 9, 9, 0);

  return handN;
}

function heldShapes(r: Rig, handN: P): void {
  const { k, hipY, shY, sh, hp, T, playing, mouth, sxN, sxB, sxU, sxBell, add } = r;
  // --- the held thing
  if (k.held === 'folder') {
    // tucked under the near arm, against the side
    // pinched under the arm: it sticks out before and behind it, tipped forward
    const c: P = T(sh * 0.35, shY - 9);
    add({ kind: 'poly', z: 8.5, mat: 'held', pts: [[c[0] - 7, c[1] + 2.5], [c[0] + 7.5, c[1] + 4.5], [c[0] + 8, c[1] - 1.5], [c[0] - 6.5, c[1] - 3.5]] });
    add({ kind: 'cap', z: 8.6, mat: 'held', band: 4, a: [c[0] - 6.6, c[1] + 2.2], b: [c[0] + 7.4, c[1] + 4.2], r1: 0.5, r2: 0.5 });
    add({ kind: 'cap', z: 8.6, mat: 'trim', a: [c[0] + 3, c[1] + 4], b: [c[0] + 3.5, c[1] - 2.5], r1: 0.6, r2: 0.6 });
  }
  if (k.pocket === 'metronome') {
    // a little wooden pyramid with its rod, peeking from the coat pocket
    const p0: P = [-hp * 0.45, hipY - 2];
    add({ kind: 'poly', z: 8.2, mat: 'held', gloss: true, pts: [[p0[0] - 2.4, p0[1]], [p0[0] + 2.4, p0[1]], [p0[0] + 0.8, p0[1] + 5.5], [p0[0] - 0.8, p0[1] + 5.5]] });
    add({ kind: 'cap', z: 8.3, mat: 'feet', band: 4, a: [p0[0], p0[1] + 1], b: [p0[0] + 1.2, p0[1] + 6.5], r1: 0.4, r2: 0.4 });
    add({ kind: 'cap', z: 8.35, mat: 'top', band: 1, a: [p0[0] - 3.4, p0[1] - 0.2], b: [p0[0] + 3.4, p0[1] - 0.2], r1: 1.1, r2: 1.1 });
  }
  if (k.held === 'lantern') {
    const top: P = [handN[0] + 0.4, handN[1] - 2.2];
    add({ kind: 'cap', z: 9.5, mat: 'feet', a: handN, b: top, r1: 0.45, r2: 0.45 });
    add({ kind: 'poly', z: 9.6, mat: 'feet', pts: [[top[0] - 3, top[1] - 1], [top[0] + 3, top[1] - 1], [top[0] + 2, top[1] + 0.6], [top[0] - 2, top[1] + 0.6]] });
    add({ kind: 'poly', z: 9.6, mat: 'held', band: 4, pts: [[top[0] - 2.4, top[1] - 1], [top[0] + 2.4, top[1] - 1], [top[0] + 2.4, top[1] - 8], [top[0] - 2.4, top[1] - 8]] });
    add({ kind: 'cap', z: 9.65, mat: 'feet', a: [top[0], top[1] - 1], b: [top[0], top[1] - 8], r1: 0.4, r2: 0.4 });
    add({ kind: 'poly', z: 9.7, mat: 'feet', pts: [[top[0] - 3, top[1] - 8], [top[0] + 3, top[1] - 8], [top[0] + 3, top[1] - 9.6], [top[0] - 3, top[1] - 9.6]] });
  }
  if (k.held === 'sax') {
    if (playing) {
      add({ kind: 'cap', z: 8, mat: 'feet', a: mouth, b: sxN, r1: 0.6, r2: 0.8 });
      add({ kind: 'cap', z: 8, mat: 'held', gloss: true, a: sxN, b: sxB, r1: 1.2, r2: 2.3 });
      add({ kind: 'cap', z: 8, mat: 'held', gloss: true, a: sxB, b: sxU, r1: 2.3, r2: 2.8 });
      add({ kind: 'cap', z: 8, mat: 'held', gloss: true, a: sxU, b: sxBell, r1: 2.8, r2: 4.0 });
      add({ kind: 'ell', z: 8.1, mat: 'held', band: 0, c: sxBell, rx: 3.4, ry: 1.2 });
    } else {
      // carried in the hand by its neck, the bell by the knee
      const n0: P = [handN[0] + 0.6, handN[1] + 2.2];
      const b0: P = [handN[0] + 1.2, handN[1] - 9];
      const u0: P = [handN[0] + 2.6, handN[1] - 13];
      const bell: P = [handN[0] + 6.5, handN[1] - 7.5];
      add({ kind: 'cap', z: 8.8, mat: 'held', gloss: true, a: n0, b: b0, r1: 1.1, r2: 2.0 });
      add({ kind: 'cap', z: 8.8, mat: 'held', gloss: true, a: b0, b: u0, r1: 2.0, r2: 2.6 });
      add({ kind: 'cap', z: 8.8, mat: 'held', gloss: true, a: u0, b: bell, r1: 2.6, r2: 3.6 });
      add({ kind: 'ell', z: 8.9, mat: 'held', band: 0, c: bell, rx: 1.4, ry: 3.0 });
    }
  }

}

/**
 * The tone of a pixel of shape `i` lit `v`, from its neighbours (right, down, left, up; -1 is outside the figure):
 * flat bands of the material's tones; the shaded edge and the underside in the deepest; a contact shadow under what
 * lies in front, from the light's side.
 */
function bandAt(shapes: readonly Shape[], i: number, v: number, [right, down, left, up]: readonly number[]): number {
  const s = shapes[i]!;
  let band = s.band ?? (v > 0.86 ? (s.gloss ? 4 : 3) : v > 0.58 ? 3 : v > 0.2 ? 2 : v > -0.22 ? 1 : 0);
  if (s.band === undefined) band += s.shift ?? 0;
  const outD = down! < 0;
  const out = right! < 0 || outD || left! < 0 || up! < 0;
  if (out && v < 0.32) band = Math.min(band, 0);
  else if (outD) band = Math.min(band, 1);
  else if (out && band > 3) band = 3;
  const front = (j: number) => j >= 0 && j !== i && shapes[j]!.z > s.z;
  if ((front(up!) || front(left!)) && !s.flatContact) band -= 1;
  else if (front(right!) || front(down!)) {
    const j = front(right!) ? right! : down!;
    if (shapes[j]!.mat === s.mat) band -= 1;
  }
  return band;
}

/** A striped top's stripe rows: one grid row of stripe, one of ground, counted up from the hip. */
function stripeRow(y: number, hipY: number, g: number): boolean {
  return Math.floor((y - hipY) / g) % 2 === 1;
}

/** A child's shaded hair: the hair's mid tone taken most of the way to its deepest, still the hair's colour. */
function childHairShade(hair: Ramp): number {
  const mix = (sh: number) => Math.round(((hair[2] >> sh) & 255) * 0.55 + ((hair[0] >> sh) & 255) * 0.45);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

function paint(r: Rig): { rgba: Uint8Array; put: Put } {
  const { k, g, shapes, w, h, ox, oy, hipY } = r;
  // --- cast to pixels
  const ramps: Record<Mat, Ramp> = { ...k.ramps, legwear: k.ramps.feet };
  shapes.sort((s1, s2) => s2.z - s1.z);
  const idx = new Int16Array(w * h).fill(-1);
  const val = new Float32Array(w * h);
  for (let py = 0; py < h; py++)
    for (let px = 0; px < w; px++) {
      const x = (px + 0.5) * g - ox;
      const y = oy - (py + 0.5) * g;
      for (let i = 0; i < shapes.length; i++) {
        const v = hit(shapes[i]!, x, y);
        if (v === null) continue;
        idx[py * w + px] = i;
        val[py * w + px] = v;
        break;
      }
    }
  const at = (px: number, py: number): number => (px < 0 || py < 0 || px >= w || py >= h ? -1 : idx[py * w + px]!);
  const rgba = new Uint8Array(w * h * 4);
  const put = (px: number, py: number, c: number, a = 255) => {
    if (px < 0 || py < 0 || px >= w || py >= h) return;
    const o = (py * w + px) * 4;
    rgba[o] = (c >> 16) & 255;
    rgba[o + 1] = (c >> 8) & 255;
    rgba[o + 2] = c & 255;
    rgba[o + 3] = a;
  };
  for (let py = 0; py < h; py++)
    for (let px = 0; px < w; px++) {
      const i = at(px, py);
      if (i < 0) continue;
      const s = shapes[i]!;
      const v = val[py * w + px]!;
      const band = bandAt(shapes, i, v, [at(px + 1, py), at(px, py + 1), at(px - 1, py), at(px, py - 1)]);
      // a child's skin is never the deepest tone: on a small face it reads as stubble (art review, d154)
      const tone = Math.max(k.child && s.mat === 'skin' ? 1 : 0, Math.min(4, band));
      // a dark hair ramp's two shade tones are near black: on a child figure's big round head they make a black slab, so a
      // child figure's shaded hair is one deep tone of its own colour (art review, d154)
      // a striped top (the student's sailor shirt): every other grid row of the top and its sleeves in the trim
      const mat = k.top === 'striped' && s.mat === 'top' && stripeRow(oy - (py + 0.5) * g, hipY, g) ? 'trim' : s.mat;
      put(px, py, k.child && mat === 'hair' && tone < 2 ? childHairShade(ramps.hair) : ramps[mat][tone]!);
    }

  return { rgba, put };
}

/** The face, set by hand on MI2's grid (facing right, three quarters): an eye is one dark pixel, a mouth one pixel, a brow only when raised. */
function face(r: Rig, put: Put, tip: P): void {
  const { k, pose, g, hr, hw, head, ox, oy } = r;
  const fx = (x: number) => Math.floor((x + ox) / g);
  const fy = (y: number) => Math.floor((oy - y) / g);
  const eyeX = fx(head[0] + hw * 0.36);
  const eyeY = fy(head[1] + hr * 0.02 - (k.child ? hr * CHILD_FACE_LOW : 0));
  const covered = k.headwear === 'brimhat' || k.headwear === 'cap';
  put(eyeX, eyeY, pose.eyes === 'shut' ? k.ramps.skin[0] : INK);
  if (pose.brows === 'up' && !covered) put(eyeX, eyeY - 2, k.ramps.hair[0]);
  if (k.child && !k.ghost) put(eyeX - 1, eyeY + 2, CHEEK);
  const mx = fx(tip[0] - 1.8);
  const my = fy(tip[1] - 2.8);
  const mouth = pose.mouth ?? 'shut';
  if (mouth === 'shut') {
    if (k.beard !== 'full') put(mx, my, k.lips ? LIPS : k.ramps.skin[k.child ? 1 : 0]);
  } else {
    put(mx, my, MOUTH);
    if (mouth === 'round') put(mx, my + 1, MOUTH);
  }
}

function fade(r: Rig, rgba: Uint8Array): void {
  const { B, g, w, h, oy } = r;
  {
    const kneeY = B.foot + B.leg * 0.5;
    for (let py = 0; py < h; py++)
      for (let px = 0; px < w; px++) {
        const o = (py * w + px) * 4;
        if (!rgba[o + 3]) continue;
        const y = oy - py * g;
        const fade = y < kneeY + 4 ? (kneeY + 4 - y) / (kneeY + 4) : 0;
        if (hash(px, py) < fade * 1.25) rgba[o + 3] = 0;
        else rgba[o + 3] = 200;
      }
  }
}

/** One frame of a person, cast on a grid of `g` x `g` fine pixels (MI2's grid is 2); pixels are in grid units. */
export function castFigure(B0: Body, k: Look, pose: Pose = {}, g = 2): Figure {
  const r = rigOf(B0, k, pose, g);
  legShapes(r);
  bodyShapes(r);
  topShapes(r);
  const tip = headShapes(r);
  hairShapes(r, tip);
  wearShapes(r);
  const handN = armShapes(r);
  heldShapes(r, handN);
  const { rgba, put } = paint(r);
  face(r, put, tip);
  if (k.ghost) fade(r, rgba);
  return { w: r.w, h: r.h, rgba, ox: r.ox, oy: r.oy };
}


