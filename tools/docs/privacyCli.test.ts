import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/* The privacy command as the hooks call it (d165). It runs through Node's own type stripping, as CI runs it. */
const cli = (args: string[], stdin = ''): { status: number | null; err: string } => {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', 'tools/docs/privacy-cli.ts', ...args], { input: stdin, encoding: 'utf8', env: { ...process.env, PIANOR_PERSONAL_WORDS: '' } });
  return { status: r.status, err: r.stderr };
};

describe('the privacy command (d165)', () => {
  it('reads a commit message without the lines git strips, and still fails a date in the message itself', () => {
    const dir = mkdtempSync(join(tmpdir(), 'privacy-cli-'));
    const clean = join(dir, 'clean');
    writeFileSync(clean, 'Plain subject\n\n# Date:      Mon Nov 3 09:51:00 1997 +0200\n# On branch main\n');
    expect(cli(['--message', clean]).status).toBe(0);
    const dated = join(dir, 'dated');
    writeFileSync(dated, 'Fixed on 3 Nov 1997 at 09:51\n');
    expect(cli(['--message', dated]).status).toBe(2);
  }, 20000);

  it('checks the tree after a command that commits or pushes, and lets every other command through at once', () => {
    expect(cli(['--changed'], JSON.stringify({ hook_event_name: 'PostToolUse', tool_input: { command: 'ls -la' } })).status).toBe(0);
    const r = cli(['--changed'], JSON.stringify({ hook_event_name: 'PostToolUse', tool_input: { command: 'git commit -m x' } }));
    expect([0, 2]).toContain(r.status);
  }, 20000);
});
