// Covers ft_1_02d.AC19 (the piece maker's keys).
import { describe, expect, it } from 'vitest';
import { digitOf, EDITOR_KEYS, editorKeyOf, VIM_HELP, vimHelpColumns, vimKeyOf, vimLabelOf, vimWordOf } from './shortcuts';

const press = (code: string, mods: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}) => ({ code, ctrlKey: !!mods.ctrl, metaKey: false, altKey: !!mods.alt, shiftKey: !!mods.shift });

describe('the piece maker keys (ft_1_02d.AC19)', () => {
  it('ft_1_02d.AC19 every key is one tool: no two share a key with the same Ctrl', () => {
    const seen = new Map<string, string>();
    for (const [name, k] of Object.entries(EDITOR_KEYS)) {
      const id = `${'ctrl' in k && k.ctrl ? 'ctrl+' : ''}${'shift' in k && k.shift ? 'shift+' : ''}${k.code}`;
      expect(seen.get(id), `${name} and ${seen.get(id)} share ${id}`).toBeUndefined();
      seen.set(id, name);
    }
  });

  it('ft_1_02d.AC19 no letter of a tool is a digit or a cursor key (they pick choices and move the cursor)', () => {
    for (const k of Object.values(EDITOR_KEYS)) {
      expect(digitOf(k.code)).toBeNull();
      expect(k.code.startsWith('Arrow') || k.code === 'Enter').toBe(false);
    }
  });

  it('ft_1_02d.AC19 finds the tool of a key press, Ctrl telling C (chord) from Ctrl+C (copy)', () => {
    expect(editorKeyOf(press('KeyN'))).toBe('notes');
    expect(editorKeyOf(press('KeyC'))).toBe('chord');
    expect(editorKeyOf(press('KeyC', { ctrl: true }))).toBe('copy');
    expect(editorKeyOf(press('KeyN', { shift: true }))).toBeNull();
    expect(editorKeyOf(press('KeyQ'))).toBeNull();
    expect(digitOf('Digit3')).toBe(3);
    expect(digitOf('Numpad8')).toBe(8);
    expect(digitOf('KeyD')).toBeNull();
  });
});

describe('the vim keys of the piece maker (ft_1_02e)', () => {
  it('ft_1_02e.AC1 Ctrl + Shift + V turns the vim keys on and off; V alone is still paste', () => {
    expect(editorKeyOf(press('KeyV', { ctrl: true, shift: true }))).toBe('vimKeys');
    expect(editorKeyOf(press('KeyV'))).toBe('paste');
    expect(editorKeyOf(press('KeyV', { shift: true }))).toBeNull();
  });

  it('ft_1_02e.AC6 a : word names a tool by its name or its short word', () => {
    expect(vimWordOf('play')).toBe('listen');
    expect(vimWordOf('Listen')).toBe('listen');
    expect(vimWordOf('tryit')).toBe('tryIt');
    expect(vimWordOf('dyn')).toBe('dynamics');
    expect(vimWordOf('vim')).toBe('vimKeys');
    expect(vimWordOf('nonsense')).toBeNull();
    // every short word names a tool of the table
    for (const word of ['pl', 'try', 'time', 're', 'acc', 'rep', 'tap', 'ph', 'pb', 'pn', 'h', 'e', 'o']) expect(vimWordOf(word)).not.toBeNull();
  });

  it('ft_1_02e.AC7 F1 names a tool whose letter vim takes by its : word, a length by its N digit', () => {
    expect(vimLabelOf(EDITOR_KEYS.listen.label)).toBe(':pl');
    expect(vimLabelOf(EDITOR_KEYS.accidentals.label)).toBe('~');
    expect(vimLabelOf('4')).toBe('n4');
    expect(vimLabelOf(EDITOR_KEYS.notes.label)).toBe('N');
    expect(vimLabelOf(EDITOR_KEYS.save.label)).toBe('^S');
  });

  it('ft_1_02e.AC7 reads the typed character, and with Ctrl the physical letter (AltGr types a character)', () => {
    const k = (key: string, code: string, mods: { ctrl?: boolean; alt?: boolean } = {}) => vimKeyOf({ key, code, ctrlKey: !!mods.ctrl, metaKey: false, altKey: !!mods.alt });
    expect(k('$', 'Digit4')).toEqual({ key: '$', ctrl: false });
    expect(k('к', 'KeyR', { ctrl: true })).toEqual({ key: 'r', ctrl: true });
    expect(k('~', 'Backquote', { ctrl: true, alt: true })).toEqual({ key: '~', ctrl: false });
  });

  it('ft_1_02e.AC8 F1 lists the vim keys in at most four columns over the staff, each group under its title', () => {
    // the staff area under the top strip holds about ten lines of the pixel font
    const columns = vimHelpColumns(VIM_HELP, 10);
    expect(columns.length).toBeLessThanOrEqual(4);
    for (const column of columns) {
      expect(column.length).toBeLessThanOrEqual(10);
      expect(column[0]!.kind).toBe('title');
    }
    expect(columns.flat().filter((l) => l.kind === 'row')).toHaveLength(VIM_HELP.reduce((n, g) => n + g.rows.length, 0));
    // a group longer than a column runs on into the next
    expect(vimHelpColumns([VIM_HELP[2]!], 4).map((c) => c.length)).toEqual([4, 4, 2]);
  });
});
