/**
 * Vim keys for the piece maker (ft_1_02e): an opt-in modal layer over the editor's pure moves and edits. `vimKey` reads
 * one key at a time in the vim way (a count, an operator, a motion) and gives the command it completes; the scene carries
 * the command out with the same moves (`keyCursor.ts`), edits (`keyEdits.ts`, `bars.ts`) and tool actions (the names of
 * `EDITOR_KEYS`) the plain keys use, so there is no second set of editor actions. `vimMotion`, `nearestPitch` and the
 * helpers below are what the scene needs that the plain keys do not have. Pure.
 */
import { STEPS as STEPS_IN_ORDER, type Step } from '../chart/pitch';
import { moveBar, moveInTime, movePitch, otherStaff, timeStops, type KeyCursor } from './keyCursor';
import { findNote, KEY_HIGH, KEY_LOW, midiOf, placedRests, removeNote, removeRest, type Edit, type EditorLength, type EditorPiece } from './model';

export type VimMode = 'normal' | 'insert' | 'visual';

/**
 * One key as the vim layer reads it: `key` is the character typed (`KeyboardEvent.key`: `l`, `G`, `$`, `:`) or the name of
 * a key that types none (`Escape`, `Enter`, `Backspace`, `ArrowLeft`); `ctrl` is Ctrl or Cmd. With Ctrl the game gives the
 * letter of the physical key, so Ctrl-R is Ctrl-R on any layout.
 */
export interface VimKey {
  readonly key: string;
  readonly ctrl: boolean;
}

/** Where the cursor goes: the vim motions, in the piece maker's terms (a place is a note, chord or rest start; a bar is a line). */
export type VimMotion =
  | 'left' | 'right' | 'up' | 'down'
  | 'barNext' | 'barPrev' | 'barStart' | 'barEnd'
  | 'staffDown' | 'staffUp'
  | 'first' | 'last' | 'bar';

/** A change `.` can do again. */
export type VimChange =
  | { readonly kind: 'deleteNote'; readonly count: number }
  | { readonly kind: 'pitch'; readonly direction: 1 | -1; readonly count: number }
  | { readonly kind: 'replace'; readonly step: Step }
  | { readonly kind: 'accidental'; readonly count: number }
  | { readonly kind: 'deleteBars'; readonly count: number }
  | { readonly kind: 'paste'; readonly before: boolean; readonly count: number };

export type VimCommand =
  | VimChange
  /** Moves the cursor; for `bar` the count is the bar's number from 1 (`5G`), absent means the last bar. */
  | { readonly kind: 'move'; readonly motion: VimMotion; readonly count: number }
  | { readonly kind: 'yankBars'; readonly count: number }
  | { readonly kind: 'undo'; readonly count: number }
  | { readonly kind: 'redo'; readonly count: number }
  /** Into insert mode: at the cursor, after it, in a new empty bar after or before the cursor's bar. */
  | { readonly kind: 'insert'; readonly where: 'here' | 'after' | 'barAfter' | 'barBefore' }
  | { readonly kind: 'visual' }
  | { readonly kind: 'visualDelete' }
  | { readonly kind: 'visualYank' }
  | { readonly kind: 'visualPaste' }
  | { readonly kind: 'visualPitch'; readonly direction: 1 | -1; readonly count: number }
  /** Back to normal mode (Esc); `from` is the mode left. */
  | { readonly kind: 'normal'; readonly from: VimMode }
  /** Insert mode: a note of this letter at the cursor, then the cursor moves on. */
  | { readonly kind: 'write'; readonly step: Step }
  | { readonly kind: 'writeRest' }
  /** Insert mode: the note just written an octave up or down. */
  | { readonly kind: 'octave'; readonly direction: 1 | -1 }
  /** Insert mode: an uppercase letter, that note added to the chord just written, the next of that letter above its top head. */
  | { readonly kind: 'chordNote'; readonly step: Step }
  /** Insert mode: + and -, the note just written a semitone sharper or flatter (sharp, natural, flat). */
  | { readonly kind: 'sharpen'; readonly direction: 1 | -1 }
  /** Insert mode: Backspace, the note or chord before the cursor taken out and the cursor on its place. */
  | { readonly kind: 'erase' }
  /** A `:` line ended with Enter: its word and a `!` after it. */
  | { readonly kind: 'ex'; readonly name: string; readonly bang: boolean; readonly arg: string }
  /** The key is not vim's here: the plain piece maker handles it as it does without vim. */
  | { readonly kind: 'pass' }
  /** The key was taken and waits for more (a count, an operator, a `:` line), or was no command (vim's beep). */
  | { readonly kind: 'wait' };

