import type { Repo } from './repo.ts';

/** A small in-memory repository for the docs tests. Files ending in .md become docs, .ts files become sources. */
export function makeRepo(files: Record<string, string>, scripts: string[] = []): Repo {
  const docs = new Map<string, string>();
  const sources = new Map<string, string>();
  const paths = new Set<string>();
  for (const [path, text] of Object.entries(files)) {
    if (path.endsWith('.md')) docs.set(path, text);
    else if (path.endsWith('.ts') || path.endsWith('.js')) sources.set(path, text);
    paths.add(path);
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) paths.add(parts.slice(0, i).join('/'));
  }
  return { root: '/nonexistent', docs, sources, paths, scripts: new Set(scripts), read: (path) => files[path] ?? null, readBytes: (path) => (files[path] === undefined ? null : Buffer.from(files[path], 'latin1')) };
}

export interface FeatureOptions {
  effort?: string;
  /** Default: 100 for a done feature, none for a split one, else 0. */
  completeness?: number;
  status?: string;
  extra?: Record<string, unknown>;
  heading?: string;
  body?: string;
}

/** The text of a feature file with valid front matter. */
export function feature(id: string, options: FeatureOptions = {}): string {
  const effort = options.effort ?? 'simple';
  const data: Record<string, unknown> = {
    id,
    title: `Title of ${id}`,
    scope: `Scope of ${id}`,
    effort,
    status: options.status ?? 'idea',
    ...(effort === 'split' ? {} : { completeness: options.completeness ?? (effort.startsWith('done') ? 100 : 0) }),
    ...options.extra,
  };
  const lines = Object.entries(data).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  return ['---', ...lines, '---', options.heading ?? `# ${id}: Title`, '', options.body ?? 'Body.', ''].join('\n');
}

export function decision(id: string, features: string[] = ['all'], extra: Record<string, unknown> = {}): string {
  const data: Record<string, unknown> = { id, title: `Decision ${id}`, features, ...extra };
  const lines = Object.entries(data).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  return ['---', ...lines, '---', `# ${id}: Decision`, ''].join('\n');
}

export const INDEX_BLOCKS = {
  features: ['ft_0', 'core', 'ft_1', 'ft_Y']
    .map((g) => `<!-- docs:index features ${g} -->\n<!-- /docs:index -->`)
    .concat(['<!-- docs:completeness -->\n<!-- /docs:completeness -->'])
    .join('\n\n'),
  decisions: '<!-- docs:index decisions -->\n<!-- /docs:index -->',
  authoring: '<!-- docs:index authoring -->\n<!-- /docs:index -->',
  playtests: '<!-- docs:index playtests -->\n<!-- /docs:index -->',
};
