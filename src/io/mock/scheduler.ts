/** Runs a callback after a delay. Real time for demos, a manual queue for deterministic tests. */
export interface Scheduler {
  at(delayMs: number, run: () => void): void;
}

export const realtimeScheduler: Scheduler = {
  at(delayMs, run) {
    setTimeout(run, Math.max(0, delayMs));
  },
};

/** Deterministic scheduler: nothing runs until the test says so. Tasks run in time order, ties in the order added. */
export class ManualScheduler implements Scheduler {
  private queue: { at: number; order: number; run: () => void }[] = [];
  private order = 0;
  private clock = 0;

  get now(): number {
    return this.clock;
  }

  get pending(): number {
    return this.queue.length;
  }

  at(delayMs: number, run: () => void): void {
    this.queue.push({ at: this.clock + Math.max(0, delayMs), order: this.order++, run });
  }

  /** Run everything scheduled up to and including `ms` from now. */
  advance(ms: number): void {
    const until = this.clock + ms;
    for (;;) {
      this.queue.sort((a, b) => a.at - b.at || a.order - b.order);
      const next = this.queue[0];
      if (!next || next.at > until) break;
      this.queue.shift();
      this.clock = next.at;
      next.run();
    }
    this.clock = until;
  }

  runAll(): void {
    while (this.queue.length > 0) {
      this.queue.sort((a, b) => a.at - b.at || a.order - b.order);
      const next = this.queue.shift()!;
      this.clock = next.at;
      next.run();
    }
  }
}
