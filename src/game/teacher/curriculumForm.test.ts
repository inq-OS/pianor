import { describe, expect, it } from 'vitest';
import type { Curriculum } from '../../core/curriculum/curriculum';
import { addDays, fieldValues, newCurriculumPiece, stepField, withPiece, withoutPiece } from './curriculumForm';

const curriculum: Curriculum = { base: 85, pieces: [{ piece: 'a', deadline: '1998-12-01', priority: 5 }], calendar: [] };
const today = '1998-11-17';

describe('setting a curriculum piece (ft_1_26.AC3)', () => {
  it('moves a day across months and years', () => {
    expect(addDays('1998-11-30', 1)).toBe('1998-12-01');
    expect(addDays('1998-12-31', 1)).toBe('1999-01-01');
    expect(addDays('1998-03-01', -1)).toBe('1998-02-28');
  });

  it('ft_1_26.AC3 a new piece is due in two weeks with priority 5 and no overrides', () => {
    expect(newCurriculumPiece('b', today)).toEqual({ piece: 'b', deadline: '1998-12-01', priority: 5 });
  });

  it('ft_1_26.AC3 keeps the deadline from today on and the priority 1 to 10', () => {
    const cp = newCurriculumPiece('b', today);
    expect(stepField(cp, 'deadline', 7, today, curriculum).deadline).toBe('1998-12-08');
    expect(stepField(cp, 'deadline', -30, today, curriculum).deadline).toBe(today);
    expect(stepField({ ...cp, priority: 10 }, 'priority', 1, today, curriculum).priority).toBe(10);
    expect(stepField({ ...cp, priority: 1 }, 'priority', -1, today, curriculum).priority).toBe(1);
  });

  it('ft_1_26.AC3 sets the base and X, Y, Z, B under "more" as overrides, and drops one set back to the default', () => {
    const cp = newCurriculumPiece('b', today);
    const lower = stepField(cp, 'base', -5, today, curriculum);
    expect(lower.overrides).toEqual({ base: 80 });
    expect(fieldValues(lower, curriculum).base).toBe(80);
    expect(stepField(lower, 'base', 5, today, curriculum).overrides).toBeUndefined();
    const y = stepField(cp, 'atLeast', 1, today, curriculum);
    expect(y.overrides).toEqual({ retain: { atLeast: 4, belowAtMost: 2, byAtMost: 15 } });
    expect(stepField(cp, 'lastPlays', 5, today, curriculum).overrides).toEqual({ lastPlays: 15 });
    expect(stepField(cp, 'byAtMost', 100, today, curriculum).overrides?.retain?.byAtMost).toBe(50);
  });

  it('keeps Y and Z within X when X is lowered', () => {
    let cp = newCurriculumPiece('b', today);
    for (let i = 0; i < 6; i++) cp = stepField(cp, 'atLeast', 1, today, curriculum);
    expect(fieldValues(cp, curriculum).atLeast).toBe(9);
    cp = stepField(cp, 'lastPlays', -5, today, curriculum);
    expect(fieldValues(cp, curriculum)).toMatchObject({ lastPlays: 5, atLeast: 5 });
  });

  it('puts a piece in, replaces it in place, and takes it out', () => {
    const added = withPiece(curriculum, newCurriculumPiece('b', today));
    expect(added.pieces.map((p) => p.piece)).toEqual(['a', 'b']);
    const changed = withPiece(added, { piece: 'a', deadline: '1998-12-24', priority: 9 });
    expect(changed.pieces[0]).toEqual({ piece: 'a', deadline: '1998-12-24', priority: 9 });
    expect(withoutPiece(changed, 'a').pieces.map((p) => p.piece)).toEqual(['b']);
  });
});
