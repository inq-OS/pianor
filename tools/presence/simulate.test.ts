import { describe, expect, it } from 'vitest';
import puuvaimJson from '../../content/characters/puuvaim.json';
import { characterDefSchema } from '../../src/core/character/character';
import { DEFAULT_PRESENCE_RULES } from '../../src/core/island/presenceRules';
import { DEFAULT_SIMULATION, formatSimulation, simulate } from './simulate';

const puuvaim = characterDefSchema.parse(puuvaimJson);
const run = (over = {}) => simulate({ ...DEFAULT_SIMULATION, characters: [puuvaim], rules: DEFAULT_PRESENCE_RULES, ...over });

describe('the presence simulator (ft_1_25.AC6)', () => {
  it('runs 30 days of a made-up student, the same for the same seed', () => {
    const days = run();
    expect(days).toHaveLength(30);
    expect(days[0]!.day).toBe('1998-11-18');
    expect(days.at(-1)!.day).toBe('1998-12-17');
    expect(run()).toEqual(days);
    expect(run({ seed: 2 })).not.toEqual(days);
  });

  it('shows the threshold, the cool-down after the lost first tug (in clean plays, ft_1_25.AC3), and the boat landing on the deadline', () => {
    const days = run();
    const first = days.findIndex((d) => d.where['puuvaim'] !== 'away');
    expect(days[first]!.minutesTotal).toBeGreaterThanOrEqual(puuvaim.meet.practiceMinutes);
    const meetDay = days.findIndex((d, i) => i >= first && d.minutesToday > 0 && d.where['puuvaim'] !== 'away');
    const back = days.findIndex((d, i) => i > meetDay && d.where['puuvaim'] !== 'away');
    expect(days[back]!.clean['puuvaim']).toBeGreaterThanOrEqual(puuvaim.meet.cooldownCleanPlays);
    for (let i = meetDay + 1; i < back; i++) if (days[i]!.where['puuvaim'] !== 'away') throw new Error(`day ${i}`);
    expect(days[20]!.boat).toBe(1);
    expect(days[21]!.boat).toBeNull();
  });

  it("ft_1_27.AC3 Kiur reminds of the curriculum piece on opening the game; ft_1_27.AC2 the deadline day ends with the teacher's check-up", () => {
    const days = run();
    expect(days[0]!.kiur).toEqual(['kiur.remind.unmeasured plays=0 need=3']);
    expect(days.some((d) => d.kiur.some((l) => l.startsWith('kiur.remind.trend gap=')))).toBe(true);
    const checkups = days.filter((d) => d.checkup !== undefined);
    expect(checkups.map((d) => d.day)).toEqual(['1998-12-08']);
    expect(checkups[0]!.checkup).toMatchObject({ piece: 'little-steps', expected: 90 });
    expect(formatSimulation(days)).toContain('check-up little-steps:');
    const lazy = run({ score: { start: 40, perDay: 0, noise: 5 } }).find((d) => d.checkup !== undefined)!;
    expect(lazy.checkup!.result).toBe('notYet');
  });

  it('prints a line per day and a count', () => {
    const text = formatSimulation(run({ days: 3 }));
    expect(text.trim().split('\n')).toHaveLength(4);
    expect(text).toContain('puuvaim: in a scene on');
    expect(formatSimulation([])).toBe('\n');
  });
});
