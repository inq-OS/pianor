import { describe, expect, it } from 'vitest';
import { cardShowing, showsTitle } from './menuCard';

describe('the autoplay finds a piece card by its title', () => {
  it('takes the whole title, or its start cut with an ellipsis beside a curriculum hat', () => {
    expect(showsTitle('Au Clair de la Lune', 'Au Clair de la Lune')).toBe(true);
    expect(showsTitle('Au Clair de l…', 'Au Clair de la Lune')).toBe(true);
    expect(showsTitle('Au Clair de l', 'Au Clair de la Lune')).toBe(false);
    expect(showsTitle('Ode to J…', 'Au Clair de la Lune')).toBe(false);
    expect(showsTitle('…', 'Au Clair de la Lune')).toBe(false);
  });

  it('prefers a whole title over a cut one that would also fit', () => {
    expect(cardShowing(['Ode to Joy, L…', 'Ode to Joy'], 'Ode to Joy')).toBe(1);
    expect(cardShowing(['Little Steps', 'Au Clair de l…'], 'Au Clair de la Lune')).toBe(1);
    expect(cardShowing(['Little Steps'], 'Au Clair de la Lune')).toBe(-1);
  });
});
