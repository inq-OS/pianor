import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scenePalette } from '../../src/game/ui/pixel/keri/keriPalette';
import { KIT } from '../../src/game/ui/pixel/keri/kit/index';
import { KIT_WOOD } from '../../src/game/ui/pixel/keri/kit/wood';
import { C } from '../../src/game/ui/pixel/palette';
import { kitSheet } from './kitSheet';

/** The kit's sheet (`npm run art:render -- kit`, d124): what the maintainer picks from. */
describe('the kit\'s sheet', () => {
  it('paints every type of the kit from the shared palette at the hour asked', () => {
    const day = kitSheet('day'), night = kitSheet('night');
    // every material and the kit's own wood (`KIT_WOOD`)
    expect(day.palette).toEqual(scenePalette({ wood: KIT_WOOD }).at('day'));
    expect(night.palette).not.toEqual(day.palette);
    expect(night.bitmap.height).toBe(day.bitmap.height);
    const stone = new Set(scenePalette().fine.stone);
    expect(day.bitmap.pixels.filter((p) => stone.has(p)).length).toBeGreaterThan(1000);
    expect(day.bitmap.width).toBeLessThanOrEqual(640);
  });

  it('paints one family when asked, says so when it has no type yet, and knows no other family', () => {
    expect(kitSheet('day', 'stones').bitmap.height).toBeLessThanOrEqual(kitSheet('day').bitmap.height);
    const none = kitSheet('day', 'trees');
    expect(none.bitmap.height).toBeLessThan(40);
    expect(none.bitmap.pixels.some((p) => p === C.dim)).toBe(true);
    expect(() => kitSheet('day', 'furniture')).toThrow(/no family "furniture"/);
  });

  it('every type\'s artist\'s note is there to read', () => {
    for (const item of KIT) expect(existsSync(`projects/painter/artists-notes/${item.note}`), `${item.id}: ${item.note}`).toBe(true);
  });
});
