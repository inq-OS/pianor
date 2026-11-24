import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STAFF_FONT, staffFontFaces } from './staffFont';

/** Every .ts file under a folder, tests left out. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sources(path);
    return e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('the staff font (d288)', () => {
  it('every text of the game in a screen font uses the shipped staff font, never one of the computer', () => {
    const named = sources('src/game').flatMap((path) => [...readFileSync(path, 'utf8').matchAll(/fontFamily:\s*([^,}]+)/g)].map((m) => `${path}: ${m[1]!.trim()}`));
    expect(named.length).toBeGreaterThan(0);
    expect(named.filter((line) => !line.endsWith(': STAFF_FONT'))).toEqual([]);
    expect(STAFF_FONT.startsWith('"Pianor Mono"')).toBe(true);
  });

  it('ships every font file it loads, with the licence beside them', () => {
    const faces = staffFontFaces('/');
    expect(faces.map((f) => f.style).sort()).toEqual(['italic', 'italic', 'normal', 'normal']);
    for (const { url } of faces) expect(existsSync(join('public', url)), url).toBe(true);
    expect(readFileSync('public/assets/jetbrains-mono/LICENSE', 'utf8')).toContain('SIL Open Font License');
  });

  it('covers the Estonian letters: Š and Ž in the Latin Extended file, the rest in Latin', () => {
    const [latin, ext] = staffFontFaces('/');
    expect(latin!.unicodeRange).toContain('U+0000-00FF'); // õ ä ö ü
    expect(ext!.unicodeRange).toContain('U+0100-02BA'); // š U+0161, ž U+017E
  });
});
