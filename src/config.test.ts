import { describe, expect, it } from 'vitest';
import { createConfig } from './config';

describe('the autoplay switch (dev only)', () => {
  // ft_Y_09.AC1
  it('is off in a production build, whatever the address says', () => {
    const config = createConfig('?autoplay=1&scenario=messy-tempo&speed=3&device=virtual', false);
    expect(config.flags.autoplay).toBeNull();
    expect(config.flags.demo).toBeNull();
    expect(config.flags.showDraftContent).toBe(false);
  });

  it('is off unless ?autoplay=1, also in a dev build', () => {
    expect(createConfig('', true).flags.autoplay).toBeNull();
    expect(createConfig('?scenario=clean-wait', true).flags.autoplay).toBeNull();
    expect(createConfig('?autoplay=0', true).flags.autoplay).toBeNull();
    expect(createConfig('?autoplay=true', true).flags.autoplay).toBeNull();
  });

  it('asks for the scenario in the address (none: the dev code plays its default), and uses the virtual keyboard', () => {
    expect(createConfig('?autoplay=1', true).flags.autoplay).toEqual({ scenario: null, overrides: {} });
    const config = createConfig('?autoplay=1&scenario=messy-tempo', true);
    expect(config.flags.autoplay?.scenario).toBe('messy-tempo');
    expect(config.flags.virtualDevice).toBe(true);
    expect(config.flags.monitorMidi).toBe(true);
    expect(createConfig('', true).flags.virtualDevice).toBe(false);
  });

  it('reads the piece, speed and seed overrides and leaves out numbers that are not numbers', () => {
    expect(createConfig('?autoplay=1&piece=low-walk&speed=2.5&seed=9', true).flags.autoplay?.overrides).toEqual({ piece: 'low-walk', speed: 2.5, seed: 9 });
    expect(createConfig('?autoplay=1&speed=fast&seed=', true).flags.autoplay?.overrides).toEqual({});
  });
});

describe('the start command', () => {
  it('hides draft pieces in the start mode, also in a dev server, and shows them in the plain dev server', () => {
    expect(createConfig('', true, 'start').flags.showDraftContent).toBe(false);
    expect(createConfig('', true, 'development').flags.showDraftContent).toBe(true);
    expect(createConfig('', false, 'production').flags.showDraftContent).toBe(false);
  });
});

describe('the staff demo view', () => {
  it('reads the view settings from the address; a missing, zero or non-number value is left to the scene', () => {
    expect(createConfig('?demo=staff&piece=3&hints=nf&vw=1366&vh=768&zoom=1&cx=400&cy=200', true).flags.staffDemo)
      .toEqual({ piece: 3, hints: 'nf', vw: 1366, vh: 768, zoom: 1, cx: 400, cy: 200 });
    expect(createConfig('?vw=wide&zoom=0', true).flags.staffDemo)
      .toEqual({ piece: null, hints: '', vw: null, vh: null, zoom: null, cx: null, cy: null });
  });
});

describe('the debug log switch (ft_Y_15)', () => {
  it('keeps the debug log with ?debug=1, in a production build too (npm run start:local)', () => {
    expect(createConfig('?debug=1', false).flags.debug).toBe(true);
    expect(createConfig('?debug=1', true).flags.debug).toBe(true);
    expect(createConfig('', false).flags.debug).toBe(false);
    expect(createConfig('?debug=0', true).flags.debug).toBe(false);
  });
});

