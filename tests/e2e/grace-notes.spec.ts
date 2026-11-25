// Covers core_09.AC32, core_09.AC33.
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoErrors, letGameRun, openGame, openPiece, playWithVirtualPiano, results, toScoreScreen } from './helpers';

/**
 * Grace Steps (`tests/fixtures/e2e/pieces/grace-steps`, a draft piece made for this test, synthetic): five graces, four slashed, one
 * plain ({F}D), one with a sharp ({/^D}E) and one under a ledger line ({/B,}C).
 */
const PIECE = 'Grace Steps';

interface Drawn {
  layout: { index: number; x: number; y: number; slash: boolean; ledgers: number; accidental: boolean; label: string; stem: { x: number; y1: number; y2: number }; slashLine: { x1: number; y1: number; x2: number; y2: number } | null }[];
  drawn: { index: number; x: number; y: number; slash: boolean }[];
  labels: { text: string; x: number; y: number; visible: boolean }[];
  origin: { x: number; y: number };
  ink: number;
}

const graces = (page: Page): Promise<Drawn> =>
  page.evaluate(() => {
    const view = window.__game.scene.getScene('practice').playSession.staffView;
    type G = { index: number; x: number; y: number; slash: { x1: number; y1: number; x2: number; y2: number } | null; ledgerLines: unknown[]; accidental: unknown; label: string; labelY: number; stem: { x: number; y1: number; y2: number } };
    return {
      layout: (view.layout.graces as G[]).map((g) => ({ index: g.index, x: g.x, y: g.y, slash: g.slash !== null, ledgers: g.ledgerLines.length, accidental: g.accidental !== null, label: g.label, stem: g.stem, slashLine: g.slash })),
      drawn: view.gracesShown as Drawn['drawn'],
      labels: (view.graceLabels as { text: string; x: number; y: number; visible: boolean }[]).map((t) => ({ text: t.text, x: t.x, y: t.y, visible: t.visible })),
      origin: view.origin as { x: number; y: number },
      ink: view.theme.ink as number,
    };
  });

/** The colour the game drew at (x, y) of its canvas, read back from the renderer (a frame later). */
const pixel = (page: Page, x: number, y: number): Promise<{ r: number; g: number; b: number }> =>
  page.evaluate(
    ([px, py]) =>
      new Promise((resolve) => {
        const renderer = (window.__game as unknown as { renderer: { snapshotPixel(x: number, y: number, done: (c: { r: number; g: number; b: number }) => void): void } }).renderer;
        renderer.snapshotPixel(Math.round(px), Math.round(py), (c) => resolve({ r: c.r, g: c.g, b: c.b }));
      }),
    [x, y] as const,
  );

/** Darkest of the pixels at (x, y) and its eight neighbours: thin, smoothed lines can fall between two pixels. */
async function darkest(page: Page, x: number, y: number): Promise<number> {
  let min = 255 * 3;
  for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
    const c = await pixel(page, x + dx, y + dy);
    min = Math.min(min, c.r + c.g + c.b);
  }
  return min;
}

test.describe('grace notes (core_09.AC32)', () => {
  test('(core_09.AC32) the staff draws each grace small, where the layout put it: head, stem, slash and its small note name', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, PIECE);
    const g = await graces(page);
    expect(g.layout.map((l) => ({ slash: l.slash, ledgers: l.ledgers, accidental: l.accidental, label: l.label }))).toEqual([
      { slash: true, ledgers: 0, accidental: false, label: 'D' },
      { slash: true, ledgers: 0, accidental: false, label: 'A' },
      { slash: false, ledgers: 0, accidental: false, label: 'F' },
      { slash: true, ledgers: 0, accidental: true, label: 'D#' },
      { slash: true, ledgers: 1, accidental: false, label: 'B' },
    ]);
    // every grace on the page is drawn, at its layout position
    expect(g.drawn).toEqual(g.layout.map((l) => ({ index: l.index, x: l.x, y: l.y, slash: l.slash })));

    // and the canvas shows ink there: the head's centre, a point on the stem, and a point on the slash away from the stem
    const paper = await pixel(page, g.origin.x + 4, g.origin.y + 4);
    const paperSum = paper.r + paper.g + paper.b;
    const ink = ((g.ink >> 16) & 255) + ((g.ink >> 8) & 255) + (g.ink & 255);
    const dark = (sum: number) => sum < (paperSum + ink) / 2;
    for (const l of g.layout) {
      expect(dark(await darkest(page, g.origin.x + l.x, g.origin.y + l.y)), `head of grace ${l.index}`).toBe(true);
      expect(dark(await darkest(page, g.origin.x + l.stem.x, g.origin.y + (l.stem.y1 * 0.25 + l.stem.y2 * 0.75))), `stem of grace ${l.index}`).toBe(true);
      if (l.slashLine) {
        const s = l.slashLine;
        expect(dark(await darkest(page, g.origin.x + s.x1 * 0.85 + s.x2 * 0.15, g.origin.y + s.y1 * 0.85 + s.y2 * 0.15)), `slash of grace ${l.index}`).toBe(true);
      }
    }
    // the note-name hint of each grace is made small, under its head, and shown with the note names
    expect(g.labels.map((t) => t.text)).toEqual(g.layout.map((l) => l.label));
    g.labels.forEach((t, i) => expect(t.x).toBeCloseTo(g.origin.x + g.layout[i]!.x, 3));
    const hints = (noteNames: boolean) => page.evaluate((on) => window.__game.scene.getScene('practice').playSession.staffView.setHints({ noteNames: on, fingers: false }), noteNames);
    await hints(false);
    expect((await graces(page)).labels.every((t) => !t.visible)).toBe(true);
    await hints(true);
    expect((await graces(page)).labels.every((t) => t.visible)).toBe(true);
    expectNoErrors(errors);
  });
});

test.describe('grace notes are never wrong in Wait mode (core_09.AC33)', () => {
  test('(core_09.AC33) a press of the grace key before its main note shows no wrong note; the cursor moves on with the main note', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, PIECE);
    const state = () =>
      page.evaluate(() => {
        const session = window.__game.scene.getScene('practice').playSession;
        const s = session.controller.getState();
        return { step: s.stepIndex as number, last: (s.lastJudged?.verdict ?? null) as string | null, played: (session.staffView?.playedShown ?? null) as string | null };
      });

    await playWithVirtualPiano(page, [60, 62]); // C D, then the E waits with its grace D before it
    await expect.poll(async () => (await state()).step).toBe(2);
    await playWithVirtualPiano(page, [62]); // the grace key
    await letGameRun(page, 10);
    expect(await state()).toEqual({ step: 2, last: 'correct', played: null }); // nothing marked, the E still waits
    await playWithVirtualPiano(page, [64]); // the main note
    await expect.poll(async () => (await state()).step).toBe(3);

    // the rest with every grace played: E F {A}G | E {F}D {D#}E | D E {B,}C
    await playWithVirtualPiano(page, [64, 65, 69, 67, 64, 65, 62, 63, 64, 62, 64, 59, 60]);
    await toScoreScreen(page);
    expect(await results(page)).toMatchObject({ notes: 12, accuracy: 1, mistakes: 0, firstTryCorrect: 12 });
    expectNoErrors(errors);
  });
});
