// Golden tests for the profile migrations: each step turns the fixture of its version into a frozen file, and the
// output never depends on today's defaults. The expected files are in tests/fixtures/saves/steps/; regenerate one only when a
// step is meant to change, which it never is once released (add a new version instead).
import { afterEach, describe, expect, it } from 'vitest';
import progressionJson from '../../../content/curriculum/progression.json';
import v1 from '../../../tests/fixtures/saves/profile.v1.json';
import v2 from '../../../tests/fixtures/saves/profile.v2.json';
import v3 from '../../../tests/fixtures/saves/profile.v3.json';
import v4 from '../../../tests/fixtures/saves/profile.v4.json';
import v5 from '../../../tests/fixtures/saves/profile.v5.json';
import v6 from '../../../tests/fixtures/saves/profile.v6.json';
import v7 from '../../../tests/fixtures/saves/profile.v7.json';
import v8 from '../../../tests/fixtures/saves/profile.v8.json';
import v9 from '../../../tests/fixtures/saves/profile.v9.json';
import v10 from '../../../tests/fixtures/saves/profile.v10.json';
import v11 from '../../../tests/fixtures/saves/profile.v11.json';
import v12 from '../../../tests/fixtures/saves/profile.v12.json';
import v13 from '../../../tests/fixtures/saves/profile.v13.json';
import s1 from '../../../tests/fixtures/saves/steps/profile.v1-to-v2.json';
import s2 from '../../../tests/fixtures/saves/steps/profile.v2-to-v3.json';
import s3 from '../../../tests/fixtures/saves/steps/profile.v3-to-v4.json';
import s4 from '../../../tests/fixtures/saves/steps/profile.v4-to-v5.json';
import s5 from '../../../tests/fixtures/saves/steps/profile.v5-to-v6.json';
import s6 from '../../../tests/fixtures/saves/steps/profile.v6-to-v7.json';
import s7 from '../../../tests/fixtures/saves/steps/profile.v7-to-v8.json';
import s8 from '../../../tests/fixtures/saves/steps/profile.v8-to-v9.json';
import s9 from '../../../tests/fixtures/saves/steps/profile.v9-to-v10.json';
import s10 from '../../../tests/fixtures/saves/steps/profile.v10-to-v11.json';
import s11 from '../../../tests/fixtures/saves/steps/profile.v11-to-v12.json';
import s12 from '../../../tests/fixtures/saves/steps/profile.v12-to-v13.json';
import s13 from '../../../tests/fixtures/saves/steps/profile.v13-to-v14.json';
import v14 from '../../../tests/fixtures/saves/profile.v14.json';
import s14 from '../../../tests/fixtures/saves/steps/profile.v14-to-v15.json';
import v15 from '../../../tests/fixtures/saves/profile.v15.json';
import s15 from '../../../tests/fixtures/saves/steps/profile.v15-to-v16.json';
import v16 from '../../../tests/fixtures/saves/profile.v16.json';
import s16 from '../../../tests/fixtures/saves/steps/profile.v16-to-v17.json';
import { DEFAULT_BATTLE_SETTINGS } from './battleSettings';
import { DEFAULT_PLAY_SETTINGS } from '../judge/playSettings';
import { DEFAULT_BAR_NUMBER_SETTINGS } from '../layout/barNumbers';
import { DEFAULT_KEYBOARD_SETTINGS } from '../layout/keyboardSettings';
import { DEFAULT_STAFF_SETTINGS } from '../layout/staffSettings';
import { parseProgressionConfig } from './config';
import { migrateProfile, profileMigrations } from './migrate';
import { DEFAULT_PIECES_SETTINGS } from './pieceSwitch';
import { DEFAULT_PROFILE_SETTINGS } from './profile';

const config = parseProgressionConfig(progressionJson);

