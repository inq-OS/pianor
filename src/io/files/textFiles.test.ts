import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDocument, type FakeElement } from '../../../tests/helpers/fakeDom';
import { downloadTextFile, pickAnyFile, pickTextFile } from './textFiles';

/** A fake page: `document.body`, and inputs and links that record a click instead of opening anything. */
function fakePage() {
  const doc = fakeDocument();
  const body = doc.createElement();
  const clicked: FakeElement[] = [];
  const createElement = () => {
    const el = doc.createElement() as FakeElement & { click(): void; files?: unknown };
    el.click = () => clicked.push(el);
    return el;
  };
  vi.stubGlobal('document', { body: Object.assign(body, { append: (el: FakeElement) => body.appendChild(el) }), createElement });
  return { body, clicked };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('downloadTextFile', () => {
  it('clicks a download link named for the file, removes it, and frees the object URL a moment later', async () => {
    const { body, clicked } = fakePage();
    const revoked: string[] = [];
    let blob: Blob | undefined;
    vi.stubGlobal('URL', { createObjectURL: (b: Blob) => { blob = b; return 'blob:1'; }, revokeObjectURL: (u: string) => revoked.push(u) });
    downloadTextFile('song.json', '{"a":1}');
    expect(clicked).toHaveLength(1);
    expect(clicked[0]).toMatchObject({ href: 'blob:1', download: 'song.json' });
    expect(body.children).toEqual([]);
    expect(blob?.type).toBe('application/json');
    expect(await blob?.text()).toBe('{"a":1}');
    expect(revoked).toEqual([]);
    vi.advanceTimersByTime(1000);
    expect(revoked).toEqual(['blob:1']);
  });
});

describe('pickTextFile', () => {
  it('opens a hidden picker for the given types and reads the chosen file', async () => {
    const { body, clicked } = fakePage();
    const picked = pickTextFile({ accept: '.json', id: 'own-piece-file' });
    const input = clicked[0] as FakeElement & { files?: unknown; type?: string; id?: string; accept?: string };
    expect(input).toMatchObject({ type: 'file', id: 'own-piece-file', accept: '.json' });
    expect(input.style.display).toBe('none');
    input.files = [{ text: () => Promise.resolve('hello') }];
    input.dispatch('change', {});
    await expect(picked).resolves.toBe('hello');
    expect(body.children).toEqual([]);
  });

  it('gives null when the player cancels, chooses nothing, or the file cannot be read', async () => {
    const { clicked } = fakePage();
    const cancel = pickTextFile({ accept: '.json', id: 'a' });
    clicked[0]!.dispatch('cancel', {});
    await expect(cancel).resolves.toBeNull();

    const none = pickTextFile({ accept: '.json', id: 'b' });
    Object.assign(clicked[1]!, { files: [] }).dispatch('change', {});
    await expect(none).resolves.toBeNull();

    const broken = pickTextFile({ accept: '.json', id: 'c' });
    Object.assign(clicked[2]!, { files: [{ text: () => Promise.reject(new Error('gone')) }] }).dispatch('change', {});
    await expect(broken).resolves.toBeNull();
  });
});

describe('pickAnyFile', () => {
  it('reads the chosen file as its name and bytes', async () => {
    const { clicked } = fakePage();
    const picked = pickAnyFile({ accept: 'image/*', id: 'photo' });
    Object.assign(clicked[0]!, { files: [{ name: 'sheet.jpg', arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2]).buffer) }] }).dispatch('change', {});
    await expect(picked).resolves.toEqual({ name: 'sheet.jpg', bytes: new Uint8Array([1, 2]) });
  });
});
