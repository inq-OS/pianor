// Covers ft_0_05.AC4.
import { describe, expect, it } from 'vitest';
import { sheetPlan } from '../../src/core/layout/sheet';
import { paintParchment, PARCHMENT_PALETTE, PARCHMENT_RUNS } from '../../src/game/ui/pixel/paint/parchment';
import { runFindings, runsDeclared, useFindings } from './sceneChecks';

/**
 * The sheet of parchment under the staff (d119) against the measured rules of colour every painted picture keeps
 * (docs/art-direction.md rule 19, d111). It is painted in the game, at the staff's size, so it is not one of
 * the build's pictures (`pictures.ts`); it is painted here at the sizes of the target screen.
 */
describe('the parchment keeps the rules of colour of a painted picture (d119)', () => {
  it('names its runs, and they are sound', () => {
    expect(runsDeclared(PARCHMENT_RUNS, PARCHMENT_PALETTE)).toEqual([]);
  });

  it.each(Object.entries(PARCHMENT_RUNS))('the run of the %s has small steps, turns its hue towards the light and keeps a pale highlight', (name, places) => {
    expect(runFindings(name, places.map((place) => PARCHMENT_PALETTE[place]!), 'material')).toEqual([]);
  });

  it.each([
    ['the piece maker', sheetPlan(640, 248, { left: 15, right: 625, top: 20, bottom: 228 })],
    ['practice', sheetPlan(640, 108, { left: 18, right: 622, top: 10, bottom: 97 })],
    ['a staff with no room for an edge', sheetPlan(640, 144, { left: 3, right: 637, top: 2, bottom: 142 })],
  ])('under %s it is painted from its runs with no coarse dither', (_, plan) => {
    expect(useFindings(paintParchment(plan), PARCHMENT_PALETTE, PARCHMENT_RUNS)).toEqual([]);
  });
});
