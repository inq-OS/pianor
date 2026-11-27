// Covers core_01.AC10.
import { describe, expect, it } from 'vitest';
import { PLAY_CHOICES } from '../../core/judge/playSettings';
import { modeTooltip } from './modeText';

describe('the play mode chooser', () => {
  it('core_01.AC10 gives each mode its own tooltip, so Tempo does not repeat what Wait says', () => {
    const tips = PLAY_CHOICES.map(modeTooltip);
    expect(new Set(tips).size).toBe(PLAY_CHOICES.length);
    expect(modeTooltip('wait')).not.toBe(modeTooltip('tempo'));
  });
});
