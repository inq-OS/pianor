import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import { failureFileName, firstLine, historyLine, runFolderName, summaryMarkdown, type RunRecord, type TestRecord, type TestStatus } from './runLog.ts';

/** Where runs are logged (gitignored); the newest `KEEP_RUNS` run folders are kept, `history.jsonl` grows by one line a run. */
const LOG_DIR = 'test-logs';
const KEEP_RUNS = 30;

const STATUS: Record<ReturnType<TestCase['outcome']>, TestStatus> = { expected: 'passed', unexpected: 'failed', flaky: 'flaky', skipped: 'skipped' };
// eslint-disable-next-line no-control-regex
const plain = (text: string): string => text.replace(/\u001b\[[0-9;]*m/g, '');

/**
 * Writes `test-logs/runs/<start>_<areas>/` for every end-to-end run: `summary.md` (per area, failures, flaky tests),
 * `results.json` (every test) and `failures/<area>__<test>.txt` (error, browser console, output), and appends a line to
 * `test-logs/history.jsonl`. On GitHub Actions the summary also goes to the run's page. The formatting is in `runLog.ts`.
 */
export default class RunLogReporter implements Reporter {
  private config?: FullConfig;
  private suite?: Suite;
  private readonly started = new Date();
  private readonly results = new Map<TestCase, { record: TestRecord; detail: string }>();

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    this.suite = suite;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const area = test.parent.project()?.name ?? 'unknown';
    const record: TestRecord = {
      area,
      file: relative(process.cwd(), test.location.file).replaceAll('\\', '/'),
      line: test.location.line,
      title: test.titlePath().slice(3).join(' › '),
      status: STATUS[test.outcome()],
      durationMs: Math.round(result.duration),
    };
    if (record.status === 'failed') record.error = firstLine(result.error?.message);
    const consoleLog = result.attachments.find((a) => a.name === 'console')?.body?.toString();
    const detail = [
      `${record.area} › ${record.file}:${record.line} › ${record.title}`,
      `status: ${result.status}, retry ${result.retry}, ${result.duration} ms`,
      '',
      '## Error',
      ...result.errors.map((e) => plain(e.stack ?? e.message ?? String(e.value))),
      '',
      '## Browser console',
      consoleLog ?? '(not recorded: the test did not open the game with openGame)',
      '',
      '## Output',
      ...result.stdout.map(String),
      ...result.stderr.map(String),
    ].join('\n');
    this.results.set(test, { record, detail });
  }

  onEnd(result: FullResult): void {
    if (this.results.size === 0) return; // `--list`, or nothing matched: no run to log
    const projects = this.config?.projects.map((p) => p.name) ?? [];
    const areas = (this.suite?.suites ?? []).filter((p) => p.allTests().length > 0).map((p) => p.title);
    const run: RunRecord = {
      startedAt: this.started.toISOString(),
      commit: process.env.GITHUB_SHA?.slice(0, 7) ?? gitCommit(),
      status: result.status,
      durationMs: Math.round(result.duration),
      areas,
      selection: process.env.E2E_SELECTION ? (JSON.parse(process.env.E2E_SELECTION) as string[]) : undefined,
      workers: this.config?.workers,
      tests: [...this.results.values()].map((r) => r.record),
    };
    const runsDir = join(LOG_DIR, 'runs');
    const dir = join(runsDir, runFolderName(run.startedAt, areas, areas.length === projects.length));
    mkdirSync(join(dir, 'failures'), { recursive: true });
    const summary = summaryMarkdown(run);
    writeFileSync(join(dir, 'summary.md'), summary);
    writeFileSync(join(dir, 'results.json'), `${JSON.stringify(run, null, 2)}\n`);
    for (const { record, detail } of this.results.values()) {
      if (record.status === 'failed' || record.status === 'flaky') writeFileSync(join(dir, 'failures', failureFileName(record)), detail);
    }
    appendFileSync(join(LOG_DIR, 'history.jsonl'), `${historyLine(run)}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
    for (const old of readdirSync(runsDir).sort().slice(0, -KEEP_RUNS)) rmSync(join(runsDir, old), { recursive: true, force: true });
    console.log(`\nRun log: ${join(dir, 'summary.md')}`);
  }

  printsToStdio(): boolean {
    return false;
  }
}

function gitCommit(): string | undefined {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return undefined;
  }
}
