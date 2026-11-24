import type { StringKey } from '../../core/text/strings';

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

/** One group of the vim keys' F1 page (ft_1_02e.AC8): its title, then each row's keys (as typed) and what they do. */
export interface VimHelpGroup {
  readonly title: StringKey;
  readonly rows: readonly (readonly [keys: string, does: StringKey])[];
}

/** What F1 shows while the vim keys are on: every key of ft_1_02e, grouped as a vim user looks for them. */
export const VIM_HELP: readonly VimHelpGroup[] = [
  { title: 'editor.vimHelp.move', rows: [
    ['h l', 'editor.vimHelp.note'], ['j k', 'editor.vimHelp.step'], ['w b', 'editor.vimHelp.bar'], ['3l 5j', 'editor.vimHelp.count'], ['0 $', 'editor.vimHelp.barEnds'],
    ['+ -', 'editor.vimHelp.staff'], ['gg G', 'editor.vimHelp.firstLast'], ['5G', 'editor.vimHelp.barN'],
  ] },
  { title: 'editor.vimHelp.change', rows: [
    ['x', 'editor.vimHelp.delete'], ['^A ^X', 'editor.vimHelp.upDown'], ['r a..g', 'editor.vimHelp.letter'], ['~', 'editor.vimHelp.sharpFlat'],
    ['u ^R', 'editor.vimHelp.undo'], ['.', 'editor.vimHelp.again'], ['dd yy', 'editor.vimHelp.cutCopy'], ['p P', 'editor.vimHelp.paste'],
    ['v', 'editor.vimHelp.select'],
  ] },
  { title: 'editor.vimHelp.insert', rows: [
    ['Esc', 'editor.vimHelp.stop'], ['i a', 'editor.vimHelp.here'], ['o O', 'editor.vimHelp.newBar'], ['c..g', 'editor.vimHelp.write'], ['C..G', 'editor.vimHelp.chord'],
    ['+ -', 'editor.vimHelp.sharpFlat'], ["' ,", 'editor.vimHelp.octave'], ['r', 'editor.vimHelp.rest'], ['1..8', 'editor.vimHelp.length'],
  ] },
  { title: 'editor.vimHelp.line', rows: [
    [':w', 'editor.vimHelp.save'], [':q', 'editor.vimHelp.leave'], [':q!', 'editor.vimHelp.leaveNow'], [':wq', 'editor.vimHelp.saveLeave'],
    [':pl[ay]', 'editor.vimHelp.listen'], [':12', 'editor.vimHelp.barN'], [':set novim', 'editor.vimHelp.off'],
  ] },
];

export type VimHelpLine = { readonly kind: 'title'; readonly text: StringKey } | { readonly kind: 'row'; readonly keys: string; readonly does: StringKey };

/**
 * The F1 page's lines poured into columns of at most `rows` lines, top to bottom: a group starts a new column when it does
 * not fit in what is left of one, so its title stays with its keys (a group longer than a column runs on).
 */
export function vimHelpColumns(groups: readonly VimHelpGroup[], rows: number): VimHelpLine[][] {
  const columns: VimHelpLine[][] = [[]];
  for (const group of groups) {
    const lines: VimHelpLine[] = [{ kind: 'title', text: group.title }, ...group.rows.map(([keys, does]) => ({ kind: 'row' as const, keys, does }))];
    let column = columns.at(-1)!;
    if (column.length > 0 && column.length + lines.length > rows) columns.push((column = []));
    for (const line of lines) {
      if (column.length >= rows) columns.push((column = []));
      column.push(line);
    }
  }
  return columns;
}
