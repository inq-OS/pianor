import { describe, expect, it } from 'vitest';
import { beingsInScenes, isTester, localDay, openScenes } from './sceneBeings';

const SCENES = [{ id: 'knoll', level: 1 }, { id: 'harbour', level: 3 }, { id: 'spit', level: 5 }];

describe('where the beings are (ft_1_19.AC8, d113)', () => {
  it('ft_1_19.AC2 a scene is open when the student\'s level is at least the scene\'s: levelling up opens new scenes', () => {
    expect(openScenes(SCENES, 1)).toEqual(['knoll']);
    expect(openScenes(SCENES, 2)).toEqual(['knoll']);
    expect(openScenes(SCENES, 3)).toEqual(['knoll', 'harbour']);
    expect(openScenes(SCENES, 9)).toEqual(['knoll', 'harbour', 'spit']);
    expect(openScenes(SCENES, 0)).toEqual([]);
  });

  it('ft_1_19.AC8 every unlocked monster is in exactly one open scene, and none is anywhere else', () => {
    for (let day = 20000; day < 20060; day++) {
      const where = beingsInScenes([0, 1, 2, 3], ['knoll', 'harbour', 'spit'], 'anna', day);
      expect(Object.keys(where).sort()).toEqual(['harbour', 'knoll', 'spit']);
      expect(Object.values(where).flat().sort()).toEqual([0, 1, 2, 3]);
    }
  });

  it('ft_1_19.AC4 scenes keep no state of their own: the draw only reads the monsters the trail unlocked and changes nothing', () => {
    const unlocked = Object.freeze([2, 0, 1]);
    const open = Object.freeze(['knoll', 'harbour']);
    const first = beingsInScenes(unlocked, open, 'anna', 20001);
    expect(beingsInScenes(unlocked, open, 'anna', 20001)).toEqual(first);
    expect(unlocked).toEqual([2, 0, 1]);
    expect(open).toEqual(['knoll', 'harbour']);
  });

  it('ft_1_19.AC8 with one open scene every unlocked monster is in it, in the ladder\'s order', () => {
    expect(beingsInScenes([2, 0, 1], ['knoll'], 'anna', 20001)).toEqual({ knoll: [0, 1, 2] });
    expect(beingsInScenes([], ['knoll'], 'anna', 20001)).toEqual({ knoll: [] });
    expect(beingsInScenes([0], [], 'anna', 20001)).toEqual({});
  });

  it('ft_1_19.AC8 the draw is the same for a student all day, and over many days and students a monster is seen in every open scene', () => {
    const open = ['knoll', 'harbour'];
    expect(beingsInScenes([0, 1], open, 'anna', 20001)).toEqual(beingsInScenes([0, 1], open, 'anna', 20001));
    const seen = new Set<string>(), students = new Set<string>();
    for (let day = 20000; day < 20040; day++) {
      const anna = beingsInScenes([0], open, 'anna', day), ben = beingsInScenes([0], open, 'ben', day);
      seen.add(anna.knoll!.length ? 'knoll' : 'harbour');
      if (JSON.stringify(anna) !== JSON.stringify(ben)) students.add('differ');
    }
    expect([...seen].sort()).toEqual(['harbour', 'knoll']);
    expect(students.has('differ')).toBe(true);
  });

  it('ft_1_19.AC8 the day changes at the student\'s own midnight, not at midnight in Greenwich', () => {
    const utcNoon = Date.UTC(1998, 10, 11, 12, 0), tallinnLateEvening = Date.UTC(1998, 10, 11, 21, 59), tallinnAfterMidnight = Date.UTC(1998, 10, 11, 22, 1);
    expect(localDay(tallinnLateEvening, -120)).toBe(localDay(utcNoon, -120));
    expect(localDay(tallinnAfterMidnight, -120)).toBe(localDay(utcNoon, -120) + 1);
    expect(localDay(tallinnAfterMidnight, 0)).toBe(localDay(utcNoon, 0));
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
