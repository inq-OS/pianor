import { describe, expect, it } from 'vitest';
import { MARK_TIP_KEYS, taughtMarkOf, barsMark, countMark, lapMark, missMark, notInMark, pitchMark, sectionLogChips, tempoMark } from './marks';

describe('the marks said in play instead of words (d312)', () => {
  it('a count is a number pair', () => {
    expect(countMark(3, 5)).toBe('3/5');
  });

  it('a wrong key names its reason as a mark with the way the played key lay', () => {
    expect(pitchMark('wrong-octave', 'higher')).toBe('8▲');
    expect(pitchMark('wrong-octave', 'lower')).toBe('8▼');
    expect(pitchMark('neighbour-key', 'higher')).toBe('½▲');
    expect(pitchMark('neighbour-key', 'lower')).toBe('½▼');
    expect(pitchMark('wrong-letter', 'lower')).toBe('▼');
  });

  it('with no staff a wrong key names the awaited note and the played one, so the arrow is never read alone', () => {
    expect(missMark({ midi: 65, expectedMidi: 64, reason: 'neighbour-key', direction: 'higher' }, 'B')).toBe('E✓ F✗ ½▲');
    expect(missMark({ midi: 55, expectedMidi: 64, reason: 'wrong-letter', direction: 'lower' }, 'B')).toBe('E✓ G✗ ▼');
    // an octave off has one letter: the mark says the rest
    expect(missMark({ midi: 72, expectedMidi: 60, reason: 'wrong-octave', direction: 'higher' }, 'B')).toBe('C✓ 8▲');
    // the letter naming of the player
    expect(missMark({ midi: 71, expectedMidi: 72, reason: 'neighbour-key', direction: 'lower' }, 'H')).toBe('C✓ H✗ ½▼');
  });

  it('a key not in the answer is crossed', () => {
    expect(notInMark('C#')).toBe('C#✗');
  });

  it('laps, tempo and a section log are marks and numbers, a tempo change with an arrow, never the play sign', () => {
    expect(lapMark(2)).toBe('↻2');
    expect(tempoMark(77)).toBe('♩77');
    expect(tempoMark(77, true)).toBe('♩77▲');
    expect(sectionLogChips({ laps: 4, clean: 2, from: 60, to: 66 })).toEqual(['↻4', '✓2', '♩60→66']);
    expect(barsMark(3, 6)).toBe('3-6');
    expect(barsMark(3, 3)).toBe('3');
  });

  it('d312 the 8 and the ½ are taught once by a tip in words, a wrong letter needs none', () => {
    expect(taughtMarkOf('wrong-octave')).toBe('octave');
    expect(taughtMarkOf('neighbour-key')).toBe('half');
    expect(taughtMarkOf('wrong-letter')).toBeNull();
    expect(MARK_TIP_KEYS).toEqual({ octave: 'marks.octaveTip', half: 'marks.halfTip' });
  });
});