export interface VimState {
  readonly mode: VimMode;
  /** The keys of a command not finished yet (`3d`), shown beside the mode. */
  readonly pending: string;
  /** The `:` line being typed (without the colon), or null. */
  readonly line: string | null;
  /** The last change, for `.`. */
  readonly last: VimChange | null;
}

export const VIM_START: VimState = { mode: 'normal', pending: '', line: null, last: null };

/**
 * The letters that keep their plain piece-maker tool in normal mode, because vim does not use them: N the lengths, T the
 * ties, F the fingers, M the staff, C the chord. The tools whose letter vim takes are reached with `:` and their name.
 */
export const VIM_PASS_LETTERS: ReadonlySet<string> = new Set(['n', 't', 'f', 'm', 'c']);

const NOTE_LETTERS: Readonly<Record<string, Step>> = { a: 'A', b: 'B', c: 'C', d: 'D', e: 'E', f: 'F', g: 'G' };

const MOTIONS: Readonly<Record<string, VimMotion>> = {
  h: 'left', l: 'right', j: 'down', k: 'up', ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ArrowUp: 'up',
  w: 'barNext', b: 'barPrev', '0': 'barStart', '^': 'barStart', $: 'barEnd', '+': 'staffDown', '-': 'staffUp', G: 'bar',
};

const done = (state: VimState, command: VimCommand): { state: VimState; command: VimCommand } => ({ state, command });

/** The count typed before a command (`12`), and the rest (`dd`). */
function splitCount(pending: string): { count: number | null; rest: string } {
  const match = /^([1-9][0-9]*)?(.*)$/.exec(pending)!;
  return { count: match[1] ? Math.min(Number(match[1]), 999) : null, rest: match[2]! };
}

/** One key in vim mode: the state after it and the command it finished (`wait` while a command is still being typed). */
export function vimKey(state: VimState, k: VimKey): { state: VimState; command: VimCommand } {
  if (state.line !== null) return lineKey(state, k);
  if (state.mode === 'insert') return insertKey(state, k);
  return normalKey(state, k);
}

/** The `:` line: letters are typed, Backspace takes one back (on an empty line it closes it), Enter runs it, Esc drops it. */
function lineKey(state: VimState, k: VimKey): { state: VimState; command: VimCommand } {
  const line = state.line!;
  if (k.key === 'Escape') return done({ ...state, line: null }, { kind: 'wait' });
  if (k.key === 'Backspace') return done({ ...state, line: line.length > 0 ? line.slice(0, -1) : null }, { kind: 'wait' });
  if (k.key === 'Enter') {
    const closed = { ...state, line: null };
    const match = /^\s*([A-Za-z]+|[0-9]+)(!?)\s*(.*?)\s*$/.exec(line);
    if (!match) return done(closed, { kind: 'wait' });
    const [, name, bang, arg] = match;
    // `:12` goes to bar 12, as a line number does in vim
    if (/^[0-9]+$/.test(name!)) return done(closed, { kind: 'move', motion: 'bar', count: Number(name) });
    return done(closed, { kind: 'ex', name: name!, bang: bang === '!', arg: arg! });
  }
  if (k.ctrl || k.key.length !== 1) return done(state, { kind: 'wait' });
  return done({ ...state, line: line + k.key }, { kind: 'wait' });
}

/**
 * Insert mode: the letters a to g write notes, A to G add one to the chord just written, r a rest, ' or . and , move the last
 * note an octave, + and - make it sharp or flat; the rest is the plain piece maker's (the digits pick the length).
 */
function insertKey(state: VimState, k: VimKey): { state: VimState; command: VimCommand } {
  if (k.key === 'Escape') return done({ ...state, mode: 'normal', pending: '' }, { kind: 'normal', from: 'insert' });
  if (k.ctrl) return done(state, { kind: 'pass' });
  if (k.key === 'Backspace') return done(state, { kind: 'erase' });
  const step = NOTE_LETTERS[k.key];
  if (step) return done(state, { kind: 'write', step });
  const upper = NOTE_LETTERS[k.key.toLowerCase()];
  if (upper && k.key !== k.key.toLowerCase()) return done(state, { kind: 'chordNote', step: upper });
  if (k.key === 'r') return done(state, { kind: 'writeRest' });
  // any other letter is no note: a slip of the finger never reaches a plain tool (playback, short tap) mid-entry
  if (/^[A-Za-z]$/.test(k.key)) return done(state, { kind: 'wait' });
  if (k.key === '+') return done(state, { kind: 'sharpen', direction: 1 });
  if (k.key === '-') return done(state, { kind: 'sharpen', direction: -1 });
  // ' is a dead key on some layouts (Estonian): . is octave up too, beside , for down
  if (k.key === "'" || k.key === '.') return done(state, { kind: 'octave', direction: 1 });
  if (k.key === ',') return done(state, { kind: 'octave', direction: -1 });
  return done(state, { kind: 'pass' });
}

