import { hash2, noise2 } from './paint/noise';
import { LIVE, SURF_EDGE, SURF_HIDDEN, SURF_OPEN, type LiveWater } from './paint/live';

/**
 * The game's side of live water (`paint/live.ts`): which of a field's pixels are lit at a time, worked out while the
 * game runs. Pure: the same field, seed and time give the same pixels, so the tests and the screenshots stay still.
 * Nothing here loops: every stroke lives its own life at its own length, so the sea never shows the same moment twice.
 *
 * - A wave stroke is born a dot, stretches along its row, slides a few pixels with the drift and shrinks away; then it
 *   is born again somewhere else on the row. Far off they are short and many, near the viewer longer and fewer, and
 *   now and then a near one breaks white at its longest.
 * - A glint flashes on its own beat, each at its own pace.
 * - The pale bands round what stands in the water slide outward along their run a pixel at a time.
 * - The surf comes and goes along the water's edge, a white line and a broken one further out.
 *
 * `gustMs` is how long a gust takes at the day's wind (`GUST_MS`): everything goes faster in more wind.
 */

/** How much of a stroke row strokes cover at a moment, far off and near (the painted strokes covered about as much). */
const COVER = { far: 0.3, body: 0.15 } as const;

interface Stroke {
  /** The row's pixels from `from` to `to` (field columns), its row and its depth under the horizon. */
  row: number;
  from: number;
  to: number;
  depth: number;
  far: boolean;
  slot: number;
}

interface Glint {
  i: number;
  colour: number;
  beat: number;
  pace: number;
}

interface Ring {
  i: number;
  at: number;
  wide: number;
  core: number;
  rim: number;
}

export class LiveWaterPlayer {
  /** The field's box in the picture's fine pixels. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  private readonly up: Uint8Array;
  private readonly down: Uint8Array;
  private readonly shade: Uint8Array;
  private readonly surfAt: Uint8Array;
  private readonly strokes: Stroke[] = [];
  private readonly glints: Glint[] = [];
  private readonly rings: Ring[] = [];
  /** Each column's water edge (field rows), or -1 where the column has no surf. */
  private readonly edges: Int16Array;