describe('the any-size switch (d105, dev only)', () => {
  it('steps the game loop on a timer with ?loop=timer in a dev build only', () => {
    expect(createConfig('?loop=timer', true).flags.timerLoop).toBe(true);
    expect(createConfig('?loop=timer', false).flags.timerLoop).toBe(false);
    expect(createConfig('', true).flags.timerLoop).toBe(false);
    expect(createConfig('?loop=raf', true).flags.timerLoop).toBe(false);
  });

  it('turns the small-window guard off with ?anysize=1 in a dev build only', () => {
    expect(createConfig('?anysize=1', true).flags.anySize).toBe(true);
    expect(createConfig('?anysize=1', false).flags.anySize).toBe(false);
    expect(createConfig('', true).flags.anySize).toBe(false);
    expect(createConfig('?anysize=0', true).flags.anySize).toBe(false);
    // ft_1_07.AC1: the four test players only in a dev server
    expect(createConfig('?players=test', true).flags.testPlayers).toBe(true);
    expect(createConfig('?players=test', false).flags.testPlayers).toBe(false);
    expect(createConfig('', true).flags.testPlayers).toBe(false);
  });
});

describe('the actors switch (ft_1_24.AC3)', () => {
  it('ft_1_24.AC3 stands the demo cast in the scenes with ?actors=1, in a dev build only', () => {
    expect(createConfig('', true).flags.actors).toBe(false);
    expect(createConfig('?actors=1', true).flags.actors).toBe(true);
    expect(createConfig('?actors=1', false).flags.actors).toBe(false);
  });
});

describe('the beings switch (ft_1_19.AC8)', () => {
  it('ft_1_19.AC8 keeps the beings out of the scenes unless ?beings=1 asks for them, in any build', () => {
    expect(createConfig('', true).flags.beings).toBe(false);
    expect(createConfig('?beings=0', true).flags.beings).toBe(false);
    expect(createConfig('?beings=1', true).flags.beings).toBe(true);
    expect(createConfig('?beings=1', false).flags.beings).toBe(true);
  });
});

describe('the band is the default (ft_1_20.AC10)', () => {
  it('ft_1_20.AC10 has no band switch any more: the band is drawn on every screen, whatever the URL says', () => {
    for (const query of ['', '?band=0', '?band=1']) expect('band' in createConfig(query, true).flags).toBe(false);
  });
});

describe('the scenery\'s motion (d127)', () => {
  it('moves unless the page asks for ?motion=still, in a dev and a production build alike', () => {
    expect(createConfig('', true).theme.reducedMotion).toBe(false);
    expect(createConfig('?motion=still', false).theme.reducedMotion).toBe(true);
    expect(createConfig('?motion=still', true).theme.reducedMotion).toBe(true);
    expect(createConfig('?motion=on', false).theme.reducedMotion).toBe(false);
  });
});

describe('the sky switches (ft_1_14 AC6, dev only)', () => {
  // ft_1_14.AC6
  it('reads ?sky= (a known phase only) and ?now= (an ISO instant) in a dev build', () => {
    expect(createConfig('?sky=dusk&now=1998-11-01T14:00:00Z', true).flags.sky)
      .toEqual({ phase: 'dusk', now: Date.UTC(1998, 10, 1, 14, 0), wind: null });
    expect(createConfig('?sky=noon&now=yesterday', true).flags.sky).toEqual({ phase: null, now: null, wind: null });
  });

  it('ft_1_06.AC12 reads ?wind= as a number or a sea state in a dev build, and never in a production build', () => {
    expect(createConfig('?wind=3', true).flags.sky.wind).toBe(3);
    expect(createConfig('?wind=calm', true).flags.sky.wind).toBe(0);
    expect(createConfig('?wind=9', true).flags.sky.wind).toBeNull();
    expect(createConfig('?wind=3', false).flags.sky.wind).toBeNull();
  });

  it('ignores both in a production build', () => {
    expect(createConfig('?sky=night&now=1998-11-01T14:00:00Z', false).flags.sky).toEqual({ phase: null, now: null, wind: null });
  });
});

describe('the learning switch', () => {
  // ft_1_32.AC6
  it('learns a new piece bar by bar unless ?learn=0, and never under autoplay', () => {
    expect(createConfig('', false).flags.learn).toBe(true);
    expect(createConfig('?learn=0', false).flags.learn).toBe(false);
    expect(createConfig('?autoplay=1', true).flags.learn).toBe(false);
  });
});
