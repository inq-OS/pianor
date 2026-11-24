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

  it('needs one Check line on every entry', () => {
    expect(run(entry('d001', 'A.'))).toEqual(['d001: a live entry needs exactly one "Check:" line (a test, or "untestable: reason"; d165)']);
  });

  it('refuses a retired or superseded entry, which is deleted instead (d151)', () => {
    expect(run(entry('d001', 'A. Retired.', 'untestable: taste') + entry('d002', 'B. Superseded by d003.', 'untestable: taste'))).toEqual([
      'd001: a retired or superseded entry is deleted, not kept (d151)',
      'd002: a retired or superseded entry is deleted, not kept (d151)',
    ]);
  });

  it('refuses a Supersedes note on the rule line (d151)', () => {
    expect(run(entry('d002', 'B.** Features: none. Supersedes d001.**', 'untestable: taste'))).toEqual(['d002: "Supersedes dNNN" tells what an entry used to say; say only what holds (d151)']);
  });

  it('refuses a note of how an entry used to read (d151)', () => {
    const changed = '## d001\n\n**A.** Features: none.\n\nThe rule. Changed by d002 (it was B).\n\nCheck: untestable: taste\n';
    expect(run(changed)).toEqual(['d001: "Changed by dNNN" tells what an entry used to say; say only what holds (d151)']);
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
