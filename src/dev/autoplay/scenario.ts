/**
 * Scenarios for the dev-only autoplay (ft_Y_09): which piece, Wait or Tempo mode, how the virtual player plays, how fast, and
 * what happens after the results. They are data (`content/dev/scenarios.json`, `schemaVersion` 1), checked here, so a new scenario
 * needs no engine code. Nothing in here touches the DOM or Phaser.
 */
import { z } from 'zod';
import { GATE_MIN_PLAYS } from '../../core/exchange/tugGate';
import scenarioFile from '../../../content/dev/scenarios.json';

export const SCENARIO_SCHEMA_VERSION = 1;

/** The scenario `?autoplay=1` plays when `?scenario=` is not given. */
export const DEFAULT_SCENARIO_ID = 'clean-wait';

/** A player with no wrong keys and no missed notes; `jitterMs` is how far a note may stray from its time (0: exactly on it). */
const cleanPlayer = z.object({
  style: z.literal('clean'),
  jitterMs: z.number().min(0).max(100).default(0),
});

/**
 * A player who makes mistakes, chosen by the scenario's seed: `wrongKeys` steps get a wrong key just before the right one,
 * `skips` steps are not played at all (Tempo mode only: Wait mode would wait for them forever), and every note is up to
 * `jitterMs` early or late.
 */
const messyPlayer = z.object({
  style: z.literal('messy'),
  wrongKeys: z.number().int().min(0).max(20).default(3),
  skips: z.number().int().min(0).max(10).default(1),
  jitterMs: z.number().min(0).max(300).default(220),
});

export const scenarioSchema = z
  .object({
    /** The id used in `?scenario=`. */
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lower-case words joined by dashes'),
    title: z.string().min(1),
    /** A piece id. Left out: the first piece the menu offers (and, with `after: "next-piece"`, the ones after it). */
    piece: z.string().min(1).optional(),
    mode: z.enum(['wait', 'tempo']),
    /** The player's score view for Tempo mode. */
    scoreView: z.enum(['off', 'colour', 'number']).default('colour'),
    /**
     * What is played: `practice` (a piece card of the menu), or `teacher` (`piece` put on the player's curriculum, practised like
     * `practice` for every run, then the teacher's screen with its measured status, ft_1_26, WP-14), or `script` (`script`
     * run in the adventure scene `scene` until it ends, nothing played by the player; ft_1_24.AC6, WP-07), or `challenge`
     * (`piece`, a character's phrase, practised like `practice` for every run so the gate opens, then the character met in
     * its scene, its tug picked in its talk and played to the end; ft_1_21.AC10, WP-13), or `week` (`piece` put on the
     * curriculum, due today, with a play on each of the six days before (synthetic), practised like `practice` for every run,
     * then the room, where the teacher asks for it and hears it played once: her check-up; ft_1_27.AC2, WP-15).
     */
    activity: z.enum(['practice', 'teacher', 'script', 'challenge', 'week']).default('practice'),
    /** The adventure scene a `script` scenario opens (`content/scenes/<id>.json`). */
    scene: z.string().min(1).optional(),
    /** The script a `script` scenario runs there (`content/scripts/<id>.json`). */
    script: z.string().min(1).optional(),
    player: z.discriminatedUnion('style', [cleanPlayer, messyPlayer]),
    /** 1 is the piece's own tempo, 2 twice as fast. Wait mode only: Tempo mode runs on the piece's tempo. */
    speed: z.number().min(0.25).max(8).default(1),
    /** The same seed always gives the same run. */
    seed: z.number().int().default(1),
    /** After the results: stop there, play the same piece again, or go on to the next piece of the menu. */
    after: z.enum(['stop', 'again', 'next-piece']).default('stop'),
    /** Pieces played at most, so a looping scenario ends by itself. */
    maxRuns: z.number().int().min(1).max(500).default(20),
  })
  .refine((s) => s.mode === 'wait' || s.speed === 1, { message: 'Tempo mode runs at the piece\'s own tempo: speed must be 1', path: ['speed'] })
  .refine((s) => s.mode === 'tempo' || s.player.style === 'clean' || s.player.skips === 0, {
    message: 'Wait mode waits for every note: a player who skips notes needs Tempo mode', path: ['player', 'skips'],
  })
  .refine((s) => (s.activity !== 'teacher' && s.activity !== 'week') || s.piece !== undefined, { message: 'The teacher and week scenarios put their piece on the curriculum: piece is needed', path: ['piece'] })
  .refine((s) => s.activity !== 'week' || s.mode === 'wait', { message: 'The check-up is played in Wait mode', path: ['mode'] })
  .refine((s) => s.activity !== 'challenge' || (s.piece !== undefined && s.scene !== undefined), { message: 'The challenge scenario practises its piece and meets its character in its scene: piece and scene are needed', path: ['piece'] })
  .refine((s) => s.activity !== 'challenge' || (s.after === 'again' && s.maxRuns >= GATE_MIN_PLAYS), {
    message: `The tug opens after ${GATE_MIN_PLAYS} plays of its piece: a challenge plays again, at least ${GATE_MIN_PLAYS} runs`, path: ['maxRuns'],
  })
  .refine((s) => s.activity === 'practice' || s.activity === 'teacher' || s.activity === 'week' || s.mode === 'wait', { message: 'A tug (level 1) is played in Wait mode', path: ['mode'] })
  .refine((s) => s.activity !== 'script' || (s.scene !== undefined && s.script !== undefined), { message: 'A script scenario names its scene and its script', path: ['script'] });

export type Scenario = z.output<typeof scenarioSchema>;
export type ScenarioPlayer = Scenario['player'];

export const scenarioFileSchema = z.object({
  schemaVersion: z.literal(SCENARIO_SCHEMA_VERSION),
  scenarios: z.array(scenarioSchema).min(1),
}).refine((file) => new Set(file.scenarios.map((s) => s.id)).size === file.scenarios.length, { message: 'Scenario ids must be unique', path: ['scenarios'] });

/** Parse a scenario file (throws a readable error for a bad one). */
export function parseScenarioFile(raw: unknown): Scenario[] {
  const parsed = scenarioFileSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`Bad scenario file: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  return parsed.data.scenarios;
}

/** The scenarios that come with the game, from `content/dev/scenarios.json`. */
export const SCENARIOS: readonly Scenario[] = parseScenarioFile(scenarioFile);

export function findScenario(id: string, scenarios: readonly Scenario[] = SCENARIOS): Scenario {
  const found = scenarios.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown scenario "${id}". Known: ${scenarios.map((s) => s.id).join(', ')}`);
  return found;
}

/** Replace the piece, speed or seed of a scenario (what `?piece=`, `?speed=` and `?seed=` ask for) and check the result again. */
export function withOverrides(scenario: Scenario, overrides: { piece?: string; speed?: number; seed?: number }): Scenario {
  return scenarioSchema.parse({
    ...scenario,
    ...(overrides.piece === undefined ? {} : { piece: overrides.piece }),
    ...(overrides.speed === undefined ? {} : { speed: overrides.speed }),
    ...(overrides.seed === undefined ? {} : { seed: overrides.seed }),
  });
}
