import { describe, expect, it } from 'vitest';
import { upgradeToCurrent, type UpgradeWords } from './upgrade';

class Refused extends Error {}
const words: UpgradeWords = { noVersion: 'none', newer: (v, c) => `newer ${v} ${c}`, noStep: (v) => `gap ${v}` };
const fail = (message: string) => new Refused(message);
const steps: Record<number, (doc: Record<string, unknown>) => Record<string, unknown>> = {
  0: (doc) => ({ ...doc, a: 1 }),
  1: (doc) => ({ ...doc, b: 2 }),
};
const run = (raw: unknown, current = 2) => upgradeToCurrent(raw, (v) => steps[v], current, words, fail);

describe('upgradeToCurrent', () => {
  it('applies one step per version and stamps each new version', () => {
    expect(run({ schemaVersion: 0 })).toEqual({ schemaVersion: 2, a: 1, b: 2 });
    expect(run({ schemaVersion: 1 })).toEqual({ schemaVersion: 2, b: 2 });
    expect(run({ schemaVersion: 2, c: 3 })).toEqual({ schemaVersion: 2, c: 3 });
  });

  it('refuses a missing, invalid or newer version and a gap in the steps, in the format\'s own words and error', () => {
    expect(() => run(null)).toThrow(new Refused('none'));
    expect(() => run({})).toThrow('none');
    expect(() => run({ schemaVersion: -1 })).toThrow('invalid schemaVersion: -1');
    expect(() => run({ schemaVersion: 1.5 })).toThrow('invalid schemaVersion: 1.5');
    expect(() => run({ schemaVersion: '1' })).toThrow('invalid schemaVersion: 1');
    expect(() => run({ schemaVersion: 3 })).toThrow('newer 3 2');
    expect(() => run({ schemaVersion: 0 }, 3)).toThrow('gap 2');
    expect(() => run({ schemaVersion: 0 })).not.toThrow();
    expect(() => run({})).toThrow(Refused);
  });
});
