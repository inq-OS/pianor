// Covers ft_1_02c.AC3.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PIECES_SETTINGS, canTurnOff, isPieceOn, piecesSettingsSchema, pressHide, HIDE_SECOND_PRESS_MS, bookPieces, setPieceOn, songPartsOff, withSongPartsOff, type PiecesSettings } from './pieceSwitch';

const hiding = (hidden: string[]): PiecesSettings => ({ hidden });
const OFFERED = ['a', 'b', 'c'];

describe('pieces settings', () => {
  it('start with every piece on', () => {
    expect(DEFAULT_PIECES_SETTINGS).toEqual({ hidden: [] });
    expect(OFFERED.every((id) => isPieceOn(DEFAULT_PIECES_SETTINGS, id))).toBe(true);
    expect(piecesSettingsSchema.safeParse(DEFAULT_PIECES_SETTINGS).success).toBe(true);
  });

  it('reject ids that are not text', () => {
    expect(piecesSettingsSchema.safeParse({ hidden: [1] }).success).toBe(false);
    expect(piecesSettingsSchema.safeParse({ hidden: [''] }).success).toBe(false);
    expect(piecesSettingsSchema.safeParse({}).success).toBe(false);
  });
});

describe('turning a piece off and on', () => {
  it('off hides that piece only, and on brings it back', () => {
    const off = setPieceOn(DEFAULT_PIECES_SETTINGS, 'b', false, OFFERED);
    expect(off).toEqual(hiding(['b']));
    expect(OFFERED.map((id) => isPieceOn(off, id))).toEqual([true, false, true]);
    expect(setPieceOn(off, 'b', true, OFFERED)).toEqual(DEFAULT_PIECES_SETTINGS);
  });

  it('turning off twice, or on twice, changes nothing more', () => {
    const off = setPieceOn(DEFAULT_PIECES_SETTINGS, 'a', false, OFFERED);
    expect(setPieceOn(off, 'a', false, OFFERED)).toEqual(off);
    expect(setPieceOn(DEFAULT_PIECES_SETTINGS, 'a', true, OFFERED)).toEqual(DEFAULT_PIECES_SETTINGS);
  });

  it('does not change the settings it is given', () => {
    const start = hiding(['a']);
    const frozen = structuredClone(start);
    setPieceOn(start, 'b', false, OFFERED);
    setPieceOn(start, 'a', true, OFFERED);
    expect(start).toEqual(frozen);
  });

  it('refuses to turn off the last piece that is on (the menu would be empty)', () => {
    const two = hiding(['a', 'b']);
    expect(canTurnOff(two, 'c', OFFERED)).toBe(false);
    expect(setPieceOn(two, 'c', false, OFFERED)).toEqual(two);
    expect(canTurnOff(hiding(['a']), 'c', OFFERED)).toBe(true);
  });

  it('a piece that is already off can be asked to go off again, and a piece not on offer never blocks', () => {
    expect(canTurnOff(hiding(['a', 'b']), 'a', OFFERED)).toBe(true);
    expect(canTurnOff(hiding([]), 'zzz', OFFERED)).toBe(true);
    expect(setPieceOn(hiding([]), 'zzz', false, OFFERED)).toEqual(hiding(['zzz']));
  });

  it('ids that no longer exist stay harmlessly in the list and do not count', () => {
    const stale = hiding(['gone', 'a', 'b']);
    expect(isPieceOn(stale, 'c')).toBe(true);
    expect(canTurnOff(stale, 'c', OFFERED)).toBe(false); // only c is left on among the pieces on offer
    expect(setPieceOn(stale, 'a', true, OFFERED)).toEqual(hiding(['gone', 'b']));
  });

  it('with a single piece on offer it cannot be turned off', () => {
    expect(canTurnOff(DEFAULT_PIECES_SETTINGS, 'a', ['a'])).toBe(false);
    expect(canTurnOff(DEFAULT_PIECES_SETTINGS, 'a', [])).toBe(true);
  });

  it('whatever is toggled, one offered piece stays on, ids are not repeated, and turning on restores only that piece (property)', () => {
    const ids = fc.constantFrom('a', 'b', 'c', 'd', 'gone');
    fc.assert(
      fc.property(fc.array(fc.tuple(ids, fc.boolean()), { maxLength: 30 }), (steps) => {
        const offered = ['a', 'b', 'c', 'd'];
        let settings = DEFAULT_PIECES_SETTINGS;
        for (const [id, wanted] of steps) {
          settings = setPieceOn(settings, id, wanted, offered);
          expect(offered.some((o) => isPieceOn(settings, o))).toBe(true);
          expect(new Set(settings.hidden).size).toBe(settings.hidden.length);
        }
        for (const id of offered) {
          const back = setPieceOn(settings, id, true, offered);
          expect(isPieceOn(back, id)).toBe(true);
          expect(offered.filter((o) => o !== id).every((o) => isPieceOn(back, o) === isPieceOn(settings, o))).toBe(true);
        }
      }),
    );
  });
});

