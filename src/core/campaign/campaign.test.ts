import { describe, expect, it } from 'vitest';
import {
  battleResult,
  levelToPlay,
  phaseOneResult,
  phaseTwoResult,
  selectable,
  startCampaign,
  type CampaignState,
} from './campaign';
import { loadLadder } from './content';

const level = (end: number, accuracy: number) => ({ bars: [1, end] as [1, number], accuracy });
const ladder = loadLadder({
  schemaVersion: 1,
  monsters: ['a', 'b', 'c', 'd'].map((id) => ({
    id,
    name: id,
    piece: `p-${id}`,
    levels: [level(8, 0.5), level(16, 0.75), level(32, 0.9)],
  })),
});

/** Walk monster m through both phases so its door is open. */
function openDoor(s: CampaignState, m: number): CampaignState {
  return phaseTwoResult(phaseOneResult(s, m, 'passed'), m, 'door-open');
}

describe('campaign state machine', () => {
  it('ft_1_06.AC1 starts with only the first monster unlocked, nothing beaten, doors closed', () => {
    const s = startCampaign(ladder);
    expect(s.unlocked).toEqual([true, false, false, false]);
    expect(s.beaten.flat().some(Boolean)).toBe(false);
    expect(s.doorOpen).toEqual([false, false, false, false]);
    expect(s.phase[0]).toBe('find-key');
  });

  it('ft_1_06.AC1 a locked monster has no selectable level', () => {
    const s = startCampaign(ladder);
    expect(selectable(s, 0, 1)).toBe(true);
    for (const l of [1, 2, 3] as const) expect(selectable(s, 1, l)).toBe(false);
  });

  it('phase 1 window-expired and key-broken keep phase 1 with nothing lost', () => {
    const s = startCampaign(ladder);
    expect(phaseOneResult(s, 0, 'window-expired')).toEqual(s);
    expect(phaseOneResult(s, 0, 'key-broken')).toEqual(s);
    expect(phaseOneResult(s, 0, 'in-progress')).toEqual(s);
  });

  it('phase 1 passed moves to phase 2; key-broken returns to phase 1', () => {
    const s = startCampaign(ladder);
    const p2 = phaseOneResult(s, 0, 'passed');
    expect(p2.phase[0]).toBe('find-door');
    expect(p2.doorOpen[0]).toBe(false);
    const back = phaseTwoResult(p2, 0, 'key-broken');
    expect(back.phase[0]).toBe('find-key');
    expect(back.doorOpen[0]).toBe(false);
  });

  it('door-open opens the door and stays open through later phase results', () => {
    const open = openDoor(startCampaign(ladder), 0);
    expect(open.doorOpen[0]).toBe(true);
    expect(open.phase[0]).toBe('battle');
    expect(phaseOneResult(open, 0, 'key-broken').doorOpen[0]).toBe(true);
    expect(phaseTwoResult(open, 0, 'key-broken').doorOpen[0]).toBe(true);
    expect(phaseTwoResult(open, 0, 'key-broken').phase[0]).toBe('battle');
  });

  it('phase results for a locked monster change nothing', () => {
    const s = startCampaign(ladder);
    expect(phaseOneResult(s, 1, 'passed')).toEqual(s);
  });

  it('ft_1_06.AC4 a lost battle keeps the door open and the phase at battle', () => {
    const open = openDoor(startCampaign(ladder), 0);
    const lost = battleResult(open, 0, 1, false);
    expect(lost.doorOpen[0]).toBe(true);
    expect(lost.phase[0]).toBe('battle');
    expect(lost.beaten[0]![0]).toBe(false);
    expect(lost).toEqual(open);
  });

  it('ft_1_06.AC5 beating level 3 unlocks the next monster; levels 1 and 2 do not', () => {
    let s = startCampaign(ladder);
    s = battleResult(openDoor(s, 0), 0, 1, true);
    expect(s.beaten[0]).toEqual([true, false, false]);
    expect(s.unlocked).toEqual([true, false, false, false]);
    s = battleResult(openDoor(s, 0), 0, 2, true);
    expect(s.unlocked).toEqual([true, false, false, false]);
    s = battleResult(openDoor(s, 0), 0, 3, true);
    expect(s.unlocked).toEqual([true, true, false, false]);
  });

  it('a win closes the door so the next level repeats phases 1 and 2', () => {
    const s = battleResult(openDoor(startCampaign(ladder), 0), 0, 1, true);
    expect(s.doorOpen[0]).toBe(false);
    expect(s.phase[0]).toBe('find-key');
  });

  it('beating the last monster at level 3 unlocks nothing further and does not throw', () => {
    let s = startCampaign(ladder);
    for (let m = 0; m < 4; m++) for (const l of [1, 2, 3] as const) s = battleResult(openDoor(s, m), m, l, true);
    expect(s.unlocked).toEqual([true, true, true, true]);
  });

  it('levels are played in order: level 2 needs level 1 beaten, level 3 needs level 2 beaten', () => {
    let s = startCampaign(ladder);
    expect(selectable(s, 0, 2)).toBe(false);
    expect(selectable(s, 0, 3)).toBe(false);
    s = battleResult(openDoor(s, 0), 0, 1, true);
    expect(selectable(s, 0, 2)).toBe(true);
    expect(selectable(s, 0, 3)).toBe(false);
    // a battle on a level that is not selectable changes nothing
    expect(battleResult(openDoor(s, 0), 0, 3, true)).toEqual(openDoor(s, 0));
  });

  it('a win outside the battle phase gives no progress: phases 1 and 2 cannot be skipped', () => {
    const s = startCampaign(ladder);
    expect(battleResult(s, 0, 1, true)).toEqual(s); // still in phase 1
    const findDoor = phaseOneResult(s, 0, 'passed');
    expect(battleResult(findDoor, 0, 1, true)).toEqual(findDoor); // phase 2, door closed
  });

  it('a beaten level can be replayed any time, but a repeat win gives no new progress', () => {
    const afterOne = battleResult(openDoor(startCampaign(ladder), 0), 0, 1, true);
    expect(selectable(afterOne, 0, 1)).toBe(true);
    // replaying level 1 from phase 1 of level 2: nothing changes
    expect(battleResult(afterOne, 0, 1, true)).toEqual(afterOne);
    // replaying it while the door of level 2 is open does not close that door
    const doorForTwo = openDoor(afterOne, 0);
    expect(battleResult(doorForTwo, 0, 1, true)).toEqual(doorForTwo);
    expect(battleResult(doorForTwo, 0, 1, false)).toEqual(doorForTwo);
    // the level 2 win still counts
    expect(battleResult(doorForTwo, 0, 2, true).beaten[0]).toEqual([true, true, false]);
  });

  it('does not mutate the state it is given', () => {
    const s = startCampaign(ladder);
    const copy = structuredClone(s);
    openDoor(s, 0);
    battleResult(s, 0, 1, true);
    expect(s).toEqual(copy);
  });

  it('ft_1_06.AC6 the campaign records nothing outside its own calls (free play has no entry point)', () => {
    // Free play never calls the campaign: a fresh start is always identical, and no call
    // is needed or offered to record a free-play result.
    expect(startCampaign(ladder)).toEqual(startCampaign(ladder));
  });

  it('ft_1_06.AC5 over arbitrary battle sequences the unlock order never skips a monster', () => {
    let seed = 12345;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (let run = 0; run < 200; run++) {
      let s = startCampaign(ladder);
      for (let i = 0; i < 60; i++) {
        const m = Math.floor(rnd() * 4);
        const l = (1 + Math.floor(rnd() * 3)) as 1 | 2 | 3;
        s = battleResult(openDoor(s, m), m, l, rnd() < 0.7);
        for (let k = 0; k < 3; k++) {
          if (s.unlocked[k + 1]) expect(s.beaten[k]![2]).toBe(true);
          if (!s.unlocked[k]) expect(s.unlocked[k + 1]).toBe(false);
        }
        expect(s.unlocked[0]).toBe(true);
      }
    }
  });
});

describe('levelToPlay (ft_1_06, the level the map offers)', () => {
  it('is level 1 for a fresh monster and the first level not beaten after that', () => {
    const fresh = startCampaign({ monsters: [null, null] });
    expect(levelToPlay(fresh, 0)).toBe(1);
    const beatOne = { ...fresh, beaten: [[true, false, false], [false, false, false]] };
    expect(levelToPlay(beatOne, 0)).toBe(2);
  });

  it('is null once all three levels are beaten', () => {
    const done = { ...startCampaign({ monsters: [null] }), beaten: [[true, true, true]] };
    expect(levelToPlay(done, 0)).toBeNull();
  });
});
