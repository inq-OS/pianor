import type { SongRow } from './resolve.ts';

/**
 * The switches of a song's parts (ft_1_36 rule 5): `off` holds the node ids a player turned off. A part that is off, or
 * under a group that is off, is left out of the song. At least one written part (a piece or a link) stays on.
 */

const isOn = (rows: readonly SongRow[], off: ReadonlySet<string>, row: SongRow): boolean => {
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (let r: SongRow | undefined = row; r; r = r.parent === null ? undefined : byId.get(r.parent)) if (off.has(r.id)) return false;
  return true;
};

/** Written parts (pieces and links whose piece is there) that would be on with these switches. */
function writtenOn(rows: readonly SongRow[], off: ReadonlySet<string>): SongRow[] {
  return rows.filter((r) => (r.kind === 'piece' || r.kind === 'link') && r.written && isOn(rows, off, r));
}

/** The row's switch may not be turned off: that would leave no written part on (its switch is drawn faded). */
export function keepsLastPartOn(rows: readonly SongRow[], off: readonly string[], id: string): boolean {
  const set = new Set(off);
  if (set.has(id)) return false;
  const before = writtenOn(rows, set).length;
  set.add(id);
  return before > 0 && writtenOn(rows, set).length === 0;
}

/** The switches with one row turned on or off; turning off the last written part on changes nothing (`changed` false). */
export function setPartOn(rows: readonly SongRow[], off: readonly string[], id: string, on: boolean): { off: string[]; changed: boolean } {
  const has = off.includes(id);
  if (on) return has ? { off: off.filter((x) => x !== id), changed: true } : { off: [...off], changed: false };
  if (has || !rows.some((r) => r.id === id && r.kind !== 'phrase') || keepsLastPartOn(rows, off, id)) return { off: [...off], changed: false };
  return { off: [...off, id], changed: true };
}

/**
 * Every row with `label` turned on or off at once (rule 16), in song order, each by the rule of `setPartOn`: the row
 * that would leave no written part on stays on.
 */
export function setLabelOn(rows: readonly SongRow[], off: readonly string[], label: string, on: boolean): { off: string[]; changed: boolean } {
  let now = [...off];
  let changed = false;
  for (const row of rows.filter((r) => r.labels.includes(label))) {
    const step = setPartOn(rows, now, row.id, on);
    now = step.off;
    changed ||= step.changed;
  }
  return { off: now, changed };
}

/** Whether every row with `label` is switched on: what its tab in the page's header shows. */
export function labelOn(rows: readonly SongRow[], off: readonly string[], label: string): boolean {
  return rows.filter((r) => r.labels.includes(label)).every((r) => !off.includes(r.id));
}
