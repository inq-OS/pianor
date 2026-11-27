// Covers ft_1_33.AC1, ft_1_33.AC3, ft_1_02d.AC50 (the piece maker's help as pictures).
import { describe, expect, it } from 'vitest';
import { t } from '../text/strings';
import { HELP_CARDS, KEY_CAP, KEY_TOUR } from './help';
import { clickOutcome, mouseAction } from './mouse';

describe('the piece maker help as pictures (ft_1_33)', () => {
  it('ft_1_33.AC1 every card that is a press shows what that press does', () => {
    // a drag is no click: it selects bars, so only the clicks are held to clickOutcome
    for (const card of HELP_CARDS) if (card.press && card.gesture !== 'drag') expect(clickOutcome(card.press, card.press.on)).toBe(card.press.outcome);
    // the drag is a plain left press, the one that starts the lasso
    for (const card of HELP_CARDS) if (card.gesture === 'drag') expect(mouseAction(card.press!)).toBe('select');
    const outcomes = HELP_CARDS.map((c) => c.press?.outcome);
    for (const outcome of ['write', 'select', 'lengthen'] as const) expect(outcomes).toContain(outcome);
    // ft_1_02d.AC50 the first card is a plain left click that writes a note; the touchpad's Alt + left lengthens like the middle button
    expect(HELP_CARDS[0]).toMatchObject({ gesture: 'left', press: { button: 0, altKey: false, on: 'place', outcome: 'write' } });
    expect(HELP_CARDS.some((c) => c.key === 'alt' && c.press?.outcome === 'lengthen')).toBe(true);
    expect(HELP_CARDS.filter((c) => c.gesture === 'wheelUp').map((c) => c.key ?? 'none')).toEqual(['none', 'ctrl']);
  });

  it('ft_1_33.AC1 every card changes the staff: its picture after is not the one before', () => {
    for (const card of HELP_CARDS) expect(JSON.stringify({ ...card.after, pointer: undefined })).not.toBe(JSON.stringify({ ...card.before, pointer: undefined }));
  });

  it('ft_1_33.AC3 the keys tour shows the cursor, then its bar, then the band, and every word is a string', () => {
    expect(KEY_TOUR.map((s) => s.spot)).toEqual(['cursor', 'cursor', 'cursor', 'bar', 'band']);
    for (const key of [...KEY_TOUR.map((s) => s.line), ...Object.values(KEY_CAP)]) expect(t(key)).not.toBe('');
  });
});
