import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LIFE_KINDS, NO_LIFE, SCENE_LIVING, livingGaps } from './sceneLiving';

describe('ft_1_19.AC14 every place says what lives in it, kind by kind (small details are considered in every future scene too)', () => {
  const scenes = readdirSync('content/scenes').filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));

  it('every scene of content/scenes has a list, and every list is a scene', () => {
    expect(Object.keys(SCENE_LIVING).sort()).toEqual([...scenes].sort());
  });

  it('each list answers every kind: what moves there, or none and why', () => {
    for (const scene of scenes) expect(livingGaps(SCENE_LIVING[scene]), scene).toEqual([]);
  });

  it('a list with an answer missing, an empty one or a bare "none:" is turned back', () => {
    expect(livingGaps(undefined)).toHaveLength(LIFE_KINDS.length);
    const full = SCENE_LIVING.knoll!;
    expect(livingGaps({ ...full, birds: '' })).toEqual(['birds: no answer']);
    expect(livingGaps({ ...full, fire: `${NO_LIFE} no` })[0]).toMatch(/^fire: says too little/);
    expect(livingGaps({ ...full, small: 'fireflies' })[0]).toMatch(/^small: says too little/);
    expect(livingGaps(Object.fromEntries(Object.entries(full).filter(([kind]) => kind !== 'water')))).toEqual(['water: no answer']);
  });
});
