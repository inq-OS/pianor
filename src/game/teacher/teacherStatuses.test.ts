import { describe, expect, it } from 'vitest';
import type { Curriculum } from '../../core/curriculum/curriculum';
import type { BarPlay, PracticeLog } from '../../core/progression';
import { teacherStatuses } from './teacherStatuses';

/** One whole play of a two-bar piece in Wait mode, every note right first try or not. */
function play(piece: string, at: string, firstTry: number): BarPlay[] {
  return [0, 1].map((bar) => ({ pieceId: piece, bar, at, mode: 'wait', tempoPercent: 100, section: null, notes: 4, firstTry, timing: null, misses: [] }));
}

const curriculum: Curriculum = {
  base: 85, calendar: [],
  pieces: [{ piece: 'played', deadline: '1998-12-01', priority: 3 }, { piece: 'new', deadline: '1998-12-01', priority: 3 }, { piece: 'gone', deadline: '1998-12-01', priority: 3 }],
};

describe("the teacher's statuses from a practice log (ft_1_26.AC2, WP-04's queries)", () => {
  it('ft_1_26.AC2 measures the played piece and leaves the unplayed and the missing one purple', () => {
    const log: PracticeLog = { bars: [...play('played', '1998-11-15T10:00:00Z', 4), ...play('played', '1998-11-16T10:00:00Z', 4), ...play('played', '1998-11-17T10:00:00Z', 4)] };
    const statuses = teacherStatuses(curriculum, log, (p) => (p === 'gone' ? undefined : 2), '1998-11-17', (iso) => iso.slice(0, 10));
    const byPiece = Object.fromEntries(statuses.map((s) => [s.piece, s]));
    expect(byPiece.played).toMatchObject({ plays: 3, level: 100, expected: 88 });
    expect(byPiece.played!.colour).not.toBe('purple');
    expect(byPiece.new).toMatchObject({ plays: 0, level: null, colour: 'purple' });
    expect(byPiece.gone).toMatchObject({ plays: 0, colour: 'purple' });
  });
});
