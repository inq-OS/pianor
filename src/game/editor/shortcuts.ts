/**
 * The piece maker's keys: every action and item of the band has one, F1 shows them on the band, and a
 * key with choices opens its menu with a number on each choice (N, then 3: a dotted half). Matched by physical key
 * (`KeyboardEvent.code`), so they work on any layout. Not Phaser: the table is plain data a test can check.
 */

export interface EditorKey {
  /** `KeyboardEvent.code` of the key. */
  code: string;
  /** Held with Ctrl (or Cmd). */
  ctrl?: boolean;
  /** Its name on its button, short enough for a 20-pixel button: `N`, or `^S` for Ctrl+S (the F1 list says ^ is Ctrl). */
  label: string;
}

const key = (code: string, label: string, ctrl = false): EditorKey => (ctrl ? { code, label, ctrl } : { code, label });

// AX-3 provisional: which letter each tool has (N for notes and the number choices are set; the rest are provisional)
export const EDITOR_KEYS = {
  help: key('F1', 'F1'),
  listen: key('KeyP', 'P'),
  tryIt: key('KeyY', 'Y'),
  save: key('KeyS', '^S', true),
  undo: key('KeyZ', '^Z', true),
  redo: key('KeyY', '^Y', true),
  delete: key('Delete', 'Del'),
  copy: key('KeyC', '^C', true),
  paste: key('KeyV', 'V'),
  exportFile: key('KeyE', '^E', true),
  importFile: key('KeyO', '^O', true),
  piece: key('KeyI', 'I'),
  notes: key('KeyN', 'N'),
  rests: key('KeyR', 'R'),
  accidentals: key('KeyA', 'A'),
  ties: key('KeyT', 'T'),
  dynamics: key('KeyD', 'D'),
  fingers: key('KeyF', 'F'),
  repeats: key('KeyK', 'K'),
  staff: key('KeyM', 'M'),
  shortTap: key('KeyU', 'U'),
  chord: key('KeyC', 'C'),
  // the photo behind the staff after a photo import (ft_Y_04 slice 4): shown or hidden, moved a bar back or on
  photo: key('KeyG', 'G'),
  photoBack: key('Comma', ','),
  photoOn: key('Period', '.'),
} as const satisfies Record<string, EditorKey>;

export type EditorKeyName = keyof typeof EDITOR_KEYS;

/** The name of the key `e` is, if it is one of the table's (Ctrl must match: C is the chord, Ctrl+C copies). */
export function editorKeyOf(e: { code: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }): EditorKeyName | null {
  if (e.altKey || e.shiftKey) return null;
  const ctrl = e.ctrlKey || e.metaKey;
  for (const [name, k] of Object.entries(EDITOR_KEYS) as [EditorKeyName, EditorKey][]) {
    if (k.code === e.code && !!k.ctrl === ctrl) return name;
  }
  return null;
}

/** The digit a key is (the row or the number pad), or null: what picks a choice in a menu opened by its key. */
export function digitOf(code: string): number | null {
  const match = /^(?:Digit|Numpad)([0-9])$/.exec(code);
  return match ? Number(match[1]) : null;
}
