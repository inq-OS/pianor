import { describe, expect, it } from 'vitest';
import presenceJson from '../../../content/world/presence.json';
import puuvaimJson from '../../../content/characters/puuvaim.json';
import { characterDefSchema, type CharacterDef } from '../character/character';
import type { Curriculum } from '../curriculum/curriculum';
import { dayNumber } from '../curriculum/evaluate';
import { Random } from '../random';
import type { PresenceInput } from './presence';
import {
  DEFAULT_PRESENCE_RULES, TEACHER_ID, daysBetween, eligible, headsUpKey, headsUps, meetCharacter, parsePresenceRules, presence, recordTug, teacherBoat, turnsUp,
} from './presenceRules';
import type { WorldState } from './worldState';

const rules = DEFAULT_PRESENCE_RULES;
const puuvaim = characterDefSchema.parse(puuvaimJson);
const teacher: CharacterDef = { ...puuvaim, id: 'teacher', kind: 'teacher' };
const twoScenes: CharacterDef = { ...puuvaim, id: 'wanderer', scenes: ['knoll', 'docks'] };
const empty: WorldState = { flags: [], items: [], met: {}, teacherVisits: [] };
const noCurriculum: Curriculum = { base: 85, pieces: [], calendar: [] };
const input = (over: Partial<PresenceInput> = {}): PresenceInput => ({
  day: '1998-11-18', practiceMinutes: 100, practiceMinutesToday: 10, characters: [puuvaim], world: empty, curriculum: noCurriculum, statuses: [], cleanPlaysSinceLostTug: {}, ...over,
});

describe('the presence rules as content', () => {
  it('content/world/presence.json holds the defaults', () => {
    expect(parsePresenceRules(presenceJson)).toEqual(DEFAULT_PRESENCE_RULES);
    expect(() => parsePresenceRules({ ...presenceJson, appearChance: 2 })).toThrow();
  });
});

describe('eligibility: met by practising, the cool-down counted in practice (ft_1_25.AC2, ft_1_25.AC3)', () => {
  // ft_1_21.AC12
  it('needs the practice threshold, never time', () => {
    expect(eligible(puuvaim, undefined, 29.9)).toBe(false);
    expect(eligible(puuvaim, undefined, 30)).toBe(true);
  });

  it('ft_1_25.AC3 after a lost tug stays away until the piece is played clean three more times, whatever the minutes', () => {
    const world = recordTug(meetCharacter(empty, 'puuvaim', '1998-11-18'), 'puuvaim', { outcome: 'lost', level: 1, piece: 'puuvaim-1', at: '1998-11-18T16:00:00.000Z' });
    const met = world.met['puuvaim'];
    expect(eligible(puuvaim, met, 10_000, 2)).toBe(false);
    expect(eligible(puuvaim, met, 10_000)).toBe(false);
    expect(eligible(puuvaim, met, 100, 3)).toBe(true);
    const day = '1998-11-19';
    expect(presence(input({ day, world, characters: [{ ...puuvaim, meet: { ...puuvaim.meet, cooldownCleanPlays: 3 } }], cleanPlaysSinceLostTug: { puuvaim: 2 } }), { ...rules, maxDaysAway: 0 }).characters['puuvaim']!.where).toEqual({ at: 'away' });
    expect(presence(input({ day, world, cleanPlaysSinceLostTug: { puuvaim: 3 } }), { ...rules, maxDaysAway: 0 }).characters['puuvaim']!.where.at).toBe('scene');
  });

  it('the teacher is never met this way: she comes by boat', () => {
    expect(eligible(teacher, undefined, 10_000)).toBe(false);
  });
});

