import { describe, expect, it } from 'vitest';
import { agentRun } from './verifyGuard';

describe('who may stamp a doc as re-read (d202)', () => {
  it('refuses inside an agent session and runs for a person', () => {
    expect(agentRun({ CLAUDECODE: '1' })).toBe(true);
    expect(agentRun({ CLAUDE_CODE_ENTRYPOINT: 'cli' })).toBe(true);
    expect(agentRun({ HOME: '/home/a' })).toBe(false);
  });
});