/** Fixture of version N, and the frozen output of step N to N + 1 on it. Step 0 replays XP through the rules it is given (d064). */
const steps: [number, object, object][] = [
  [1, v1, s1], [2, v2, s2], [3, v3, s3], [4, v4, s4], [5, v5, s5], [6, v6, s6], [7, v7, s7],
  [8, v8, s8], [9, v9, s9], [10, v10, s10], [11, v11, s11], [12, v12, s12], [13, v13, s13],
  [14, v14, s14], [15, v15, s15], [16, v16, s16],
];

/** Every default a migration once read, and their values today, to put back after a test changes them. */
const defaults = [DEFAULT_STAFF_SETTINGS, DEFAULT_PLAY_SETTINGS, DEFAULT_PIECES_SETTINGS, DEFAULT_BATTLE_SETTINGS, DEFAULT_KEYBOARD_SETTINGS, DEFAULT_BAR_NUMBER_SETTINGS, DEFAULT_PROFILE_SETTINGS] as Record<string, unknown>[];
const saved = defaults.map((d) => structuredClone(d));

afterEach(() => {
  defaults.forEach((d, i) => {
    for (const key of Object.keys(d)) delete d[key];
    Object.assign(d, structuredClone(saved[i]));
  });
  // DEFAULT_PROFILE_SETTINGS holds the other defaults by reference, as it does in profile.ts
  Object.assign(DEFAULT_PROFILE_SETTINGS, { staff: DEFAULT_STAFF_SETTINGS, play: DEFAULT_PLAY_SETTINGS, pieces: DEFAULT_PIECES_SETTINGS, battle: DEFAULT_BATTLE_SETTINGS, keyboard: DEFAULT_KEYBOARD_SETTINGS, barNumbers: DEFAULT_BAR_NUMBER_SETTINGS });
});

/** Change every default a player could get today, as a later version of the game might. */
function changeTodaysDefaults(): void {
  Object.assign(DEFAULT_STAFF_SETTINGS, { lines: 'all', barsPerLine: 2 });
  Object.assign(DEFAULT_PLAY_SETTINGS, { mode: 'tempo', scoreView: 'number' });
  Object.assign(DEFAULT_PIECES_SETTINGS, { hidden: ['some-piece'] });
  Object.assign(DEFAULT_BATTLE_SETTINGS, { fights: 'many' });
  Object.assign(DEFAULT_KEYBOARD_SETTINGS, { onScreen: false });
  Object.assign(DEFAULT_BAR_NUMBER_SETTINGS, { mode: 'every4' });
  Object.assign(DEFAULT_PROFILE_SETTINGS, { noteNaming: 'H', staffGap: 'short', keyLights: { enabled: true, afterWrong: 2 } });
}

describe('profile migration steps are frozen', () => {
  it('each step turns the fixture of its version into the same save as when it was written', () => {
    expect(steps.map(([n]) => n)).toEqual(Object.keys(profileMigrations).map(Number).filter((n) => n > 0));
    for (const [n, fixture, expected] of steps) {
      const input = structuredClone(fixture);
      expect(profileMigrations[n]!(input as Record<string, unknown>, config), `step ${n} to ${n + 1}`).toEqual(expected);
      expect(input, `step ${n} leaves its input unchanged`).toEqual(fixture);
    }
  });

  it('changing a default today does not change what an old save migrates to', () => {
    const before = steps.map(([, fixture]) => migrateProfile(structuredClone(fixture), config));
    const stepsBefore = steps.map(([n, fixture]) => profileMigrations[n]!(structuredClone(fixture) as Record<string, unknown>, config));
    changeTodaysDefaults();
    expect(steps.map(([n, fixture]) => profileMigrations[n]!(structuredClone(fixture) as Record<string, unknown>, config))).toEqual(stepsBefore);
    expect(steps.map(([, fixture]) => migrateProfile(structuredClone(fixture), config))).toEqual(before);
  });

  it('a version 1 save gets only the settings that version 2 had: the staff, one line, bars chosen automatically', () => {
    const out = profileMigrations[1]!(structuredClone(v1), config);
    expect(out.settings).toEqual({ staff: { lines: 1, barsPerLine: 'auto' } });
  });
});
