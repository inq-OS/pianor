// Covers ft_1_02e (vim keys in the piece maker): the key parser and the moves and edits it adds.
import { describe, expect, it } from 'vitest';
import { startKeyCursor } from './keyCursor';
import { emptyPiece, findNote, type EditorHand, type EditorNote, type EditorPiece } from './model';
import { deleteNotes, eraseBefore, nearestPitch, pitchAbove, snapToNote, stepsTo, VIM_START, vimKey, vimMotion, vimShowCmd, type VimCommand, type VimState } from './vim';

const n = (hand: EditorHand, bar: number, start: number, step: EditorNote['step'], octave = 4, length: EditorNote['length'] = 'quarter'): EditorNote => ({
  hand, bar, start, length, step, octave, alter: 0,
});
const piece = (notes: EditorNote[]): EditorPiece => ({ ...emptyPiece({ title: 'Vim', hands: 'both', beats: 4, bars: 4 }), notes });

/** Types `keys` (one character each; `<Esc>`, `<CR>`, `<BS>`, `<C-r>` for the named ones) and gives every command and the state. */
function type(keys: string, from: VimState = VIM_START): { state: VimState; commands: VimCommand[] } {
  const tokens = keys.match(/<[^>]+>|./g) ?? [];
  let state = from;
  const commands: VimCommand[] = [];
  for (const token of tokens) {
    const named: Record<string, string> = { '<Esc>': 'Escape', '<CR>': 'Enter', '<BS>': 'Backspace', '<Left>': 'ArrowLeft', '<F1>': 'F1' };
    const ctrl = /^<C-(.)>$/.exec(token);
    const key = ctrl ? { key: ctrl[1]!, ctrl: true } : { key: named[token] ?? token, ctrl: false };
    const out = vimKey(state, key);
    state = out.state;
    if (out.command.kind !== 'wait') commands.push(out.command);
  }
  return { state, commands };
}

