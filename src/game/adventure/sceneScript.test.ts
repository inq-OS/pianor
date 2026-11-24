// Covers ft_1_24.AC6's give: a script's item goes to the player (the scene keeps it in the world, WP-08).
import { describe, expect, it } from 'vitest';
import type { PieceCatalogue } from '../pieceCatalogue';
import type { GameAudio } from '../../io/audio';
import type { SceneData } from '../../core/scene/scene';
import { scriptSchema } from '../../core/scene/script';
import boatArrives from '../../../tests/fixtures/contracts/boat-arrives.script.json';
import { SceneScript } from './sceneScript';

const scene = { places: [
  { id: 'sea-far', x: 0, y: 100, facing: 'right', scale: 0.5 },
  { id: 'pier', x: 100, y: 100, facing: 'right' },
] } as unknown as SceneData;
const pieces = { find: () => undefined } as unknown as PieceCatalogue;
const audio = { piano: { play: () => undefined, stopAll: () => undefined }, clock: { nowMs: () => 0 } } as unknown as GameAudio;

describe('a script run in a scene (ft_1_24.AC6)', () => {
  it('ft_1_24.AC6 hands each item it gives to the scene, once, as it is given', () => {
    const gave: string[] = [];
    const running = new SceneScript(scriptSchema.parse(boatArrives), scene, pieces, audio, (item) => gave.push(item));
    expect(gave).toEqual([]);
    expect(running.skip()).toBe(true);
    expect(running.done).toBe(true);
    expect(gave).toEqual(['shell']);
    expect(running.given).toEqual(['shell']);
  });

  it('keeps time on a slow machine: a frame of 400 ms moves the script as far as four of 100 ms', () => {
    const run = () => new SceneScript(scriptSchema.parse(boatArrives), scene, pieces, audio, () => undefined);
    const slow = run(), even = run();
    slow.tick(1000);
    slow.tick(1400);
    for (const time of [1000, 1100, 1200, 1300, 1400]) even.tick(time);
    expect(slow.view()).toEqual(even.view());
    expect(slow.view()).not.toEqual(run().view());
  });

  it('never jumps ahead after a pause: a frame of ten seconds counts as one second', () => {
    const run = () => new SceneScript(scriptSchema.parse(boatArrives), scene, pieces, audio, () => undefined);
    const paused = run(), second = run();
    paused.tick(0);
    paused.tick(10_000);
    second.tick(0);
    second.tick(1000);
    expect(paused.view()).toEqual(second.view());
  });
});
