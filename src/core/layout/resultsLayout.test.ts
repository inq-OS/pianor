import { describe, expect, it } from 'vitest';
import { rectCentre } from './rect';
import { GRAPH_MIN_HEIGHT, resultsLayout, scoreGraphPlot } from './resultsLayout';

describe('resultsLayout', () => {
  const layout = resultsLayout(320, 180);

  it('ft_1_12.AC7: puts the two small icon buttons side by side at the foot of the left column', () => {
    expect(rectCentre(layout.again)).toEqual({ x: 20, y: 160, width: 24, height: 18 });
    expect(rectCentre(layout.back)).toEqual({ x: 48, y: 160, width: 24, height: 18 });
    // a screen's third button (the stats page's other view, ft_1_32.AC8) follows in the same row
    expect(rectCentre(layout.more)).toEqual({ x: 76, y: 160, width: 24, height: 18 });
  });

  it('starts the numbers right of the left column and keeps the edge on the right', () => {
    expect(layout.left).toEqual({ x: 8, y: 8, w: 124, h: 164 });
    expect(layout.numbers).toEqual({ x: 142, y: 8, w: 170, h: 164 });
  });

  it('ft_1_20.AC2 keeps the numbers clear of the gear in the top right corner under the band: the column ends left of it', () => {
    const banded = resultsLayout(320, 124, { rightInset: 28 });
    expect(banded.numbers).toEqual({ x: 142, y: 8, w: 170 - 20, h: 108 });
    // an inset smaller than the edge changes nothing
    expect(resultsLayout(320, 124, { rightInset: 4 }).numbers).toEqual(resultsLayout(320, 124).numbers);
  });
});

describe('scoreGraphPlot (ft_1_12.AC4)', () => {
  const { numbers } = resultsLayout(320, 180);

  it('fills the numbers column from the given row down, with room for the labels left and under it', () => {
    expect(scoreGraphPlot(numbers, 80)).toEqual({ x: 164, y: 80, w: 148, h: 81 });
  });

  it('ft_1_12.AC4 keeps the graph on the 320 x 157 main area of the target screen under a session with XP and a level line (d110)', () => {
    // a two-pass session with its XP and the piece level ends at row 111 there (tests/e2e/play-loop.spec.ts), plus the gap of 3
    expect(scoreGraphPlot(resultsLayout(320, 157).numbers, 114)).not.toBeNull();
  });

  it('is left out when fewer rows than GRAPH_MIN_HEIGHT are left', () => {
    expect(scoreGraphPlot(numbers, 172 - 11 - GRAPH_MIN_HEIGHT + 1)).toBeNull();
    expect(scoreGraphPlot(numbers, 172 - 11 - GRAPH_MIN_HEIGHT)).not.toBeNull();
  });
});
