import { describe, expect, it } from 'vitest';
import { resultsTitleKey } from './resultsTitle';
import { t } from './strings';

describe('resultsTitleKey (AX-2.1)', () => {
  it('a finished play gets the neutral title, not praise', () => {
    expect(resultsTitleKey(false)).toBe('results.title');
    expect(t(resultsTitleKey(false))).toBe('Result');
  });

  it('only a real milestone gets the celebratory title', () => {
    expect(resultsTitleKey(true)).toBe('results.titleMilestone');
    expect(t(resultsTitleKey(true))).toBe('Well done!');
  });
});
