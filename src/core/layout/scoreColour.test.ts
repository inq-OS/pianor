// Covers core_01.AC8.
import { describe, expect, it } from 'vitest';
import type { NoteTiming } from '../judge/types';
import { DEFAULT_TEMPO_WINDOWS } from '../judge/timing';
import { mixColour, SCORE_COLOURS, scoreColour } from './scoreColour';

const W = DEFAULT_TEMPO_WINDOWS; // perfectMs 60, goodMs 150, windowMs 400

const timing = (errorMs: number, verdict: NoteTiming['verdict'], hold?: number): NoteTiming => ({
  errorMs,
  verdict,
  score: 100,
  ...(hold === undefined ? {} : { hold }),
});

describe('scoreColour hold grading', () => {
  it('core_01.AC8: a note held in full keeps the colour it has without hold grading', () => {
    const plain = scoreColour(timing(0, 'on-time'), false, W);
    expect(scoreColour(timing(0, 'on-time', 100), false, W)).toBe(plain);
    expect(scoreColour(timing(200, 'late', 100), false, W)).toBe(scoreColour(timing(200, 'late'), false, W));
  });

  it('core_01.AC8: an on-time note let go at once is orange', () => {
    expect(scoreColour(timing(0, 'on-time', 0), false, W)).toBe(SCORE_COLOURS.mistimedWorst);
  });

  it('core_01.AC8: an on-time note held half way is the middle of yellow and orange', () => {
    expect(scoreColour(timing(0, 'on-time', 50), false, W)).toBe(
      mixColour(SCORE_COLOURS.mistimed, SCORE_COLOURS.mistimedWorst, 0.5),
    );
  });

  it('core_01.AC8: a late press whose press colour is worse than the hold keeps the press colour', () => {
    // errorMs 350: tPress = (350 - 150) / (400 - 150) = 0.8; hold 90 gives tHold = 0.1.
    expect(scoreColour(timing(350, 'late', 90), false, W)).toBe(
      mixColour(SCORE_COLOURS.mistimed, SCORE_COLOURS.mistimedWorst, 0.8),
    );
  });

  it('core_01.AC8: a late press let go early takes the worse of press and hold', () => {
    // errorMs 200: tPress = 50 / 250 = 0.2; hold 0 gives tHold = 1, so the hold shows.
    expect(scoreColour(timing(200, 'late', 0), false, W)).toBe(SCORE_COLOURS.mistimedWorst);
  });

  it('core_01.AC8: a missed note stays red whatever the hold', () => {
    expect(scoreColour(timing(0, 'on-time', 0), true, W)).toBe(SCORE_COLOURS.missed);
    expect(scoreColour(timing(0, 'on-time', 50), true, W)).toBe(SCORE_COLOURS.missed);
  });
});
