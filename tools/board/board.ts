/**
 * The piece review board (ft_0_11.AC3, d262): one page that shows every draft piece as a sheet, plays it, and lets the
 * maintainer pick "approve" or "not yet" from a phone. `boardPieces` reads the drafts, `renderBoard` writes the page (a
 * private page in the Claude app keeps the picks), and `applyPicks` records the picks: it approves only a piece whose
 * files are still the ones the maintainer saw, through the same checked write as the preview tool.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LevelDefinition } from '../../src/core/chart/index.ts';
import { formatDiagnostic } from '../../src/core/piece/diagnostics.ts';
import { readStatus } from '../../src/core/piece/status.ts';
import { checkPieceFolder, listPieceFolders } from '../piece/folder.ts';
import { changePieceStatus } from '../piece/previewApi.ts';

/** One sounding note on the board, in seconds from the start at the written tempo. */
export interface BoardNote {
  t: number;
  d: number;
  midi: number;
  /** False for the computer's part (accompaniment), which plays a little softer. */
  play: boolean;
}

export interface BoardPiece {
  id: string;
  title: string;
  level: number;
  hands: string[];
  bpm: number;
  source: string;
  license: string;
  abc: string;
  /** The compiler's and linter's warnings, for the maintainer to read before approving. */
  warnings: string[];
  /** Fingerprint of both files as shown; a pick applies only while the files still match it. */
  hash: string;
  notes: BoardNote[];
}

export interface BoardContent {
  pieces: BoardPiece[];
  /** Drafts that cannot be offered, each with its first error. */
  refused: { id: string; reason: string }[];
}

/** Fingerprint of a piece's two files: 12 hex characters of their SHA-256. */
export function pieceHash(abc: string, meta: string): string {
  return createHash('sha256').update(abc).update('\u0000').update(meta).digest('hex').slice(0, 12);
}

const round = (x: number): number => Math.round(x * 1000) / 1000;

/** Every draft piece of `piecesDir` that compiles and passes its level, ready for the board; the rest with a reason. */
export function boardPieces(piecesDir: string, levels: readonly LevelDefinition[]): BoardContent {
  const content: BoardContent = { pieces: [], refused: [] };
  for (const folder of listPieceFolders(piecesDir)) {
    const abc = readFileSync(join(piecesDir, folder, 'piece.abc'), 'utf-8');
    let meta = '';
    try {
      meta = readFileSync(join(piecesDir, folder, 'piece.meta.json'), 'utf-8');
    } catch {
      // a missing meta file is reported by the check below
    }
    if (meta !== '' && readStatus(meta) !== 'draft') continue;
    const check = checkPieceFolder(piecesDir, folder, levels);
    const chart = check.compiled?.chart;
    const pieceMeta = check.compiled?.meta;
    if (!check.ok || !chart || !pieceMeta) {
      const first = check.diagnostics.find((d) => d.severity === 'error');
      content.refused.push({ id: folder, reason: first ? formatDiagnostic(first) : 'it does not compile' });
      continue;
    }
    const bpm = chart.tempoMap[0]?.bpm ?? 80;
    const secondsPerTick = 60 / bpm / chart.ppq;
    const playTracks = new Set(chart.tracks.filter((t) => t.role === 'play').map((t) => t.id));
    content.pieces.push({
      id: pieceMeta.id,
      title: pieceMeta.title,
      level: pieceMeta.level,
      hands: [...pieceMeta.hands],
      bpm,
      source: pieceMeta.source,
      license: pieceMeta.license,
      abc,
      warnings: check.diagnostics.filter((d) => d.severity === 'warning').map((d) => d.message),
      hash: pieceHash(abc, meta),
      notes: chart.notes.map((n) => ({ t: round(n.tick * secondsPerTick), d: round(n.dur * secondsPerTick), midi: n.midi, play: playTracks.has(n.track) })),
    });
  }
  return content;
}

/** The pinned renderer the page loads (MIT; the only script it fetches). */
export const ABCJS_URL = 'https://cdn.jsdelivr.net/npm/abcjs@6.7.2/dist/abcjs-basic-min.js';

/** JSON safe to put inside a `<script>` element: no `</script>` or `<!--` can end or open anything. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/** The whole board page: the pieces as data, drawn and played by the page's own script. */
export function renderBoard(content: BoardContent, made: string): string {
  return BOARD_HTML.replace('__ABCJS__', ABCJS_URL).replace('__DATA__', () => scriptJson({ made, ...content }));
}

