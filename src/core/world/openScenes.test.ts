import { describe, expect, it } from 'vitest';
import { isTester, openScenes, sceneGate } from './openScenes';

const SCENES = [{ id: 'knoll', level: 1 }, { id: 'harbour', level: 3 }, { id: 'spit', level: 5 }];

describe('which scenes are open (ft_1_19)', () => {
  it('ft_1_19.AC2 a scene is open when the student\'s level is at least the scene\'s: levelling up opens new scenes', () => {
    expect(openScenes(SCENES, 1)).toEqual(['knoll']);
    expect(openScenes(SCENES, 2)).toEqual(['knoll']);
    expect(openScenes(SCENES, 3)).toEqual(['knoll', 'harbour']);
    expect(openScenes(SCENES, 9)).toEqual(['knoll', 'harbour', 'spit']);
    expect(openScenes(SCENES, 0)).toEqual([]);
  });
});

describe('a tester', () => {
  it('opens every scene there is to the player called tester, whatever the level and the letter case', () => {
    expect(isTester('tester')).toBe(true);
    expect(isTester(' Tester ')).toBe(true);
    expect(isTester('testers')).toBe(false);
    expect(openScenes(SCENES, 1, true)).toEqual(SCENES.map((s) => s.id));
    expect(openScenes(SCENES, 1, false)).toEqual(['knoll']);
  });
});

describe('a closed scene', () => {
  it('stays closed to every player but a tester, whatever the level', () => {
    const scenes = [...SCENES, { id: 'terrace', level: 1, closed: true }];
    expect(openScenes(scenes, 9)).toEqual(['knoll', 'harbour', 'spit']);
    expect(openScenes(scenes, 1, true)).toContain('terrace');
  });
});

describe('Keri as shipped', () => {
  it('keeps every scene but the knoll closed to players at any level', async () => {
    const { loadWorld } = await import('./world');
    const keri = loadWorld((await import('../../../content/world/keri.json')).default);
    expect(openScenes(keri.scenes ?? [], 10)).toEqual(['knoll']);
    expect(openScenes(keri.scenes ?? [], 10, true)).toContain('terrace');
  });
});

describe('what a shut scene says on the map', () => {
  it('ft_1_19.AC2 a scene shut by the level says the level that opens it, and one the maintainer has closed says only that it is not open yet', () => {
    const scenes = [{ id: 'a', level: 1 }, { id: 'b', level: 3 }, { id: 'c', level: 2, closed: true }];
    expect(scenes.map((s) => sceneGate(s, 1))).toEqual([{ open: true }, { open: false, opensAt: 3 }, { open: false, opensAt: null }]);
    expect(sceneGate(scenes[2]!, 5)).toEqual({ open: false, opensAt: null });
    expect(sceneGate(scenes[2]!, 1, true)).toEqual({ open: true });
  });
});
