import { describe, expect, it } from 'vitest';
import type { MetRecord, WorldState } from '../island/worldState';
import { phraseBook } from './phraseBook';

const record = (extra: Partial<MetRecord>): MetRecord => ({
  firstDay: '1998-11-18', lastDay: '1998-11-20', taught: [], tugs: { won: 0, lost: 0, bestLevel: 0 }, ...extra,
});
const world = (met: WorldState['met']): WorldState => ({ flags: [], items: [], met, teacherVisits: [] });

describe('the phrase book (ft_1_22.AC5, WP-12)', () => {
  it('ft_1_22.AC5 lists every taught phrase by its character; heard until played clean on a later day than it was taught', () => {
    const w = world({
      puuvaim: record({ taught: ['puuvaim-1', 'puuvaim-2'], taughtOn: { 'puuvaim-1': '1998-11-19', 'puuvaim-2': '1998-11-20' } }),
      other: record({ taught: ['other-1'], taughtOn: { 'other-1': '1998-11-19' } }),
    });
    const clean: Record<string, string[]> = {
      'puuvaim-1': ['1998-11-19', '1998-11-20'], // clean the day it was taught (not yet), then the next day: mine
      'puuvaim-2': ['1998-11-20'], // only the day it was taught: still heard
    };
    expect(phraseBook(w, (piece) => clean[piece] ?? [])).toEqual([
      { piece: 'puuvaim-1', character: 'puuvaim', taughtOn: '1998-11-19', state: 'mine' },
      { piece: 'puuvaim-2', character: 'puuvaim', taughtOn: '1998-11-20', state: 'heard' },
      { piece: 'other-1', character: 'other', taughtOn: '1998-11-19', state: 'heard' },
    ]);
  });

  it('ft_1_22.AC5 a phrase saved before its day was kept counts from the character\'s last day, never from a clean play before it', () => {
    const w = world({ puuvaim: record({ taught: ['puuvaim-1'] }) });
    expect(phraseBook(w, () => ['1998-11-19', '1998-11-20'])[0]).toMatchObject({ taughtOn: '1998-11-20', state: 'heard' });
    expect(phraseBook(w, () => ['1998-11-21'])[0]).toMatchObject({ state: 'mine' });
  });

  it('is empty before anything was taught', () => {
    expect(phraseBook(world({ puuvaim: record({}) }), () => ['1998-11-20'])).toEqual([]);
    expect(phraseBook(world({}), () => [])).toEqual([]);
  });
});
