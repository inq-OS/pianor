import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pack = readFileSync('tools/release/pack.sh', 'utf8');
const settings = readFileSync('src/game/SettingsScene.ts', 'utf8');

describe('the release zip (tools/release/pack.sh)', () => {
  it('ft_1_16.AC4 builds with VITE_PIANOR_RELEASE, which the settings screen tests inline so the report code is dropped', () => {
    expect(pack).toMatch(/VITE_PIANOR_RELEASE=1 npm run build/);
    // written out at both places, not through a helper: the bundler drops only a branch it can see is dead
    expect(settings.match(/import\.meta\.env\.VITE_PIANOR_RELEASE === '1'/g)).toHaveLength(2);
  });

  it('refuses a checkout with a private folder and builds without private pieces', () => {
    expect(pack).toContain('if [ -e private ]; then echo "refusing: this checkout has a private/ folder; pack from a clean clone" >&2; exit 1; fi');
    expect(pack).toContain('PIANOR_NO_PRIVATE_PIECES=1');
  });

  it('leaves out the hardware check page and its script, and packs with zip or PowerShell', () => {
    expect(pack).toContain('rm -f "$out/game/spike.html" "$out/game/assets"/spike-*');
    expect(pack).toContain('command -v zip');
    expect(pack).toContain('Compress-Archive');
  });
});
