/** The record of one end-to-end run and the files written from it (docs/testing.md section 10). Pure: no file access. */

export type TestStatus = 'passed' | 'failed' | 'flaky' | 'skipped';

export interface TestRecord {
  area: string;
  file: string;
  line: number;
  title: string;
  status: TestStatus;
  durationMs: number;
  /** First line of the error, for failed tests. */
  error?: string;
}

export interface RunRecord {
  startedAt: string;
  commit?: string | undefined;
  status: string;
  durationMs: number;
  /** Areas that had tests in this run. */
  areas: string[];
  /** Why these areas ran (from `npm run test:e2e:affected`). */
  selection?: string[] | undefined;
  /** How many browsers ran the tests side by side (Playwright's workers). */
  workers?: number | undefined;
  tests: TestRecord[];
}

export interface AreaStats {
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  durationMs: number;
}

export function runFolderName(startedAt: string, areas: string[], all: boolean): string {
  const stamp = startedAt.slice(0, 19).replace('T', '_').replaceAll(':', '-');
  return `${stamp}_${all ? 'all' : areas.join('+')}`;
}

/** The first non-empty line, without terminal colour codes, at most 200 characters. */
export function firstLine(message: string | undefined): string {
  // eslint-disable-next-line no-control-regex
  const plain = (message ?? '').replace(/\u001b\[[0-9;]*m/g, '');
  return (plain.split('\n').map((l) => l.trim()).find((l) => l !== '') ?? '').slice(0, 200);
}

export function failureFileName(test: Pick<TestRecord, 'area' | 'title'>): string {
  const slug = test.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  return `${test.area}__${slug}.txt`;
}

export function areaStats(tests: TestRecord[]): Map<string, AreaStats> {
  const stats = new Map<string, AreaStats>();
  for (const t of tests) {
    const s = stats.get(t.area) ?? { passed: 0, failed: 0, flaky: 0, skipped: 0, durationMs: 0 };
    s[t.status] += 1;
    s.durationMs += t.durationMs;
    stats.set(t.area, s);
  }
  return stats;
}

const minutes = (ms: number): string => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
};

const label = (t: TestRecord): string => `${t.area} › ${t.file}:${t.line} › ${t.title}`;

const SHARE: Record<number, string> = { 2: 'half', 3: 'a third', 4: 'a quarter' };

/** The line under the table: test time is the sum over all browsers, so the run took about its share of it. */
function sideBySide(workers: number | undefined): string {
  if (workers === undefined) return 'Test time adds up the tests.';
  if (workers <= 1) return 'Test time adds up the tests; one browser ran them one after another.';
  return `Test time adds up the tests; ${workers} browsers ran side by side, so the run took about ${SHARE[workers] ?? `1/${workers}`} of it.`;
}

export function summaryMarkdown(run: RunRecord): string {
  const stats = areaStats(run.tests);
  const total: AreaStats = { passed: 0, failed: 0, flaky: 0, skipped: 0, durationMs: 0 };
  const rows = [...stats].map(([area, s]) => {
    for (const k of Object.keys(total) as (keyof AreaStats)[]) total[k] += s[k];
    return `| ${area} | ${s.passed} | ${s.failed} | ${s.flaky} | ${s.skipped} | ${minutes(s.durationMs)} |`;
  });
  const failed = run.tests.filter((t) => t.status === 'failed');
  const flaky = run.tests.filter((t) => t.status === 'flaky');
  const lines = [
    `# e2e run ${run.startedAt.slice(0, 16).replace('T', ' ')} · ${run.areas.join('+')} · ${run.status}`,
    '',
    `Commit ${run.commit ?? 'unknown'} · ${run.tests.length} tests · ${minutes(run.durationMs)}`,
    '',
    '| Area | Passed | Failed | Flaky | Skipped | Test time |',
    '|---|---|---|---|---|---|',
    ...rows,
    `| **total** | ${total.passed} | ${total.failed} | ${total.flaky} | ${total.skipped} | ${minutes(total.durationMs)} |`,
    '',
    sideBySide(run.workers),
  ];
  if (run.selection?.length) lines.push('', '## Selected', '', ...run.selection.map((r) => `- ${r}`));
  if (failed.length) lines.push('', '## Failed', '', ...failed.map((t) => `- ${label(t)}: ${t.error ?? ''} (failures/${failureFileName(t)})`));
  if (flaky.length) lines.push('', '## Flaky (passed on a retry)', '', ...flaky.map((t) => `- ${label(t)}`));
  return `${lines.join('\n')}\n`;
}

export function historyLine(run: RunRecord): string {
  const perArea = Object.fromEntries(areaStats(run.tests));
  const count = (status: TestStatus): number => run.tests.filter((t) => t.status === status).length;
  return JSON.stringify({
    startedAt: run.startedAt,
    commit: run.commit,
    status: run.status,
    durationMs: run.durationMs,
    areas: run.areas,
    totals: { passed: count('passed'), failed: count('failed'), flaky: count('flaky'), skipped: count('skipped') },
    perArea,
    failed: run.tests.filter((t) => t.status === 'failed').map((t) => `${t.area} › ${t.title}`),
  });
}
