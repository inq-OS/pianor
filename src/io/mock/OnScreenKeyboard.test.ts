import { describe, expect, it } from 'vitest';
import type { NoteEvent } from '../../core/judge/types';
import { fakeDocument } from '../../../tests/helpers/fakeDom';
import { OnScreenKeyboard } from './OnScreenKeyboard';

function setup() {
  const parent = fakeDocument().createElement();
  let now = 0;
  const keyboard = new OnScreenKeyboard(parent as unknown as HTMLElement, { low: 60, high: 64, now: () => now });
  const root = parent.children[0]!;
  const key = (midi: number) => root.children.find((el) => el.getAttribute('data-midi') === String(midi))!;
  const notes: string[] = [];
  keyboard.onNote((e: NoteEvent) => notes.push(`${e.kind} ${e.midi} @${e.timeMs}`));
  const fire = (type: string, midi: number, pointerId: number) => {
    now += 10;
    root.dispatch(type, { target: key(midi), pointerId, preventDefault: () => undefined });
  };
  return { keyboard, parent, root, key, notes, fire };
}

describe('the on-screen keyboard', () => {
  it('draws one key per note of its range, labels the Cs, and sits in its parent', () => {
    const { parent, root, key } = setup();
    expect(parent.children).toEqual([root]);
    expect(root.children.map((el) => el.getAttribute('data-midi'))).toEqual(['60', '61', '62', '63', '64']);
    expect(key(60).textContent).toBe('C4');
    expect(key(61).getAttribute('data-black')).toBe('true');
  });

  it('a tap plays the key: note-on on press, note-off on release, with the song time and the source', () => {
    const { notes, fire, key } = setup();
    fire('pointerdown', 62, 1);
    expect(key(62).getAttribute('data-down')).toBe('true');
    fire('pointerup', 62, 1);
    expect(key(62).getAttribute('data-down')).toBe('false');
    expect(notes).toEqual(['on 62 @10', 'off 62 @20']);
  });

  it('two fingers on two keys play both, and each lifts its own key', () => {
    const { notes, fire } = setup();
    fire('pointerdown', 60, 1);
    fire('pointerdown', 64, 2);
    fire('pointercancel', 60, 1);
    fire('pointerleave', 64, 2);
    expect(notes).toEqual(['on 60 @10', 'on 64 @20', 'off 60 @30', 'off 64 @40']);
  });

  it('a second finger on a key that is already down is not a second press, and the key lifts with the last finger', () => {
    const { notes, fire, key } = setup();
    fire('pointerdown', 62, 1);
    fire('pointerdown', 62, 2);
    fire('pointerup', 62, 1);
    expect(key(62).getAttribute('data-down')).toBe('true');
    fire('pointerup', 62, 2);
    expect(notes).toEqual(['on 62 @10', 'off 62 @40']);
  });

  it('ignores a release it never saw pressed and a press outside the keys', () => {
    const { notes, fire, root } = setup();
    fire('pointerup', 60, 9);
    root.dispatch('pointerdown', { target: root, pointerId: 1, preventDefault: () => undefined });
    expect(notes).toEqual([]);
  });

  it('shows lit keys and clears the ones no longer lit', () => {
    const { keyboard, key } = setup();
    keyboard.setLitKeys([60, 64]);
    keyboard.setLitKeys([64]);
    expect(key(60).getAttribute('data-lit')).toBe('false');
    expect(key(64).getAttribute('data-lit')).toBe('true');
  });

  it('on dispose releases every held key once and leaves the page', () => {
    const { keyboard, notes, fire, parent } = setup();
    fire('pointerdown', 60, 1);
    fire('pointerdown', 60, 2);
    fire('pointerdown', 62, 3);
    keyboard.dispose();
    keyboard.dispose();
    expect(notes.filter((n) => n.startsWith('off'))).toEqual(['off 60 @30', 'off 62 @30']);
    expect(parent.children).toEqual([]);
  });
});
