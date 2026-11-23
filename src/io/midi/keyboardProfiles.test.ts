import { describe, expect, it } from 'vitest';
import { EZ220_PROFILE, KNOWN_KEYBOARD_NAME, UNKNOWN_PROFILE, YDP166_PROFILE, profileOfPort } from './keyboardProfiles';

describe('keyboard profiles by port name', () => {
  it('ft_0_06.AC5 knows the EZ-220 by its Windows port name and by its model', () => {
    expect(profileOfPort('Digital Keyboard')).toBe(EZ220_PROFILE);
    expect(profileOfPort('Virtual EZ-220 (simulated)')).toBe(EZ220_PROFILE);
  });

  it('ft_0_06.AC5 knows the YDP-166 by a digital piano port name and by its model', () => {
    expect(profileOfPort('Digital Piano')).toBe(YDP166_PROFILE);
    expect(profileOfPort('YDP-166 MIDI 1')).toBe(YDP166_PROFILE);
  });

  it('ft_0_06.AC5 treats any other port, or none, as unknown', () => {
    expect(profileOfPort('Some Synth')).toBe(UNKNOWN_PROFILE);
    expect(profileOfPort(null)).toBe(UNKNOWN_PROFILE);
  });

  it('ft_0_06.AC5 sends notes on channel 2 to any keyboard that may light keys, so a light never gives the answer away', () => {
    for (const profile of [EZ220_PROFILE, YDP166_PROFILE, UNKNOWN_PROFILE]) {
      if (profile.lightsKeys) expect(profile.soundChannel).not.toBe(0);
    }
    expect(YDP166_PROFILE.soundChannel).toBe(0);
  });

  it('ft_0_06.AC5 sends a voice only where its bank numbers are known', () => {
    expect(EZ220_PROFILE.voice).not.toBeNull();
    expect(YDP166_PROFILE.voice).toBeNull();
    expect(UNKNOWN_PROFILE.voice).toBeNull();
  });

  it('ft_0_06.AC5 prefers a known keyboard when several ports are there', () => {
    expect(KNOWN_KEYBOARD_NAME.test('Digital Piano')).toBe(true);
    expect(KNOWN_KEYBOARD_NAME.test('Digital Keyboard')).toBe(true);
    expect(KNOWN_KEYBOARD_NAME.test('Microsoft GS Wavetable Synth')).toBe(false);
  });
});
