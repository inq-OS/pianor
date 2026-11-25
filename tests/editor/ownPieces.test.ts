// Covers core_09.AC1, ft_1_02a.AC3, ft_1_02d.AC1.
import { describe, expect, it } from 'vitest';
import { layoutStaff } from '../../src/core/layout/staff';
import { WaitMode } from '../../src/core/judge/wait';
import { emptyPiece, placeNote, type EditorPiece } from '../../src/core/editor/model';
import { compileOwn, OwnPieces } from '../../src/game/editor/OwnPieces';
import { MemoryStore } from '../../src/io/storage/MemoryStore';

const NOW = () => new Date('1998-10-08T12:00:00.000Z');

/** C D E F | G2 F2 | E D C D | C4: four bars of steps on the right hand, so it fits level 1 of the starter table. */
function climb(title = 'Little Climb'): EditorPiece {
  let p = emptyPiece({ title, hands: 'RH', beats: 4, bars: 4 });
  const notes = [
    [0, 0, 'C', 'quarter'], [0, 480, 'D', 'quarter'], [0, 960, 'E', 'quarter'], [0, 1440, 'F', 'quarter'],
    [1, 0, 'G', 'half'], [1, 960, 'F', 'half'],
    [2, 0, 'E', 'quarter'], [2, 480, 'D', 'quarter'], [2, 960, 'C', 'quarter'], [2, 1440, 'D', 'quarter'],
    [3, 0, 'C', 'whole'],
  ] as const;
  for (const [bar, start, step, length] of notes) {
    const edit = placeNote(p, { hand: 'RH', bar, start, length, step, octave: 4 });
    if (!edit.ok) throw new Error(edit.reason);
    p = edit.piece;
  }
  return p;
}

describe('compiling an own piece', () => {
  it('checks it against the lowest level it fits and lists what fits, without the licence warning', () => {
    const c = compileOwn(climb(), { id: 'own-little-climb', author: 'Mia' });
    expect(c.chart?.notes).toHaveLength(11);
    expect(c.fitsLevels[0]).toBe(1);
    expect(c.level).toBe(1);
    expect(c.problems.some((p) => p.message.includes('licence'))).toBe(false);
    expect(JSON.parse(c.meta)).toMatchObject({ id: 'own-little-climb', license: 'NaN', status: 'approved', unlockLevel: 1, level: 1 });
  });

  it('a piece no level allows is checked against the highest level, and says why', () => {
    let p = emptyPiece({ title: 'Wide', hands: 'RH', beats: 4, bars: 1 });
    const edit = placeNote(p, { hand: 'RH', bar: 0, start: 0, length: 'whole', step: 'C', octave: 6 });
    if (edit.ok) p = edit.piece;
    const c = compileOwn(p, { id: 'own-wide', author: 'Mia' });
    expect(c.fitsLevels).toEqual([]);
    expect(c.level).toBe(6);
    expect(c.problems[0]).toMatchObject({ severity: 'error' });
    expect(c.chart).not.toBeNull(); // no limits: it still plays
  });
});

