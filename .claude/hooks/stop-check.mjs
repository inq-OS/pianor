// Claude Code Stop hook: before the agent says it is done, run the fast checks (typecheck, lint, docs check).
// Unit tests are not run here: they are slow and block the session for minutes. The agent runs the full `npm run check` itself before it says a task is done (CLAUDE.md).
// If a fast check fails, the agent is told why and keeps working; if it passes, or nothing changed, it may stop.
// Wired up in .claude/settings.json; see docs/decisions/workflow.md#d041.
import { spawnSync } from 'node:child_process';

const TAIL_LINES = 60;

function readInput() {
  return new Promise((resolve) => {
    let text = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (text += chunk));
    process.stdin.on('end', () => {
      try {
        resolve(text.trim() === '' ? {} : JSON.parse(text));
      } catch {
        resolve({});
      }
    });
    process.stdin.on('error', () => resolve({}));
  });
}

const input = await readInput();

// The agent was already sent back once by this hook in this stop sequence: let it stop rather than loop forever.
if (input.stop_hook_active === true) process.exit(0);

// Nothing edited and not committed: there is nothing new to check.
const status = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
if (status.status === 0 && status.stdout.trim() === '') process.exit(0);

const FAST_CHECK = 'npm run typecheck && npm run lint && npm run docs:check';
const run = spawnSync(FAST_CHECK, { encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024 });
if (run.status === 0) process.exit(0);

const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`.trim().split(/\r?\n/);
const tail = output.slice(-TAIL_LINES).join('\n');
process.stdout.write(
  JSON.stringify({
    decision: 'block',
    reason: `${FAST_CHECK} failed, so the work is not done. Fix what it reports (or say plainly why a failure is not yours), then finish.\n\n${tail}`,
  }),
);
process.exit(0);
