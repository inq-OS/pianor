import { OwnPieces } from '../game/editor/OwnPieces';
import { browserTextFiles } from '../io/files/textFiles';
import { MemoryStore } from '../io/storage/MemoryStore';
import { createAdminAccess } from '../io/admin/adminAccess';
import { createTeacherDesk } from '../io/teacher/teacherDesk';
import { DEFAULT_ADMIN_SETTINGS } from '../core/admin/adminSettings';
import Phaser from 'phaser';
import { checkPiece, type PieceCheck } from '../core/piece/check.ts';
import { difficultySummary } from '../core/piece/difficulty.ts';
import { createDifficultyPanel } from './difficultyPanel';
import { parseModelFiles } from '../core/piece/learnedModel';
import { formatDiagnostic, type Diagnostic } from '../core/piece/diagnostics.ts';
import { parseLevels } from '../core/piece/levelsTable.ts';
import { readStatus } from '../core/piece/status.ts';
import type { LevelDefinition } from '../core/chart';
import { appConfig } from '../appConfig';
import { createSoundAndInput } from '../compose';
import { bundledPieceSources } from '../game/content';
import { PieceCatalogue } from '../game/pieceCatalogue';
import { CONTEXT_KEY, type GameContext } from '../game/context';
import { PracticeScene } from '../game/PracticeScene';
import {
  PREVIEW_HINTS, PREVIEW_LISTEN, PREVIEW_MARKS, PREVIEW_PRACTICE, PREVIEW_READY, PREVIEW_SHOW, PREVIEW_STATUS, PREVIEW_STOP,
  PreviewScene, type PreviewStatus,
} from '../game/PreviewScene';
import { createMemoryProfileService } from '../profileSetup';
import { contentStyles } from '../../tools/piece/styles.ts';

/** What `GET /__pianor/pieces` answers (see `tools/piece/previewApi.ts`). */
interface PreviewData {
  levels: string;
  pieces: { folder: string; abc: string; meta: string }[];
  /** Missing from an older dev server. */
  models?: { file: string; text: string }[];
}

/** A piece on disk, or the scratch piece. `abc` and `meta` are what is in the boxes; `disk*` is what is saved. */
interface Entry {
  /** The folder name, or null for the scratch piece. */
  folder: string | null;
  abc: string;
  meta: string;
  diskAbc: string;
  diskMeta: string;
}

const SCRATCH_ABC = 'X:1\nT:Scratch\nM:4/4\nL:1/4\nQ:1/4=80\nK:C\n% Paste or write ABC here. It is checked and drawn as you type, and nothing is saved.\nC D E F | G2 F2 | F E D C | C4 |]\n';
const SCRATCH_META = JSON.stringify(
  { id: 'scratch', title: 'Scratch', level: 1, status: 'draft', hands: ['RH'], phrases: [{ name: 'All', bars: [1, 4] }], tags: [], source: 'original', license: 'CC0-1.0', generator: { kind: 'manual' } },
  null, 2,
);
const SCRATCH_KEY = 'pianor/preview/scratch';

const COLORS = { error: '#ff8a8a', warning: '#ffd37a', ok: '#7dffa0', dim: '#9a9ab8' } as const;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, css = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (css) node.style.cssText = css;
  if (text) node.textContent = text;
  return node;
}

const BUTTON_CSS = 'background:#2d2d4a;color:#fff;border:1px solid #2b6cff;padding:5px 10px;font:inherit;cursor:pointer;margin:2px 4px 2px 0';