type Out = { state: VimState; command: VimCommand };

/** The commands of one key in normal mode, from the state with no keys pending, the count (1 when none) and the count typed. */
const NORMAL_KEYS: Readonly<Record<string, (s: VimState, n: number, count: number | null) => Out>> = {
  x: (s, n) => change(s, { kind: 'deleteNote', count: n }),
  '~': (s, n) => change(s, { kind: 'accidental', count: n }),
  p: (s, n) => change(s, { kind: 'paste', before: false, count: n }),
  P: (s, n) => change(s, { kind: 'paste', before: true, count: n }),
  u: (s, n) => done(s, { kind: 'undo', count: n }),
  '.': (s, _n, count) => done(s, s.last ? withCount(s.last, count) : { kind: 'wait' }),
  i: (s) => done({ ...s, mode: 'insert' }, { kind: 'insert', where: 'here' }),
  a: (s) => done({ ...s, mode: 'insert' }, { kind: 'insert', where: 'after' }),
  o: (s) => done({ ...s, mode: 'insert' }, { kind: 'insert', where: 'barAfter' }),
  O: (s) => done({ ...s, mode: 'insert' }, { kind: 'insert', where: 'barBefore' }),
  v: (s) => done({ ...s, mode: 'visual' }, { kind: 'visual' }),
  V: (s) => done({ ...s, mode: 'visual' }, { kind: 'visual' }),
};

/** The keys of visual mode besides the motions: each ends it. */
const VISUAL_KEYS: Readonly<Record<string, VimCommand>> = {
  v: { kind: 'normal', from: 'visual' }, V: { kind: 'normal', from: 'visual' },
  d: { kind: 'visualDelete' }, x: { kind: 'visualDelete' }, y: { kind: 'visualYank' }, p: { kind: 'visualPaste' }, P: { kind: 'visualPaste' },
};

/** The keys that wait for a second one: dd, yy, gg, r{letter}. */
const OPERATORS: ReadonlySet<string> = new Set(['d', 'y', 'g', 'r']);

/** Normal and visual mode: a count, then a motion, an operator with its second key, or a command of one key. */
function normalKey(state: VimState, k: VimKey): Out {
  const visual = state.mode === 'visual';
  const cleared = { ...state, pending: '' };
  if (k.key === 'Escape') {
    if (visual) return done({ ...cleared, mode: 'normal' }, { kind: 'normal', from: 'visual' });
    // Esc in normal mode only drops a command half typed; it never leaves the piece maker
    return done(cleared, state.pending ? { kind: 'wait' } : { kind: 'normal', from: 'normal' });
  }
  const { count, rest } = splitCount(state.pending);
  const n = count ?? 1;
  if (k.ctrl) return ctrlKey(cleared, k.key.toLowerCase(), n, visual);
  if (rest) return operatorKey(cleared, rest, k.key, count);
  // a digit grows the count; 0 with no count is the bar's start
  if (/^[0-9]$/.test(k.key) && (k.key !== '0' || count !== null)) return done({ ...state, pending: state.pending + k.key }, { kind: 'wait' });
  const motion = MOTIONS[k.key];
  if (motion) return done(cleared, { kind: 'move', motion, count: motion === 'bar' ? count ?? 0 : n });
  const visualCommand = visual ? VISUAL_KEYS[k.key] : undefined;
  if (visualCommand) return done({ ...cleared, mode: 'normal' }, visualCommand);
  if (!visual && OPERATORS.has(k.key)) return done({ ...state, pending: state.pending + k.key }, { kind: 'wait' });
  const single = visual ? undefined : NORMAL_KEYS[k.key];
  if (single) return single(cleared, n, count);
  if (k.key === ':') return done({ ...cleared, line: '' }, { kind: 'wait' });
  if (VIM_PASS_LETTERS.has(k.key) || k.key.length > 1) return done(cleared, { kind: 'pass' });
  // any other character is vim's and does nothing (vim's beep): it never falls through to a plain tool
  return done(cleared, { kind: 'wait' });
}

