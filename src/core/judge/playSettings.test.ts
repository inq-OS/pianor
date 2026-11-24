// Covers core_01.AC10 and core_01.AC11: the two Tempo-mode options are saved per player with no save bump (d069.3).
import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAY_SETTINGS, PLAY_CHOICES, choiceSettings, followsPlayer, nextPlayChoice, playChoiceOf, playSettingsSchema } from './playSettings';

describe('play settings: the Tempo-mode start and auto reset', () => {
  it('core_01.AC10 core_01.AC11 an older save without them still reads, as the count-in and no auto reset', () => {
    const old = playSettingsSchema.parse({ mode: 'tempo', scoreView: 'colour' });
    expect(old.tempoStart).toBeUndefined();
    expect(old.autoReset).toBeUndefined();
    expect(DEFAULT_PLAY_SETTINGS).toEqual({ mode: 'wait', scoreView: 'colour' });
  });

  it('core_01.AC10 core_01.AC11 keeps both when set, and refuses an unknown start', () => {
    expect(playSettingsSchema.parse({ mode: 'tempo', scoreView: 'off', tempoStart: 'firstNote', autoReset: true })).toEqual({ mode: 'tempo', scoreView: 'off', tempoStart: 'firstNote', autoReset: true });
    expect(playSettingsSchema.safeParse({ mode: 'tempo', scoreView: 'off', tempoStart: 'later' }).success).toBe(false);
  });
});

describe('the cycling mode button', () => {
  it('core_01.AC10 core_01.AC13 goes Wait, the following clock, Tempo with a count-in, Tempo from the first note, then Wait again', () => {
    let settings = { mode: 'wait' as const, tempoStart: undefined } as Parameters<typeof playChoiceOf>[0];
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      seen.push(playChoiceOf(settings));
      settings = nextPlayChoice(settings);
    }
    expect(seen).toEqual(['wait', 'follow', 'tempo', 'tempoFirstNote', 'wait']);
  });

  it('core_01.AC10 a Tempo player of an older save (no start saved) counts in', () => {
    expect(playChoiceOf({ mode: 'tempo' })).toBe('tempo');
  });

  it('core_01.AC13 the following clock is Tempo mode started by the first note, saved with no save bump, and never Wait mode', () => {
    const follow = nextPlayChoice({ mode: 'wait' });
    expect(follow).toEqual({ mode: 'tempo', tempoStart: 'firstNote', tempoClock: 'follow' });
    expect(followsPlayer(follow)).toBe(true);
    expect(followsPlayer({ mode: 'wait', tempoClock: 'follow' })).toBe(false);
    expect(followsPlayer({ mode: 'tempo' })).toBe(false);
    expect(playSettingsSchema.parse({ mode: 'tempo', scoreView: 'colour' }).tempoClock).toBeUndefined();
    expect(playSettingsSchema.safeParse({ mode: 'tempo', scoreView: 'colour', tempoClock: 'loose' }).success).toBe(false);
    // the steps after it put the strict clock back
    expect(nextPlayChoice(follow).tempoClock).toBe('strict');
  });

  it('core_01.AC10 each choice of the mode menu saves the settings that read back as that choice, in the order of the cycle', () => {
    expect(PLAY_CHOICES).toEqual(['wait', 'follow', 'tempo', 'tempoFirstNote']);
    for (const choice of PLAY_CHOICES) expect(playChoiceOf(choiceSettings(choice))).toBe(choice);
    expect(choiceSettings('follow')).toEqual(nextPlayChoice({ mode: 'wait' }));
  });
});
