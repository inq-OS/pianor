import { describe, expect, it } from 'vitest';
import { phrasePieceCharacters } from './character';

describe('phrasePieceCharacters', () => {
  it('maps every phrase piece of every level to the character that teaches it; the first listed wins a shared piece', () => {
    const owners = phrasePieceCharacters([
      { id: 'puuvaim', phrases: { 1: ['puuvaim-1'], 3: ['puuvaim-3', 'shared'] } },
      { id: 'other', phrases: { 2: ['shared', 'other-2'] } },
    ]);
    expect([...owners]).toEqual([['puuvaim-1', 'puuvaim'], ['puuvaim-3', 'puuvaim'], ['shared', 'puuvaim'], ['other-2', 'other']]);
  });
});