describe('vim keys: the parser (ft_1_02e)', () => {
  it('ft_1_02e.AC2 motions take a count, and 0 with no count is the start of the bar', () => {
    expect(type('3l').commands).toEqual([{ kind: 'move', motion: 'right', count: 3 }]);
    expect(type('12j').commands).toEqual([{ kind: 'move', motion: 'down', count: 12 }]);
    expect(type('0').commands).toEqual([{ kind: 'move', motion: 'barStart', count: 1 }]);
    expect(type('10w').commands).toEqual([{ kind: 'move', motion: 'barNext', count: 10 }]);
    expect(type('$+-').commands.map((c) => (c.kind === 'move' ? c.motion : c.kind))).toEqual(['barEnd', 'staffDown', 'staffUp']);
  });

  it('ft_1_02e.AC2 gg is the first bar, G the last, a count before either the bar of that number, as :N is', () => {
    expect(type('gg').commands).toEqual([{ kind: 'move', motion: 'first', count: 1 }]);
    expect(type('G').commands).toEqual([{ kind: 'move', motion: 'bar', count: 0 }]);
    expect(type('5G').commands).toEqual([{ kind: 'move', motion: 'bar', count: 5 }]);
    expect(type('3gg').commands).toEqual([{ kind: 'move', motion: 'bar', count: 3 }]);
    expect(type(':7<CR>').commands).toEqual([{ kind: 'move', motion: 'bar', count: 7 }]);
  });

  it('ft_1_02e.AC3 x, Ctrl-A, Ctrl-X, r and ~ are changes with counts; u and Ctrl-R undo and redo that many', () => {
    expect(type('3x').commands).toEqual([{ kind: 'deleteNote', count: 3 }]);
    expect(type('7<C-a><C-x>').commands).toEqual([{ kind: 'pitch', direction: 1, count: 7 }, { kind: 'pitch', direction: -1, count: 1 }]);
    expect(type('rf').commands).toEqual([{ kind: 'replace', step: 'F' }]);
    expect(type('rz').commands).toEqual([]);
    expect(type('~').commands).toEqual([{ kind: 'accidental', count: 1 }]);
    expect(type('2u<C-r>').commands).toEqual([{ kind: 'undo', count: 2 }, { kind: 'redo', count: 1 }]);
  });

  it('ft_1_02e.AC3 . does the last change again, with a new count if one is typed', () => {
    const after = type('2<C-a>');
    expect(type('.', after.state).commands).toEqual([{ kind: 'pitch', direction: 1, count: 2 }]);
    expect(type('5.', after.state).commands).toEqual([{ kind: 'pitch', direction: 1, count: 5 }]);
    // a motion or an undo is no change, so . still repeats the change
    expect(type('lu.', after.state).commands.at(-1)).toEqual({ kind: 'pitch', direction: 1, count: 2 });
    expect(type('.').commands).toEqual([]);
  });

  it('ft_1_02e.AC4 dd and yy take bars, p and P put them back after or before, v selects bars', () => {
    expect(type('2dd').commands).toEqual([{ kind: 'deleteBars', count: 2 }]);
    expect(type('yy3p').commands).toEqual([{ kind: 'yankBars', count: 1 }, { kind: 'paste', before: false, count: 3 }]);
    expect(type('P').commands).toEqual([{ kind: 'paste', before: true, count: 1 }]);
    // an operator with a key it does not know is dropped (vim's beep)
    expect(type('dq').state.pending).toBe('');
    const v = type('vwwd');
    expect(v.commands.map((c) => c.kind)).toEqual(['visual', 'move', 'move', 'visualDelete']);
    expect(v.state.mode).toBe('normal');
    expect(type('Vy').commands.at(-1)).toEqual({ kind: 'visualYank' });
    expect(type('vp').commands.at(-1)).toEqual({ kind: 'visualPaste' });
    expect(type('v2<C-x>').commands.at(-1)).toEqual({ kind: 'visualPitch', direction: -1, count: 2 });
    expect(type('v<Esc>').commands.at(-1)).toEqual({ kind: 'normal', from: 'visual' });
    expect(type('v<C-r>').state.mode).toBe('normal');
  });

  it('ft_1_02e.AC5 i, a, o and O go into insert mode, where a to g write notes and Esc comes back', () => {
    expect(type('i').commands).toEqual([{ kind: 'insert', where: 'here' }]);
    expect(type('a').commands).toEqual([{ kind: 'insert', where: 'after' }]);
    expect(type('o').commands).toEqual([{ kind: 'insert', where: 'barAfter' }]);
    expect(type('O').commands).toEqual([{ kind: 'insert', where: 'barBefore' }]);
    const typed = type("icdeg'r,<BS>4<CR><Esc>");
    expect(typed.commands.map((c) => (c.kind === 'write' ? c.step : c.kind))).toEqual(['insert', 'C', 'D', 'E', 'G', 'octave', 'writeRest', 'octave', 'erase', 'pass', 'pass', 'normal']);
    expect(typed.state.mode).toBe('normal');
    // uppercase stacks a chord, + and - make the last note sharp or flat, . is octave up as ' is
    expect(type('icEG+-.').commands.slice(1).map((c) => c.kind)).toEqual(['write', 'chordNote', 'chordNote', 'sharpen', 'sharpen', 'octave']);
    // in insert mode a letter that is no note does nothing, so a slip never reaches a plain tool
    expect(type('ixu').commands).toEqual([{ kind: 'insert', where: 'here' }]);
    expect(type('i4').commands.at(-1)).toEqual({ kind: 'pass' });
  });

  it('ft_1_02e.AC6 a : line gives its word, a ! after it and the rest; Backspace and Esc edit and drop it', () => {
    expect(type(':w<CR>').commands).toEqual([{ kind: 'ex', name: 'w', bang: false, arg: '' }]);
    expect(type(':q!<CR>').commands).toEqual([{ kind: 'ex', name: 'q', bang: true, arg: '' }]);
    expect(type(':set novim<CR>').commands).toEqual([{ kind: 'ex', name: 'set', bang: false, arg: 'novim' }]);
    expect(type(':wx<BS>q<CR>').commands).toEqual([{ kind: 'ex', name: 'wq', bang: false, arg: '' }]);
    expect(type(':wq<Esc>').commands).toEqual([]);
    expect(type(':<BS>').state.line).toBeNull();
    expect(vimShowCmd(type(':pla').state)).toEqual({ mode: 'normal', keys: ':pla' });
    expect(vimShowCmd(type('3d').state)).toEqual({ mode: 'normal', keys: '3d' });
  });

  it('ft_1_02e.AC7 the plain tool letters N, T, F, M, C and keys that type nothing pass; other letters do nothing; Esc never leaves', () => {
    expect(type('ntfmc').commands.every((c) => c.kind === 'pass')).toBe(true);
    expect(type('<F1><CR><C-s>').commands.every((c) => c.kind === 'pass')).toBe(true);
    expect(type('qszQ').commands).toEqual([]);
    expect(type('<Esc>').commands).toEqual([{ kind: 'normal', from: 'normal' }]);
    // Esc with a command half typed only drops it
    expect(type('3d<Esc>').commands).toEqual([]);
  });
});

