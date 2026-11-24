import { describe, expect, it } from 'vitest';
import fishermanJson from '../../../content/characters/fisherman.json';
import puuvaimJson from '../../../content/characters/puuvaim.json';
import { characterDefSchema } from '../character/character';
import type { Curriculum } from '../curriculum/curriculum';
import type { BarPlay, PracticeLog } from '../progression/practiceLog';
import { setCast } from './cast';
import { castToday, wandererPlay, type CastTodayInput } from './castToday';
import { DEFAULT_PRESENCE_RULES } from './presenceRules';
import { DEFAULT_WANDERER_RULES, sendWanderer } from './wanderer';
import type { WorldState } from './worldState';

const puuvaim = characterDefSchema.parse(puuvaimJson);
const fisherman = characterDefSchema.parse(fishermanJson);
const rules = { presence: DEFAULT_PRESENCE_RULES, wanderers: DEFAULT_WANDERER_RULES };
const empty: WorldState = { flags: [], items: [], met: {}, teacherVisits: [] };
const plain: Curriculum = { base: 85, pieces: [], calendar: [] };
const bar = (n: number, at: string, over: Partial<BarPlay> = {}): BarPlay => ({
  at, pieceId: 'a', bar: n, notes: 4, firstTry: 4, timing: null, mode: 'wait', tempoPercent: 100, section: null, misses: [], ...over,
});
// an hour of practice, a bar every 30 seconds
const practised: PracticeLog = { bars: Array.from({ length: 121 }, (_, i) => bar(i % 3, new Date(Date.UTC(1998, 10, 17, 9, 0, i * 30)).toISOString())) };
const input = (over: Partial<CastTodayInput> = {}): CastTodayInput => ({
  day: '1998-11-18', log: practised, dayOf: (iso) => iso.slice(0, 10), barCount: () => 3, characters: [puuvaim, fisherman],
  world: empty, curriculum: plain, openScenes: ['knoll', 'port'], learned: ['a'], ...over,
});

describe('who stands where today, for every player (ft_1_37 slice 3)', () => {
  it('ft_1_37.AC1 a character stands in its scene on a day presence picks it, never when the teacher switched it off', () => {
    const always = setCast(setCast(plain, 'puuvaim', { chance: 1 }), 'fisherman', { chance: 1 });
    expect(castToday(input({ curriculum: always }), rules).characters).toEqual({ puuvaim: 'knoll', fisherman: 'port' });
    expect(castToday(input({ curriculum: setCast(always, 'puuvaim', { on: false }) }), rules).characters).toEqual({ fisherman: 'port' });
    // a scene not open yet holds nobody
    expect(castToday(input({ curriculum: always, openScenes: ['knoll'] }), rules).characters).toEqual({ puuvaim: 'knoll' });
    // not enough practice yet: nobody
    expect(castToday(input({ curriculum: always, log: { bars: [] } }), rules).characters).toEqual({});
  });

  it('ft_1_37.AC6 a wanderer sent for today stands in an open scene and asks for a learned piece; with none learned it does not come', () => {
    const sent = sendWanderer(plain, 'traveller', '1998-11-18');
    const today = castToday(input({ curriculum: sent }), rules).wanderers;
    expect(today['traveller']?.piece).toBe('a');
    expect(['knoll', 'port']).toContain(today['traveller']?.scene);
    expect(castToday(input({ curriculum: sent, learned: [] }), rules).wanderers).toEqual({});
    expect(castToday(input({ curriculum: sent, day: '1998-11-19' }), rules).wanderers).toEqual({});
  });
});

describe("the wanderer's play (ft_1_37.AC7)", () => {
  const heard: BarPlay[] = [
    bar(0, '1998-11-25T10:00:00.000Z'),
    bar(1, '1998-11-25T10:00:10.000Z', { firstTry: 2 }),
    bar(2, '1998-11-25T10:00:20.000Z'),
  ];
  it('ft_1_37.AC7 hears the first whole play after it asked: the notes right first try of the notes', () => {
    expect(wandererPlay({ bars: heard }, 'a', 3, '1998-11-25T09:30:00.000Z')).toEqual({ right: 10, notes: 12, share: 10 / 12 });
    expect(wandererPlay({ bars: heard }, 'a', 3, '1998-11-25T11:00:00.000Z')).toBeNull();
    expect(wandererPlay({ bars: heard.slice(0, 2) }, 'a', 3, '1998-11-25T09:30:00.000Z')).toBeNull();
  });
});