  constructor(private readonly field: LiveWater, private readonly seed: number) {
    const { layers } = field;
    const f = layers.frames;
    this.x = layers.x;
    this.y = layers.y;
    this.w = f[0]!.width;
    this.h = f[0]!.height;
    const { w, h } = this;
    this.up = f[LIVE.up]!.pixels;
    this.down = f[LIVE.down]!.pixels;
    this.shade = f[LIVE.shade]!.pixels;
    this.surfAt = f[LIVE.surf]!.pixels;
    const glint = f[LIVE.glint]!.pixels, glintBeat = f[LIVE.glintBeat]!.pixels;
    const ringAt = f[LIVE.ringAt]!.pixels, ringWide = f[LIVE.ringWide]!.pixels, ringCore = f[LIVE.ringCore]!.pixels, ringRim = f[LIVE.ringRim]!.pixels;
    this.edges = new Int16Array(w).fill(-1);
    let slot = 0;
    for (let y = 0; y < h; y++) {
      let from = -1, to = -1, far = 0, all = 0;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (this.up[i]) {
          if (from < 0) from = x;
          to = x;
          all++;
          if (this.down[i]) far++;
        }
        if (glint[i]) {
          // the pixels of one glint share a beat; the seed moves every beat, so no two visits flash alike
          const beat = (glintBeat[i]! / 255 + hash2(glintBeat[i]!, seed, 701)) % 1;
          this.glints.push({ i, colour: glint[i], beat, pace: 0.7 + 0.6 * hash2(glintBeat[i]!, seed, 702) });
        }
        if (ringAt[i]) this.rings.push({ i, at: ringAt[i] / 255, wide: ringWide[i]! / 255, core: ringCore[i]!, rim: ringRim[i]! });
        const s = this.surfAt[i]!;
        if ((s === SURF_EDGE || s === SURF_HIDDEN) && this.edges[x] === -1) this.edges[x] = y;
      }
      if (from < 0) continue;
      const depth = this.y + y - field.horizon, len = 2 + depth * 0.22;
      const isFar = far > all / 2;
      const count = Math.max(1, Math.round(((to - from + 1) * (isFar ? COVER.far : COVER.body) * field.cover) / (len * 0.64)));
      for (let k = 0; k < count; k++) this.strokes.push({ row: y, from, to, depth, far: isFar, slot: slot++ });
    }
  }

  /** The field's pixels at `t` milliseconds into `out` (palette places, `w` x `h`; 0 where nothing is lit). */
  paint(t: number, gustMs: number, out: Uint8Array): void {
    out.fill(0);
    const { w, h, seed } = this;
    for (const s of this.strokes) this.stroke(s, t, gustMs, out);
    for (const r of this.rings) {
      const f = (((r.at - t / gustMs) % 1) + 1) % 1;
      if (f < r.wide) out[r.i] = f < r.wide * 0.5 ? r.core : r.rim;
    }
    for (const g of this.glints) if ((g.beat + (2 * t) / (gustMs * g.pace)) % 1 < 0.45) out[g.i] = g.colour;
    // the surf: a white line at the water's edge and a broken one further out, coming and going with the swell
    const foam = this.field.foam;
    const lay = (x: number, y: number): void => {
      if (y < 0 || y >= h) return;
      const v = this.surfAt[y * w + x];
      if (v === SURF_OPEN || v === SURF_EDGE) out[y * w + x] = foam;
    };
    for (let x = 0; x < w; x++) {
      const edge = this.edges[x]!;
      if (edge < 0) continue;
      const X = this.x + x;
      const swell = Math.sin(2 * Math.PI * (t / gustMs + X / 260));
      if (noise2(X / 6 + swell * 0.6, 7, 59 + seed) > 0.28) { lay(x, edge); if (swell > 0) lay(x, edge - 1); }
      const outer = edge - 3 - Math.round(1.5 + 1.5 * swell + 2 * noise2(X / 23, 3, 60 + seed));
      if (noise2(X / 8 + (3.2 * t) / gustMs, 5, 61 + seed) > 0.52) lay(x, outer);
    }
  }

  private stroke(s: Stroke, t: number, gustMs: number, out: Uint8Array): void {
    const { w, seed, field } = this;
    const k = s.slot + seed * 7919;
    const life = gustMs * (0.6 + 0.8 * hash2(k, 1, 711));
    const u = t / life + hash2(k, 2, 712), born = Math.floor(u), p = u - born;
    const len = 2 + s.depth * 0.22;
    const long = Math.max(2, len * (0.5 + hash2(k, born, 713))) * 1.3;
    const shown = long * Math.sin(Math.PI * p);
    if (shown < 1) return;
    const travel = 2 * (1.5 + s.depth * 0.08) * field.way;
    const middle = s.from + hash2(k, born, 714) * (s.to - s.from + 1) + travel * (p - 0.5);
    const darker = s.far && hash2(k, born, 715) > 0.45;
    const cap = !s.far && hash2(k, born, 716) > 0.9 && p > 0.3 && p < 0.7;
    const a = Math.round(middle - shown / 2), b = Math.round(middle + shown / 2);
    for (let x = Math.max(0, a); x < Math.min(w, b); x++) {
      const i = s.row * w + x;
      const colour = darker ? this.down[i]! : this.up[i]!;
      if (!colour) continue;
      out[i] = cap && x > a + (b - a) * 0.25 && x < a + (b - a) * 0.75 ? field.foam : colour;
      const under = this.shade[i + w];
      if (under) out[i + w] = under;
    }
  }
}

/** The field lit at `t` as a picture of its own, laid at (`x`, `y`) of the picture: for the art tools and the tests. */
export function liveWaterAt(water: LiveWater, t: number, gustMs: number, seed = 0): { bitmap: { width: number; height: number; pixels: Uint8Array }; x: number; y: number } {
  const player = new LiveWaterPlayer(water, seed);
  const pixels = new Uint8Array(player.w * player.h);
  player.paint(t, gustMs, pixels);
  return { bitmap: { width: player.w, height: player.h, pixels }, x: player.x, y: player.y };
}
