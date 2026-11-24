import { describe, expect, it } from 'vitest';
import type { Curriculum } from '../../core/curriculum/curriculum';
import { DEFAULT_PRESENCE_RULES } from '../../core/island/presenceRules';
import { DEFAULT_WANDERER_RULES } from '../../core/island/wanderer';
import { castLines, castValues, sentToday, stepChance, stepNeediness, toggleCastDay, toggleOn, toggleSend, withPiece } from './castForm';

const plain: Curriculum = { base: 85, pieces: [], calendar: [] };
const rules = { presence: DEFAULT_PRESENCE_RULES, wanderers: DEFAULT_WANDERER_RULES, tugShares: [0.6, 0.8, 0.95] };
const today = '1998-11-18';

describe("the teacher's cast page (ft_1_37)", () => {
  it('a character has on, days, how often, piece and neediness; a wanderer its piece, neediness and the sending', () => {
    expect(castLines('character')).toEqual(['on', 'days', 'often', 'piece', 'needy']);
    expect(castLines('wanderer')).toEqual(['on', 'piece', 'needy', 'send']);
  });

  it('ft_1_37.AC5 shows the defaults for a player the teacher never set: on, every day, 50 per cent, its own piece, 3', () => {
    expect(castValues(plain, 'puuvaim', 'character', today, rules)).toEqual({
      on: true, days: [1, 2, 3, 4, 5, 6, 0], often: 50, piece: undefined, needy: 3, shares: [60, 80, 95], sent: false,
    });
    expect(castValues(plain, 'traveller', 'wanderer', today, rules).shares).toEqual([80]);
  });

  it('ft_1_37.AC1 ft_1_37.AC2 ft_1_37.AC3 a press turns it on or off, a weekday on or off, and steps how often by 10 within 10 to 100', () => {
    expect(castValues(toggleOn(plain, 'puuvaim'), 'puuvaim', 'character', today, rules).on).toBe(false);
    expect(toggleOn(toggleOn(plain, 'puuvaim'), 'puuvaim').cast?.characters).toEqual({});
    expect(castValues(toggleCastDay(plain, 'puuvaim', 0), 'puuvaim', 'character', today, rules).days).toEqual([1, 2, 3, 4, 5, 6]);
    expect(castValues(toggleCastDay(toggleCastDay(plain, 'puuvaim', 0), 'puuvaim', 0), 'puuvaim', 'character', today, rules).days).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(castValues(stepChance(plain, 'puuvaim', 10, rules.presence), 'puuvaim', 'character', today, rules).often).toBe(60);
    let low = plain;
    for (let i = 0; i < 9; i++) low = stepChance(low, 'puuvaim', -10, rules.presence);
    expect(castValues(low, 'puuvaim', 'character', today, rules).often).toBe(10);
    let high = plain;
    for (let i = 0; i < 9; i++) high = stepChance(high, 'puuvaim', 10, rules.presence);
    expect(castValues(high, 'puuvaim', 'character', today, rules).often).toBe(100);
  });

  it('ft_1_37.AC4 ft_1_37.AC8 picks a piece and back to its own, and steps neediness 1 to 5 with the shares it needs', () => {
    const given = withPiece(plain, 'puuvaim', 'twinkle');
    expect(castValues(given, 'puuvaim', 'character', today, rules).piece).toBe('twinkle');
    expect(castValues(withPiece(given, 'puuvaim', undefined), 'puuvaim', 'character', today, rules).piece).toBeUndefined();
    let needy = plain;
    for (let i = 0; i < 4; i++) needy = stepNeediness(needy, 'puuvaim', 1);
    expect(castValues(needy, 'puuvaim', 'character', today, rules)).toMatchObject({ needy: 5, shares: [80, 100, 100] });
    let easy = plain;
    for (let i = 0; i < 4; i++) easy = stepNeediness(easy, 'traveller', -1);
    expect(castValues(easy, 'traveller', 'wanderer', today, rules)).toMatchObject({ needy: 1, shares: [60] });
  });

  it('ft_1_37.AC6 sends a wanderer for today with its piece, and a second press takes it back', () => {
    const sent = toggleSend(withPiece(plain, 'traveller', 'twinkle'), 'traveller', today);
    expect(sentToday(sent, 'traveller', today)).toBe(true);
    expect(sent.cast?.sent).toEqual([{ wanderer: 'traveller', day: today }]);
    expect(castValues(sent, 'traveller', 'wanderer', today, rules).sent).toBe(true);
    expect(sentToday(toggleSend(sent, 'traveller', today), 'traveller', today)).toBe(false);
    expect(sentToday(sent, 'traveller', '1998-11-19')).toBe(false);
  });
});
