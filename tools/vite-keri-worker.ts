import { parentPort, workerData } from 'node:worker_threads';
import type { SkyPhase } from '../src/core/sky/skyPhase.ts';
import { paintOne, shippedWorld } from './vite-keri.ts';

/**
 * A worker of `vite-keri.ts`: paints the pictures it is handed, one picture at one hour at a time, and hands each
 * back packed. The world is read here once; the private portrait comes with the worker.
 */
const sources = { portrait: (workerData as { portrait: unknown }).portrait, world: shippedWorld() };
parentPort?.on('message', ({ name, phase }: { name: string; phase: SkyPhase }) => {
  parentPort?.postMessage({ name, phase, picture: paintOne(name, phase, sources) });
});
