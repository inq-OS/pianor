/**
 * `SaveDocument` (core_11, WP-03; d136; contract A.2): one saved block of a player, versioned and migrated on its own, read
 * and written only through `KeyValueStore` (`src/core/progression/repository.ts`). WP-01 delivers the type only; WP-03 the
 * documents, the one-time move and the golden tests.
 */

export type SaveDocumentName = 'profile' | 'practiceLog' | 'world' | 'curriculum';

export interface SaveDocument<T> {
  readonly name: SaveDocumentName;
  /** This document's own version, starting at 1. */
  readonly schemaVersion: number;
  /** Steps from each older version to the next; frozen once released, each with a golden test. */
  readonly migrations: readonly { readonly from: number; migrate(old: unknown): unknown }[];
  /** A fresh player's value. */
  empty(): T;
  /** Any stored text of any released version (or null) to the current value; never throws on old data. */
  parse(text: string | null): T;
  /** Always writes `{ schemaVersion, ...value }`. */
  serialize(value: T): string;
}
