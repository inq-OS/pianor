import type { Chart } from '../core/chart';
import type { SectionMarks } from '../game/ui/staff/StaffView';
import { heatColour } from '../core/layout/analyzeLayout';
import { difficultyMarks } from '../core/layout/difficultyMarks';
import { formatBarList, parseBarList } from '../core/piece/barList';
import { learnedSummary, type LearnedModel } from '../core/piece/learnedModel';
import { DIMENSIONS, difficultyOf, difficultyOfPassage, difficultySummary, partDifficulties, type BarDifficulty, type BarRange, type Difficulty, type DimensionParts } from '../core/piece/difficulty';

/**
 * The piece preview's difficulty panel (core_08.AC8 to AC10): the bars as a strip tinted by how hard each is, any passage
 * chosen by clicking bars or typing "1-4, 9-12", and what makes it hard, by dimension and per bar. The staff shows the
 * same heat through `onMarks`. Numbers come from `core/piece/difficulty`; this file only draws them.
 */
export interface DifficultyPanel {
  element: HTMLElement;
  /** Show a piece (null when it does not compile); `confirmed` is the meta file's `difficulty`. */
  show(chart: Chart | null, confirmed: number | undefined): void;
  /** The learned models found (core_08.AC11), and the files refused with why; shown for the piece and the passage. */
  setModels(models: readonly LearnedModel[], refused: readonly string[]): void;
}

/** One line per learned model, for the piece or the passage. */
const learnedLines = (models: readonly LearnedModel[], d: Difficulty) => models.map((m) => learnedSummary(m, d)).join('\n');

const DIM = '#9a9ab8';
const BAR_WIDTH = 24;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, css = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (css) node.style.cssText = css;
  if (text) node.textContent = text;
  return node;
}

const css = (colour: number) => `#${colour.toString(16).padStart(6, '0')}`;

/** One line per dimension, longest first, as a bar of blocks: what makes this score. */
function partsLines(parts: DimensionParts): string {
  const max = Math.max(...DIMENSIONS.map((d) => parts[d]), 0.01);
  return DIMENSIONS.filter((d) => parts[d] > 0)
    .sort((a, b) => parts[b] - parts[a])
    .map((d) => `${d.padEnd(9)} ${'#'.repeat(Math.max(1, Math.round((parts[d] / max) * BAR_WIDTH))).padEnd(BAR_WIDTH)} ${parts[d].toFixed(2)}`)
    .join('\n');
}

/** What one bar's features say, only the ones that are there. */
function featureLine(b: BarDifficulty): string {
  const f = b.features;
  const bits = [
    `${f.presses} presses`,
    `${f.onsetsPerSecond}/s`,
    f.rhythm > 0 ? `rhythm ${f.rhythm}` : '',
    f.leapPoints > 0 ? `leaps ${f.leapPoints}` : '',
    f.shifts > 0 ? `shifts ${f.shifts}` : '',
    f.accidentals > 0 ? `accidentals ${f.accidentals}` : '',
    f.chordNotes > 0 ? `chord notes ${f.chordNotes}` : '',
    f.handsTogether > 0 ? `hands together ${Math.round(f.handsTogether * 100)}%` : '',
    f.extraVoices > 0 ? `voices +${f.extraVoices}` : '',
    f.graces > 0 ? `graces ${f.graces}` : '',
  ].filter(Boolean);
  return `bar ${String(b.printed).padStart(3)}  ${b.score.toFixed(2).padStart(5)}  ${bits.join(', ')}`;
}

