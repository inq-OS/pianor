/** Paths whose change should come with a docs change (feature file, decision, or architecture text). */
const WATCHED = /^(src\/core\/|tools\/(?!docs\/)|content\/curriculum\/)(?!.*\.test\.ts$)/;
const DOCS = /^(docs\/|README\.md$|CLAUDE\.md$)/;

/** Opt-out: the author writes `docs: n/a` (with a reason after it) in the pull request description or a commit message. */
export const OPT_OUT = /docs:\s*n\/a/i;

/**
 * A pull request that changes core code, tools or the curriculum without touching any doc must say why with `docs: n/a`.
 * Returns the problem, or null when it is fine.
 */
export function checkDocsTouched(changedFiles: string[], description: string): string | null {
  const watched = changedFiles.filter((f) => WATCHED.test(f));
  if (watched.length === 0) return null;
  if (changedFiles.some((f) => DOCS.test(f))) return null;
  if (OPT_OUT.test(description)) return null;
  return `${watched.length} file(s) under src/core, tools or content/curriculum changed (for example ${watched[0]}) but no doc did. Update the feature file, a decision or the architecture text, or write "docs: n/a" and a reason in the pull request description.`;
}
