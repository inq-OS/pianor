import { describe, expect, it } from 'vitest';
import { lintLedgerChecks } from './ledgerChecks';
import { makeRepo } from './testRepo';

const entry = (id: string, first: string, check?: string): string => `## ${id}\n\n**${first}** Features: none.\n\nThe rule.${check === undefined ? '' : `\n\nCheck: ${check}`}\n`;
const run = (ledger: string, extra: Record<string, string> = {}) => lintLedgerChecks(makeRepo({ 'docs/decisions/play.md': `# Play\n\n${ledger}`, ...extra })).map((i) => i.message);

describe('lintLedgerChecks (d165)', () => {
  it('accepts a test file with a title that exists, several tests, or untestable with a reason', () => {
    const tests = { 'src/a.test.ts': "it('keeps the rule', () => {})", 'src/b.test.ts': '' };
    expect(run(entry('d001', 'A.', '`src/a.test.ts` "keeps the rule"') + entry('d002', 'B.', '`src/a.test.ts`; `src/b.test.ts`') + entry('d003', 'C.', 'untestable: taste'), tests)).toEqual([]);
  });

  it('needs one Check line on a live entry, none on a retired or superseded one', () => {
    expect(run(entry('d001', 'A.'))).toEqual(['d001: a live entry needs exactly one "Check:" line (a test, or "untestable: reason"; d165)']);
    expect(run(entry('d001', 'A. Retired.') + entry('d002', 'B. Superseded by d003.'))).toEqual([]);
  });

  it('still needs a check on a rule that only talks about retiring things', () => {
    expect(run(entry('d001', 'Retired ideas are deleted.'))).toEqual(['d001: a live entry needs exactly one "Check:" line (a test, or "untestable: reason"; d165)']);
  });

  it('reports a missing file, a missing title, a bad form and an empty reason', () => {
    expect(run(entry('d001', 'A.', '`src/none.test.ts`'))).toEqual(['d001: the check src/none.test.ts does not exist']);
    expect(run(entry('d001', 'A.', '`src/a.test.ts` "other"'), { 'src/a.test.ts': "it('x')" })).toEqual(['d001: src/a.test.ts has no test titled "other"']);
    expect(run(entry('d001', 'A.', 'a test somewhere'))).toEqual(['d001: "a test somewhere" is not `path` "test title" nor untestable: reason']);
    expect(run(entry('d001', 'A.', 'untestable:'))).toEqual(['d001: "untestable:" is not `path` "test title" nor untestable: reason']);
  });

  it('skips files that are not ledgers', () => {
    expect(lintLedgerChecks(makeRepo({ 'docs/other.md': entry('d001', 'A.') }))).toEqual([]);
  });
});
