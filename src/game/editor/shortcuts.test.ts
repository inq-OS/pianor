// Covers ft_1_02d.AC19 (the piece maker's keys).
import { describe, expect, it } from 'vitest';
import { digitOf, EDITOR_KEYS, editorKeyOf } from './shortcuts';

const press = (code: string, mods: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}) => ({ code, ctrlKey: !!mods.ctrl, metaKey: false, altKey: !!mods.alt, shiftKey: !!mods.shift });

describe('the piece maker keys (ft_1_02d.AC19)', () => {
  it('ft_1_02d.AC19 every key is one tool: no two share a key with the same Ctrl', () => {
    const seen = new Map<string, string>();
    for (const [name, k] of Object.entries(EDITOR_KEYS)) {
      const id = `${'ctrl' in k && k.ctrl ? 'ctrl+' : ''}${k.code}`;
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