export function createDifficultyPanel(onMarks: (marks: SectionMarks | null) => void): DifficultyPanel {
  const element = el('div', 'margin:10px 0;padding-top:8px;border-top:1px solid #2b2b55');
  element.dataset.testid = 'difficulty';
  const heading = el('div', 'font-weight:bold', 'Difficulty');
  const whole = el('div', `color:${DIM};margin:2px 0`);
  whole.dataset.testid = 'difficulty-whole';
  const wholeParts = el('pre', 'margin:4px 0;font:11px/14px monospace;color:#ccc');
  const strip = el('div', 'display:flex;flex-wrap:wrap;gap:2px;margin:6px 0');
  strip.dataset.testid = 'difficulty-bars';
  const hint = el('div', `color:${DIM}`, 'Click a bar, shift-click to extend, or type bars in any order:');
  const row = el('div', 'display:flex;gap:6px;align-items:center;margin:4px 0');
  const input = Object.assign(el('input', 'flex:1;background:#0e0e1c;color:#eee;border:1px solid #2b6cff;font:inherit;padding:3px'), { placeholder: '1-4, 9-12' });
  input.dataset.testid = 'passage';
  const heatLabel = el('label', 'white-space:nowrap');
  const heatBox = Object.assign(document.createElement('input'), { type: 'checkbox', checked: true });
  heatLabel.append(heatBox, ' heat on staff');
  row.append(input, heatLabel);
  const passage = el('div', 'margin:4px 0');
  passage.dataset.testid = 'passage-result';
  const passageParts = el('pre', 'margin:4px 0;font:11px/14px monospace;color:#ccc');
  const perBar = el('pre', 'margin:4px 0;font:11px/14px monospace;color:#ccc;white-space:pre-wrap');
  const parts = el('div', `color:${DIM};margin:4px 0`);
  const learned = el('pre', `margin:4px 0;font:11px/14px monospace;color:${DIM};white-space:pre-wrap`);
  learned.dataset.testid = 'difficulty-learned';
  const passageLearned = el('pre', `margin:4px 0;font:11px/14px monospace;color:${DIM};white-space:pre-wrap`);
  element.append(heading, whole, wholeParts, learned, parts, strip, hint, row, passage, passageLearned, passageParts, perBar);

  let chart: Chart | null = null;
  let piece: Difficulty | null = null;
  let anchor: number | null = null;
  let ranges: BarRange[] = [];
  let models: readonly LearnedModel[] = [];
  let refusedModels: readonly string[] = [];

  const marks = () => difficultyMarks(piece, ranges, heatBox.checked);
  const barsOf = (r: BarRange) => Array.from({ length: r.last - r.first + 1 }, (_, i) => r.first + i);

  const renderPassage = () => {
    const chosen = new Set(ranges.flatMap(barsOf));
    for (const cell of strip.children) (cell as HTMLElement).style.outline = chosen.has(Number((cell as HTMLElement).dataset.bar)) ? '2px solid #2b6cff' : 'none';
    onMarks(marks());
    if (!chart || ranges.length === 0) {
      passage.textContent = '';
      passageLearned.textContent = '';
      passageParts.textContent = '';
      perBar.textContent = '';
      return;
    }
    const d = difficultyOfPassage(chart, ranges);
    passage.textContent = `Passage ${formatBarList(ranges, chart)}: ${difficultySummary(d)}`;
    passageLearned.textContent = learnedLines(models, d);
    passageParts.textContent = partsLines(d.parts);
    perBar.textContent = d.bars.map(featureLine).join('\n');
  };

  const choose = (next: BarRange[]) => {
    ranges = next;
    input.value = chart && next.length > 0 ? formatBarList(next, chart) : '';
    input.style.borderColor = '#2b6cff';
    renderPassage();
  };

  input.addEventListener('input', () => {
    if (!chart) return;
    if (input.value.trim() === '') return choose([]);
    const parsed = parseBarList(input.value, chart);
    if ('error' in parsed) {
      input.style.borderColor = '#ff8a8a';
      passage.textContent = parsed.error;
      return;
    }
    input.style.borderColor = '#2b6cff';
    ranges = parsed.ranges;
    renderPassage();
  });
  heatBox.addEventListener('change', () => onMarks(marks()));

  const renderLearned = () => {
    learned.textContent = [piece ? learnedLines(models, piece) : '', ...refusedModels].filter(Boolean).join('\n');
  };

  return {
    element,
    setModels(next, refused) {
      models = next;
      refusedModels = refused;
      renderLearned();
      renderPassage();
    },
    show(next, confirmed) {
      if (next?.id !== chart?.id) ranges = []; // another piece: start with no passage
      chart = next;
      piece = next ? difficultyOf(next) : null;
      strip.replaceChildren();
      if (!next || !piece) {
        whole.textContent = 'The piece does not compile, so it has no difficulty yet.';
        wholeParts.textContent = '';
        parts.textContent = '';
        ranges = [];
        renderLearned();
        renderPassage();
        return;
      }
      whole.textContent = difficultySummary(piece, confirmed);
      wholeParts.textContent = partsLines(piece.parts);
      renderLearned();
      const named = partDifficulties(next);
      parts.textContent = named.length > 0 ? `Parts: ${named.map((p) => `${p.name} ${p.difficulty.points}/100`).join(', ')}` : '';
      const peak = Math.max(...piece.bars.map((b) => b.score), 0.01);
      for (const b of piece.bars) {
        const tint = heatColour(b.score / peak);
        const cell = Object.assign(el('button', `min-width:30px;padding:2px 3px;font:11px monospace;border:1px solid #444;cursor:pointer;color:#222;background:${tint === null ? '#fdf6e3' : css(tint)}`, String(b.printed)), { type: 'button', title: featureLine(b) });
        cell.dataset.bar = String(b.index);
        cell.dataset.testid = `difficulty-bar-${b.printed}`;
        cell.addEventListener('click', (event) => {
          if (event.shiftKey && anchor !== null) choose([{ first: Math.min(anchor, b.index), last: Math.max(anchor, b.index) }]);
          else {
            anchor = b.index;
            choose([{ first: b.index, last: b.index }]);
          }
        });
        strip.append(cell);
      }
      // a passage typed for an earlier version of the piece is kept while its bars still exist
      ranges = ranges.filter((r) => r.last < next.bars.length);
      choose(ranges);
    },
  };
}
