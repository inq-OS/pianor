// Covers core_05.AC1, core_05.AC3, core_05.AC5.
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import { PPQ } from '../chart/time';
import { pieceInfo } from './info';
import { parseStyleList } from './styles';

const chart = chartWith([{ tick: 0, dur: PPQ, midi: 61 }]);

describe('pieceInfo', () => {
  it('puts the grade and stars, the tags and the features of a piece together', () => {
    expect(pieceInfo({ chart, tags: ['traditional', 'stepwise'], difficulty: 6 })).toEqual({
      bpm: chart.tempoMap[0]!.bpm, complexity: { grade: 'beginner', stars: 1.5 }, styles: [], tags: ['traditional', 'stepwise'], features: ['blackKeys', 'fastest.quarter'],
    });
  });

  it('has no stars for a piece the linter has not scored, and no tags when the meta has none', () => {
    expect(pieceInfo({ chart })).toMatchObject({ complexity: null, tags: [] });
  });

  it('carries the piece BPM, whatever the play mode', () => {
    expect(pieceInfo({ chart }).bpm).toBe(chart.tempoMap[0]!.bpm);
  });

  it('names the styles the closed list knows, and none without a list', () => {
    const list = parseStyleList({ schemaVersion: 1, styles: [{ id: 'folk', nameKey: 'style.folk' }] });
    expect(pieceInfo({ chart, styles: ['folk', 'jazz'], tags: ['c-position'] }, list)).toMatchObject({ styles: ['style.folk'], tags: ['c-position'] });
    expect(pieceInfo({ chart, styles: ['folk'] }).styles).toEqual([]);
  });

  it('leaves out blank and repeated tags', () => {
    expect(pieceInfo({ chart, tags: ['jazz', ' ', 'jazz', ' folk '] }).tags).toEqual(['jazz', 'folk']);
  });
});
