/**
 * A unit-test run reads the working tree for its whole length: vitest transforms a module when a test first imports it, and
 * content tests read their JSON when they run. If the tree changes meanwhile (a `git pull`, a checkout, another agent's
 * edit), one run can mix two revisions: a loader from before a change can read a data file from after it and fail on a
 * field that no longer exists. Such a failure is not the code's; this guard says so at the end of the run.
 */
import { execFileSync } from 'node:child_process';

type Git = (args: string[]) => string;

const git: Git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

/** The commit checked out and the list of changed tracked files, or null outside a git working tree. */
export function treeState(run: Git = git): string | null {
  try {
    return `${run(['rev-parse', 'HEAD']).trim()}\n${run(['status', '--porcelain', '--untracked-files=no'])}`;
  } catch {
    return null;
  }
}

/** The warning to print when the tree is not the one the run started on, or null. */
export function treeChangedWarning(before: string | null, after: string | null): string | null {
  if (before === null || after === null || before === after) return null;
  const head = (state: string) => state.split('\n')[0];
  const what = head(before) === head(after) ? 'tracked files changed' : `the checked-out commit changed (${head(before)!.slice(0, 7)} to ${head(after)!.slice(0, 7)})`;
  return [
    `WARNING: the working tree changed while the tests ran: ${what}.`,
    'A failure in this run may come from a mix of two revisions. Run the tests again before looking for a bug.',
  ].join('\n');
}

/** Vitest global setup: remember the tree at the start, warn at the end if it moved. */
export default function setup(): () => void {
  const before = treeState();
  return () => {
    const warning = treeChangedWarning(before, treeState());
    if (warning) console.warn(`\n${warning}\n`);
  };
}
