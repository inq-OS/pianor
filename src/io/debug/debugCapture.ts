/**
 * What feeds the debug log from the browser (ft_Y_15): errors nobody caught, promises nobody handled, the computer keys and
 * mouse presses, the keys played, and a copy of the log in the tab's session storage so that a page that froze and was
 * reloaded still has what led up to it. Only started with `?debug=1` (`src/main.ts`): off, none of these listeners exist.
 */
import type { DebugLog } from '../../core/debug/debugLog';
import type { KeyboardInput, Unsubscribe } from '../keyboard';

/** The key the log is kept under in session storage (one tab's, gone when the tab closes). */
export const DEBUG_STORAGE_KEY = 'pianor.debugLog';

/** How often the copy in session storage is brought up to date, when anything changed. */
export const DEBUG_FLUSH_MS = 2000;

export interface DebugCaptureOptions {
  log: DebugLog;
  /** Where errors, keys and presses come from: the page's `window`. */
  target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  /** The tab's session storage, or null when the browser refuses it. */
  storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  /** True while a screen takes typed text (a name, a password): letters and digits are written as `*`, as in any text field. */
  masking: () => boolean;
}

export interface DebugCapture {
  /** Follow the keys played on this input (the merged keyboard). */
  follow(input: KeyboardInput): void;
  /** Write the copy in session storage now. */
  flush(): void;
  dispose(): void;
}

export function startDebugCapture(options: DebugCaptureOptions): DebugCapture {
  const { log, target, storage, masking } = options;
  log.enable();
  try {
    const earlier = storage?.getItem(DEBUG_STORAGE_KEY);
    if (earlier) log.restore(earlier);
  } catch {
    // a refused storage only loses the earlier page's log
  }

  const onError = (e: Event) => {
    const event = e as ErrorEvent;
    const where = event.filename ? ` (${event.filename}:${event.lineno}:${event.colno})` : '';
    log.log('error', `${describe(event.error ?? event.message)}${where}`);
    flush();
  };
  const onRejection = (e: Event) => {
    log.log('rejection', describe((e as PromiseRejectionEvent).reason));
    flush();
  };
  const onKey = (e: Event) => {
    const key = e as KeyboardEvent;
    if (key.repeat) return;
    log.log('key', keyName(key, masking() || isTextField(key.target)));
  };
  const onPointer = (e: Event) => {
    const p = e as PointerEvent;
    log.log('press', `${Math.round(p.clientX)},${Math.round(p.clientY)} button ${p.button}`);
  };
  const listeners: [string, (e: Event) => void][] = [['error', onError], ['unhandledrejection', onRejection], ['keydown', onKey], ['pointerdown', onPointer]];
  for (const [name, listener] of listeners) target.addEventListener(name, listener, true);

  let saved = log.version;
  function flush(): void {
    if (!storage || saved === log.version) return;
    saved = log.version;
    try {
      storage.setItem(DEBUG_STORAGE_KEY, log.text());
    } catch {
      // full or refused: the log in memory is still there to download
    }
  }
  const timer = setInterval(flush, DEBUG_FLUSH_MS);
  const unsubscribes: Unsubscribe[] = [];

  return {
    follow(input) {
      unsubscribes.push(input.onNote((n) => log.log('note', `${n.kind} ${n.midi} v${n.velocity} ${n.source}`)));
      unsubscribes.push(input.onStatus((s) => log.log('midi', `${s.state}${s.name ? ` ${s.name}` : ''}`)));
    },
    flush,
    dispose() {
      clearInterval(timer);
      for (const [name, listener] of listeners) target.removeEventListener(name, listener, true);
      unsubscribes.forEach((off) => off());
    },
  };
}

/** Whether a key goes into a text field of the page (the piece maker's title, any later one): what is typed there is masked. */
export function isTextField(target: EventTarget | null): boolean {
  const el = target as { tagName?: unknown; isContentEditable?: unknown } | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable === true);
}

/** A key as `Control+z`, `ArrowLeft`, `Shift+C`; a typed letter or digit is `*` while `masked` (no names or passwords in a log). */
export function keyName(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey'>, masked: boolean): string {
  const chord = e.ctrlKey || e.altKey || e.metaKey;
  const key = masked && !chord && e.key.length === 1 ? '*' : e.key;
  // Shift shows in a typed character itself (`C`), so it is named only before a named key (`Shift+ArrowLeft`)
  const mods = [e.ctrlKey && 'Control', e.altKey && 'Alt', e.metaKey && 'Meta', e.shiftKey && key.length > 1 && 'Shift'].filter((m) => m && m !== key);
  return [...mods, key].join('+');
}

/** An error, a rejection's reason or anything thrown, as one text with its stack when it has one. */
export function describe(thrown: unknown): string {
  if (thrown instanceof Error) {
    const head = `${thrown.name}: ${thrown.message}`;
    return thrown.stack ? (thrown.stack.startsWith(head) ? thrown.stack : `${head}\n${thrown.stack}`) : head;
  }
  if (typeof thrown === 'string') return thrown;
  try {
    return JSON.stringify(thrown) ?? String(thrown);
  } catch {
    return String(thrown);
  }
}