describe('hiding a piece from the book', () => {
  it('ft_1_02c.AC8 the first press on a piece arms its hide, only a second press on the same piece hides it', () => {
    const first = pressHide(null, 'a', 1000);
    expect(first).toEqual({ armed: { piece: 'a', at: 1000 }, hide: null });
    expect(pressHide(first.armed, 'a', 2000)).toEqual({ armed: null, hide: 'a' });
    // a press on another piece's hide arms that one instead, and hides nothing
    expect(pressHide(first.armed, 'b', 2000)).toEqual({ armed: { piece: 'b', at: 2000 }, hide: null });
  });

  it('ft_1_02c.AC8 a double click hides nothing: a second press too soon after arming leaves it armed', () => {
    const first = pressHide(null, 'a', 1000);
    expect(pressHide(first.armed, 'a', 1000 + HIDE_SECOND_PRESS_MS - 1)).toEqual({ armed: first.armed, hide: null });
    expect(pressHide(first.armed, 'a', 1000 + HIDE_SECOND_PRESS_MS)).toEqual({ armed: null, hide: 'a' });
  });
});

describe('song parts that are off (ft_1_36 rule 5)', () => {
  it('ft_1_36.AC11 keeps each song\'s parts that are off per player, and an older save without them reads as all on', () => {
    const old = piecesSettingsSchema.parse({ hidden: ['x'] });
    expect(songPartsOff(old, 'morning-song')).toEqual([]);
    const one = withSongPartsOff(old, 'morning-song', ['middle']);
    expect(piecesSettingsSchema.parse(JSON.parse(JSON.stringify(one)))).toEqual({ hidden: ['x'], songs: { 'morning-song': ['middle'] } });
    expect(songPartsOff(one, 'morning-song')).toEqual(['middle']);
    expect(withSongPartsOff(one, 'morning-song', [])).toEqual({ hidden: ['x'], songs: {} });
    // turning a piece on or off keeps the songs' switches
    expect(setPieceOn(one, 'x', true, ['x', 'y']).songs).toEqual({ 'morning-song': ['middle'] });
  });
});

describe('songs in the library (ft_1_36 rules 10 and 13)', () => {
  it('ft_1_36.AC6 the last piece of the book outside songs cannot be turned off while a song\'s pieces are on', () => {
    const offered = bookPieces(['solo', 'song-intro', 'song-outro'], new Set(['song-intro', 'song-outro']));
    expect(offered).toEqual(['solo']);
    expect(canTurnOff(DEFAULT_PIECES_SETTINGS, 'solo', offered)).toBe(false);
  });

  it('ft_1_36.AC11 a save from before the tick hint reads as not yet told, and a told one keeps it', () => {
    expect(piecesSettingsSchema.parse({ hidden: [] }).songTickTold).toBeUndefined();
    expect(piecesSettingsSchema.parse({ hidden: [], songTickTold: true }).songTickTold).toBe(true);
  });
});
