import { afterEach, describe, expect, it } from 'vitest';
import { forgetKiurDays, remindedOn, roomVisit } from './kiurDay';

afterEach(() => forgetKiurDays());

describe("what Kiur remembers of today (ft_1_27.AC3)", () => {
  it('ft_1_27.AC3 the first visit after the game opened is the opening; later ones count up, per player and day', () => {
    expect(roomVisit('a', '1998-11-20')).toEqual({ occasion: 'open', visit: 0, remindedToday: false });
    expect(roomVisit('a', '1998-11-20')).toEqual({ occasion: 'room', visit: 1, remindedToday: false });
    expect(roomVisit('b', '1998-11-20')).toEqual({ occasion: 'open', visit: 0, remindedToday: false });
    remindedOn('a', '1998-11-20');
    expect(roomVisit('a', '1998-11-20')).toEqual({ occasion: 'room', visit: 2, remindedToday: true });
    // a new day: nothing reminded yet, the visits count from 0
    expect(roomVisit('a', '1998-11-21')).toEqual({ occasion: 'room', visit: 0, remindedToday: false });
  });
});
