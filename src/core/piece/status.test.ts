// Covers ft_0_11.AC1.
import { describe, expect, it } from 'vitest';
import { readStatus, withStatus } from './status';

const META = `{
  "id": "x",
  "title": "X",
  "status": "draft",
  "generator": { "kind": "manual", "params": { "status": "draft" } }
}
`;

describe('readStatus', () => {
  it('reads the top-level status', () => {
    expect(readStatus(META)).toBe('draft');
    expect(readStatus(META.replace('"draft",\n  "generator"', '"approved",\n  "generator"'))).toBe('approved');
  });

  it('is null for text that is not a meta file', () => {
    expect(readStatus('not json')).toBeNull();
    expect(readStatus('{"id": "x"}')).toBeNull();
    expect(readStatus('{"status": "published"}')).toBeNull();
    expect(readStatus('[1, 2]')).toBeNull();
  });
});

describe('withStatus', () => {
  it('changes only the status value and keeps every other character, so a review diff is one line', () => {
    const result = withStatus(META, 'approved');
    expect(result).toEqual({ ok: true, text: META.replace('"status": "draft",\n  "generator"', '"status": "approved",\n  "generator"') });
    expect(result.ok && result.text.split('\n').filter((line, i) => line !== META.split('\n')[i])).toHaveLength(1);
  });

  it('ignores a "status" key nested deeper in the file', () => {
    const result = withStatus(META, 'approved');
    expect(result.ok && result.text).toContain('"params": { "status": "draft" }');
  });

  it('works on compact JSON and keeps the formatting', () => {
    const compact = '{"id":"x","status":"approved","level":1}';
    expect(withStatus(compact, 'draft')).toEqual({ ok: true, text: '{"id":"x","status":"draft","level":1}' });
  });

  it('is a no-op that says so when the status is already that', () => {
    expect(withStatus(META, 'draft')).toEqual({ ok: true, text: META, unchanged: true });
  });

  it('handles keys and values with escapes and braces inside strings', () => {
    const tricky = '{"title": "a \\"status\\": \\"draft\\" {", "status": "draft", "note": "}"}';
    const result = withStatus(tricky, 'approved');
    expect(result).toEqual({ ok: true, text: tricky.replace('"status": "draft"', '"status": "approved"') });
  });

  it('refuses text it cannot read, without guessing', () => {
    expect(withStatus('not json', 'approved')).toMatchObject({ ok: false });
    expect(withStatus('{"id": "x"}', 'approved')).toMatchObject({ ok: false, message: expect.stringContaining('status') });
    expect(withStatus('{"status": 3}', 'approved')).toMatchObject({ ok: false });
  });
});