/** Ctrl-R redo, Ctrl-A and Ctrl-X a step up and down (the selected bars' notes in visual mode); any other Ctrl key is the plain one. */
function ctrlKey(state: VimState, key: string, n: number, visual: boolean): Out {
  // redo in visual mode ends it, as the selection it made may be gone
  if (key === 'r') return done(visual ? { ...state, mode: 'normal' } : state, { kind: 'redo', count: n });
  if (key !== 'a' && key !== 'x') return done(state, { kind: 'pass' });
  const direction = key === 'a' ? 1 : -1;
  if (visual) return done(state, { kind: 'visualPitch', direction, count: n });
  return change(state, { kind: 'pitch', direction, count: n });
}

/** The second key of an operator: dd, yy, gg, r{letter}; any other is dropped (vim's beep). */
function operatorKey(state: VimState, op: string, key: string, count: number | null): Out {
  const n = count ?? 1;
  const both = op + key;
  if (both === 'dd') return change(state, { kind: 'deleteBars', count: n });
  if (both === 'yy') return done(state, { kind: 'yankBars', count: n });
  if (both === 'gg') return done(state, { kind: 'move', motion: count === null ? 'first' : 'bar', count: n });
  const step = op === 'r' ? NOTE_LETTERS[key.toLowerCase()] : undefined;
  return step ? change(state, { kind: 'replace', step }) : done(state, { kind: 'wait' });
}

/** A change is kept for `.`. */
function change(state: VimState, command: VimChange): Out {
  return done({ ...state, last: command }, command);
}

/** `.` with a count of its own does the change that many times instead of its first count (`3.`); `r` has no count. */
function withCount(last: VimChange, count: number | null): VimChange {
  if (count === null || last.kind === 'replace') return last;
  return { ...last, count };
}

/** What the mode line shows: the mode, then the keys typed so far or the `:` line. */
export function vimShowCmd(state: VimState): { mode: VimMode; keys: string } {
  return { mode: state.mode, keys: state.line !== null ? `:${state.line}` : state.pending };
}

/**
 * Where a motion takes the cursor, `count` times (for `bar`, the count is the bar's number from 1; 0 is the last bar). A
 * motion that cannot go on stops where it got to.
 */
export function vimMotion(piece: EditorPiece, cursor: KeyCursor, motion: VimMotion, count: number, length: EditorLength): KeyCursor {
  const to = motionTarget(piece, cursor, motion, count, length);
  // a move in time lands on the note there, so x, r and Ctrl-A act on it at once; up and down go step by step
  return motion === 'up' || motion === 'down' || motion === 'staffUp' || motion === 'staffDown' ? to : snapToNote(piece, to);
}

/**
 * The cursor on the note of its place nearest to its pitch (of a chord, the nearest head), or as it is where no note starts
 * there. After a move in time and after undo, so the cursor stands on what is there.
 */
export function snapToNote(piece: EditorPiece, cursor: KeyCursor): KeyCursor {
  if (findNote(piece, cursor)) return cursor;
  const here = midiOf(cursor.step, cursor.octave);
  const heads = piece.notes.filter((n) => n.hand === cursor.hand && n.bar === cursor.bar && n.start === cursor.start);
  if (heads.length === 0) return cursor;
  const near = heads.reduce((a, b) => (Math.abs(midiOf(b.step, b.octave) - here) < Math.abs(midiOf(a.step, a.octave) - here) ? b : a));
  return { ...cursor, step: near.step, octave: near.octave };
}

function motionTarget(piece: EditorPiece, cursor: KeyCursor, motion: VimMotion, count: number, length: EditorLength): KeyCursor {
  const repeat = (step: (c: KeyCursor) => KeyCursor): KeyCursor => {
    let c = cursor;
    for (let i = 0; i < Math.max(1, count); i++) c = step(c);
    return c;
  };
  switch (motion) {
    case 'left': return repeat((c) => moveInTime(piece, c, -1, length));
    case 'right': return repeat((c) => moveInTime(piece, c, 1, length));
    case 'up': return repeat((c) => movePitch(c, 1));
    case 'down': return repeat((c) => movePitch(c, -1));
    case 'barNext': return repeat((c) => moveBar(piece, c, 1));
    // b goes to the start of the bar first, as vim's b goes to the word's start
    case 'barPrev': return repeat((c) => moveBar(piece, c, -1));
    case 'barStart': return { ...cursor, start: 0 };
    case 'barEnd': return { ...cursor, start: timeStops(piece, cursor.hand, cursor.bar, length).at(-1) ?? 0 };
    case 'staffDown': return repeat((c) => otherStaff(piece, c, length, -1));
    case 'staffUp': return repeat((c) => otherStaff(piece, c, length, 1));
    case 'first': return { ...cursor, bar: 0, start: 0 };
    case 'last': return { ...cursor, bar: piece.bars - 1, start: 0 };
    case 'bar': {
      const bar = count <= 0 ? piece.bars - 1 : Math.min(count, piece.bars) - 1;
      return { ...cursor, bar, start: 0 };
    }
  }
}

