import { describe, expect, it } from 'vitest';
import { lchOf } from '../../src/game/ui/pixel/paint/lab';
import { APART, scenePalette } from '../../src/game/ui/pixel/keri/keriPalette';
import { runFindings, type RunKind } from './sceneChecks';

/**
 * Keri's shared palette against the colour rules measured in Monkey Island 2 (docs/art-direction.md, d111):
 * as a material's run lightens its hue turns towards yellow or cyan, and a pale highlight is greyer than the run's most
 * saturated colour. The steps of lightness are tested in keriPalette.test.ts. Judged by day: an hour only lights them.
 */

const KIND: Record<string, RunKind> = { sky: 'sky', cloud: 'sky', sea: 'sky', ember: 'light' };

describe('Keri palette keeps the measured colour rules', () => {
  const shared = scenePalette();
  const day = shared.at('day');
  const runs = Object.entries(shared.fine as unknown as Record<string, readonly number[]>).filter(([name]) => !APART.has(name));

  it('has runs to check', () => {
    expect(runs.length).toBeGreaterThan(8);
  });

  it.each(runs)('%s turns towards the light and keeps its highlight pale', (name, places) => {
    const hexes = places.map((p) => day[p]!).sort((a, b) => lchOf(a).l - lchOf(b).l);
    expect(runFindings(name, hexes, KIND[name] ?? 'material')).toEqual([]);
  });
});
