import { describe, expect, it } from 'vitest';
import { areaStats, failureFileName, firstLine, historyLine, runFolderName, summaryMarkdown, type RunRecord } from './runLog.ts';

const run: RunRecord = {
  startedAt: '1998-10-13T10:51:02.000Z',
  commit: 'abc1234',
  status: 'failed',
  durationMs: 192_000,
  areas: ['editor', 'tug'],
  selection: ['src/game/editor/Grid.ts → editor, visual'],
  tests: [
    { area: 'editor', file: 'tests/e2e/editor.spec.ts', line: 12, title: 'opens the editor', status: 'passed', durationMs: 60_000 },
    { area: 'editor', file: 'tests/e2e/editor.spec.ts', line: 40, title: 'refuses a note past the bar line', status: 'failed', durationMs: 30_000, error: 'expect(received).toEqual(expected)' },
    { area: 'tug', file: 'tests/e2e/tug.spec.ts', line: 7, title: 'wins a tug', status: 'flaky', durationMs: 45_000 },
    { area: 'tug', file: 'tests/e2e/tug.spec.ts', line: 9, title: 'needs a baseline', status: 'skipped', durationMs: 0 },
  ],
};

describe('run log', () => {
  it('names the run folder by start time and areas, or "all"', () => {
    expect(runFolderName(run.startedAt, ['editor', 'tug'], false)).toBe('1998-10-13_10-51-02_editor+tug');
    expect(runFolderName(run.startedAt, ['editor', 'tug'], true)).toBe('1998-10-13_10-51-02_all');
  });

  it('keeps the first line of an error without terminal colours, cut to 200 characters', () => {
    expect(firstLine('\u001b[31mError: boom\u001b[39m\n  at x')).toBe('Error: boom');
    expect(firstLine('\n\n  second\n')).toBe('second');
    expect(firstLine('x'.repeat(300))).toHaveLength(200);
    expect(firstLine(undefined)).toBe('');
  });

  it('gives a failure a file name that is safe on Windows and Linux', () => {
    expect(failureFileName({ area: 'editor', title: 'refuses: a note > bar "line"?' })).toBe('editor__refuses-a-note-bar-line.txt');
  });

  it('counts each area', () => {
    expect(areaStats(run.tests).get('editor')).toEqual({ passed: 1, failed: 1, flaky: 0, skipped: 0, durationMs: 90_000 });
    expect(areaStats(run.tests).get('tug')).toEqual({ passed: 0, failed: 0, flaky: 1, skipped: 1, durationMs: 45_000 });
  });

  it('writes a summary with a table per area, the selection, failures and flaky tests', () => {
    const md = summaryMarkdown(run);
    expect(md).toContain('# e2e run 1998-10-13 10:51 · editor+tug · failed');
    expect(md).toContain('Commit abc1234 · 4 tests · 3m 12s');
    expect(md).toContain('- src/game/editor/Grid.ts → editor, visual');
    expect(md).toContain('| editor | 1 | 1 | 0 | 0 | 1m 30s |');
    expect(md).toContain('| **total** | 1 | 1 | 1 | 1 | 2m 15s |');
    expect(md).toContain('- editor › tests/e2e/editor.spec.ts:40 › refuses a note past the bar line: expect(received).toEqual(expected) (failures/editor__refuses-a-note-past-the-bar-line.txt)');
    expect(md).toContain('- tug › tests/e2e/tug.spec.ts:7 › wins a tug');
  });

  it('says how many browsers ran side by side, when the run says', () => {
    expect(summaryMarkdown({ ...run, workers: 3 })).toContain('Test time adds up the tests; 3 browsers ran side by side, so the run took about a third of it.');
    expect(summaryMarkdown({ ...run, workers: 2 })).toContain('2 browsers ran side by side, so the run took about half of it.');
    expect(summaryMarkdown({ ...run, workers: 1 })).toContain('Test time adds up the tests; one browser ran them one after another.');
    expect(summaryMarkdown({ ...run, workers: 5 })).toContain('5 browsers ran side by side, so the run took about 1/5 of it.');
    expect(summaryMarkdown(run)).toContain('Test time adds up the tests.');
  });

  it('leaves out empty sections', () => {
    const md = summaryMarkdown({ ...run, selection: undefined, tests: [run.tests[0]!] });
    expect(md).not.toContain('## Selected');
    expect(md).not.toContain('## Failed');
    expect(md).not.toContain('## Flaky');
  });

  it('writes one JSON line for the history', () => {
    const line = JSON.parse(historyLine(run));
    expect(line).toMatchObject({ startedAt: run.startedAt, commit: 'abc1234', status: 'failed', durationMs: 192_000, areas: ['editor', 'tug'] });
    expect(line.totals).toEqual({ passed: 1, failed: 1, flaky: 1, skipped: 1 });
    expect(line.perArea.editor).toEqual({ passed: 1, failed: 1, flaky: 0, skipped: 0, durationMs: 90_000 });
    expect(line.failed).toEqual(['editor › refuses a note past the bar line']);
  });
});
