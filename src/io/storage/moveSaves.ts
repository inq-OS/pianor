import type { KeyValueStore } from '../../core/progression';

/** Written last into the new store once every save is copied and checked. Its presence means the move is done. */
export const MOVED_MARKER = 'pianor/migrated/from-localstorage';

export type MoveOutcome =
  | { kind: 'moved'; count: number }
  | { kind: 'already' }
  | { kind: 'nothing' }
  | { kind: 'failed'; error: string };

/**
 * One-time copy of saves from `from` (localStorage) to `to` (IndexedDB). Order matters:
 * copy, read every copy back and compare, write the marker, then clear the old keys.
 * Any failure before the marker leaves `from` as it is, so the caller keeps using it and the next start tries again.
 * A failure to clear old keys after the marker does not undo the move: the saves are already safe in `to`.
 */
export async function moveSaves(from: KeyValueStore, to: KeyValueStore, prefix: string): Promise<MoveOutcome> {
  try {
    if ((await to.get(MOVED_MARKER)) !== null) return { kind: 'already' };
    const keys = await from.keys(prefix);
    if (keys.length === 0) return { kind: 'nothing' };

    const values = new Map<string, string>();
    for (const key of keys) {
      const value = await from.get(key);
      if (value === null) throw new Error(`save vanished while copying: ${key}`);
      values.set(key, value);
    }
    for (const [key, value] of values) await to.set(key, value);
    for (const [key, value] of values) {
      if ((await to.get(key)) !== value) throw new Error(`copy does not read back the same: ${key}`);
    }

    await to.set(MOVED_MARKER, new Date().toISOString());
    for (const key of keys) {
      try {
        await from.remove(key);
      } catch {
        // Left behind on purpose: nothing reads these keys any more.
      }
    }
    return { kind: 'moved', count: keys.length };
  } catch (error) {
    return { kind: 'failed', error: error instanceof Error ? error.message : String(error) };
  }
}
