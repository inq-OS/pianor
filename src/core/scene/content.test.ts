import { describe, expect, it } from 'vitest';
import keri from '../../../content/world/keri.json';
import { strings } from '../text/strings';
import { loadWorld } from '../world/world';
import { actorDefSchema } from './actor';
import { sceneDataSchema } from './scene';
import { scriptSchema } from './script';
import { scriptProblems } from './scriptRunner';

const scenes = import.meta.glob<unknown>('../../../content/scenes/*.json', { eager: true, import: 'default' });
const scripts = import.meta.glob<unknown>('../../../content/scripts/*.json', { eager: true, import: 'default' });
const pieces = new Set(Object.keys(import.meta.glob('../../../content/pieces/*/piece.abc')).map((p) => p.split('/').at(-2)!));
const actors = import.meta.glob<unknown>('../../../content/actors/*.json', { eager: true, import: 'default' });
const fileId = (path: string) => path.split('/').pop()!.replace(/\.json$/, '');
const worldScenes = new Set((loadWorld(keri).scenes ?? []).map((s) => s.id));

describe('every scene in content/scenes (ft_1_24.AC1)', () => {
  it('ft_1_24.AC1 parses, is named by its file and the world model, and every key and place it names exists', () => {
    expect(Object.keys(scenes).length).toBeGreaterThan(0);
    for (const [path, raw] of Object.entries(scenes)) {
      const scene = sceneDataSchema.parse(raw);
      expect(scene.id, path).toBe(fileId(path));
      expect(worldScenes.has(scene.id), `${scene.id} is a scene of content/world/keri.json`).toBe(true);
      const places = new Set(scene.places.map((p) => p.id));
      expect(places.size, `${scene.id}: place ids are unique`).toBe(scene.places.length);
      for (const h of scene.hotspots) {
        for (const key of [h.name, h.look]) expect(key in strings, `${scene.id}: ${key}`).toBe(true);
        if (h.place) expect(places.has(h.place), `${scene.id}: hotspot ${h.id} place`).toBe(true);
      }
      for (const e of scene.exits) {
        expect(e.name in strings, `${scene.id}: ${e.name}`).toBe(true);
        // an exit leads to a scene, the map or the room (ft_1_24.AC1)
        expect(e.to === 'map' || e.to === 'room' || worldScenes.has(e.to), `${scene.id}: exit ${e.id} to ${e.to}`).toBe(true);
      }
      if (scene.musicTie) expect(scene.musicTie in strings).toBe(true);
    }
  });
});

describe('every actor in content/actors (ft_1_24.AC3)', () => {
  it('ft_1_24.AC3 parses and is named by its file', () => {
    expect(Object.keys(actors).length).toBeGreaterThan(0);
    for (const [path, raw] of Object.entries(actors)) expect(actorDefSchema.parse(raw).id, path).toBe(fileId(path));
  });
});

describe('every script in content/scripts (ft_1_24.AC6)', () => {
  it('ft_1_24.AC6 parses, is named by its file, runs clean on a scene, and every actor, line and piece it names exists', () => {
    expect(Object.keys(scripts).length).toBeGreaterThan(0);
    const allScenes = Object.values(scenes).map((raw) => sceneDataSchema.parse(raw));
    const actorIds = new Set(Object.values(actors).map((raw) => actorDefSchema.parse(raw).id));
    for (const [path, raw] of Object.entries(scripts)) {
      const script = scriptSchema.parse(raw);
      expect(script.id, path).toBe(fileId(path));
      const clean = allScenes.filter((scene) => scriptProblems(script, scene.places.map((p) => p.id), []).length === 0);
      expect(clean.length, `${script.id} runs clean on some scene`).toBeGreaterThan(0);
      for (const c of script.commands) {
        if ('enter' in c) expect(actorIds.has(c.enter), `${script.id}: actor ${c.enter}`).toBe(true);
        if ('say' in c) expect(c.line in strings, `${script.id}: ${c.line}`).toBe(true);
        if ('playPhrase' in c) expect(pieces.has(c.piece), `${script.id}: piece ${c.piece}`).toBe(true);
      }
    }
  });
});
