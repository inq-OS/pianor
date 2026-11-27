import { describe, expect, it } from 'vitest';
import { isTester, openScenes } from './openScenes';

const SCENES = [{ id: 'knoll' }, { id: 'harbour' }, { id: 'spit' }];

describe('which scenes are open (ft_1_19)', () => {
  it('ft_1_19.AC2 every built scene is open to every player: no level opens or locks a scene (d113)', () => {
    expect(openScenes(SCENES)).toEqual(['knoll', 'harbour', 'spit']);
    expect(openScenes(SCENES, false)).toEqual(['knoll', 'harbour', 'spit']);
  });
});

describe('a tester', () => {
  it('opens every scene there is to the player called tester, a closed one included, whatever the letter case', () => {
    expect(isTester('tester')).toBe(true);
    expect(isTester(' Tester ')).toBe(true);
    expect(isTester('testers')).toBe(false);
    const scenes = [...SCENES, { id: 'terrace', closed: true }];
    expect(openScenes(scenes, true)).toEqual(scenes.map((s) => s.id));
  });
});

describe('a closed scene', () => {
  it('stays closed to every player but a tester', () => {
    const scenes = [...SCENES, { id: 'terrace', closed: true }];
    expect(openScenes(scenes)).toEqual(['knoll', 'harbour', 'spit']);
    expect(openScenes(scenes, true)).toContain('terrace');
  });
});

describe('Keri as shipped', () => {
  it('keeps every scene but the knoll closed to players, so the map is as it was', async () => {
    const { loadWorld } = await import('./world');
    const keri = loadWorld((await import('../../../content/world/keri.json')).default);
    expect(openScenes(keri.scenes ?? [])).toEqual(['knoll']);
    expect(openScenes(keri.scenes ?? [], true)).toContain('terrace');
  });
});
