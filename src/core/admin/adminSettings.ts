/**
 * The per-device admin settings: a record outside every player's profile, next to the password record. Pure: the
 * storage itself is in `io/admin`. A broken or unknown-version record falls back to the defaults, like the password record.
 */
import { z } from 'zod';
import type { PianoSoundKind } from '../sound/pianoSound';

/** Version of the stored settings; a change needs a migration step here. */
export const ADMIN_SETTINGS_SCHEMA_VERSION = 1;

/** The key the settings are stored under. Not under `pianor/`, so profile saves and their move never touch it. */
export const ADMIN_SETTINGS_KEY = 'pianor-admin/settings';

export interface AdminSettings {
  /** On: Tempo mode grades how long each note is held (d093). Off: it judges onsets only, as before slice f. */
  gradeNoteLength: boolean;
  /** The piano this computer plays: the full recordings, or the light ones that take about a fifth of the memory (ft_0_07.AC3). */
  pianoSound: PianoSoundKind;
}

/** The settings a fresh device uses. */
export const DEFAULT_ADMIN_SETTINGS: AdminSettings = { gradeNoteLength: true, pianoSound: 'full' };

/**
 * The stored JSON. A missing field takes its default, so a record written before a field existed reads as before and needs
 * no new schema version (`pianoSound`, then its `keyboard` value).
 */
const storedSettings = z.object({
  schemaVersion: z.literal(ADMIN_SETTINGS_SCHEMA_VERSION),
  gradeNoteLength: z.boolean().optional(),
  pianoSound: z.enum(['full', 'light', 'keyboard']).optional(),
});

/** The settings as stored (JSON). */
export function serializeAdminSettings(settings: AdminSettings): string {
  return JSON.stringify({ schemaVersion: ADMIN_SETTINGS_SCHEMA_VERSION, gradeNoteLength: settings.gradeNoteLength, pianoSound: settings.pianoSound });
}

/**
 * Reads the stored settings. Null, invalid JSON, a wrong shape or another schema version give a copy of the defaults;
 * this never throws.
 */
export function parseAdminSettings(raw: string | null): AdminSettings {
  if (raw === null) return { ...DEFAULT_ADMIN_SETTINGS };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_ADMIN_SETTINGS };
  }
  const parsed = storedSettings.safeParse(value);
  if (!parsed.success) return { ...DEFAULT_ADMIN_SETTINGS };
  return {
    gradeNoteLength: parsed.data.gradeNoteLength ?? DEFAULT_ADMIN_SETTINGS.gradeNoteLength,
    pianoSound: parsed.data.pianoSound ?? DEFAULT_ADMIN_SETTINGS.pianoSound,
  };
}
