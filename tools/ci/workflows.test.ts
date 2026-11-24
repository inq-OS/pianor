import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/* The CI rules of the workflow ledger, held against the workflow files themselves (d042, d062, d090, d165, d288). Read as text. */
const file = (name: string): string => readFileSync(`.github/workflows/${name}`, 'utf8');
/** The block under a key at the given indent, up to the next key at that indent. */
const block = (text: string, key: string, indent: number): string => {
  const pad = ' '.repeat(indent);
  const start = text.indexOf(`\n${pad}${key}:`);
  if (start < 0) return '';
  const rest = text.slice(start + 1);
  const next = rest.slice(1).search(new RegExp(`\\n${pad}[\\w-]+:`));
  return next < 0 ? rest : rest.slice(0, next + 1);
};
const job = (name: string, id: string): string => block(block(`\n${file(name)}`, 'jobs', 0), id, 2);
const triggers = (name: string): string => block(`\n${file(name)}`, 'on', 0);

describe('the CI workflows (d042, d090)', () => {
  it('runs check and art rules on Ubuntu with Node 22 on every pull request push, never on a push to main', () => {
    expect(triggers('ci.yml')).toMatch(/pull_request:[\s\S]*workflow_dispatch:[\s\S]*schedule:/);
    expect(triggers('ci.yml')).not.toMatch(/\n {2}push:/);
    for (const id of ['check', 'art']) {
      expect(job('ci.yml', id)).toContain('runs-on: ubuntu-latest');
      expect(job('ci.yml', id)).toContain('node-version: 22');
    }
    expect(job('ci.yml', 'check')).toContain('npm ci --ignore-scripts');
  });

  it('ft_0_00.AC2 runs typecheck, lint, tests, piece build and lint, build and end-to-end in CI', () => {
    const check = job('ci.yml', 'check');
    for (const step of ['npm run typecheck', 'npm run lint', 'npm run test:coverage', 'npm run piece:build', 'npm run piece:lint', 'npx vite build']) expect(check).toContain(step);
    expect(job('ci.yml', 'art')).toContain('npm run test:art');
    expect(job('browser-tests.yml', 'e2e')).toContain('npm run test:e2e');
  });

  it('runs the browser tests only on a label, by hand or on the schedule', () => {
    expect(file('ci.yml')).toContain("e2e: ${{ github.event_name != 'pull_request' || contains(github.event.pull_request.labels.*.name, 'ci:e2e') }}");
    expect(file('ci.yml')).toContain("visual: ${{ github.event_name != 'pull_request' || contains(github.event.pull_request.labels.*.name, 'ci:visual') }}");
  });
});

describe('the screenshot baselines (d062)', () => {
  it('are checked by a Windows job and made by a Windows workflow run by hand', () => {
    expect(job('browser-tests.yml', 'visual-windows')).toContain('runs-on: windows-latest');
    expect(triggers('update-snapshots.yml').trim()).toMatch(/^on:\s+workflow_dispatch:/);
    expect(job('update-snapshots.yml', 'update')).toContain('runs-on: windows-latest');
  });
});

describe('one screenshot baseline per screen for every system (d288)', () => {
  it('names a baseline without the platform, and the Windows workflow hands back those names', () => {
    expect(readFileSync('playwright.config.ts', 'utf8')).toContain("snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}-chromium{ext}'");
    expect(job('update-snapshots.yml', 'update')).toContain('path: tests/e2e/*-snapshots/*-chromium.png');
  });

  it('commits the baselines to the branch it ran on, never to main', () => {
    const update = job('update-snapshots.yml', 'update');
    expect(update).toContain("if: github.ref_name != 'main'");
    expect(update).toContain('git push origin "HEAD:${{ github.ref_name }}"');
  });
});

describe('the privacy workflow (d165)', () => {
  const privacy = job('privacy.yml', 'privacy');
  it('runs on pull requests, their edits, and every push to main', () => {
    expect(triggers('privacy.yml')).toMatch(/\n {2}pull_request_target:/);
    expect(triggers('privacy.yml')).not.toMatch(/\n {2}pull_request:/);
    expect(file('privacy.yml')).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request_target' }}");
    expect(triggers('privacy.yml')).toMatch(/types: \[[^\]]*opened[^\]]*synchronize[^\]]*edited[^\]]*\]/);
    expect(triggers('privacy.yml')).toMatch(/push:\s+branches: \[main\]/);
  });

  it('runs the checker of the base commit on the files of the head, installs nothing and keeps no token in a checkout', () => {
    expect(privacy.match(/uses: actions\/checkout/g)).toHaveLength(2);
    expect(privacy.match(/persist-credentials: false/g)).toHaveLength(2);
    expect(privacy).toMatch(/path: checker\s+ref: \$\{\{ github\.event\.pull_request\.base\.sha/);
    expect(privacy).toMatch(/path: head[\s\S]*ref: \$\{\{ github\.event\.pull_request\.head\.sha/);
    expect(privacy).toContain('../checker/tools/docs/privacy-ci.ts');
    expect(privacy).not.toMatch(/\b(npm|npx|yarn|pnpm)\b/);
    expect(privacy.match(/secrets\./g)).toHaveLength(1);
  });

  it('gives the private list only to a branch of this repository, never to a pull request from a fork', () => {
    const words = privacy.split('\n').find((l) => l.includes('PIANOR_PERSONAL_WORDS:')) ?? '';
    expect(words).toContain("(github.event_name != 'pull_request_target' || github.event.pull_request.head.repo.full_name == github.repository) && secrets.PIANOR_PERSONAL_WORDS || ''");
    const allow = privacy.split('\n').find((l) => l.includes('ALLOW_MISSING_LIST:')) ?? '';
    expect(allow).toContain("github.event.pull_request.head.repo.full_name != github.repository");
  });

  it('is the only workflow that sees the private list', () => {
    for (const name of ['ci.yml', 'browser-tests.yml', 'update-snapshots.yml', 'pr-events.yml']) expect(file(name)).not.toContain('PIANOR_PERSONAL_WORDS');
  });
});

describe('the privacy hooks (d165)', () => {
  type Hook = { matcher: string; hooks: { command: string }[] };
  const settings = JSON.parse(readFileSync('.claude/settings.json', 'utf8')) as { hooks: Record<string, Hook[]> };
  const privacyHooks = (event: string): Hook[] => (settings.hooks[event] ?? []).filter((h) => h.hooks.some((c) => c.command.includes('privacy-cli.ts')));
  it('check every write before and after it, and every commit or push through Bash, and stop on a finding', () => {
    for (const event of ['PreToolUse', 'PostToolUse']) {
      const matchers = privacyHooks(event).flatMap((h) => h.matcher.split('|'));
      expect(matchers).toEqual(expect.arrayContaining(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']));
    }
    expect(privacyHooks('PostToolUse').some((h) => h.matcher === 'Bash' && h.hooks[0]?.command.includes('--changed'))).toBe(true);
    for (const h of [...privacyHooks('PreToolUse'), ...privacyHooks('PostToolUse')]) for (const c of h.hooks) expect(c.command).toMatch(/\|\| exit 2$/);
  });

  it('check every commit through git as well, for any tool', () => {
    expect(JSON.parse(readFileSync('package.json', 'utf8')).scripts.prepare).toContain('core.hooksPath .githooks');
    expect(readFileSync('.githooks/pre-commit', 'utf8')).toContain('privacy-cli.ts --staged || exit 1');
    expect(readFileSync('.githooks/commit-msg', 'utf8')).toContain('privacy-cli.ts --message "$1" || exit 1');
  });
});
