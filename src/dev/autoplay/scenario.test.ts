import { describe, expect, it } from 'vitest';
import { DEFAULT_SCENARIO_ID, SCENARIOS, findScenario, parseScenarioFile, scenarioSchema, withOverrides } from './scenario';

const base = { id: 'x', title: 'X', mode: 'wait', player: { style: 'clean' } };

describe('scenario files', () => {
  // ft_Y_09.AC2
  it('the built-in scenarios are valid, have unique ids and cover clean, messy, Wait and Tempo', () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['clean-wait', 'clean-tempo', 'messy-tempo']));
    expect(findScenario('clean-wait')).toMatchObject({ mode: 'wait', player: { style: 'clean' }, after: 'stop' });
    expect(findScenario('clean-tempo').mode).toBe('tempo');
    expect(findScenario('messy-tempo').player).toMatchObject({ style: 'messy', skips: 1 });
    expect(findScenario(DEFAULT_SCENARIO_ID).id).toBe(DEFAULT_SCENARIO_ID);
  });

  it('ft_1_24.AC6 the boat-arrives scenario runs the boat\'s script in the docks; a script scenario must name both', () => {
    expect(findScenario('boat-arrives')).toMatchObject({ activity: 'script', scene: 'docks', script: 'boat-arrives' });
    expect(() => scenarioSchema.parse({ ...base, activity: 'script', scene: 'docks' })).toThrow(/scene and its script/);
    expect(() => scenarioSchema.parse({ ...base, activity: 'script', script: 'boat-arrives' })).toThrow(/scene and its script/);
  });

  it('ft_1_21.AC10 the challenge scenario practises Puuvaim\'s piece and meets him in the knoll; it names both and plays enough to open the tug', () => {
    expect(findScenario('challenge')).toMatchObject({ activity: 'challenge', piece: 'puuvaim-1', scene: 'knoll', mode: 'wait', after: 'again', maxRuns: 3 });
    const challenge = { ...base, activity: 'challenge', piece: 'puuvaim-1', scene: 'knoll', after: 'again', maxRuns: 3 };
    expect(scenarioSchema.parse(challenge).activity).toBe('challenge');
    expect(() => scenarioSchema.parse({ ...challenge, scene: undefined })).toThrow(/piece and scene are needed/);
    expect(() => scenarioSchema.parse({ ...challenge, piece: undefined })).toThrow(/piece and scene are needed/);
    expect(() => scenarioSchema.parse({ ...challenge, maxRuns: 2 })).toThrow(/at least 3 runs/);
    expect(() => scenarioSchema.parse({ ...challenge, after: 'stop' })).toThrow(/at least 3 runs/);
  });

  it('ft_1_27.AC2 the week scenario puts its piece on the curriculum and ends with the teacher\'s check-up, played in Wait mode', () => {
    expect(findScenario('week')).toMatchObject({ activity: 'week', piece: 'little-steps', mode: 'wait' });
    expect(() => scenarioSchema.parse({ ...base, activity: 'week' })).toThrow(/piece is needed/);
    expect(() => scenarioSchema.parse({ ...base, activity: 'week', piece: 'little-steps', mode: 'tempo' })).toThrow(/check-up is played in Wait mode/);
  });

  it('fills in defaults, so a scenario can be a few lines', () => {
    const s = scenarioSchema.parse(base);
    expect(s).toMatchObject({ speed: 1, seed: 1, after: 'stop', activity: 'practice', scoreView: 'colour', maxRuns: 20 });
    expect(s.piece).toBeUndefined();
    expect(scenarioSchema.parse({ ...base, mode: 'tempo', player: { style: 'messy' } }).player).toEqual({ style: 'messy', wrongKeys: 3, skips: 1, jitterMs: 220 });
  });

  it('refuses a file of another version, an empty file and duplicate ids', () => {
    expect(() => parseScenarioFile({ schemaVersion: 2, scenarios: [base] })).toThrow(/Bad scenario file/);
    expect(() => parseScenarioFile({ schemaVersion: 1, scenarios: [] })).toThrow(/Bad scenario file/);
    expect(() => parseScenarioFile({ schemaVersion: 1, scenarios: [base, base] })).toThrow(/unique/);
    expect(parseScenarioFile({ schemaVersion: 1, scenarios: [base] })).toHaveLength(1);
  });

  it('refuses scenarios that could not play: skipped notes in Wait mode, a faster Tempo mode, a tug in Tempo mode, bad ids and values', () => {
    expect(() => scenarioSchema.parse({ ...base, player: { style: 'messy', skips: 1 } })).toThrow(/needs Tempo mode/);
    expect(scenarioSchema.parse({ ...base, player: { style: 'messy', skips: 0 } }).player.style).toBe('messy');
    expect(() => scenarioSchema.parse({ ...base, mode: 'tempo', speed: 2 })).toThrow(/speed must be 1/);
    expect(() => scenarioSchema.parse({ ...base, mode: 'tempo', activity: 'challenge', piece: 'puuvaim-1', scene: 'knoll', after: 'again', maxRuns: 3 })).toThrow(/Wait mode/);
    expect(() => scenarioSchema.parse({ ...base, id: 'Not Valid' })).toThrow();
    expect(() => scenarioSchema.parse({ ...base, mode: 'free' })).toThrow();
    expect(() => scenarioSchema.parse({ ...base, speed: 0 })).toThrow();
    expect(() => scenarioSchema.parse({ ...base, seed: 1.5 })).toThrow();
    expect(() => scenarioSchema.parse({ ...base, player: { style: 'clean', jitterMs: 500 } })).toThrow();
  });

  it('says which scenarios exist when one is unknown', () => {
    expect(() => findScenario('nope')).toThrow(/Unknown scenario "nope".*clean-wait/);
  });

  it('applies the piece, speed and seed overrides and checks the result again', () => {
    const s = withOverrides(findScenario('clean-wait'), { piece: 'low-walk', speed: 3, seed: 5 });
    expect(s).toMatchObject({ piece: 'low-walk', speed: 3, seed: 5 });
    expect(withOverrides(findScenario('clean-wait'), {})).toEqual(findScenario('clean-wait'));
    expect(() => withOverrides(findScenario('clean-tempo'), { speed: 2 })).toThrow(/speed must be 1/);
  });
});
