// Covers ft_1_10.AC6 (the length is whole seconds 1 to 3; repeat is on or off) and ft_1_10.AC9 (the defaults are 1 second and repeat on).
import { describe, expect, it } from 'vitest';
import { DEFAULT_EAR_TRAINER_SETTINGS, earTrainerSettingsSchema } from './earSettings';

describe('ear trainer settings (ft_1_10.AC6, AC9)', () => {
  it('default to one second with repeat on', () => {
    expect(DEFAULT_EAR_TRAINER_SETTINGS).toEqual({ seconds: 1, repeat: true });
  });

  it('accept 1, 2 and 3 seconds and either repeat', () => {
    for (const seconds of [1, 2, 3]) for (const repeat of [true, false]) {
      expect(earTrainerSettingsSchema.safeParse({ seconds, repeat }).success).toBe(true);
    }
  });

  it('reject lengths outside whole seconds 1 to 3, and a repeat that is not on or off', () => {
    for (const seconds of [0, 4, 1.5, '2']) expect(earTrainerSettingsSchema.safeParse({ seconds, repeat: true }).success, String(seconds)).toBe(false);
    expect(earTrainerSettingsSchema.safeParse({ seconds: 1, repeat: 'yes' }).success).toBe(false);
  });
});