/** A pick as the board stores it, one document per piece in the `picks` collection. */
export interface BoardPick {
  id: string;
  pick: 'approve' | 'draft';
  hash: string;
  note?: string;
}

export type PickResult =
  | { id: string; outcome: 'approved'; warnings: number }
  | { id: string; outcome: 'kept-draft'; note: string }
  | { id: string; outcome: 'refused'; reason: string };

/** Reads the picks from a JSON file's text: a list of picks, or `{ "picks": [...] }`. Anything malformed is an error. */
export function parsePicks(text: string): BoardPick[] {
  const raw: unknown = JSON.parse(text);
  const list: unknown = Array.isArray(raw) ? raw : (raw as { picks?: unknown } | null)?.picks;
  if (!Array.isArray(list)) throw new Error('expected a list of picks or { "picks": [...] }');
  return list.map((item: unknown, i) => {
    const p = item as Partial<BoardPick> | null;
    if (!p || typeof p.id !== 'string' || (p.pick !== 'approve' && p.pick !== 'draft') || typeof p.hash !== 'string') {
      throw new Error(`pick ${i + 1}: needs "id", "pick" ("approve" or "draft") and "hash"`);
    }
    return { id: p.id, pick: p.pick, hash: p.hash, ...(typeof p.note === 'string' && p.note.trim() !== '' ? { note: p.note.trim() } : {}) };
  });
}

/**
 * Record the maintainer's picks. "approve" sets the status through the checked write of the preview tool, and only when
 * the piece's files still have the fingerprint the board showed (an edited piece needs a new look); "draft" changes
 * nothing and passes on the maintainer's note.
 */
export function applyPicks(piecesDir: string, levelsPath: string, picks: readonly BoardPick[]): PickResult[] {
  const folders = new Set(listPieceFolders(piecesDir));
  return picks.map((p): PickResult => {
    if (!folders.has(p.id)) return { id: p.id, outcome: 'refused', reason: 'there is no such piece' };
    if (p.pick === 'draft') return { id: p.id, outcome: 'kept-draft', note: p.note ?? '' };
    const abc = readFileSync(join(piecesDir, p.id, 'piece.abc'), 'utf-8');
    const meta = readFileSync(join(piecesDir, p.id, 'piece.meta.json'), 'utf-8');
    if (readStatus(meta) === 'approved') return { id: p.id, outcome: 'approved', warnings: 0 };
    if (pieceHash(abc, meta) !== p.hash) return { id: p.id, outcome: 'refused', reason: 'the piece changed after the board showed it; put it on a new board' };
    const result = changePieceStatus(piecesDir, levelsPath, p.id, 'approved');
    return result.ok ? { id: p.id, outcome: 'approved', warnings: result.warnings } : { id: p.id, outcome: 'refused', reason: result.message };
  });
}

/*
 * The page. Plain HTML, CSS and script with no build step: the Claude app shows it on a phone. Its picks go to the page's
 * own database (`picks/<piece id>`), which only the page's owner may write; a viewer without it sees the board read-only.
 */
