import type { ActorState } from '../../src/core/scene/actor.ts';
import type { SkyPhase } from '../../src/core/sky/skyPhase.ts';
import { generateFeatures, SAMPLE_CHILDREN, SAMPLE_PEOPLE } from '../../src/game/ui/pixel/actors/features.ts';
import { figureFrames, type FigureFrame } from '../../src/game/ui/pixel/actors/figure.ts';
import type { IndexedPicture } from './png.ts';

/**
 * The template character's sheet (`npm run art:render -- figures [hour]`): the six sample people in every state
 * (idle and its blink, talk, listen, play, the six walk frames), a row of the sample children (d154: idle, talk, listen,
 * a walk frame each), then a row of generated islanders, all lit by the hour as the scenes are. What the maintainer judges the template by (WP-05, d142, d144), and what a painter looks at after
 * changing a number in `figureModel.ts`.
 */

const COLUMNS: readonly (readonly [ActorState, number])[] = [
  ['idle', 0], ['idle', 2], ['talk', 0], ['talk', 2], ['listen', 0], ['listen', 1], ['play', 0], ['play', 1],
  ['walk', 0], ['walk', 1], ['walk', 2], ['walk', 3], ['walk', 4], ['walk', 5],
];
/** The children's row: each sample child in these frames. */
const CHILD_COLUMNS: readonly (readonly [ActorState, number])[] = [['idle', 0], ['talk', 0], ['listen', 0], ['walk', 1]];
/** How many generated islanders the last row shows. */
export const GENERATED = 12;
const GAP = 4;
const BACKDROP = 0xc4b28c;

export function figureSheet(hour: SkyPhase = 'day'): IndexedPicture {
  // each person's states are drawn once, however many of their frames the sheet shows (the walk is six columns)
  const cellsOf = (features: Parameters<typeof figureFrames>[0], columns: readonly (readonly [ActorState, number])[]): FigureFrame[] => {
    const drawn = new Map<ActorState, readonly FigureFrame[]>();
    return columns.map(([state, frame]) => {
      let frames = drawn.get(state);
      if (!frames) drawn.set(state, (frames = figureFrames(features, state, { hour })));
      return frames[frame % frames.length]!;
    });
  };
  const rows: FigureFrame[][] = SAMPLE_PEOPLE.map(({ features }) => cellsOf(features, COLUMNS));
  rows.push(SAMPLE_CHILDREN.flatMap(({ features }) => cellsOf(features, CHILD_COLUMNS)));
  rows.push(Array.from({ length: GENERATED }, (_, i) => figureFrames(generateFeatures(i + 1), 'idle', { hour })[0]!));
  const cellW = Math.max(...rows.flat().map((f) => f.w));
  const cellH = Math.max(...rows.flat().map((f) => f.h));
  const width = Math.max(...rows.map((r) => r.length)) * (cellW + GAP) + GAP;
  const height = rows.length * (cellH + GAP) + GAP;
  const palette: number[] = [0, BACKDROP];
  const places = new Map<number, number>();
  const pixels = new Uint16Array(width * height).fill(1);
  rows.forEach((row, r) =>
    row.forEach((f, c) => {
      const x0 = GAP + c * (cellW + GAP);
      const y0 = GAP + r * (cellH + GAP) + (cellH - f.h);
      for (let y = 0; y < f.h; y++)
        for (let x = 0; x < f.w; x++) {
          const o = (y * f.w + x) * 4;
          if (!f.rgba[o + 3]) continue;
          const colour = (f.rgba[o]! << 16) | (f.rgba[o + 1]! << 8) | f.rgba[o + 2]!;
          let index = places.get(colour);
          if (index === undefined) {
            index = palette.push(colour) - 1;
            places.set(colour, index);
          }
          pixels[(y0 + y) * width + x0 + x] = index;
        }
    }),
  );
  return { width, height, pixels, palette };
}
