import { describe, expect, it } from 'vitest';
import { pieceTitle } from './pieceTitle';

describe('piece titles per locale (ft_0_18.AC4)', () => {
  const withEt = { title: 'Ode to Joy', titles: { et: 'Ood rõõmule' } };
  const english = { title: 'Quiet Pond' };

  it('ft_0_18.AC4 shows the Estonian title in Estonian where the piece gives one', () => {
    expect(pieceTitle(withEt, 'et')).toBe('Ood rõõmule');
  });

  it('ft_0_18.AC4 falls back to the English title where the piece gives no Estonian one', () => {
    expect(pieceTitle(english, 'et')).toBe('Quiet Pond');
  });

  it('ft_0_18.AC4 shows the English title in English, even when an Estonian one exists', () => {
    expect(pieceTitle(withEt, 'en')).toBe('Ode to Joy');
  });

  it('ft_0_18.AC4 treats an explicitly undefined Estonian title as absent', () => {
    expect(pieceTitle({ title: 'Quiet Pond', titles: { et: undefined } }, 'et')).toBe('Quiet Pond');
  });
});
