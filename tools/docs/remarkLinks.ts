import { remark } from 'remark';
import remarkFrontmatter from 'remark-frontmatter';
import remarkValidateLinks from 'remark-validate-links';
import { VFile } from 'vfile';
import type { Issue } from './lint.ts';
import type { Repo } from './repo.ts';

/**
 * Links and images in every doc must point at a file that exists and, inside the same file, at a heading that exists.
 * remark-validate-links does the checking on a real markdown syntax tree (reference links, images, code fences);
 * it reads the file system, so `repo.root` must be a real folder. Gitignored `private/` is skipped.
 */
export async function lintLocalLinks(repo: Repo): Promise<Issue[]> {
  const processor = remark()
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkValidateLinks, { repository: false, root: repo.root, skipPathPatterns: ['/private/'] });
  const issues: Issue[] = [];
  for (const [path, text] of repo.docs) {
    const file = new VFile({ path: `${repo.root}/${path}`, cwd: repo.root, value: text });
    await processor.process(file);
    for (const message of file.messages) {
      issues.push({ severity: 'error', file: path, ...(message.line ? { line: message.line } : {}), message: message.reason });
    }
  }
  return issues;
}
