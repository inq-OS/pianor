import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { actorDefSchema, type ActorDef } from '../../core/scene/actor';
import { templateActorNumbers } from '../ui/pixel/actors/figure';
import { unknownFeatures } from '../ui/pixel/actors/features';
import { actorFrames } from './actorSheets';
import { placeActor } from '../../core/scene/actorRuntime';
import { PUUVAIM_SPRITE } from '../ui/pixel/keri/puuvaim';
import knollScene from '../../../content/scenes/knoll.json';

const dir = new URL('../../../content/actors/', import.meta.url);
const actors: ActorDef[] = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => actorDefSchema.parse(JSON.parse(readFileSync(new URL(f, dir), 'utf8'))));
const templates = actors.filter((a) => a.template !== undefined);

describe('the actors drawn in the scenes (ft_1_24.AC3)', () => {
  it('has a template character in the content', () => {
    expect(templates.map((a) => a.id)).toContain('villager');
  });

  it.each(templates.map((a) => [a.id, a] as const))('template %s names only known features and carries the numbers its figure has', (_id, actor) => {
    const features = actor.template!.features;
    expect(unknownFeatures(features)).toEqual([]);
    const numbers = templateActorNumbers(features);
    expect({ size: actor.size, anchor: actor.anchor, states: actor.states }).toEqual(numbers);
  });

  it('casts a template from its features, one frame per state frame, the size its file says', () => {
    const villager = templates.find((a) => a.id === 'villager')!;
    for (const state of ['idle', 'talk'] as const) {
      const frames = actorFrames(villager, state, 'day')!;
      expect(frames).toHaveLength(villager.states[state]!.frames);
      for (const frame of frames) expect([frame.width, frame.height]).toEqual([villager.size.w, villager.size.h]);
    }
  });

  it('lights a template by the hour and casts each hour once', () => {
    const villager = templates.find((a) => a.id === 'villager')!;
    const day = actorFrames(villager, 'idle', 'day')!, night = actorFrames(villager, 'idle', 'night')!;
    expect(actorFrames(villager, 'idle', 'night')).toBe(night);
    const rgba = (f: (typeof day)[number]) => ('rgba' in f ? Array.from(f.rgba) : []);
    expect(rgba(night[0]!)).not.toEqual(rgba(day[0]!));
  });

  it('draws a sheet actor from its sheet and an actor with no art as nothing (its box)', () => {
    const kiur = actors.find((a) => a.id === 'kiur')!, placeholder = actors.find((a) => a.id === 'placeholder')!;
    expect(actorFrames(kiur, 'talk', 'day')).toHaveLength(2);
    expect(actorFrames(placeholder, 'idle', 'day')).toBeNull();
  });

  it('draws Puuvaim (WP-11) from the knoll\'s own strokes, lit by the hour, one frame per state frame, over his face in the tree', () => {
    const puuvaim = actors.find((a) => a.id === 'puuvaim')!;
    for (const state of ['idle', 'talk', 'listen', 'play'] as const) {
      const frames = actorFrames(puuvaim, state, 'dusk')!;
      expect(frames, state).toHaveLength(puuvaim.states[state]!.frames);
      for (const frame of frames) expect([frame.width, frame.height]).toEqual([puuvaim.size.w, puuvaim.size.h]);
    }
    // standing on the knoll's place in the tree, the frame lies exactly over the face the picture paints
    const place = knollScene.places.find((p) => p.id === 'in-the-tree')!;
    const at = placeActor(puuvaim, { ...place, facing: 'right' });
    expect({ x: at.x, y: at.y }).toEqual({ x: PUUVAIM_SPRITE.x, y: PUUVAIM_SPRITE.y });
  });
});
