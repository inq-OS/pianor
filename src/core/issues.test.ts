import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { formatIssues } from './issues';

describe('formatIssues', () => {
  it('names the path of each problem, or (root) for the value itself', () => {
    const nested = z.object({ a: z.object({ b: z.number() }) }).safeParse({ a: { b: 'x' } });
    const root = z.number().safeParse('x');
    expect(nested.success || formatIssues(nested.error)).toEqual([expect.stringMatching(/^a\.b: /)]);
    expect(root.success || formatIssues(root.error)).toEqual([expect.stringMatching(/^\(root\): /)]);
  });
});