describe('turnsUp: not every day, never more than three days away (ft_1_25.AC2)', () => {
  const year = Array.from({ length: 365 }, (_, i) => dayNumber('1998-11-18') + i);

  // ft_1_21.AC12
  it('is away at most maxDaysAway days in a row, for several characters over a year', () => {
    for (const id of ['puuvaim', 'wanderer', 'a', 'b', 'c']) {
      let away = 0;
      for (const n of year) {
        away = turnsUp(id, n, rules) ? 0 : away + 1;
        expect(away, `${id} day ${n}`).toBeLessThanOrEqual(rules.maxDaysAway);
      }
    }
  });

  it('is present on some days and away on others, near the chance', () => {
    const shown = year.filter((n) => turnsUp('puuvaim', n, rules)).length;
    expect(shown).toBeGreaterThan(365 * 0.45);
    expect(shown).toBeLessThan(365 * 0.75);
  });

  it('with maxDaysAway 0 is there every day', () => {
    expect(year.every((n) => turnsUp('puuvaim', n, { appearChance: 0, maxDaysAway: 0 }))).toBe(true);
  });
});

describe('presence (ft_1_25.AC2)', () => {
  it('the same day gives the same answer', () => {
    const days = daysBetween('1998-11-18', '1998-12-17');
    expect(days).toHaveLength(30);
    for (const day of days) expect(presence(input({ day, characters: [puuvaim, twoScenes] }), rules)).toEqual(presence(input({ day, characters: [puuvaim, twoScenes] }), rules));
  });

  it('a character under its threshold is away; once eligible it turns up in one of its scenes', () => {
    expect(presence(input({ practiceMinutes: 10 }), rules).characters['puuvaim']).toEqual({ where: { at: 'away' }, phase: 'present' });
    const scenes = new Set<string>();
    for (const day of daysBetween('1998-11-18', '1999-01-31')) {
      const where = presence(input({ day, characters: [twoScenes] }), rules).characters['wanderer']!.where;
      if (where.at === 'scene') {
        scenes.add(where.scene);
        expect(where.place).toBe(where.scene);
      }
    }
    expect([...scenes].sort()).toEqual(['docks', 'knoll']);
  });

  it('the scene is drawn apart from the appearance: each of two scenes gets about half of a year of appearances', () => {
    const count = { knoll: 0, docks: 0 };
    let drawn = 0;
    for (const day of daysBetween('1968-11-18', '1998-11-17')) {
      const where = presence(input({ day, characters: [twoScenes] }), rules).characters['wanderer']!.where;
      if (where.at !== 'scene') continue;
      count[where.scene as 'knoll' | 'docks']++;
      if (Random.derive('presence', 'wanderer', dayNumber(day)).chance(rules.appearChance)) drawn++;
    }
    const all = count.knoll + count.docks;
    expect(count.knoll / all).toBeGreaterThan(0.4);
    expect(count.knoll / all).toBeLessThan(0.6);
    expect(drawn).toBeLessThan(all); // some days come from the three-day rule
  });

  it('a character with no scene is always away, and Kiur has no heads-up about it', () => {
    const p = presence(input({ characters: [{ ...puuvaim, scenes: [] }] }), rules);
    expect(p.characters['puuvaim']!.where).toEqual({ at: 'away' });
    expect(p.headsUps).toEqual([]);
  });
});

describe("Kiur's heads-ups (ft_1_25.AC5)", () => {
  it('ft_1_25.AC5 names each character in a scene by a key of the character and the scene, and only those', () => {
    const always = { ...rules, maxDaysAway: 0 };
    const p = presence(input({ characters: [puuvaim, { ...twoScenes, meet: { ...twoScenes.meet, practiceMinutes: 1000 } }] }), always);
    expect(p.headsUps).toEqual([{ character: 'puuvaim', line: 'kiur.headsUp.puuvaim.knoll' }]);
    expect(headsUpKey('wanderer', 'docks')).toBe('kiur.headsUp.wanderer.docks');
  });

  it("ft_1_25.AC5 puts the teacher's boat first: coming, then landed on the day", () => {
    const at = (deadline: string) => presence(input({ curriculum: { base: 85, pieces: [{ piece: 'little-steps', deadline, priority: 5 }], calendar: [], testWeekdays: [] }, characters: [] }), rules).headsUps;
    expect(at('1998-11-20')).toEqual([{ character: TEACHER_ID, line: 'kiur.headsUp.teacher.boat' }]);
    expect(at('1998-11-18')).toEqual([{ character: TEACHER_ID, line: 'kiur.headsUp.teacher.landed' }]);
    expect(at('1998-12-30')).toEqual([]);
    expect(headsUps({ puuvaim: { where: { at: 'scene', scene: 'knoll', place: 'knoll' }, phase: 'present' } }, { progress: 0.5 }).map((h) => h.character)).toEqual([TEACHER_ID, 'puuvaim']);
  });
});

