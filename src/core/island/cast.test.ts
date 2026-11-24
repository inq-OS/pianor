import { describe, expect, it } from 'vitest';
import puuvaimJson from '../../../content/characters/puuvaim.json';
import { characterDefSchema, type CharacterDef } from '../character/character';
import type { Curriculum } from '../curriculum/curriculum';
import { dayNumber } from '../curriculum/evaluate';
import { DEFAULT_TUG_RULES } from '../exchange/tug';
import { curriculumDocument } from '../save/documents';
import {
  DEFAULT_NEEDINESS, castCharacter, castSettingOf, mayComeOn, neededShare, setCast, tugRulesFor,
} from './cast';
import type { PresenceInput } from './presence';
import { DEFAULT_PRESENCE_RULES, daysBetween, longestWait, presence } from './presenceRules';
import { weekdayOf } from './teacher';
import type { WorldState } from './worldState';

const rules = DEFAULT_PRESENCE_RULES;
const puuvaim = characterDefSchema.parse(puuvaimJson);
const empty: WorldState = { flags: [], items: [], met: {}, teacherVisits: [] };
const plain: Curriculum = { base: 85, pieces: [], calendar: [] };
const input = (curriculum: Curriculum, day: string, characters: CharacterDef[] = [puuvaim]): PresenceInput => ({
  day, practiceMinutes: 100, practiceMinutesToday: 10, characters, world: empty, curriculum, statuses: [], cleanPlaysSinceLostTug: {},
});
const month = daysBetween('1998-11-01', '1998-12-31');
const where = (curriculum: Curriculum, day: string) => presence(input(curriculum, day), rules).characters['puuvaim']!.where.at;

describe('the teacher sets each character per player (ft_1_37)', () => {
  it('ft_1_37.AC5 a curriculum without a cast reads as every character on, every day, the default chance and its own piece', () => {
    expect(castSettingOf(plain, 'puuvaim', rules)).toEqual({ on: true, weekdays: [0, 1, 2, 3, 4, 5, 6], chance: 0.5, neediness: DEFAULT_NEEDINESS });
    expect(castCharacter(puuvaim, plain)).toEqual(puuvaim);
    const old = curriculumDocument.parse(JSON.stringify({ schemaVersion: 1, base: 85, pieces: [], calendar: [] }));
    expect(old.cast).toBeUndefined();
    expect(month.map((d) => where(old, d))).toEqual(month.map((d) => where(plain, d)));
  });

  it('keeps the cast in the curriculum document and reads it back', () => {
    const curriculum = setCast(plain, 'puuvaim', { on: false, weekdays: [0], chance: 0.3, piece: 'twinkle', neediness: 4 });
    expect(curriculumDocument.parse(curriculumDocument.serialize(curriculum))).toEqual(curriculum);
    expect(() => curriculumDocument.parse(JSON.stringify({ ...curriculum, schemaVersion: 1, cast: { characters: { puuvaim: { neediness: 6 } } } }))).toThrow();
  });

  it('ft_1_37.AC1 a character switched off never stands in a scene, and on again restores the draw', () => {
    const off = setCast(plain, 'puuvaim', { on: false });
    expect(month.every((d) => where(off, d) === 'away')).toBe(true);
    const on = setCast(off, 'puuvaim', { on: true });
    expect(month.map((d) => where(on, d))).toEqual(month.map((d) => where(plain, d)));
  });

  it('ft_1_37.AC2 a character comes only on its weekdays, and the longest wait counts only those days', () => {
    const sundays = setCast(plain, 'puuvaim', { weekdays: [0] });
    const seen = month.filter((d) => where(sundays, d) === 'scene');
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((d) => weekdayOf(d) === 0)).toBe(true);
    // never more than maxDaysAway of its own days in a row away
    const own = month.filter((d) => weekdayOf(d) === 0).map((d) => where(sundays, d) === 'scene');
    let away = 0;
    for (const here of own) { away = here ? 0 : away + 1; expect(away).toBeLessThanOrEqual(rules.maxDaysAway); }
    expect(mayComeOn(castSettingOf(sundays, 'puuvaim', rules), '1998-11-01')).toBe(weekdayOf('1998-11-01') === 0);
    expect(month.every((d) => where(setCast(plain, 'puuvaim', { weekdays: [] }), d) === 'away')).toBe(true);
  });

  it('ft_1_37.AC3 how often a character comes is its own chance on its days', () => {
    const always = setCast(plain, 'puuvaim', { chance: 1 });
    expect(month.every((d) => where(always, d) === 'scene')).toBe(true);
    expect(month.every((d) => where(setCast(plain, 'puuvaim', { chance: 0 }), d) === 'away')).toBe(true);
    const year = daysBetween('1998-01-01', '2000-12-31');
    const rare = setCast(plain, 'puuvaim', { chance: 0.1 });
    const often = setCast(plain, 'puuvaim', { chance: 0.9 });
    const count = (c: Curriculum) => year.filter((d) => where(c, d) === 'scene').length;
    expect(count(rare)).toBeLessThan(count(plain));
    expect(count(plain)).toBeLessThan(count(often));
    expect(dayNumber(year[0]!)).toBeLessThan(dayNumber(year[1]!));
    expect([0.1, 0.3, 0.5, 1].map((c) => longestWait(c, rules))).toEqual([15, 5, 3, 2]);
  });

  it('ft_1_37.AC4 a piece the teacher picks replaces the character\'s own at every level it teaches', () => {
    const given = castCharacter(puuvaim, setCast(plain, 'puuvaim', { piece: 'twinkle' }));
    expect(given.phrases).toEqual({ 1: ['twinkle'], 2: ['twinkle'], 3: ['twinkle'] });
    expect({ ...given, phrases: puuvaim.phrases }).toEqual(puuvaim);
  });

  it('ft_1_37.AC8 neediness moves the share a play needs by 10 points a step from 3, never past all the notes', () => {
    expect(neededShare(0.6, 3)).toBe(0.6);
    expect(neededShare(0.6, 1)).toBe(0.4);
    expect(neededShare(0.8, 5)).toBe(1);
    expect(neededShare(0.95, 4)).toBe(1);
    expect(neededShare(0.95, 2)).toBe(0.85);
    const strict = tugRulesFor(DEFAULT_TUG_RULES, 5);
    expect(strict.levels.map((l) => l.share)).toEqual([0.8, 1, 1]);
    expect(tugRulesFor(DEFAULT_TUG_RULES, 3)).toEqual(DEFAULT_TUG_RULES);
  });
});
