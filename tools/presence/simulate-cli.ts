// The presence simulator: `npx tsx tools/presence/simulate-cli.ts [seed] [days]` prints 30 days (ft_1_25.AC6).
import { readdirSync, readFileSync } from 'node:fs';
import { characterDefSchema } from '../../src/core/character/character';
import { parsePresenceRules } from '../../src/core/island/presenceRules';
import { DEFAULT_SIMULATION, formatSimulation, simulate } from './simulate';

const dir = 'content/characters';
const characters = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => characterDefSchema.parse(JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'))));
const rules = parsePresenceRules(JSON.parse(readFileSync('content/world/presence.json', 'utf8')));
const [seed, days] = process.argv.slice(2);
process.stdout.write(formatSimulation(simulate({ ...DEFAULT_SIMULATION, characters, rules, seed: seed ?? DEFAULT_SIMULATION.seed, days: days ? Number(days) : DEFAULT_SIMULATION.days })));
