import type { Chart } from '../core/chart';
import { musicXmlToChart, mxlScoreText, scoreText, type MusicXmlResult } from '../core/import/musicxml';
import { readEntry, zipEntries, type ZipEntry } from '../core/import/zip';
import { difficultyOf, type Difficulty } from '../core/piece/difficulty';
import { complexityOf } from '../core/properties/complexity';
import { parseModelFiles, predictLevel, type LearnedModel } from '../core/piece/learnedModel';
import { createDifficultyPanel } from './difficultyPanel';

/**
 * Dev-only page (`?demo=analyse`, ft_Y_04 slice 1, core_08): drop MusicXML scores (`.musicxml`, `.xml`, `.mxl`) and see how
 * hard each is, easiest first, with what the reader simplified; a row opens the difficulty panel for any passage. The
 * files are read in the browser and never leave the computer; learned models come from the dev server like the preview's.
 */

const ACCEPT = '.musicxml,.xml,.mxl';
const DIM = '#9a9ab8';

interface Row {
  file: string;
  result: MusicXmlResult;
  difficulty?: Difficulty;
}

async function inflateRaw(raw: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A dropped file as a chart; an `.mxl` is unzipped with the browser's own deflate. */
export async function readScoreFile(name: string, bytes: Uint8Array): Promise<MusicXmlResult> {
  const id = name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'score';
  try {
    if (!/\.mxl$/i.test(name)) return musicXmlToChart(scoreText(bytes), id);
    const entries = zipEntries(bytes);
    const read = new Map<ZipEntry, Uint8Array>();
    for (const entry of entries) read.set(entry, await readEntry(entry, inflateRaw));
    return musicXmlToChart(mxlScoreText(entries, (e) => read.get(e)!), id);
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, css = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (css) node.style.cssText = css;
  if (text) node.textContent = text;
  return node;
}

const tempoOf = (chart: Chart) => {
  const bpms = [...new Set(chart.tempoMap.map((t) => Math.round(t.bpm)))];
  return bpms.length > 1 ? `${Math.min(...bpms)}-${Math.max(...bpms)}` : String(bpms[0]);
};

export async function startAnalyseDemo(): Promise<void> {
  document.title = 'Pianor: analyse scores';
  document.body.style.cssText = 'margin:0;background:#1b1b2f;color:#eee;font:13px monospace;padding:16px';
  const heading = el('h2', 'margin:0 0 6px', 'Analyse scores');
  const hint = el('div', `color:${DIM}`, 'Drop MusicXML files here (.musicxml, .xml or .mxl, as MuseScore exports them) or choose them. They are read in this browser and never leave the computer.');
  const input = Object.assign(el('input', 'margin:8px 0'), { type: 'file', multiple: true, accept: ACCEPT });
  input.dataset.testid = 'score-files';
  const table = el('table', 'border-collapse:collapse;margin:8px 0;width:100%');
  table.dataset.testid = 'score-table';
  const detail = el('div');
  const warnings = el('pre', `color:${DIM};white-space:pre-wrap;margin:6px 0`);
  warnings.dataset.testid = 'score-warnings';
  const panel = createDifficultyPanel(() => {});
  detail.append(warnings, panel.element);
  document.body.append(heading, hint, input, table, detail);

  let models: LearnedModel[] = [];
  try {
    const response = await fetch('/__pianor/pieces');
    if (response.ok) {
      const parsed = parseModelFiles(((await response.json()) as { models?: { file: string; text: string }[] }).models ?? []);
      models = parsed.models;
      panel.setModels(parsed.models, parsed.refused);
    }
  } catch {
    // no dev server answer: the page works without learned models
  }

  const rows: Row[] = [];
  let selected: Row | null = null;
  const cell = (row: HTMLTableRowElement, text: string, css = '') => row.append(el('td', `padding:2px 8px;border-bottom:1px solid #2b2b55;${css}`, text));

  const open = (row: Row) => {
    selected = row;
    if (!row.result.ok) {
      warnings.textContent = `${row.file}: not read: ${row.result.reason}`;
      panel.show(null, undefined);
    } else {
      warnings.textContent = row.result.warnings.length > 0 ? `${row.file}: simplified while reading:\n  ${row.result.warnings.join('\n  ')}` : `${row.file}: read with nothing left out.`;
      panel.show(row.result.chart, undefined);
    }
    render();
  };

  const render = () => {
    const head = el('tr');
    for (const h of ['file', 'title', 'bars', 'notes', 'tempo', 'difficulty', 'score', 'hardest bars', ...models.map((m) => `${m.label.name}-like (${m.source.dataset})`), 'simplified']) head.append(el('th', `text-align:left;padding:2px 8px;color:${DIM}`, h));
    table.replaceChildren(head);
    // by the raw score, which keeps growing where the points slow down near 100
    const sorted = [...rows].sort((a, b) => (a.difficulty?.score ?? Infinity) - (b.difficulty?.score ?? Infinity));
    for (const row of sorted) {
      const tr = el('tr', `cursor:pointer;${row === selected ? 'background:#2b2b55' : ''}`);
      tr.dataset.testid = `score-row-${row.file}`;
      tr.addEventListener('click', () => open(row));
      cell(tr, row.file);
      if (!row.result.ok || !row.difficulty) {
        cell(tr, `not read: ${row.result.ok ? '' : row.result.reason}`, 'color:#ff8a8a');
      } else {
        const { chart } = row.result;
        const d = row.difficulty;
        cell(tr, chart.title);
        cell(tr, String(chart.bars.length));
        cell(tr, String(chart.notes.length));
        cell(tr, tempoOf(chart));
        cell(tr, `${d.points}/100 ${complexityOf(d.points).grade} ${complexityOf(d.points).stars}*`);
        cell(tr, d.score.toFixed(1));
        cell(tr, d.hardest.map((i) => d.bars[i]?.printed ?? i + 1).join(', '));
        for (const m of models) cell(tr, predictLevel(m, d).toFixed(1));
        cell(tr, String(row.result.warnings.length));
      }
      table.append(tr);
    }
  };

  const add = async (files: Iterable<File>) => {
    let last: Row | null = null;
    for (const file of files) {
      const result = await readScoreFile(file.name, new Uint8Array(await file.arrayBuffer()));
      const row: Row = { file: file.name, result, ...(result.ok ? { difficulty: difficultyOf(result.chart) } : {}) };
      const same = rows.findIndex((r) => r.file === file.name);
      if (same >= 0) rows[same] = row;
      else rows.push(row);
      last = row;
    }
    render();
    if (last) open(last);
  };

  input.addEventListener('change', () => void add(input.files ?? []));
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    void add(e.dataTransfer?.files ?? []);
  });
  render();
}
