import { describe, expect, it } from 'vitest';
import { IN_PLAY_KEYS, IN_PLAY_WORDS, isSentence, wordsOf } from './inPlay';
import { strings } from './strings';
import { stringsEt } from './strings.et';

describe('the strings shown while the student plays (d312)', () => {
  it('a word is two letters or more in a row, placeholders left out', () => {
    expect(wordsOf('{result}  +{xp} XP')).toEqual(['XP']);
    expect(wordsOf('A ♩77▲ ↻2')).toEqual([]);
    expect(isSentence('G: F♯')).toBe(false);
    expect(isSentence('Lap 2, faster')).toBe(true);
    expect(isSentence('{right} of {total} {total|line|lines}')).toBe(true);
  });

  it('d312 no in-play string is a sentence, in English or in Estonian', () => {
    for (const key of IN_PLAY_KEYS) {
      expect(isSentence(strings[key]), `${key}: ${strings[key]}`).toBe(false);
      expect(isSentence(stringsEt[key]), `${key} (et): ${stringsEt[key]}`).toBe(false);
    }
  });

  it('the words still shown in play are each kept for a reason, and no key is both', () => {
    for (const [key, reason] of Object.entries(IN_PLAY_WORDS)) {
      expect(key in strings, key).toBe(true);
      expect(reason.length).toBeGreaterThan(0);
      expect(IN_PLAY_KEYS).not.toContain(key);
    }
  });
});