describe('vim keys: moves and edits (ft_1_02e)', () => {
  const p = piece([n('RH', 0, 0, 'C'), n('RH', 0, 480, 'D'), n('RH', 0, 960, 'E', 4, 'half'), n('RH', 2, 0, 'G')]);
  const at = (bar: number, start: number, step: EditorNote['step'] = 'C', octave = 4) => ({ hand: 'RH' as const, bar, start, step, octave });

  it('ft_1_02e.AC2 motions move as the arrows do, count times, and stop at the ends', () => {
    // a move in time lands on the note of the place (its pitch), up and down go step by step
    expect(vimMotion(p, at(0, 0), 'right', 2, 'quarter')).toMatchObject({ bar: 0, start: 960, step: 'E' });
    expect(vimMotion(p, at(1, 0, 'A'), 'right', 4, 'quarter')).toMatchObject({ bar: 2, start: 0, step: 'G' });
    expect(vimMotion(p, at(0, 0), 'up', 1, 'quarter')).toMatchObject({ start: 0, step: 'D' });
    expect(vimMotion(p, at(0, 0), 'right', 99, 'quarter')).toMatchObject({ bar: 3, start: 1440 });
    expect(vimMotion(p, at(0, 0), 'up', 7, 'quarter')).toMatchObject({ step: 'C', octave: 5 });
    expect(vimMotion(p, at(0, 480), 'barEnd', 1, 'quarter')).toMatchObject({ start: 960 });
    expect(vimMotion(p, at(1, 480), 'barStart', 1, 'quarter')).toMatchObject({ bar: 1, start: 0 });
    expect(vimMotion(p, at(0, 0), 'barNext', 2, 'quarter')).toMatchObject({ bar: 2, start: 0 });
    expect(vimMotion(p, at(2, 480), 'barPrev', 1, 'quarter')).toMatchObject({ bar: 2, start: 0 });
    expect(vimMotion(p, at(2, 480), 'first', 1, 'quarter')).toMatchObject({ bar: 0, start: 0 });
    expect(vimMotion(p, at(0, 0), 'bar', 0, 'quarter')).toMatchObject({ bar: 3, start: 0 });
    expect(vimMotion(p, at(0, 0), 'bar', 2, 'quarter')).toMatchObject({ bar: 1 });
    expect(vimMotion(p, at(0, 0), 'bar', 40, 'quarter')).toMatchObject({ bar: 3 });
    // + and - jump as Ctrl + down and up do: B4, F4, then G3 on the bass staff
    expect(vimMotion(p, startKeyCursor(p), 'staffDown', 1, 'quarter')).toMatchObject({ hand: 'RH', step: 'F', octave: 4 });
    expect(vimMotion(p, startKeyCursor(p), 'staffDown', 2, 'quarter')).toMatchObject({ hand: 'LH', step: 'G', octave: 3 });
  });

  it('ft_1_02e.AC5 a letter in insert mode is the nearest pitch of that letter, never more than a fourth away', () => {
    expect(nearestPitch({ step: 'A', octave: 4 }, 'C')).toEqual({ step: 'C', octave: 5 });
    expect(nearestPitch({ step: 'C', octave: 4 }, 'B')).toEqual({ step: 'B', octave: 3 });
    expect(nearestPitch({ step: 'C', octave: 4 }, 'G')).toEqual({ step: 'G', octave: 3 });
    expect(nearestPitch({ step: 'C', octave: 4 }, 'F')).toEqual({ step: 'F', octave: 4 });
    expect(nearestPitch({ step: 'E', octave: 4 }, 'E')).toEqual({ step: 'E', octave: 4 });
    expect(stepsTo({ step: 'C', octave: 4 }, 'A')).toBe(-2);
    // an uppercase letter stacks upward: E above C4 is E4, C above C4 is C5, C above B3 is C4
    expect(pitchAbove({ step: 'C', octave: 4 }, 'E')).toEqual({ step: 'E', octave: 4 });
    expect(pitchAbove({ step: 'C', octave: 4 }, 'C')).toEqual({ step: 'C', octave: 5 });
    expect(pitchAbove({ step: 'B', octave: 3 }, 'C')).toEqual({ step: 'C', octave: 4 });
    expect(stepsTo({ step: 'C', octave: 4 }, 'E')).toBe(2);
  });

  it('ft_1_02e.AC3 x with a count takes that many notes from the cursor in one edit; on no note it is refused', () => {
    const one = deleteNotes(p, at(0, 0), 1, 'quarter');
    expect(one.ok && one.piece.notes.length).toBe(3);
    // 2x: the C, then the D of the next place (the note there nearest the pitch)
    const two = deleteNotes(p, at(0, 0, 'C'), 2, 'quarter');
    expect(two.ok && two.piece.notes.map((x) => x.step)).toEqual(['E', 'G']);
    expect(deleteNotes(p, at(1, 0), 1, 'quarter')).toEqual({ ok: false, reason: 'no-note' });
  });

  it('ft_1_02e.AC2 the cursor snaps to the nearest head of a chord at its place, and stays where no note starts', () => {
    const chord = piece([n('RH', 0, 0, 'C'), n('RH', 0, 0, 'G')]);
    expect(snapToNote(chord, at(0, 0, 'F'))).toMatchObject({ step: 'G' });
    expect(snapToNote(chord, at(0, 0, 'D'))).toMatchObject({ step: 'C' });
    expect(snapToNote(chord, at(0, 480, 'D'))).toMatchObject({ step: 'D' });
  });

  it('ft_1_02e.AC5 Backspace in insert mode takes out the chord before the cursor and stands on its place', () => {
    const chord = piece([n('RH', 0, 0, 'C'), n('RH', 0, 0, 'E')]);
    const out = eraseBefore(chord, at(0, 480), 'quarter');
    expect(out.edit.ok && out.edit.piece.notes).toEqual([]);
    expect(out.cursor).toMatchObject({ bar: 0, start: 0, step: 'E' });
    expect(eraseBefore(chord, at(0, 0), 'quarter').edit.ok).toBe(false);
    expect(findNote(chord, at(0, 0))).not.toBeNull();
  });

  it('ft_1_02e.AC5 Backspace in insert mode takes out a rest before the cursor as it does a note', () => {
    const withRest: EditorPiece = { ...piece([n('RH', 0, 0, 'C')]), rests: [{ hand: 'RH', bar: 0, start: 480, length: 'quarter' }] };
    const out = eraseBefore(withRest, at(0, 960), 'quarter');
    expect(out.edit.ok && out.edit.piece.rests).toEqual([]);
    expect(out.edit.ok && out.edit.piece.notes).toEqual(withRest.notes);
    expect(out.cursor).toMatchObject({ bar: 0, start: 480 });
  });
});