describe('own pieces on this device', () => {
  it('saves a piece, offers it as an approved piece open from level 1, and loads it again', async () => {
    const store = new MemoryStore();
    const own = await OwnPieces.load(store, NOW);
    const saved = await own.save(climb(), { author: 'Mia' });
    expect(saved).toEqual({ ok: true, id: 'own-little-climb', saved: true });
    expect(own.pieces()).toEqual([expect.objectContaining({ status: 'approved', unlockLevel: 1, level: 1, own: true, source: 'own: Mia' })]);
    expect(own.pieces()[0]!.chart.title).toBe('Little Climb');

    const again = await OwnPieces.load(store, NOW);
    expect(again.list().map((r) => [r.id, r.contentVersion, r.piece.notes.length])).toEqual([['own-little-climb', 1, 11]]);
    expect(again.get('own-little-climb')?.piece).toEqual(climb());
  });

  it('saving again keeps the id and raises the version; a new piece with the same title gets its own id', async () => {
    const own = await OwnPieces.load(new MemoryStore(), NOW);
    const first = await own.save(climb(), { author: 'Mia' });
    const second = await own.save(climb(), { id: first.ok ? first.id : undefined, author: 'Mia' });
    expect(second).toMatchObject({ ok: true, id: 'own-little-climb' });
    expect(own.get('own-little-climb')?.contentVersion).toBe(2);
    expect(await own.save(climb(), { author: 'Sam' })).toMatchObject({ ok: true, id: 'own-little-climb-2' });
    expect(own.list()).toHaveLength(2);
  });

  it('saves a long title whose first 30 letters end on a space (found 1998-11-21: it was refused as not drawable)', async () => {
    const own = await OwnPieces.load(new MemoryStore(), NOW);
    const saved = await own.save(climb('Mu esimene laul on siin ja nüüd hästi ilus'), { author: 'Mia' });
    expect(saved.ok).toBe(true);
    expect(saved.ok && saved.id).toMatch(/^own-[a-z0-9-]*[a-z0-9]$/);
  });

  it('refuses a piece with no notes', async () => {
    const own = await OwnPieces.load(new MemoryStore(), NOW);
    expect(await own.save(emptyPiece({ title: 'Nothing', hands: 'RH', beats: 4, bars: 2 }), { author: 'Mia' })).toMatchObject({ ok: false, reason: 'empty' });
  });

  it('keeps the piece for this session and says so when storage fails', async () => {
    const store = new MemoryStore();
    store.set = () => Promise.reject(new Error('QuotaExceededError'));
    const own = await OwnPieces.load(store, NOW);
    expect(await own.save(climb(), { author: 'Mia' })).toMatchObject({ ok: true, saved: false });
    expect(own.pieces()).toHaveLength(1);
  });

  it('skips a saved piece it cannot read, without touching it', async () => {
    const store = new MemoryStore();
    await store.set('pianor/v1/own-piece/own-broken', '{ nope');
    await store.set('pianor/v1/own-piece/own-odd', JSON.stringify({ schemaVersion: 1, id: 'own-odd' }));
    const own = await OwnPieces.load(store, NOW);
    expect(own.unreadable).toBe(2);
    expect(own.list()).toEqual([]);
    expect(await store.get('pianor/v1/own-piece/own-broken')).toBe('{ nope');
  });

  it('removes a piece', async () => {
    const store = new MemoryStore();
    const own = await OwnPieces.load(store, NOW);
    await own.save(climb(), { author: 'Mia' });
    await own.remove('own-little-climb');
    expect(own.list()).toEqual([]);
    expect((await OwnPieces.load(store, NOW)).list()).toEqual([]);
  });
});

describe('an own piece with a dotted half (ft_1_02d.AC1)', () => {
  it('fits a level and has no note-value error', () => {
    let p = emptyPiece({ title: 'Waltz', hands: 'RH', beats: 3, bars: 4 });
    for (const [bar, step] of [[0, 'C'], [1, 'E'], [2, 'G'], [3, 'C']] as const) {
      const edit = placeNote(p, { hand: 'RH', bar, start: 0, length: 'dottedHalf', step, octave: 4 });
      if (!edit.ok) throw new Error(edit.reason);
      p = edit.piece;
    }
    const c = compileOwn(p, { id: 'own-waltz', author: 'Mia' });
    expect(c.problems.filter((x) => x.message.includes('note of'))).toEqual([]);
    expect(c.fitsLevels.length).toBeGreaterThan(0);
  });
});

describe('a piece with chords (core_09.AC1)', () => {
  function chords(): EditorPiece {
    let p = emptyPiece({ title: 'Chords', hands: 'RH', beats: 4, bars: 4 });
    for (const [bar, step] of [[0, 'C'], [0, 'E'], [0, 'G'], [1, 'D'], [1, 'F']] as const) {
      const edit = placeNote(p, { hand: 'RH', bar, start: 0, length: 'whole', step, octave: 4 });
      if (!edit.ok) throw new Error(edit.reason);
      p = edit.piece;
    }
    return p;
  }

  it('compiles, passes the level check, is drawn by the staff and is played in Wait mode by pressing every key', () => {
    const c = compileOwn(chords(), { id: 'own-chords', author: 'Mia' });
    expect(c.problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(c.fitsLevels.length).toBeGreaterThan(0);
    const chart = c.chart!;
    expect(chart.notes.map((n) => n.midi)).toEqual([60, 64, 67, 62, 65]);
    expect(layoutStaff(chart, { viewport: { width: 1280, height: 720 } }).notes).toHaveLength(5);
    const mode = new WaitMode(chart);
    mode.handle({ kind: 'on', midi: 60, velocity: 80, timeMs: 0, source: 'test' });
    mode.handle({ kind: 'on', midi: 64, velocity: 80, timeMs: 10, source: 'test' });
    expect(mode.getState().stepIndex).toBe(0); // the cursor waits for the third key
    mode.handle({ kind: 'on', midi: 67, velocity: 80, timeMs: 20, source: 'test' });
    expect(mode.getState().stepIndex).toBe(1);
  });
});