const BOARD_HTML = String.raw`<title>Piece review board</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
:root{--bg:#f6f3ec;--card:#fffdf8;--ink:#1d1b16;--muted:#6b665a;--line:#ddd6c6;--ok:#1f7a3a;--wait:#8a5a00;--accent:#2f5d8a}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#17160f;--card:#211f18;--ink:#eeeae0;--muted:#a59f90;--line:#3a3628;--ok:#5cc27a;--wait:#e0a940;--accent:#7fb0e0;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#17160f;--card:#211f18;--ink:#eeeae0;--muted:#a59f90;--line:#3a3628;--ok:#5cc27a;--wait:#e0a940;--accent:#7fb0e0;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:760px;margin:0 auto;padding-block:16px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1{font-size:1.35rem;margin:.2rem 0}
.sub{color:var(--muted);font-size:.9rem;margin:0 0 1rem}
.tally{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem}
.tally span{border:1px solid var(--line);border-radius:999px;padding:.15rem .7rem;font-size:.85rem}
article{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;margin:0 0 16px}
article h2{font-size:1.1rem;margin:0}
.facts{color:var(--muted);font-size:.85rem;margin:.15rem 0 .5rem}
.sheet{background:#fff;border-radius:8px;overflow:hidden;margin:.4rem 0}
.sheet svg{display:block;max-width:100%;height:auto}
.row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-top:.5rem}
button,select{font:inherit;min-height:44px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--ink);padding:0 .9rem}
button.primary{border-color:var(--ok);color:var(--ok);font-weight:600}
button.on{background:var(--ok);color:var(--card);border-color:var(--ok)}
button.wait.on{background:var(--wait);border-color:var(--wait)}
textarea{width:100%;font:inherit;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--ink);padding:.5rem;margin-top:.5rem;min-height:2.6rem}
.warn{font-size:.85rem;color:var(--wait);margin:.3rem 0 0;padding-left:1.1rem}
.state{font-size:.9rem;font-weight:600}
.state.approve{color:var(--ok)}.state.draft{color:var(--wait)}
.note{color:var(--muted);font-size:.85rem}
details{color:var(--muted);font-size:.85rem;margin-top:.4rem}
pre{white-space:pre-wrap;font-size:.8rem;margin:.3rem 0 0}
</style>
<main>
<h1>Piece review board</h1>
<p class="sub" id="sub">Look, listen, then pick. Approve puts a piece in the student's game once a thread records your picks.</p>
<div class="tally" id="tally"></div>
<div id="list"></div>
<div id="refused"></div>
</main>
<script src="__ABCJS__"></script>
<script>
const BOARD = __DATA__;
const picks = {};
let db = null, canWrite = false, ctx = null, playing = null;

const el = (tag, attrs, ...kids) => { const n = document.createElement(tag); Object.assign(n, attrs || {}); for (const k of kids) n.append(k); return n; };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function stop() {
  if (!playing) return;
  for (const o of playing.voices) { try { o.stop(); } catch (e) {} }
  clearTimeout(playing.timer);
  playing.button.textContent = 'Play';
  playing = null;
}

function play(piece, button, speed) {
  const again = playing && playing.button === button;
  stop();
  if (again) return;
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  ctx.resume();
  const start = ctx.currentTime + 0.15, voices = [];
  let end = 0;
  for (const n of piece.notes) {
    const t = start + n.t / speed, d = Math.max(0.12, n.d / speed), peak = n.play ? 0.22 : 0.12;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.25);
    g.gain.setValueAtTime(peak * 0.35, t + d * 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.25);
    g.connect(ctx.destination);
    for (const [mult, type, level] of [[1, 'triangle', 1], [2, 'sine', 0.35]]) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = type; o.frequency.value = hz(n.midi) * mult; og.gain.value = level;
      o.connect(og); og.connect(g); o.start(t); o.stop(t + d + 0.3);
      voices.push(o);
    }
    end = Math.max(end, n.t / speed + d + 0.3);
  }
  button.textContent = 'Stop';
  playing = { voices, button, timer: setTimeout(stop, (end + 0.2) * 1000) };
}

function tally() {
  const n = BOARD.pieces.length;
  const a = BOARD.pieces.filter((p) => picks[p.id] && picks[p.id].pick === 'approve' && picks[p.id].hash === p.hash).length;
  const w = BOARD.pieces.filter((p) => picks[p.id] && picks[p.id].pick === 'draft' && picks[p.id].hash === p.hash).length;
  const box = document.getElementById('tally');
  box.replaceChildren(el('span', { textContent: n + ' drafts' }), el('span', { textContent: a + ' approved' }), el('span', { textContent: w + ' not yet' }), el('span', { textContent: (n - a - w) + ' to look at' }));
}

function showPick(piece, parts) {
  const p = picks[piece.id];
  const fresh = p && p.hash === piece.hash;
  parts.approve.classList.toggle('on', !!fresh && p.pick === 'approve');
  parts.wait.classList.toggle('on', !!fresh && p.pick === 'draft');
  parts.state.className = 'state ' + (fresh ? p.pick : '');
  parts.state.textContent = !p ? '' : !fresh ? 'Picked on an older version: look again' : p.pick === 'approve' ? 'Approved' : 'Not yet';
  if (fresh && p.note && document.activeElement !== parts.note) parts.note.value = p.note;
  tally();
}

async function choose(piece, pick, parts) {
  if (!db || !canWrite) { parts.state.textContent = 'Only the board\u2019s owner can pick, in the Claude app.'; return; }
  const doc = { pick, hash: piece.hash, note: parts.note.value.trim(), at: Date.now() };
  parts.state.textContent = 'Saving\u2026';
  try { await db.doc('picks/' + piece.id).set(doc); picks[piece.id] = doc; showPick(piece, parts); }
  catch (e) { parts.state.textContent = 'Not saved (' + (e && e.code || 'error') + '): try again'; }
}

const views = {};
function card(piece) {
  const sheet = el('div', { className: 'sheet' });
  const speed = el('select', {}, el('option', { value: '1', textContent: '100%' }), el('option', { value: '0.75', textContent: '75%' }), el('option', { value: '0.5', textContent: '50%' }));
  const playBtn = el('button', { textContent: 'Play' });
  playBtn.onclick = () => play(piece, playBtn, Number(speed.value));
  const parts = {
    approve: el('button', { className: 'primary', textContent: 'Approve' }),
    wait: el('button', { className: 'wait', textContent: 'Not yet' }),
    state: el('span', { className: 'state' }),
    note: el('textarea', { placeholder: 'What should change? (optional)' }),
  };
  parts.approve.onclick = () => choose(piece, 'approve', parts);
  parts.wait.onclick = () => choose(piece, 'draft', parts);
  const facts = 'Level ' + piece.level + ' \u00b7 ' + piece.hands.join(' + ') + ' \u00b7 ' + piece.bpm + ' bpm \u00b7 ' + piece.license;
  const warn = piece.warnings.length ? el('ul', { className: 'warn' }, ...piece.warnings.map((w) => el('li', { textContent: w }))) : '';
  const more = el('details', {}, el('summary', { textContent: 'Source and ABC' }), el('div', { textContent: piece.source }), el('pre', { textContent: piece.abc }));
  const node = el('article', { id: 'p-' + piece.id },
    el('h2', { textContent: piece.title }), el('div', { className: 'facts', textContent: piece.id + ' \u00b7 ' + facts }),
    sheet, warn, el('div', { className: 'row' }, playBtn, speed),
    parts.note, el('div', { className: 'row' }, parts.approve, parts.wait, parts.state), more);
  views[piece.id] = parts;
  return { node, sheet };
}

function draw() {
  const list = document.getElementById('list');
  const sheets = [];
  for (const piece of BOARD.pieces) { const c = card(piece); list.append(c.node); sheets.push([c.sheet, piece]); }
  if (!BOARD.pieces.length) list.append(el('p', { textContent: 'No draft pieces to review.' }));
  for (const [sheet, piece] of sheets) {
    if (window.ABCJS) { try { const w = Math.max(280, sheet.clientWidth - 12); ABCJS.renderAbc(sheet, piece.abc, { staffwidth: w, scale: w < 500 ? 1.15 : 1, paddingleft: 2, paddingright: 2, wrap: { minSpacing: 1.6, maxSpacing: 2.6, preferredMeasuresPerLine: w < 500 ? 2 : 4 } }); continue; } catch (e) {} }
    sheet.replaceWith(el('pre', { textContent: piece.abc }));
  }
  if (BOARD.refused.length) {
    document.getElementById('refused').append(el('details', {}, el('summary', { textContent: BOARD.refused.length + ' draft(s) not on the board (they have errors)' }), ...BOARD.refused.map((r) => el('div', { textContent: r.id + ': ' + r.reason }))));
  }
  document.getElementById('sub').append(' Made ' + BOARD.made + '.');
  tally();
}

async function connect() {
  const timer = setTimeout(() => { if (!db) document.getElementById('sub').append(' Picks cannot be saved in this view.'); }, 10000);
  try {
    const use = window.claude && window.claude.use;
    if (!use) return;
    const [d, user] = await Promise.all([use('db'), use('user')]);
    if (!d) return;
    db = d;
    canWrite = user ? !!(await user.isOwner()) : false;
    clearTimeout(timer);
    db.collection('picks').onSnapshot((snap) => {
      for (const k of Object.keys(picks)) delete picks[k];
      for (const doc of snap.docs) if (doc.exists) picks[doc.id] = doc.data();
      for (const piece of BOARD.pieces) if (views[piece.id]) showPick(piece, views[piece.id]);
    }, () => {});
  } catch (e) {}
}

draw();
connect();
</script>`;
