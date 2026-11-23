// Covers ft_1_34.AC1, ft_1_34.AC2.
import { describe, expect, it } from 'vitest';
import type { Curriculum } from './curriculum';
import { phoneCall } from './phoneCall';

const curriculum = (pieces: { piece: string; deadline: string; priority?: number }[]): Curriculum => ({
  base: 85, calendar: [], pieces: pieces.map((p) => ({ priority: 5, ...p })),
});
const none = new Set<string>();
const call = (c: Curriculum, learned = none, begun = none, known = (id: string) => id !== '') =>
  phoneCall(c, { learned: (id) => learned.has(id), begun: (id) => begun.has(id), known });

describe('the telephone in the room (ft_1_34)', () => {
  it('ft_1_34.AC1 rings for a curriculum piece whose learning has not begun', () => {
    expect(call(curriculum([{ piece: 'a', deadline: '1998-12-01' }]))).toEqual({ piece: 'a', ringing: true });
  });

  it('ft_1_34.AC1 is quiet with no curriculum, or once every curriculum piece is learned', () => {
    expect(call(curriculum([]))).toBeNull();
    expect(call(curriculum([{ piece: 'a', deadline: '1998-12-01' }]), new Set(['a']), new Set(['a']))).toBeNull();
  });

  it('ft_1_34.AC2 a call goes to the new piece due first, the higher priority on the same day', () => {
    const c = curriculum([
      { piece: 'late', deadline: '1998-12-20' },
      { piece: 'low', deadline: '1998-12-05', priority: 2 },
      { piece: 'high', deadline: '1998-12-05', priority: 9 },
    ]);
    expect(call(c)).toEqual({ piece: 'high', ringing: true });
  });

  it('ft_1_34.AC2 a new piece rings before one already begun; with none new, the begun one is picked up without a ring', () => {
    const c = curriculum([{ piece: 'begun', deadline: '1998-12-01' }, { piece: 'new', deadline: '1998-12-30' }]);
    expect(call(c, none, new Set(['begun']))).toEqual({ piece: 'new', ringing: true });
    expect(call(c, new Set(['new']), new Set(['begun', 'new']))).toEqual({ piece: 'begun', ringing: false });
  });

  it('ft_1_34.AC2 a piece the game does not have never calls', () => {
    expect(call(curriculum([{ piece: 'gone', deadline: '1998-12-01' }]), none, none, () => false)).toBeNull();
  });
});