/**
 * The pitch of `step` nearest to `from` (LilyPond's relative entry), so never more than a fourth away: C after A4 is C5, a
 * third up, not C4 a sixth down. Kept inside the keys a piece may use.
 */
export function nearestPitch(from: { step: Step; octave: number }, step: Step): { step: Step; octave: number } {
  const here = STEPS_IN_ORDER.indexOf(from.step) + 7 * from.octave;
  const candidates = [-1, 0, 1].map((d) => ({ step, octave: from.octave + d }));
  const distance = (p: { step: Step; octave: number }) => STEPS_IN_ORDER.indexOf(p.step) + 7 * p.octave - here;
  const inRange = candidates.filter((p) => midiOf(p.step, p.octave) >= KEY_LOW && midiOf(p.step, p.octave) <= KEY_HIGH);
  const pool = inRange.length > 0 ? inRange : candidates;
  return pool.reduce((best, p) => {
    const a = Math.abs(distance(p));
    const b = Math.abs(distance(best));
    return a < b || (a === b && distance(p) > 0) ? p : best;
  });
}

/** The staff steps from `from` to the nearest pitch of `step` (`r` replaces a note's letter): positive up. */
export function stepsTo(from: { step: Step; octave: number }, step: Step): number {
  const to = nearestPitch(from, step);
  return STEPS_IN_ORDER.indexOf(to.step) + 7 * to.octave - (STEPS_IN_ORDER.indexOf(from.step) + 7 * from.octave);
}

/**
 * `x` with a count: the note under the cursor out, then on to the next place and the note there nearest the pitch, `count`
 * times, in one edit; refused when the cursor is on no note.
 */
export function deleteNotes(piece: EditorPiece, cursor: KeyCursor, count: number, length: EditorLength): Edit {
  if (!findNote(piece, cursor)) return { ok: false, reason: 'no-note' };
  let next = piece;
  let c = cursor;
  for (let i = 0; i < Math.max(1, count); i++) {
    const removed = removeNote(next, c);
    if (removed.ok) next = removed.piece;
    const on = moveInTime(next, c, 1, length);
    if (on.bar === c.bar && on.start === c.start) break;
    c = snapToNote(next, on);
  }
  return { ok: true, piece: next };
}

/** The notes of the place right before the cursor (a whole chord) or its placed rest, for insert mode's Backspace: the edit and where the cursor goes. */
export function eraseBefore(piece: EditorPiece, cursor: KeyCursor, length: EditorLength): { edit: Edit; cursor: KeyCursor } {
  const back = moveInTime(piece, cursor, -1, length);
  if (back.bar === cursor.bar && back.start === cursor.start) return { edit: { ok: false, reason: 'no-note' }, cursor };
  const chord = piece.notes.filter((n) => n.hand === back.hand && n.bar === back.bar && n.start === back.start);
  if (chord.length === 0) {
    // a placed rest goes as a note does
    const rest = placedRests(piece).find((r) => r.hand === back.hand && r.bar === back.bar && r.start === back.start);
    return { edit: rest ? removeRest(piece, rest) : { ok: false, reason: 'no-note' }, cursor: back };
  }
  let next = piece;
  for (const note of chord) {
    const removed = removeNote(next, note);
    if (removed.ok) next = removed.piece;
  }
  const top = chord.reduce((a, b) => (midiOf(b.step, b.octave) > midiOf(a.step, a.octave) ? b : a));
  return { edit: { ok: true, piece: next }, cursor: { ...back, step: top.step, octave: top.octave } };
}

/** The pitch of `step` above `from` (an uppercase letter stacks a chord upward): the nearest one higher, never the same. */
export function pitchAbove(from: { step: Step; octave: number }, step: Step): { step: Step; octave: number } {
  const here = STEPS_IN_ORDER.indexOf(from.step) + 7 * from.octave;
  const index = STEPS_IN_ORDER.indexOf(step);
  const octave = Math.floor((here - index) / 7) + 1;
  return { step, octave };
}
