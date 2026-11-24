/**
 * The piece maker's entry preferences: a per-device record for the writer's hand and keyboard, kept apart from
 * the player save. AX-3 provisional: the setting lives per device rather than per player, because it is about the
 * writer's hand and keyboard, not progress; it is cheap to move later. Pure: storage is in the caller.
 */

/** Version of the stored record; a change needs a migration step here. */
export const ENTRY_PREFS_VERSION = 1;

/** The key the record is stored under. Outside `pianor/`, so profile saves never touch it. */
export const ENTRY_PREFS_KEY = 'pianor-editor/entry-prefs';

export interface EntryPrefs {
  readonly schemaVersion: 1;
  /** A short tap enters an eighth note instead of a quarter note. */
  readonly shortTapEighth: boolean;
  /** The vim keys are on (ft_1_02e). Optional and additive (no version bump): absent reads as off. */
  readonly vimKeys?: boolean;
}

/** The record a fresh device uses: every option off. */
export const DEFAULT_ENTRY_PREFS: EntryPrefs = { schemaVersion: ENTRY_PREFS_VERSION, shortTapEighth: false };

/** The record as stored (JSON). */
export function serializeEntryPrefs(prefs: EntryPrefs): string {
  return JSON.stringify({ schemaVersion: prefs.schemaVersion, shortTapEighth: prefs.shortTapEighth, ...(prefs.vimKeys ? { vimKeys: true } : {}) });
}

/**
 * Reads the stored record. A missing, broken, unknown-version or mistyped record reads as the default (off), so a damaged
 * record never changes how the writer's keys behave.
 */
export function parseEntryPrefs(text: string | null): EntryPrefs {
  if (text === null) return DEFAULT_ENTRY_PREFS;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return DEFAULT_ENTRY_PREFS;
  }
  if (typeof value !== 'object' || value === null) return DEFAULT_ENTRY_PREFS;
  const { schemaVersion, shortTapEighth, vimKeys } = value as Record<string, unknown>;
  if (schemaVersion !== ENTRY_PREFS_VERSION || typeof shortTapEighth !== 'boolean') return DEFAULT_ENTRY_PREFS;
  // a mistyped vimKeys reads as off and never spoils the short-tap setting beside it
  return { schemaVersion: ENTRY_PREFS_VERSION, shortTapEighth, ...(vimKeys === true ? { vimKeys: true } : {}) };
}
