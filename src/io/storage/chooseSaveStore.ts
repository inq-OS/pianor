import type { KeyValueStore } from '../../core/progression';
import { MemoryStore } from './MemoryStore';
import { moveSaves } from './moveSaves';

const SAVE_PREFIX = 'pianor/';

/**
 * Written into localStorage once IndexedDB has been used as the save store. Kept outside the `pianor/` prefix,
 * so the move never copies or clears it. Once it is set, localStorage is never a save store again.
 */
export const IDB_IN_USE_KEY = 'pianor-idb-in-use';

export type ChosenStore = { store: KeyValueStore; persistent: boolean };

export interface SaveSources {
  /** Opens IndexedDB. Rejects when the browser refuses. */
  openIdb: () => Promise<KeyValueStore>;
  /** localStorage, or null when the browser blocks it. */
  local: KeyValueStore | null;
  /** Called once IndexedDB has opened, for example to ask the browser to keep saves. */
  onIdbOpened?: () => void;
}

/**
 * Picks the save store for the page. IndexedDB is the store. The first time, saves from localStorage are moved across.
 * If IndexedDB will not open: localStorage, unless IndexedDB was already in use. Then localStorage holds only old,
 * moved-away data, and writes there would never be read back, so the session uses memory instead.
 */
export async function chooseSaveStore(sources: SaveSources): Promise<ChosenStore> {
  const { local } = sources;
  const idbInUse = local !== null && (await local.get(IDB_IN_USE_KEY)) !== null;
  let idb: KeyValueStore;
  try {
    idb = await sources.openIdb();
  } catch {
    if (local && !idbInUse) return { store: local, persistent: true };
    return { store: new MemoryStore(), persistent: false };
  }
  sources.onIdbOpened?.();
  if (!local || idbInUse) return { store: idb, persistent: true };

  const outcome = await moveSaves(local, idb, SAVE_PREFIX);
  // A failed copy keeps the old saves in localStorage, which the game then keeps using; the next start tries again.
  if (outcome.kind === 'failed') return { store: local, persistent: true };
  // If this write fails (quota), the fallback case above can still lose a session. That is rare and not covered yet.
  await local.set(IDB_IN_USE_KEY, new Date().toISOString()).catch(() => undefined);
  return { store: idb, persistent: true };
}
