/** True when the command runs inside an agent session (Claude Code sets `CLAUDECODE`), where `docs:verify` refuses (d202). A guard against a mistake, not a lock: it reads the environment only. */
export function agentRun(env: Record<string, string | undefined>): boolean {
  return env['CLAUDECODE'] === '1' || (env['CLAUDE_CODE_ENTRYPOINT'] ?? '') !== '';
}
