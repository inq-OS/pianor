// Covers ft_1_22.AC3 (a character teaches a phrase: three tries, each judged as a tug's exchange; heard when one passes).
import { describe, expect, it } from 'vitest';
import type { CharacterDef } from '../character/character';
import type { WorldState } from '../island/worldState';
import { DEFAULT_TUG_RULES } from './tug';
import { TEACH_TRIES, advanceTeach, startTeach, teachAfter, teachLevelOf } from './teach';

const rules = DEFAULT_TUG_RULES;
const empty: WorldState = { flags: [], items: [], met: {}, teacherVisits: [] };
const met: WorldState = { ...empty, met: { puuvaim: { firstDay: '1998-11-20', lastDay: '1998-11-20', taught: [], tugs: { won: 0, lost: 0, bestLevel: 0 } } } };
const puuvaim = { phrases: { '1': ['puuvaim-1'], '2': ['puuvaim-2'], '3': ['puuvaim-3'] } } as unknown as CharacterDef;

describe('teaching a phrase (ft_1_22.AC3)', () => {
  it('ft_1_22.AC3 the student has three tries; a try passes at the level\'s share of notes right first try', () => {
    expect(TEACH_TRIES).toBe(3);
    let s = startTeach('puuvaim-1', 1);
    expect(s).toMatchObject({ piece: 'puuvaim-1', level: 1, tries: [] });
    s = advanceTeach(s, 0.5, rules);
    expect(s.tries).toEqual([false]);
    expect(s.outcome).toBeUndefined();
    s = advanceTeach(s, 0.6, rules);
    expect(s).toMatchObject({ tries: [false, true], outcome: 'heard' });
    // a level's share decides: 0.7 is not enough at level 2 (0.8)
    expect(advanceTeach(startTeach('puuvaim-2', 2), 0.7, rules).tries).toEqual([false]);
  });

  it('ft_1_22.AC3 three tries missed: not yet, with no loss; a finished teaching takes no more tries', () => {
    let s = startTeach('puuvaim-1', 1);
    for (let i = 0; i < TEACH_TRIES; i++) s = advanceTeach(s, 0, rules);
    expect(s).toMatchObject({ tries: [false, false, false], outcome: 'notYet' });
    expect(() => advanceTeach(s, 1, rules)).toThrow(RangeError);
  });

  it('ft_1_22.AC3 a heard phrase is kept with the character who taught it, once; not yet keeps nothing', () => {
    const heard = advanceTeach(startTeach('puuvaim-1', 1), 1, rules);
    const after = teachAfter(met, 'puuvaim', heard, '1998-11-20');
    expect(after.met['puuvaim']!.taught).toEqual(['puuvaim-1']);
    // the day it was taught is kept, once: heard becomes mine on a later day (ft_1_22.AC5)
    expect(after.met['puuvaim']!.taughtOn).toEqual({ 'puuvaim-1': '1998-11-20' });
    const again = teachAfter(after, 'puuvaim', heard, '1998-11-22');
    expect(again.met['puuvaim']!.taught).toEqual(['puuvaim-1']);
    expect(again.met['puuvaim']!.taughtOn).toEqual({ 'puuvaim-1': '1998-11-20' });
    let missed = startTeach('puuvaim-1', 1);
    for (let i = 0; i < TEACH_TRIES; i++) missed = advanceTeach(missed, 0, rules);
    expect(teachAfter(met, 'puuvaim', missed, '1998-11-20')).toEqual(met);
    // an unfinished teaching, or one by a character never met, is refused
    expect(() => teachAfter(met, 'puuvaim', startTeach('puuvaim-1', 1), '1998-11-20')).toThrow(RangeError);
    expect(() => teachAfter(empty, 'puuvaim', heard, '1998-11-20')).toThrow(RangeError);
  });

  it('the level of a taught piece is the level the character plays it at; 1 for a piece not among its phrases', () => {
    expect(teachLevelOf(puuvaim, 'puuvaim-2')).toBe(2);
    expect(teachLevelOf(puuvaim, 'puuvaim-3')).toBe(3);
    expect(teachLevelOf(puuvaim, 'other')).toBe(1);
  });
});
