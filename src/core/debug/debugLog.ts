/**
 * The built-in debug log (ft_Y_15): the last few hundred things that happened in the game, kept in memory for a developer
 * to download after something went wrong. Off unless the page was opened with `?debug=1`.
 *
 * Off, a call costs one test of `on` and returns, like a print behind `#ifdef DEBUG` (the text a caller builds is the one
 * cost left: a caller on a hot path tests `debugLog.on` itself before it builds any). On, each entry overwrites the oldest
 * once the ring is full, so the log never grows. It holds what a developer needs to replay a bug (scenes, keys, edits,
 * errors) and never a player's name, progress or typed text (the capture masks it, `src/io/debug/debugCapture.ts`).
 */

/** One thing that happened: when (ms since the epoch), what kind (`scene`, `key`, `note`, `edit`, `error`, ...) and the detail. */
export interface DebugEntry {
  readonly at: number;
  readonly kind: string;
  readonly text: string;
}

/** How many entries the log keeps: a few minutes of busy play, about 50 KB of text. */
export const DEBUG_LOG_CAPACITY = 500;

/** The longest detail an entry keeps; an error's stack is cut there. */
export const DEBUG_TEXT_MAX = 2000;

export class DebugLog {
  /** Whether the log records. Tested by every call; false until `enable`. */
  on = false;
  private readonly ring: (DebugEntry | undefined)[];
  private next = 0;
  private count = 0;
  /** What an earlier page left (see `restore`): shown before this page's entries. */
  private earlier = '';
  /** Bumped on each entry, so a writer can tell whether anything changed since it last looked. */
  version = 0;

  constructor(readonly capacity = DEBUG_LOG_CAPACITY, private readonly now: () => number = Date.now) {
    this.ring = new Array<DebugEntry | undefined>(capacity);
  }

  enable(): void {
    this.on = true;
  }

  /** Record one entry; nothing when the log is off. */
  log(kind: string, text: string): void {
    if (!this.on) return;
    this.ring[this.next] = { at: this.now(), kind, text: text.length > DEBUG_TEXT_MAX ? `${text.slice(0, DEBUG_TEXT_MAX)}...` : text };
    this.next = (this.next + 1) % this.capacity;
    this.count = Math.min(this.count + 1, this.capacity);
    this.version++;
  }

  /** The entries kept, oldest first. */
  entries(): DebugEntry[] {
    const out: DebugEntry[] = [];
    const first = this.count < this.capacity ? 0 : this.next;
    for (let i = 0; i < this.count; i++) out.push(this.ring[(first + i) % this.capacity]!);
    return out;
  }

  /** This page's entries as text, one line each: `<ISO time> scene editor`. */
  pageText(): string {
    return this.entries().map(formatEntry).join('\n');
  }

  /**
   * The whole log as text: what an earlier page left (a page that froze or crashed and was reloaded in the same tab), then
   * this page's entries.
   */
  text(): string {
    const page = this.pageText();
    return this.earlier ? `${this.earlier}\n--- page reloaded ---\n${page}` : page;
  }

  /** Keep the text an earlier page saved, trimmed to its last `capacity` lines, to put before this page's entries. */
  restore(earlier: string): void {
    const lines = earlier.split('\n').filter((line) => line.trim() !== '');
    this.earlier = lines.slice(-this.capacity).join('\n');
  }
}

export function formatEntry(entry: DebugEntry): string {
  return `${new Date(entry.at).toISOString()} ${entry.kind} ${entry.text.replace(/\n/g, '\n    ')}`;
}

/** The game's one log: scenes and io write to it, the page's download button reads it. */
export const debugLog = new DebugLog();
