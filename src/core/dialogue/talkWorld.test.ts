// Covers ft_1_22.AC1 (what a conversation reads from the player's world and writes back to it).
import { describe, expect, it } from 'vitest';
import type { WorldState } from '../island/worldState';
import { applyTalkEffects, talkFactsOf } from './talkWorld';

const empty: WorldState = { flags: [], items: [], met: {}, teacherVisits: [] };
const met = (taught: string[]): WorldState['met'][string] => ({ firstDay: '1998-11-18', lastDay: '1998-11-19', taught, tugs: { won: 0, lost: 0, bestLevel: 0 } });

describe('a conversation and the player\'s world (ft_1_22.AC1, WP-08)', () => {
  it('ft_1_22.AC1 the facts are the world\'s flags, items, the characters met and every phrase taught, with the level', () => {
    const world: WorldState = { ...empty, flags: ['a'], items: ['golden-leaf'], met: { puuvaim: met(['puuvaim-1']), other: met(['other-1']) } };
    expect(talkFactsOf(world, 3, false)).toEqual({ flags: ['a'], items: ['golden-leaf'], met: ['puuvaim', 'other'], taught: ['puuvaim-1', 'other-1'], level: 3, knowledge: false });
  });

  it('ft_1_22.AC1 flag and item effects change the world once; outcomes and the rest leave it as it was', () => {
    const after = applyTalkEffects(empty, [{ setFlag: 'met-puuvaim' }, { setFlag: 'met-puuvaim' }, { give: 'golden-leaf' }, { leave: true }]);
    expect(after).toEqual({ ...empty, flags: ['met-puuvaim'], items: ['golden-leaf'] });
    expect(applyTalkEffects(after, [{ clearFlag: 'met-puuvaim' }, { take: 'golden-leaf' }])).toEqual(empty);
    expect(applyTalkEffects(empty, [{ leave: true }])).toBe(empty);
  });

  it('does not change the world it was given', () => {
    const frozen = structuredClone(empty);
    applyTalkEffects(empty, [{ setFlag: 'x' }]);
    expect(empty).toEqual(frozen);
  });
});
