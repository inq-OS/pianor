import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { UNDO_LIMIT, amend, canRedo, canUndo, mapEvery, push, redo, startHistory, undo } from './history';

describe('editor undo history', () => {
  it('starts with nothing to undo or redo', () => {
    const h = startHistory('a');
    expect(h).toEqual({ past: [], present: 'a', future: [] });
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
  });

  it('leaves the history as it is when there is nothing to undo or redo', () => {
    const h = startHistory('a');
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it('a new edit after an undo drops what could be redone', () => {
    const h = undo(push(push(startHistory('a'), 'b'), 'c'));
    expect(h.present).toBe('b');
    expect(canRedo(h)).toBe(true);
    const branched = push(h, 'x');
    expect(branched).toEqual({ past: ['a', 'b'], present: 'x', future: [] });
  });

  it('keeps at most UNDO_LIMIT steps, dropping the oldest', () => {
    let h = startHistory(0);
    for (let i = 1; i <= UNDO_LIMIT + 5; i++) h = push(h, i);
    expect(h.past).toHaveLength(UNDO_LIMIT);
    expect(h.past[0]).toBe(5);
    while (canUndo(h)) h = undo(h);
    expect(h.present).toBe(5);
  });

  it('undo then redo returns to the same history (property)', () => {
    fc.assert(fc.property(fc.array(fc.integer(), { maxLength: 30 }), fc.nat(40), (values, undos) => {
      let h = startHistory(-1);
      for (const v of values) h = push(h, v);
      const before = h;
      let n = 0;
      while (n < undos && canUndo(h)) { h = undo(h); n++; }
      for (let i = 0; i < n; i++) h = redo(h);
      expect(h).toEqual(before);
    }));
  });

  it('a change made to every step is kept through undo and redo (the typed title is no undo step)', () => {
    let h = startHistory({ title: 'My piece', notes: 0 });
    h = push(h, { title: 'My piece', notes: 1 });
    h = push(h, { title: 'My piece', notes: 2 });
    h = undo(h);
    h = mapEvery(h, (s) => ({ ...s, title: 'Sunny Day' }));
    expect(h.present).toEqual({ title: 'Sunny Day', notes: 1 });
    expect(undo(h).present).toEqual({ title: 'Sunny Day', notes: 0 });
    expect(redo(h).present).toEqual({ title: 'Sunny Day', notes: 2 });
  });
});

describe('amending the last step', () => {
  it('ft_1_02d.AC17 a change folded into the step just made is undone with it, in one undo', () => {
    const h = amend(push(startHistory('a'), 'b'), 'b+');
    expect(h).toEqual({ past: ['a'], present: 'b+', future: [] });
    expect(undo(h).present).toBe('a');
  });
});
