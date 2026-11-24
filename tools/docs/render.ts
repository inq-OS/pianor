import { featureGroup, rate, summarize } from './completeness.ts';
import type { AuthoringMeta, DecisionMeta, FeatureMeta, PlaytestMeta } from './schemas.ts';

const cell = (text: string): string => text.replace(/[\\|]/g, '\\$&');
const row = (cells: string[]): string => `| ${cells.map(cell).join(' | ')} |`;
const table = (head: string[], rows: string[][]): string => [row(head), `|${head.map(() => '---').join('|')}|`, ...rows.map(row)].join('\n');

const byId = <T extends { meta: { id: string } }>(items: T[]): T[] =>
  [...items].sort((a, b) => (a.meta.id < b.meta.id ? -1 : a.meta.id > b.meta.id ? 1 : 0));

export { featureGroup };

export interface Listed<T> {
  meta: T;
  /** File name inside its folder, used as the link target (the index sits in the same folder). */
  file: string;
}

/** `human`: per feature id, how many acceptance criteria only a person can check (not counted in Done %). */
export function renderFeatures(items: Listed<FeatureMeta>[], group: string, human: ReadonlyMap<string, number> = new Map()): string {
  const done = new Map(rate(items.map((i) => i.meta)).map((r) => [r.id, r.value]));
  const rows = byId(items)
    .filter(({ meta }) => featureGroup(meta.id) === group)
    .map(({ meta, file }) => {
      const open = human.get(meta.id) ?? 0;
      return [`[${meta.id}](${file})`, meta.title, meta.scope, meta.effort, String(done.get(meta.id) ?? 0), open > 0 ? String(open) : '', meta.status];
    });
  return table(['ID', 'Feature', 'Scope', 'Effort', 'Done %', 'Human', 'Status'], rows);
}

const BAR_WIDTH = 20;
const bar = (value: number): string => {
  const filled = Math.round((value / 100) * BAR_WIDTH);
  return '`' + '#'.repeat(filled) + '.'.repeat(BAR_WIDTH - filled) + '`';
};

/** The summary block of FEATURES.md: completeness per group and overall. */
export function renderCompleteness(items: Listed<FeatureMeta>[]): string {
  const rows = summarize(rate(items.map((i) => i.meta))).map((s) => [s.label, `${s.done} of ${s.total}`, `${s.value}`, bar(s.value)]);
  return table(['Scope', 'Features at 100', 'Done %', ''], rows);
}

export function renderDecisions(items: Listed<DecisionMeta>[]): string {
  const rows = byId(items).map(({ meta, file }) => [`[${meta.id}](${file})`, meta.title, meta.features.join(', ')]);
  return table(['ID', 'Decision', 'Features'], rows);
}

export function renderAuthoring(items: Listed<AuthoringMeta>[]): string {
  const rows = byId(items).map(({ meta, file }) => [`[${meta.id}](${file})`, meta.summary]);
  return table(['File', 'What it covers'], rows);
}

export function renderPlaytests(items: Listed<PlaytestMeta>[]): string {
  const rows = byId(items).map(({ meta, file }) => [`[${meta.id}](${file})`, meta.pieces, meta.finding]);
  return table(['ID', 'Pieces', 'Main finding'], rows.length > 0 ? rows : [['none yet', '', '']]);
}
