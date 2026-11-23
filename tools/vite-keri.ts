import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join, resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { Plugin } from 'vite';
import { PAINT_SOURCES } from './art/paintSources.ts';
import { keriMapPlan } from '../src/core/layout/keriMap.ts';
import { crossroadsPlan } from '../src/core/layout/crossroads.ts';
import { squarePlan } from '../src/core/layout/square.ts';
import { docksPlan } from '../src/core/layout/docks.ts';
import { lanternPlan } from '../src/core/layout/lantern.ts';
import { knollPlan } from '../src/core/layout/knoll.ts';
import { portPlan } from '../src/core/layout/port.ts';
import { roomPlan } from '../src/core/layout/room.ts';
import { terracePlan } from '../src/core/layout/terrace.ts';
import { SKY_PHASES, type SkyPhase } from '../src/core/sky/skyPhase.ts';
import { loadWorld, type World } from '../src/core/world/world.ts';
import { privatePortrait } from '../src/game/room/privatePortrait.ts';
import { packCrossroads } from '../src/game/ui/pixel/keri/crossroadsPack.ts';
import { paintCrossroads } from '../src/game/ui/pixel/keri/crossroadsPicture.ts';
import { packSquare } from '../src/game/ui/pixel/keri/squarePack.ts';
import { paintSquare } from '../src/game/ui/pixel/keri/squarePicture.ts';
import { packDocks } from '../src/game/ui/pixel/keri/docksPack.ts';
import { paintDocks } from '../src/game/ui/pixel/keri/docksPicture.ts';
import { packLantern } from '../src/game/ui/pixel/keri/lanternPack.ts';
import { paintLantern } from '../src/game/ui/pixel/keri/lanternPicture.ts';
import { packKnoll } from '../src/game/ui/pixel/keri/knollPack.ts';
import { paintKnoll } from '../src/game/ui/pixel/keri/knollPicture.ts';
import { packMap } from '../src/game/ui/pixel/keri/mapPack.ts';
import { packPort } from '../src/game/ui/pixel/keri/portPack.ts';
import { paintPort } from '../src/game/ui/pixel/keri/portPicture.ts';
import { paintMap } from '../src/game/ui/pixel/keri/mapPicture.ts';
import { roomArt } from '../src/game/ui/pixel/keri/roomLife.ts';
import { packRoom } from '../src/game/ui/pixel/keri/roomPack.ts';
import { paintRoom } from '../src/game/ui/pixel/keri/roomPicture.ts';
import { packTerrace } from '../src/game/ui/pixel/keri/terracePack.ts';
import { paintTerrace } from '../src/game/ui/pixel/keri/terracePicture.ts';

const VIRTUAL_ID = 'virtual:keri-pictures';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
/** The code and data the pictures are made from: a change in any of it, or in this file, paints them again. */
const SOURCES = PAINT_SOURCES;
const THIS_FILE = 'tools/vite-keri.ts';
const WORLD = 'content/world/keri.json';
const PRIVATE_PORTRAIT = 'private/room/portrait.json';
const CACHE = 'node_modules/.cache/pianor-keri';
const CACHE_KEEP = 4;

function sourceFiles(dir: string): string[] {
  if (!statSync(dir).isDirectory()) return [dir];
  return readdirSync(dir).sort().flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : [];
  });
}

/** The private portrait where this machine has it (d107, ft_1_08.AC10), else null: the room then shows the drawn one. */
function privatePortraitFile(): unknown {
  if (!existsSync(PRIVATE_PORTRAIT)) return null;
  try {
    return JSON.parse(readFileSync(PRIVATE_PORTRAIT, 'utf8')) as unknown;
  } catch {
    return null;
  }
}

/** What the pictures are painted from: the private portrait (or null) and the island as shipped. */
interface Sources {
  portrait: unknown;
  world: World;
}

/**
 * Every picture the build paints, by its name in `virtual:keri-pictures`: from the sources, a painter of it at an hour of
 * the sky, packed. Each is also in `tools/art/pictures.ts`, where the art rules are held: `tools/art/pictureRules.test.ts`
 * fails for a picture that is here and not there.
 */