/** A dev page for reviewing pieces: the pieces on disk, the linter's output, the game's own staff, playback and play-along. */
export async function startPreview(): Promise<void> {
  const keyboardHost = document.getElementById('keyboard')!;
  const app = document.getElementById('app')!;
  document.title = 'Pianor piece preview';

  // The page: a side panel on the left, the game's canvas and the on-screen keyboard on the right.
  const side = el('div', 'width:470px;flex:none;overflow:auto;background:#14142a;color:#eee;font:13px/1.4 monospace;padding:12px;box-sizing:border-box;border-right:2px solid #2b6cff');
  const stage = el('div', 'flex:1;min-width:0;display:flex;flex-direction:column;height:100%');
  stage.append(...Array.from(app.childNodes));
  app.style.flexDirection = 'row';
  app.append(side, stage);

  const { audio, inputs } = createSoundAndInput(keyboardHost);
  const profiles = await createMemoryProfileService();
  const ownPieces = await OwnPieces.load(new MemoryStore());
  const pieces = new PieceCatalogue({ ...bundledPieceSources(), ownPieces: () => ownPieces.pieces(), showDrafts: true });
  const { actors, editor, learn, demo, staffDemo, sky } = appConfig.flags;
  const context: GameContext = {
    keyboard: inputs.keyboard, lights: inputs.lights, midi: null, audio, profiles, flags: { actors, editor, learn, demo, staffDemo, sky, devTools: true, autoplay: false, draftsShown: true, pageBase: window.location.href, intro: 'off' as const }, pieces, ownPieces,
    files: browserTextFiles, savesPersist: false, admin: createAdminAccess(new MemoryStore()), teacher: createTeacherDesk(new MemoryStore()), adminSettings: { ...DEFAULT_ADMIN_SETTINGS },
    // the preview page shows no toolbar: a switch that does nothing
    keyboardSwitch: { shown: () => true, toggle: () => {}, enabled: () => true, onChange: () => () => {} },
  };
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#fdf6e3',
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE },
    scene: [PreviewScene, PracticeScene],
  });
  game.registry.set(CONTEXT_KEY, context);
  Object.assign(window, { __game: game, __virtualDevice: inputs.virtualDevice });
  void inputs.ready.then(() => {
    context.midi = inputs.midi;
  });

  // ---- data
  let levels: LevelDefinition[] = [];
  let levelProblems: Diagnostic[] = [];
  let entries: Entry[] = [];
  let selected: Entry;
  let hints = { noteNames: false, fingers: false };
  let listening = false;
  let checkTimer: ReturnType<typeof setTimeout> | undefined;

  const scratch = (): Entry => {
    let abc = SCRATCH_ABC;
    let meta = SCRATCH_META;
    try {
      const saved = JSON.parse(sessionStorage.getItem(SCRATCH_KEY) ?? 'null') as { abc?: string; meta?: string } | null;
      if (typeof saved?.abc === 'string' && typeof saved.meta === 'string') ({ abc, meta } = saved);
    } catch {
      /* no storage: the scratch piece starts fresh */
    }
    return { folder: null, abc, meta, diskAbc: SCRATCH_ABC, diskMeta: SCRATCH_META };
  };
  const saveScratch = (e: Entry) => {
    if (e.folder !== null) return;
    try {
      sessionStorage.setItem(SCRATCH_KEY, JSON.stringify({ abc: e.abc, meta: e.meta }));
    } catch {
      /* ignore */
    }
  };

  const analyse = (e: Entry): PieceCheck => checkPiece({ styles: contentStyles, folder: e.folder, abc: e.abc, meta: e.meta, levels });
  const isDirty = (e: Entry) => e.abc !== e.diskAbc || e.meta !== e.diskMeta;
  const count = (d: Diagnostic[], severity: Diagnostic['severity']) => d.filter((x) => x.severity === severity).length;

  // ---- side panel
  const heading = el('div', 'font-size:16px;font-weight:bold;margin-bottom:4px', 'Piece preview (dev)');
  const intro = el('div', `color:${COLORS.dim};margin-bottom:8px`, 'Pieces on disk, checked as the game will check them. The boxes below are for trying things out: edits are not saved to the files.');
  const list = el('div', 'margin-bottom:10px');
  const detail = el('div');
  side.append(heading, intro, list, detail);

  const title = el('div', 'font-size:15px;font-weight:bold');
  const facts = el('div', `color:${COLORS.dim};margin-bottom:6px`);
  const controls = el('div', 'margin:6px 0');
  const listenButton = Object.assign(el('button', BUTTON_CSS, 'Listen'), { type: 'button' });
  listenButton.dataset.testid = 'listen';
  const speed = el('select', 'background:#2d2d4a;color:#fff;font:inherit;margin-right:6px');
  for (const [label, value] of [['100%', '1'], ['75%', '0.75'], ['50%', '0.5']] as const) speed.append(Object.assign(document.createElement('option'), { value, textContent: label }));
  speed.dataset.testid = 'speed';
  const playAlong = Object.assign(el('button', BUTTON_CSS, 'Play along'), { type: 'button' });
  playAlong.dataset.testid = 'play-along';
  const hintsRow = el('label', 'margin-right:8px;white-space:nowrap');
  const namesBox = Object.assign(document.createElement('input'), { type: 'checkbox' });
  const fingersBox = Object.assign(document.createElement('input'), { type: 'checkbox' });
  const namesLabel = el('label', 'margin-right:8px;white-space:nowrap');
  namesLabel.append(namesBox, ' note names');
  hintsRow.append(fingersBox, ' fingers');
  const approval = el('div', 'margin:6px 0');
  const approveButton = Object.assign(el('button', BUTTON_CSS, 'Approve'), { type: 'button' });
  approveButton.dataset.testid = 'approve';
  const approveNote = el('span', `color:${COLORS.dim}`);
  approval.append(approveButton, approveNote);
  const status = el('div', `min-height:18px;color:${COLORS.ok}`);
  status.dataset.testid = 'status';
  const diagnostics = el('ul', 'margin:6px 0;padding-left:16px');
  diagnostics.dataset.testid = 'diagnostics';
  const abcLabel = el('div', `color:${COLORS.dim};margin-top:8px`, 'piece.abc');
  const abcBox = Object.assign(el('textarea', 'width:100%;height:210px;background:#0e0e1c;color:#eee;font:12px/16px monospace;box-sizing:border-box;white-space:pre;overflow:auto'), { spellcheck: false });
  abcBox.dataset.testid = 'abc';
  const metaLabel = el('div', `color:${COLORS.dim};margin-top:8px`, 'piece.meta.json');
  const metaBox = Object.assign(el('textarea', 'width:100%;height:190px;background:#0e0e1c;color:#eee;font:12px/16px monospace;box-sizing:border-box;white-space:pre;overflow:auto'), { spellcheck: false });
  metaBox.dataset.testid = 'meta';
  const resetButton = Object.assign(el('button', BUTTON_CSS, 'Undo my edits'), { type: 'button' });
  controls.append(listenButton, speed, playAlong, ' ', namesLabel, hintsRow);
  const difficulty = createDifficultyPanel((marks) => game.events.emit(PREVIEW_MARKS, marks));
  detail.append(title, facts, controls, approval, status, diagnostics, difficulty.element, abcLabel, abcBox, metaLabel, metaBox, resetButton);

  const say = (text: string, color: string = COLORS.ok) => {
    status.textContent = text;
    status.style.color = color;
  };

  const showStaff = (check: PieceCheck) => {
    const chart = check.compiled.chart;
    const problem = chart ? undefined : `This piece does not compile yet.\n${check.diagnostics.filter((d) => d.severity === 'error').slice(0, 3).map(formatDiagnostic).join('\n')}`;
    game.events.emit(PREVIEW_SHOW, { chart, ...(problem === undefined ? {} : { problem }) });
  };

  const renderDiagnostics = (check: PieceCheck) => {
    diagnostics.replaceChildren();
    const all = [...levelProblems, ...check.diagnostics];
    if (all.length === 0) {
      diagnostics.append(el('li', `list-style:none;margin-left:-16px;color:${COLORS.ok}`, 'No errors or warnings.'));
      return;
    }
    for (const d of all) {
      const li = el('li', `color:${d.severity === 'error' ? COLORS.error : COLORS.warning};margin-bottom:3px;cursor:${d.line ? 'pointer' : 'default'}`, formatDiagnostic(d));
      if (d.line !== undefined && d.file.endsWith('.abc')) li.addEventListener('click', () => selectLine(abcBox, d.line!));
      diagnostics.append(li);
    }
  };

  const selectLine = (box: HTMLTextAreaElement, line: number) => {
    const lines = box.value.split('\n');
    const start = lines.slice(0, line - 1).reduce((sum, l) => sum + l.length + 1, 0);
    box.focus();
    box.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0));
    box.scrollTop = Math.max(0, (line - 4) * 16);
  };

  const rowText = (e: Entry, check: PieceCheck) => {
    const meta = check.compiled.meta;
    const mark = e.folder === null ? '~' : readStatus(e.diskMeta) === 'approved' ? 'v' : 'o';
    const errors = count(check.diagnostics, 'error');
    const warnings = count(check.diagnostics, 'warning');
    const level = meta ? `L${meta.level}` : 'L?';
    const hard = check.difficulty ? ` ${check.difficulty.points}p` : '';
    return `${mark} ${meta?.title ?? e.folder ?? 'Scratch'}  ${level}${hard}  ${errors}e ${warnings}w`;
  };

  const renderList = () => {
    list.replaceChildren();
    for (const e of entries) {
      const check = analyse({ ...e, abc: e === selected ? e.abc : e.diskAbc, meta: e === selected ? e.meta : e.diskMeta });
      const row = Object.assign(el('button', `${BUTTON_CSS};display:block;width:100%;text-align:left;margin:2px 0;${e === selected ? 'background:#3b3b63;' : ''}${count(check.diagnostics, 'error') > 0 ? `color:${COLORS.error};` : ''}`, rowText(e, check)), { type: 'button' });
      row.dataset.testid = `piece-${e.folder ?? 'scratch'}`;
      row.addEventListener('click', () => select(e));
      list.append(row);
    }
  };

  const renderApproval = (check: PieceCheck) => {
    const saved = selected.folder !== null;
    approval.style.display = saved ? 'block' : 'none';
    if (!saved) return;
    const current = readStatus(selected.diskMeta);
    const dirty = isDirty(selected);
    approveButton.textContent = current === 'approved' ? 'Back to draft' : 'Approve for the student';
    approveButton.disabled = current !== 'approved' && (dirty || !check.ok);
    approveButton.style.opacity = approveButton.disabled ? '0.5' : '1';
    approveNote.textContent = current === 'approved' ? ' approved: the student sees it' : dirty ? ' your edits are not saved, so check the file first' : !check.ok ? ' fix the errors first' : ` draft: ${count(check.diagnostics, 'warning')} warning(s) to read`;
  };

  const renderDetail = () => {
    const check = analyse(selected);
    const meta = check.compiled.meta;
    title.textContent = meta ? `${meta.title}` : selected.folder ?? 'Scratch';
    facts.textContent = meta
      ? [
          selected.folder ?? 'scratch', `level ${meta.level}`, `unlocks at ${meta.unlockLevel ?? meta.level}`, meta.status, meta.license,
          check.fitsLevels.length > 0 ? `fits levels ${check.fitsLevels.join(', ')}` : 'fits no level',
          check.difficulty ? difficultySummary(check.difficulty, meta.difficulty) : '',
        ].filter(Boolean).join('  |  ')
      : 'the meta file cannot be read yet';
    const chartOk = check.compiled.chart !== null;
    listenButton.disabled = !chartOk;
    playAlong.disabled = !chartOk;
    renderDiagnostics(check);
    renderApproval(check);
    difficulty.show(check.compiled.chart, meta?.difficulty);
    renderList();
    return check;
  };

  const refresh = () => {
    const check = renderDetail();
    showStaff(check);
    saveScratch(selected);
  };

  const select = (e: Entry) => {
    game.events.emit(PREVIEW_STOP);
    selected = e;
    abcBox.value = e.abc;
    metaBox.value = e.meta;
    history.replaceState(null, '', e.folder === null ? '#' : `#${encodeURIComponent(e.folder)}`);
    say('');
    refresh();
  };

  // ---- actions
  const onEdit = () => {
    selected.abc = abcBox.value;
    selected.meta = metaBox.value;
    clearTimeout(checkTimer);
    checkTimer = setTimeout(refresh, 250);
  };
  abcBox.addEventListener('input', onEdit);
  metaBox.addEventListener('input', onEdit);
  resetButton.addEventListener('click', () => {
    selected.abc = selected.diskAbc;
    selected.meta = selected.diskMeta;
    abcBox.value = selected.abc;
    metaBox.value = selected.meta;
    refresh();
  });

  listenButton.addEventListener('click', () => {
    if (listening) game.events.emit(PREVIEW_STOP);
    else game.events.emit(PREVIEW_LISTEN, { tempoScale: Number(speed.value) });
  });
  playAlong.addEventListener('click', () => game.events.emit(PREVIEW_PRACTICE));
  const onHints = () => {
    hints = { noteNames: namesBox.checked, fingers: fingersBox.checked };
    game.events.emit(PREVIEW_HINTS, hints);
  };
  namesBox.addEventListener('change', onHints);
  fingersBox.addEventListener('change', onHints);

  const approve = async (): Promise<void> => {
    const folder = selected.folder;
    if (folder === null) return;
    const approving = readStatus(selected.diskMeta) !== 'approved';
    if (approving) {
      const warnings = count(analyse(selected).diagnostics, 'warning');
      const sure = window.confirm(`Approve "${title.textContent}" for the student?\n\nOnly do this after you have listened to it, played along, and read the ${warnings} warning(s).`);
      if (!sure) return;
    }
    say('Saving...', COLORS.dim);
    try {
      const response = await fetch('/__pianor/status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: folder, status: approving ? 'approved' : 'draft' }) });
      const body = (await response.json()) as { ok: boolean; message?: string; status?: string };
      if (!body.ok) return say(body.message ?? `The server refused (${response.status}).`, COLORS.error);
      // The dev server reloads the page when the file changes; until then, show the new state.
      selected.diskMeta = selected.diskMeta.replace(/"status":\s*"(draft|approved)"/, `"status": "${body.status}"`);
      selected.meta = selected.diskMeta;
      metaBox.value = selected.meta;
      say(`"${folder}" is now ${body.status}.`);
      refresh();
    } catch (e) {
      say(`Could not reach the dev server: ${e instanceof Error ? e.message : String(e)}`, COLORS.error);
    }
  };
  // `approve` catches its own errors, so the dropped promise cannot reject.
  approveButton.addEventListener('click', () => void approve());

  game.events.on(PREVIEW_STATUS, (s: PreviewStatus) => {
    listening = s.listening;
    listenButton.textContent = listening ? 'Stop' : 'Listen';
    if (s.message !== undefined) say(s.message);
  });
  // The scene (re)starts after a play-along: tell it what to show again.
  game.events.on(PREVIEW_READY, () => {
    if (selected) showStaff(analyse(selected));
    game.events.emit(PREVIEW_HINTS, hints);
  });

  // ---- load the pieces from the dev server
  try {
    const response = await fetch('/__pianor/pieces');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as PreviewData;
    const parsed = parseLevels(data.levels, 'levels.json');
    levels = parsed.levels;
    levelProblems = parsed.diagnostics;
    const { models, refused } = parseModelFiles(data.models ?? []);
    difficulty.setModels(models, refused);
    entries = [...data.pieces.map((p) => ({ folder: p.folder, abc: p.abc, meta: p.meta, diskAbc: p.abc, diskMeta: p.meta })), scratch()];
  } catch (e) {
    entries = [scratch()];
    levelProblems = [{ severity: 'error', file: '/__pianor/pieces', message: `could not load the pieces from the dev server: ${e instanceof Error ? e.message : String(e)}` }];
  }
  const wanted = decodeURIComponent(window.location.hash.slice(1));
  select(entries.find((e) => e.folder === wanted) ?? entries[0]!);
}
