import { isLedger } from './items.ts';
import type { Issue } from './lint.ts';
import type { Repo } from './repo.ts';

/**
 * Every live ledger entry says how its rule is checked (d165): a line `Check: <test file> "<test title>"`, several
 * joined by `; `, or `Check: untestable: <reason>`. A retired or superseded entry needs none.
 */
const CHECK_LINE = /^Check: (.+)$/;
const TEST_REF = /^`([^`]+)`(?: "([^"]+)")?$/;
/** A retired or superseded entry ends its rule sentence with the word, so a rule about retiring things still needs its check. */
const DONE = /\b(?:Retired|Superseded by d\d{3})\.(?:\*\*|\s*$)/;

export function lintLedgerChecks(repo: Repo): Issue[] {
  const issues: Issue[] = [];
  for (const [file, text] of repo.docs) {
    if (!isLedger(file)) continue;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const head = /^## (d\d{3})\s*$/.exec(lines[i] as string);
      if (!head) continue;
      let end = i + 1;
      while (end < lines.length && !(lines[end] as string).startsWith('## ')) end++;
      const entry = lines.slice(i + 1, end);
      const first = entry.find((l) => l.trim() !== '') ?? '';
      const at = (n: number): number => i + 2 + n;
      const checks = entry.map((l, n) => ({ m: CHECK_LINE.exec(l), n })).filter((c) => c.m);
      const id = head[1] as string;
      if (DONE.test(first)) {
        i = end - 1;
        continue;
      }
      if (checks.length !== 1) {
        issues.push({ severity: 'error', file, line: i + 1, message: `${id}: a live entry needs exactly one "Check:" line (a test, or "untestable: reason"; d165)` });
      } else {
        const { m, n } = checks[0] as { m: RegExpExecArray; n: number };
        const value = (m[1] as string).trim();
        if (/^untestable: \S/.test(value)) {
          i = end - 1;
          continue;
        }
        for (const part of value.split('; ')) {
          const ref = TEST_REF.exec(part.trim());
          if (!ref) {
            issues.push({ severity: 'error', file, line: at(n), message: `${id}: "${part}" is not \`path\` "test title" nor untestable: reason` });
            continue;
          }
          const body = repo.read(ref[1] as string);
          if (body === null) issues.push({ severity: 'error', file, line: at(n), message: `${id}: the check ${ref[1]} does not exist` });
          else if (ref[2] && !body.includes(ref[2])) issues.push({ severity: 'error', file, line: at(n), message: `${id}: ${ref[1]} has no test titled "${ref[2]}"` });
        }
      }
      i = end - 1;
    }
  }
  return issues;
}
