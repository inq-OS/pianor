import { describe, expect, it } from 'vitest';
import keriJson from '../../../../../content/world/keri.json';
import { knollPlan } from '../../../../core/layout/knoll';
import { loadWorld } from '../../../../core/world/world';
import { scenePalette } from './keriPalette';
import { paintKnoll } from './knollPicture';
import { burlRound, PUUVAIM_RUNS, PUUVAIM_SIDE, PUUVAIM_SPRITE, PUUVAIM_STATES, puuvaimFrames, puuvaimSprite, type PuuvaimFace } from './puuvaim';

const FACES: readonly PuuvaimFace[] = ['asleep', 'awake', 'blink', 'talk', 'listen', 'play', 'hum'];
const HOURS = ['day', 'dawn', 'dusk', 'night'] as const;

describe('Puuvaim in the knoll\'s tree (ft_1_22, WP-11 painter part)', () => {
  // one hour a test, so each paints the knoll once: all four in one test ran past two minutes on a CI runner
  it.each(HOURS)('laid over the bare tree at %s, he covers only the sky and the trunk, his beard the roses too: never a stem or the crown, and nothing under him moves', (hour) => {
    const fine = scenePalette().fine;
    const never = new Set([...fine.near, ...fine.stem]);
    const notUnderBurl = new Set([...fine.bush, ...fine.rose, ...fine.grass, ...fine.bloom]);
    const { x, y, w, h } = PUUVAIM_SPRITE;
    const picture = paintKnoll(loadWorld(keriJson), knollPlan(), hour);
    const face = puuvaimSprite(PUUVAIM_RUNS, PUUVAIM_SIDE[hour], 'awake');
    const first = picture.frames[0]!;
    // the pixels that break a rule, gathered and compared once (an expect for each pixel of each look cost seconds)
    const moves: string[] = [], stems: string[] = [], leaves: string[] = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (face.pixels[j * w + i] === 0) continue;
      const at = (y + j) * first.width + x + i, where = `${x + i},${y + j}`;
      if (picture.frames.some((frame) => frame.pixels[at] !== first.pixels[at])) moves.push(where);
      const under = first.pixels[at]!;
      if (never.has(under)) stems.push(where);
      if (burlRound(x + i, y + j) <= 1 && notUnderBurl.has(under)) leaves.push(where);
    }
    expect(moves, 'moves under him').toEqual([]);
    expect(stems, 'a stem or the crown under him').toEqual([]);
    expect(leaves, 'leaves under the burl').toEqual([]);
  }, 120_000);

  it('every face, lit from either side, stays inside his frame and covers the same pixels: only the face changes', () => {
    const shape = (side: number, face: PuuvaimFace) => [...puuvaimSprite(PUUVAIM_RUNS, side, face).pixels].map((p) => p !== 0);
    for (const side of [-1, 0.4, 1]) for (const face of FACES) expect(shape(side, face), `${face} at ${side}`).toEqual(shape(side, 'asleep'));
  });

  it('awake, talking and listening, his eyes are open, pale with dark pupils (no glow); asleep and playing they are shut', () => {
    const open = (face: PuuvaimFace) => [...puuvaimSprite(PUUVAIM_RUNS, 1, face).pixels].some((p) => p === PUUVAIM_RUNS.white);
    for (const face of ['awake', 'talk', 'listen'] as const) expect(open(face), face).toBe(true);
    for (const face of ['asleep', 'blink', 'play', 'hum'] as const) expect(open(face), face).toBe(false);
  });

  it('each face differs from his sleeping one', () => {
    const asleep = puuvaimSprite(PUUVAIM_RUNS, 1, 'asleep').pixels;
    for (const face of FACES.filter((f) => f !== 'asleep')) expect(puuvaimSprite(PUUVAIM_RUNS, 1, face).pixels, face).not.toEqual(asleep);
  });

  it('his actor has idle, talk, listen and play (contract A.4), lit by the hour, and no walk', () => {
    for (const state of ['idle', 'talk', 'listen', 'play'] as const) {
      const frames = puuvaimFrames(state, 'dusk');
      expect(frames?.length, state).toBe(PUUVAIM_STATES[state]!.length);
      expect(frames![0]!.width).toBe(PUUVAIM_SPRITE.w);
      expect(frames![0]!.height).toBe(PUUVAIM_SPRITE.h);
    }
    expect(puuvaimFrames('walk', 'dusk')).toBeNull();
    expect(puuvaimFrames('idle', 'night')![0]!.rgba).not.toEqual(puuvaimFrames('idle', 'day')![0]!.rgba);
  });
});
