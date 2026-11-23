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
  /** Held with Shift too. */
  shift?: boolean;
  /** Its name on its button, short enough for a 20-pixel button: `N`, or `^S` for Ctrl+S (the F1 list says ^ is Ctrl). */
  label: string;
}

const key = (code: string, label: string, ctrl = false, shift = false): EditorKey => ({ code, label, ...(ctrl ? { ctrl } : {}), ...(shift ? { shift } : {}) });

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
  // the vim keys on or off (ft_1_02e), kept on this device
  vimKeys: key('KeyV', '^⇧V', true, true),
} as const satisfies Record<string, EditorKey>;

export type EditorKeyName = keyof typeof EDITOR_KEYS;

/** The name of the key `e` is, if it is one of the table's (Ctrl and Shift must match: C is the chord, Ctrl+C copies). */
export function editorKeyOf(e: { code: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }): EditorKeyName | null {
  if (e.altKey) return null;
  const ctrl = e.ctrlKey || e.metaKey;
  for (const [name, k] of Object.entries(EDITOR_KEYS) as [EditorKeyName, EditorKey][]) {
    if (k.code === e.code && !!k.ctrl === ctrl && !!k.shift === e.shiftKey) return name;
  }
  return null;
}

/** The digit a key is (the row or the number pad), or null: what picks a choice in a menu opened by its key. */
export function digitOf(code: string): number | null {
  const match = /^(?:Digit|Numpad)([0-9])$/.exec(code);
  return match ? Number(match[1]) : null;
}

/**
 * The vim keys' `:` words for the tools (ft_1_02e): every tool by its name (`:listen`, `:tryIt`, case does not matter) and
 * the short words below, so a tool whose letter vim takes is still one word away. `:w`, `:q` and `:set` are the scene's.
 */
export const VIM_WORDS: Readonly<Record<string, EditorKeyName>> = {
  play: 'listen', pl: 'listen', try: 'tryIt', time: 'piece', re: 'rests', acc: 'accidentals', dyn: 'dynamics',
  rep: 'repeats', tap: 'shortTap', ph: 'photo', pb: 'photoBack', pn: 'photoOn', help: 'help', h: 'help',
  e: 'exportFile', o: 'importFile', vim: 'vimKeys',
};

/** The tool a `:` word names, or null. */
export function vimWordOf(word: string): EditorKeyName | null {
  const lower = word.toLowerCase();
  if (lower in VIM_WORDS) return VIM_WORDS[lower]!;
  return (Object.keys(EDITOR_KEYS) as EditorKeyName[]).find((name) => name.toLowerCase() === lower) ?? null;
}

/**
 * What F1 shows on a button with the vim keys on: a tool whose letter vim takes shows its `:` word or its vim key, a length
 * the N list's digit (in normal mode a digit is a count); the others keep their own key.
 */
const VIM_LABELS: Readonly<Record<string, string>> = {
  P: ':pl', Y: ':try', I: ':time', R: ':re', A: '~', D: ':dyn', K: ':rep', U: ':tap', G: ':ph', ',': ':pb', '.': ':pn', V: 'p',
};

export function vimLabelOf(label: string): string {
  if (/^[0-9]$/.test(label)) return `n${label}`;
  return VIM_LABELS[label] ?? label;
}

/** A key press as the vim keys read it: the character typed, or the key's name; with Ctrl the letter of the physical key. */
export function vimKeyOf(e: { key: string; code: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): { key: string; ctrl: boolean } {
  // AltGr (Ctrl + Alt on Windows) types characters such as ~ on many layouts: that is a character, not a Ctrl key
  const ctrl = (e.ctrlKey || e.metaKey) && !(e.ctrlKey && e.altKey);
  if (ctrl) {
    const letter = /^Key([A-Z])$/.exec(e.code);
    return { key: letter ? letter[1]!.toLowerCase() : e.key, ctrl };
  }
  return { key: e.key, ctrl: false };
}
