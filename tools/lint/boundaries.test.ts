import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

/* The lint boundary of src/core, run through ESLint itself on made-up files at real paths (eslint.config.js). */
const eslint = new ESLint({ cwd: process.cwd() });
const rules = async (filePath: string, code: string): Promise<string[]> => {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((m) => m.ruleId ?? 'parse');
};

describe('the lint boundary of src/core', () => {
  it('ft_0_00.AC3 fails a forbidden import in src/core, and lets the same import through in src/game', async () => {
    const code = "import Phaser from 'phaser';\nexport const scene = Phaser;\n";
    expect(await rules('src/core/judge/boundaryProbe.ts', code)).toContain('no-restricted-imports');
    expect(await rules('src/game/boundaryProbe.ts', code)).not.toContain('no-restricted-imports');
  }, 60_000);

  it('ft_0_02.AC1 keeps the chart model free of the DOM', async () => {
    expect(await rules('src/core/chart/boundaryProbe.ts', 'export const w = document.title;\n')).toContain('no-restricted-globals');
  }, 60_000);

  it('ft_0_08.AC3 keeps the judge free of UI and io code', async () => {
    expect(await rules('src/core/judge/boundaryProbe.ts', "import { x } from '../../io/keyboard';\nexport const y = x;\n")).toContain('no-restricted-imports');
    expect(await rules('src/core/judge/boundaryProbe.ts', "import { x } from '../../game/scenes';\nexport const y = x;\n")).toContain('no-restricted-imports');
  }, 60_000);
});