const PAINTERS = {
  room: ({ portrait }: Sources) => {
    const art = roomArt(privatePortrait(portrait));
    const plan = roomPlan({ w: art.portrait.width, h: art.portrait.height });
    return (phase: SkyPhase) => packRoom(paintRoom(plan.fine, plan.camera, phase, plan, art));
  },
  map: ({ world }: Sources) => {
    const plan = keriMapPlan(world);
    return (phase: SkyPhase) => packMap(paintMap(plan, phase));
  },
  // the grassy knoll, ft_1_19.AC9
  knoll: ({ world }: Sources) => {
    const plan = knollPlan();
    return (phase: SkyPhase) => packKnoll(paintKnoll(world, plan, phase));
  },  // the docks, ft_1_19
  docks: ({ world }: Sources) => {
    const plan = docksPlan();
    return (phase: SkyPhase) => packDocks(paintDocks(world, plan, phase));
  },
  // the crossroads, the path's fork by the green hut (d113)
  crossroads: ({ world }: Sources) => {
    const plan = crossroadsPlan();
    return (phase: SkyPhase) => packCrossroads(paintCrossroads(world, plan, phase));
  },
  // the lantern over Keri, the main menu's picture (ft_1_07)
  lantern: ({ world }: Sources) => {
    const plan = lanternPlan();
    return (phase: SkyPhase) => packLantern(paintLantern(world, plan, phase));
  },
  // the southern port, where most visitors land, with its underwater stage (ft_1_19)
  port: () => {
    const plan = portPlan();
    return (phase: SkyPhase) => packPort(paintPort(plan, phase));
  },
  // the terrace before the warden's house, looking out to sea (ft_1_19)
  terrace: ({ world }: Sources) => {
    const plan = terracePlan();
    return (phase: SkyPhase) => packTerrace(paintTerrace(world, plan, phase));
  },
  // the village square between the houses at the lighthouse, looking to the southern pier (ft_1_19)
  square: () => {
    const plan = squarePlan();
    return (phase: SkyPhase) => packSquare(paintSquare(plan, phase));
  },
} as const;
export const KERI_PICTURES = Object.keys(PAINTERS);

/** One picture at one hour, packed. */
export function paintOne(name: string, phase: SkyPhase, sources: Sources): unknown {
  const painter = (PAINTERS as Record<string, (sources: Sources) => (phase: SkyPhase) => unknown>)[name];
  if (!painter) throw new Error(`no picture "${name}"`);
  return painter(sources)(phase);
}

/** The world as shipped, as the painters read it. */
export function shippedWorld(): World {
  return loadWorld(JSON.parse(readFileSync(WORLD, 'utf8')) as unknown);
}

/** Each picture painted for every hour of the sky, here, one after the other. */
function paintAll(sources: Sources): Record<string, unknown> {
  return Object.fromEntries(KERI_PICTURES.map((name) => [name, Object.fromEntries(SKY_PHASES.map((phase) => [phase, paintOne(name, phase, sources)]))]));
}

/** The worker that paints one picture at one hour (`vite-keri-worker.ts`), run through tsx as the tools are. */
const WORKER = 'tools/vite-keri-worker.ts';

/**
 * Each picture painted for every hour of the sky, the pictures and hours shared out among worker threads, one for
 * each core but one: a cold start paints in a quarter of the time on a four-core laptop. Packed the same and kept in
 * the same order as `paintAll`, so the cache file is the same either way. Where a worker cannot start or stops, here
 * instead. Every worker is stopped when the painting ends, fails or is called off (`stop`, when the art changed meanwhile).
 */
async function paintAllAtOnce(portrait: unknown, stop: AbortSignal): Promise<Record<string, unknown>> {
  const jobs = KERI_PICTURES.flatMap((name) => SKY_PHASES.map((phase) => ({ name, phase })));
  // the room takes longest: started first, it does not leave one worker painting it alone at the end
  jobs.sort((a, b) => Number(b.name === 'room') - Number(a.name === 'room'));
  const count = Math.max(1, Math.min(jobs.length, availableParallelism() - 1));
  const done = new Map<string, unknown>();
  const workers: Worker[] = [];
  let next = 0;
  const run = (): Promise<void> => new Promise((resolveRun, reject) => {
    const worker = new Worker(resolve(WORKER), { workerData: { portrait }, execArgv: ['--import', 'tsx'] });
    workers.push(worker);
    let finished = false;
    const give = (): void => {
      const job = jobs[next++];
      if (job) worker.postMessage(job);
      else {
        finished = true;
        void worker.terminate().then(() => resolveRun());
      }
    };
    worker.on('message', ({ name, phase, picture }: { name: string; phase: SkyPhase; picture: unknown }) => {
      done.set(`${name}-${phase}`, picture);
      give();
    });
    worker.on('error', reject);
    // a worker that ends without an error (out of memory, say) would otherwise leave its pictures unpainted for ever
    worker.on('exit', (code) => {
      if (!finished) reject(new Error(`a painting worker stopped with exit code ${code}`));
    });
    worker.on('online', give);
  });
  const calledOff = new Promise<never>((_, reject) => stop.addEventListener('abort', () => reject(new Error('called off')), { once: true }));
  try {
    await Promise.race([Promise.all(Array.from({ length: count }, run)), calledOff]);
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
  }
  return Object.fromEntries(KERI_PICTURES.map((name) => [name, Object.fromEntries(SKY_PHASES.map((phase) => [phase, done.get(`${name}-${phase}`)]))]));
}

