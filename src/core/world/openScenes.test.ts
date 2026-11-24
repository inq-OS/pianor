import { describe, expect, it } from 'vitest';
import { isTester, openScenes } from './openScenes';

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
