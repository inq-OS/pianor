// Covers ft_1_33.AC1, ft_1_33.AC3 (the piece maker's help as pictures).
import { describe, expect, it } from 'vitest';
import { t } from '../text/strings';
import { HELP_CARDS, KEY_CAP, KEY_TOUR } from './help';
import { mouseAction } from './mouse';

describe('the piece maker help as pictures (ft_1_33)', () => {
  it('ft_1_33.AC1 every card that is a press shows what that press does', () => {
    for (const card of HELP_CARDS) if (card.press) expect(mouseAction(card.press)).toBe(card.press.action);
    const actions = HELP_CARDS.map((c) => c.press?.action);
    for (const action of ['place', 'select', 'remove'] as const) expect(actions).toContain(action);
    // the touchpad's way to place a note, and the wheel's two turns
    expect(HELP_CARDS.some((c) => c.key === 'alt' && c.press?.action === 'place')).toBe(true);
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
