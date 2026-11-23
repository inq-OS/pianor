import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { setFromArgs } from './setArgs';

const tmp = mkdtempSync(join(tmpdir(), 'pianor-setargs-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('the labelled set a command line names (core_08.AC12)', () => {
  it('core_08.AC12 reads a CIPI index with --cipi, its score paths relative to its folder', () => {
    const path = join(tmp, 'index.json');
    writeFileSync(path, JSON.stringify({ w1: { composer: 'X', henle: 3, path: { 1: 'a.musicxml' } }, w2: { composer: 'Y', path: { 1: 'b.musicxml' } } }));
    const set = setFromArgs(['--cipi', path]);
    expect(set.ok).toBe(true);
    if (!set.ok) return;
    expect(set.baseDir).toBe(tmp);
    expect(set.manifest.items.map((i) => i.id)).toEqual(['w1']);
    expect(set.skipped.map((s) => s.id)).toEqual(['w2']);
  });

  it('core_08.AC12 reads our own manifest', () => {
    const path = join(tmp, 'set.json');
    writeFileSync(path, JSON.stringify({ schemaVersion: 1, name: 'Own', licence: 'ours', publishable: false, label: { name: 'step', min: 1, max: 10 }, items: [{ id: 'a', group: 'g', label: 2, files: ['a'] }] }));
    const set = setFromArgs([path]);
    expect(set.ok && set.manifest.name).toBe('Own');
  });

  it('core_08.AC12 says when the file is missing or none is named', () => {
    expect(setFromArgs(['--cipi'])).toEqual({ ok: false, error: 'no set named' });
    expect(setFromArgs([join(tmp, 'nope.json')])).toMatchObject({ ok: false, error: expect.stringContaining('no such file') });
  });
});
