import type { Chart } from './schema.ts';

/** How the tied notes of some tracks join up: what a judge needs to skip a press and a player needs to hold a sound. */
export interface TieLinks {
  /** Note index -> the note it is tied into (the same track, voice and pitch, starting where it ends). */
  next: Map<number, number>;
  /** Notes that continue an earlier one: no new press, no new sound. */
  continuations: Set<number>;
}

/** The ties among the notes of `trackIds`. A tie with no note to go into (`tieNext` on the last note) links nothing. */
export function tieLinks(chart: Chart, trackIds: ReadonlySet<string>): TieLinks {
  const key = (track: string, voice: number, midi: number, tick: number) => `${track}|${voice}|${midi}|${tick}`;
  const byStart = new Map<string, number>();
  chart.notes.forEach((n, i) => {
    if (trackIds.has(n.track)) byStart.set(key(n.track, n.voice, n.midi, n.tick), i);
  });
  const next = new Map<number, number>();
  const continuations = new Set<number>();
  chart.notes.forEach((n, i) => {
    if (!n.tieNext || !trackIds.has(n.track)) return;
    const into = byStart.get(key(n.track, n.voice, n.midi, n.tick + n.dur));
    if (into !== undefined && into !== i) {
      next.set(i, into);
      continuations.add(into);
    }
  });
  return { next, continuations };
}

/** The notes tied after `root`, in order (empty when nothing is tied into it). */
export function tieChain(links: TieLinks, root: number): number[] {
  const chain: number[] = [];
  for (let next = links.next.get(root); next !== undefined; next = links.next.get(next)) chain.push(next);
  return chain;
}
