import type { z } from 'zod';

/** A schema's complaints as readable lines, `path.to.field: message` (`(root)` for the value itself). */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
}