/** Keeps the newest few paintings in the cache: every change to the art leaves one more, about 2 MB each. */
function pruneCache(): void {
  try {
    const files = readdirSync(CACHE).map((name) => join(CACHE, name));
    const newestFirst = files.map((file) => ({ file, at: statSync(file).mtimeMs })).sort((a, b) => b.at - a.at);
    for (const { file } of newestFirst.slice(CACHE_KEEP)) rmSync(file, { force: true });
  } catch {
    // another server pruned at the same time: what is left is pruned next time
  }
}

/** `virtual:keri-pictures/<picture>-<hour>`: one picture at one hour, its own module and so its own file in the build (`room-night-<hash>.js`). */
function pictureHour(id: string): { name: string; phase: SkyPhase } | null {
  if (!id.startsWith(`${RESOLVED_ID}/`)) return null;
  const [name, phase] = id.slice(RESOLVED_ID.length + 1).split('-');
  if (!name || !KERI_PICTURES.includes(name) || !(SKY_PHASES as readonly string[]).includes(phase ?? '')) return null;
  return { name, phase: phase as SkyPhase };
}

/**
 * Makes `import pictures from "virtual:keri-pictures"` give the game the painted pictures of Keri (d111): the warden's
 * room (ft_1_18.AC3), the map of the island (ft_1_18.AC2) and the scenes (the knoll, ft_1_19.AC9), each for every hour of
 * the sky. Painting takes some seconds for each, so it happens here, when the dev server starts or the game is built, and
 * the result is kept in `node_modules/.cache` until the art's code or the world file changes.
 *
 * The game's own file carries none of them (d143, ft_1_24.AC7): `virtual:keri-pictures` is a table of loaders, and each
 * picture at each hour is its own module, `virtual:keri-pictures/<picture>-<hour>`, which the build puts in its own file
 * and the game loads when a scene shows it.
 */
export function keriPlugin(): Plugin {
  let files: string[] = [];
  let painted: { key: string; all: Promise<Record<string, Record<string, unknown>>>; stop: AbortController } | null = null;
  const pictures = (): Promise<Record<string, Record<string, unknown>>> => {
    files = [...SOURCES.flatMap((dir) => sourceFiles(resolve(dir))), resolve(WORLD), resolve(THIS_FILE), resolve(WORKER)];
    const hash = createHash('sha256');
    for (const file of files) hash.update(file).update(readFileSync(file));
    const portrait = privatePortraitFile();
    hash.update(JSON.stringify(portrait));
    const key = hash.digest('hex').slice(0, 24);
    if (painted?.key === key) return painted.all;
    // the art changed while it was painted: the old painting is called off, and whoever waits for it gets the new one
    painted?.stop.abort();
    const stop = new AbortController();
    const cached = join(CACHE, `${key}.json`);
    const all: Promise<Record<string, Record<string, unknown>>> = (async () => {
      if (existsSync(cached)) return JSON.parse(readFileSync(cached, 'utf8')) as Record<string, Record<string, unknown>>;
      let fresh: Record<string, unknown>;
      try {
        fresh = await paintAllAtOnce(portrait, stop.signal);
      } catch (error) {
        if (stop.signal.aborted) return pictures();
        // a worker could not start (tsx missing, say), stopped, or threw (a painter's bug): painted again in this
        // process, where a painter's bug throws once more, now with its own stack
        console.warn(`pianor-keri: the painting workers failed, painting in this process instead (${String(error)})`);
        fresh = paintAll({ portrait, world: shippedWorld() });
      }
      const text = JSON.stringify(fresh);
      mkdirSync(CACHE, { recursive: true });
      writeFileSync(cached, text);
      pruneCache();
      return JSON.parse(text) as Record<string, Record<string, unknown>>;
    })();
    painted = { key, all, stop };
    // a painting that failed is not kept: the next load paints again
    all.catch(() => {
      if (painted?.all === all) painted = null;
    });
    return all;
  };
  return {
    name: 'pianor-keri',
    resolveId(id) {
      return id === VIRTUAL_ID || id.startsWith(`${VIRTUAL_ID}/`) ? `\0${id}` : null;
    },
    // painted ahead of the first page, so the first visitor (an end-to-end test, say) does not wait for it; unit tests never ask for it
    async buildStart() {
      if (!process.env.VITEST) await pictures();
    },
    async load(id) {
      if (id === RESOLVED_ID) {
        // the table of loaders: a dynamic import for every picture and hour, so the build splits each into its own file
        const table = KERI_PICTURES.map((name) => `${JSON.stringify(name)}: {${SKY_PHASES.map((phase) => `${phase}: () => import(${JSON.stringify(`${VIRTUAL_ID}/${name}-${phase}`)})`).join(', ')}}`);
        return `export default {\n  ${table.join(',\n  ')}\n};`;
      }
      const one = pictureHour(id);
      if (!one) return null;
      const all = await pictures();
      for (const file of files) this.addWatchFile(file);
      return `export default ${JSON.stringify(all[one.name]![one.phase])};`;
    },
  };
}
