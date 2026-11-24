import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('npm run start:local', () => {
  it('ft_0_14.AC1 is one documented command that builds the game and serves it on the local machine only', () => {
    const scripts = (JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }).scripts;
    expect(scripts['start:local']).toBe('vite build && tsx tools/start-local/cli.ts');
    const cli = readFileSync('tools/start-local/cli.ts', 'utf8');
    expect(cli).toContain("const HOST = '127.0.0.1';");
    expect(cli).toContain('strictPort: true');
    expect(readFileSync('docs/commands.md', 'utf8')).toContain('`npm run start:local`');
  });
});