describe("the teacher's boat (ft_1_25.AC4)", () => {
  it('comes in over boatDays to land on the next deadline day', () => {
    expect(teacherBoat('1998-11-18', [], rules)).toBeNull();
    expect(teacherBoat('1998-11-18', ['1998-11-26'], rules)).toBeNull();
    expect(teacherBoat('1998-11-18', ['1998-11-25'], rules)).toEqual({ progress: 0 });
    expect(teacherBoat('1998-11-21', ['1998-11-25'], rules)).toEqual({ progress: 3 / 7 });
    expect(teacherBoat('1998-11-25', ['1998-11-25', '1998-11-20'], rules)).toEqual({ progress: 1 });
    expect(teacherBoat('1998-11-26', ['1998-11-25'], rules)).toBeNull();
  });

  it('presence reads the deadlines from the curriculum', () => {
    const curriculum: Curriculum = { base: 85, pieces: [{ piece: 'little-steps', deadline: '1998-11-18', priority: 5 }], calendar: [] };
    expect(presence(input({ curriculum }), rules).teacherBoat).toEqual({ progress: 1 });
  });
});

describe('the world document records (ft_1_25.AC1)', () => {
  it('meeting sets the first day once and moves the last day on', () => {
    let world = meetCharacter(empty, 'puuvaim', '1998-11-18');
    world = meetCharacter(world, 'puuvaim', '1998-11-20');
    world = meetCharacter(world, 'puuvaim', '1998-11-19');
    expect(world.met['puuvaim']).toEqual({ firstDay: '1998-11-18', lastDay: '1998-11-20', taught: [], tugs: { won: 0, lost: 0, bestLevel: 0 } });
    expect(empty.met).toEqual({});
  });

  it('a won tug raises the best level, a lost one starts the cool-down, a left one changes nothing', () => {
    const met = meetCharacter(empty, 'puuvaim', '1998-11-18');
    const won = recordTug(met, 'puuvaim', { outcome: 'won', level: 2, piece: 'puuvaim-1', at: '1998-11-18T15:00:00.000Z' });
    expect(won.met['puuvaim']!.tugs).toEqual({ won: 1, lost: 0, bestLevel: 2 });
    expect(recordTug(won, 'puuvaim', { outcome: 'won', level: 1, piece: 'puuvaim-1', at: '1998-11-18T16:00:00.000Z' }).met['puuvaim']!.tugs.bestLevel).toBe(2);
    const lost = recordTug(won, 'puuvaim', { outcome: 'lost', level: 3, piece: 'puuvaim-1', at: '1998-11-18T17:00:00.000Z' });
    expect(lost.met['puuvaim']).toMatchObject({ tugs: { won: 1, lost: 1, bestLevel: 2 }, lastLostTug: { piece: 'puuvaim-1', at: '1998-11-18T17:00:00.000Z' } });
    expect(recordTug(lost, 'puuvaim', { outcome: 'left', level: 3, piece: 'puuvaim-1', at: '1998-11-18T18:00:00.000Z' })).toBe(lost);
    expect(() => recordTug(empty, 'puuvaim', { outcome: 'won', level: 1, piece: 'puuvaim-1', at: '1998-11-18T10:00:00.000Z' })).toThrow(RangeError);
  });
});
