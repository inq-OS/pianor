/**
 * The presence simulator (ft_1_25.AC6, WP-08): 30 days of a made-up student's practice through the presence rules, one
 * line per day, to tune the numbers in content/world/presence.json; with WP-15, what Kiur says on opening the game each day
 * and the teacher's check-up on the deadline day (ft_1_27). Synthetic: the student is invented, seeded.
 */
import type { CharacterDef } from '../../src/core/character/character';
import type { Curriculum } from '../../src/core/curriculum/curriculum';
import { DEFAULT_EVALUATION_RULES, curriculumStatuses } from '../../src/core/curriculum/evaluate';
import type { PlayResult } from '../../src/core/curriculum/play';
import { DEFAULT_KIUR_RULES, kiurAdvice, kiurSays } from '../../src/core/island/kiur';
import { daysBetween, meetCharacter, presence, recordTug, type PresenceRules } from '../../src/core/island/presenceRules';
import type { WorldState } from '../../src/core/island/worldState';
import { checkupVerdict, checkupsDue, passedPieces, recordCheckup } from '../../src/core/island/teacher';
import { Random } from '../../src/core/random';

export interface SimulationOptions {
  readonly characters: readonly CharacterDef[];
  readonly rules: PresenceRules;
  readonly start: string;
  readonly days: number;
  readonly seed: string | number;
  /** The student's minutes on a practice day, drawn from this range; `restChance` of the days have none. */
  readonly minutes: readonly [number, number];
  readonly restChance: number;
  /** A deadline this many days after the start, for the teacher's boat. */
  readonly deadlineAfter: number;
  /** The teacher's weekly test days (0 Sunday to 6 Saturday); none by default, so the deadline's check-up shows alone. */
  readonly testWeekdays: readonly number[];
  /** The student loses the first tug with each character, to show the cool-down. */
  readonly loseFirstTug: boolean;
  /** Clean plays of a lost tug's piece on a practice day, drawn from this range (the cool-down, ft_1_25.AC3). */
  readonly cleanPlays: readonly [number, number];
  /** Plays of the curriculum piece on a practice day, drawn from this range; their scores start near `score.start`, rise by `score.perDay` a day and vary by up to ± `score.noise`. */
  readonly plays: readonly [number, number];
  readonly score: { readonly start: number; readonly perDay: number; readonly noise: number };
}

export const DEFAULT_SIMULATION: Omit<SimulationOptions, 'characters' | 'rules'> = {
  start: '1998-11-18', days: 30, seed: 1, minutes: [5, 25], restChance: 0.25, deadlineAfter: 20, testWeekdays: [], loseFirstTug: true, cleanPlays: [0, 2],
  plays: [1, 3], score: { start: 60, perDay: 1.5, noise: 8 },
};

export interface SimulatedDay {
  readonly day: string;
  readonly minutesToday: number;
  readonly minutesTotal: number;
  /** Clean plays of each character's lost-tug piece since the tug. */
  readonly clean: Readonly<Record<string, number>>;
  readonly where: Readonly<Record<string, string>>;
  readonly boat: number | null;
  /** What Kiur says on opening the game: string keys with their numbers (ft_1_27.AC3). */
  readonly kiur: readonly string[];
  /** The teacher's check-up of the day (ft_1_27.AC2): the last play of the day is the one she hears. */
  readonly checkup?: { readonly piece: string; readonly score: number; readonly expected: number; readonly result: 'passed' | 'notYet' };
}

