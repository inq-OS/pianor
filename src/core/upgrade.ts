/**
 * The loop every saved or loaded format shares (charts, profiles): read `schemaVersion`, then apply one step per version
 * until the current one. Each format keeps its own steps, error class and wording.
 */

type Raw = Record<string, unknown>;

export interface UpgradeWords {
  /** The raw value is not an object with a `schemaVersion`. */
  noVersion: string;
  newer: (version: number, current: number) => string;
  noStep: (version: number) => string;
}

/**
 * Bring `raw` up to `current`: `stepFrom(n)` turns version n into n + 1, and each result gets its new `schemaVersion`.
 * Throws `fail(message)` for a missing or invalid version, one newer than `current`, or a gap in the steps.
 */
export function upgradeToCurrent(
  raw: unknown,
  stepFrom: (version: number) => ((doc: Raw) => Raw) | undefined,
  current: number,
  words: UpgradeWords,
  fail: (message: string) => Error,
): Raw {
  if (typeof raw !== 'object' || raw === null || !('schemaVersion' in raw)) throw fail(words.noVersion);
  let doc = raw as Raw;
  let version = doc.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    throw fail(`invalid schemaVersion: ${String(version)}`);
  }
  if (version > current) throw fail(words.newer(version, current));
  while (version < current) {
    const step = stepFrom(version);
    if (!step) throw fail(words.noStep(version));
    doc = step(doc);
    version++;
    doc.schemaVersion = version;
  }
  return doc;
}
