import { describe, expect, it } from 'vitest';
import ladderJson from '../../../content/campaign/ladder.json';
import { loadLadder } from './content';
import { campaignMapView } from './mapView';
import { startCampaign, battleResult, phaseOneResult, phaseTwoResult } from './campaign';

const ladder = loadLadder(ladderJson);

describe('campaign map view (ft_1_06.AC1)', () => {
  it('ft_1_06.AC1 at the start only the first monster is unlocked; the others are locked placeholders', () => {
    const map = campaignMapView(ladder, startCampaign(ladder));
    expect(map).toHaveLength(ladder.monsters.length);
    expect(map[0]!.unlocked).toBe(true);
    expect(map.slice(1).every((m) => !m.unlocked)).toBe(true);
  });

  it('ft_1_06.AC1 every monster shows three levels; only the first level of an unlocked monster is selectable', () => {
    const map = campaignMapView(ladder, startCampaign(ladder));
    expect(map.every((m) => m.levels.length === 3)).toBe(true);
    expect(map[0]!.levels.map((l) => l.selectable)).toEqual([true, false, false]);
    expect(map[0]!.levels.map((l) => l.level)).toEqual([1, 2, 3]);
    expect(map[0]!.levels.every((l) => !l.beaten)).toBe(true);
  });

  it('ft_1_06.AC5 beating a level shows it as beaten and makes the next level selectable; the next monster opens only after level 3', () => {
    let state = startCampaign(ladder);
    for (const level of [1, 2] as const) {
      state = phaseOneResult(state, 0, 'passed');
      state = phaseTwoResult(state, 0, 'door-open');
      state = battleResult(state, 0, level, true);
    }
    let map = campaignMapView(ladder, state);
    expect(map[0]!.levels.map((l) => l.beaten)).toEqual([true, true, false]);
    expect(map[0]!.levels.map((l) => l.selectable)).toEqual([true, true, true]);
    expect(map[1]!.unlocked).toBe(false);

    state = phaseOneResult(state, 0, 'passed');
    state = phaseTwoResult(state, 0, 'door-open');
    state = battleResult(state, 0, 3, true);
    map = campaignMapView(ladder, state);
    expect(map[1]!.unlocked).toBe(true);
    expect(map[1]!.levels[0]!.selectable).toBe(true);
  });

  it('is pure: the state is not changed', () => {
    const state = startCampaign(ladder);
    const copy = structuredClone(state);
    campaignMapView(ladder, state);
    expect(state).toEqual(copy);
  });
});