export function simulate(options: SimulationOptions): SimulatedDay[] {
  const random = new Random(`presence-sim#${options.seed}`);
  const days = daysBetween(options.start, addDays(options.start, options.days - 1));
  const curriculum: Curriculum = { base: 85, pieces: [{ piece: 'little-steps', deadline: addDays(options.start, options.deadlineAfter), priority: 5 }], calendar: [], testWeekdays: options.testWeekdays };
  let world: WorldState = { flags: [], items: [], met: {}, teacherVisits: [] };
  let total = 0;
  const clean: Record<string, number> = {};
  const plays: PlayResult[] = [];
  return days.map((day, index) => {
    const today = random.chance(options.restChance) ? 0 : random.int(options.minutes[0], options.minutes[1]);
    const before = curriculumStatuses(curriculum, plays, day, DEFAULT_EVALUATION_RULES);
    const kiur = kiurSays({ occasion: 'open', advice: kiurAdvice(before, DEFAULT_KIUR_RULES, passedPieces(world)), remindedToday: false, headsUps: [], minPlays: DEFAULT_EVALUATION_RULES.minPlays })
      .map((l) => [l.line, ...Object.entries(l.params).map(([k, v]) => `${k}=${v}`)].join(' '));
    if (today > 0) {
      const count = random.int(options.plays[0], options.plays[1]);
      for (let i = 0; i < count; i++) {
        const mean = options.score.start + options.score.perDay * index;
        const score = Math.round(Math.max(0, Math.min(100, mean + (random.next() * 2 - 1) * options.score.noise)));
        plays.push({ piece: 'little-steps', day, at: Date.parse(`${day}T18:00:00Z`) + i * 60_000, mode: 'wait', tempoPercent: 100, hands: {}, score });
      }
    }
    let checkup: SimulatedDay['checkup'];
    const statuses = curriculumStatuses(curriculum, plays, day, DEFAULT_EVALUATION_RULES);
    const due = checkupsDue(day, curriculum, statuses, world)[0];
    const heard = plays.filter((pl) => pl.day === day).at(-1);
    if (due !== undefined && heard !== undefined) {
      const expected = statuses.find((st) => st.piece === due)!.expected;
      const { result } = checkupVerdict({ piece: due, score: heard.score, barsWithMistakes: [] }, expected);
      world = recordCheckup(world, { day, piece: due, result });
      checkup = { piece: due, score: heard.score, expected, result };
    }
    total += today;
    if (today > 0) for (const id of Object.keys(clean)) clean[id]! += random.int(options.cleanPlays[0], options.cleanPlays[1]);
    const p = presence({ day, practiceMinutes: total, practiceMinutesToday: today, characters: options.characters, world, curriculum, statuses: [], cleanPlaysSinceLostTug: { ...clean } }, options.rules);
    const where: Record<string, string> = {};
    for (const def of options.characters) {
      const w = p.characters[def.id]!.where;
      where[def.id] = w.at === 'scene' ? w.scene : w.at;
      if (w.at === 'scene' && today > 0) {
        const first = world.met[def.id] === undefined;
        world = meetCharacter(world, def.id, day);
        if (first && options.loseFirstTug) {
          world = recordTug(world, def.id, { outcome: 'lost', level: 1, piece: def.phrases[1]?.[0] ?? def.id, at: `${day}T20:00:00.000Z` });
          clean[def.id] = 0;
        }
      }
    }
    return { day, minutesToday: today, minutesTotal: total, clean: { ...clean }, where, boat: p.teacherBoat?.progress ?? null, kiur, ...(checkup ? { checkup } : {}) };
  });
}

function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** The simulation as text: a line per day and a count per character. */
export function formatSimulation(days: readonly SimulatedDay[]): string {
  const ids = Object.keys(days[0]?.where ?? {});
  const lines = days.map((d) => {
    const boat = d.boat === null ? '' : ` boat ${Math.round(d.boat * 100)}%`;
    const where = ids.map((id) => `${id}: ${d.where[id]}${d.clean[id] === undefined ? '' : ` (${d.clean[id]} clean since the lost tug)`}`).join('  ');
    const kiur = d.kiur.length === 0 ? '' : `  kiur: ${d.kiur.join('; ')}`;
    const checkup = d.checkup === undefined ? '' : `  check-up ${d.checkup.piece}: ${d.checkup.score} of ${d.checkup.expected}, ${d.checkup.result}`;
    return `${d.day}  ${String(d.minutesToday).padStart(3)} min (total ${String(d.minutesTotal).padStart(4)})  ${where}${boat}${kiur}${checkup}`;
  });
  for (const id of ids) lines.push(`${id}: in a scene on ${days.filter((d) => d.where[id] !== 'away').length} of ${days.length} days`);
  return `${lines.join('\n')}\n`;
}
