/**
 * What a conversation reads from the player's world and what its effects write back (ft_1_22.AC1, WP-09 on WP-08's
 * `WorldState`). Pure. Only the flag and item effects change the world here; the outcomes (`teach`, `tug`, `checkup`,
 * `leave`) are the scene's to start, and `teach` and the tug write their own records (WP-12, WP-13).
 */
import type { WorldState } from '../island/worldState';
import type { Effect } from './conversation';
import type { TalkFacts } from './talk';

/** The facts a conversation's conditions read, from the world, the player's level and the knowledge switch (d132). */
export function talkFactsOf(world: WorldState, level: number, knowledge: boolean): TalkFacts {
  const met = Object.keys(world.met);
  return {
    flags: [...world.flags],
    items: [...world.items],
    met,
    taught: met.flatMap((id) => world.met[id]!.taught),
    level,
    knowledge,
  };
}

/** The world after a node's effects; the same object when none of them changes it. */
export function applyTalkEffects(world: WorldState, effects: readonly Effect[]): WorldState {
  let next = world;
  for (const e of effects) {
    if ('setFlag' in e && !next.flags.includes(e.setFlag)) next = { ...next, flags: [...next.flags, e.setFlag] };
    else if ('clearFlag' in e && next.flags.includes(e.clearFlag)) next = { ...next, flags: next.flags.filter((f) => f !== e.clearFlag) };
    else if ('give' in e && !next.items.includes(e.give)) next = { ...next, items: [...next.items, e.give] };
    else if ('take' in e && next.items.includes(e.take)) next = { ...next, items: next.items.filter((i) => i !== e.take) };
  }
  return next;
}
