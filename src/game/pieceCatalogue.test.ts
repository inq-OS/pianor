import { describe, expect, it, vi } from 'vitest';
import { chartWith } from '../../tests/helpers/charts';
import type { PieceMeta } from '../core/chart';
import { layoutStaff } from '../core/layout/staff';
import { bundledPieceSources } from './content';
import { PieceCatalogue, type PieceCatalogueSources, type PieceFile } from './pieceCatalogue';
import type { Piece } from './pieceList';

vi.mock('../core/layout/staff', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../core/layout/staff')>();
  return { ...actual, layoutStaff: vi.fn(actual.layoutStaff) };
});

const tune = (id: string) => ({ ...chartWith([{ tick: 0, dur: 1920, midi: 60 }]), id, title: id });
const file = (id: string, status: 'draft' | 'approved'): PieceFile =>
  ({ meta: { id, status, level: 1, source: 'test' } as PieceMeta, chart: tune(id) });
const own = (id: string): Piece => ({ chart: tune(id), status: 'draft', level: 1, unlockLevel: 1, source: 'own', own: true });

const catalogue = (over: Partial<PieceCatalogueSources> = {}) => new PieceCatalogue({
  files: [file('approved-tune', 'approved'), file('draft-tune', 'draft')],
  omittedIds: [],
  devCharts: [tune('dev-sample')],
  ownPieces: () => [],
  showDrafts: true,
  ...over,
});

const ids = (pieces: readonly Piece[]) => pieces.map((p) => p.chart.id).sort();

describe('PieceCatalogue', () => {
  it('offers drafts and the dev samples only when built to show drafts', () => {
    expect(ids(catalogue().list())).toEqual(['approved-tune', 'dev-sample', 'draft-tune']);
    const production = catalogue({ showDrafts: false });
    expect(ids(production.list())).toEqual(['approved-tune']);
    expect(production.find('draft-tune')).toBeUndefined();
    expect(production.find('approved-tune')?.chart.id).toBe('approved-tune');
  });

  it('still reserves the ids of the pieces the build left out, and those of the dev samples', () => {
    const production = catalogue({ files: [file('approved-tune', 'approved')], omittedIds: ['draft-tune'], devCharts: [] });
    expect(production.bundledIds().sort()).toEqual(['approved-tune', 'draft-tune']);
    expect(catalogue().bundledIds().sort()).toEqual(['approved-tune', 'dev-sample', 'draft-tune']);
  });

  it('parses the dev samples once and skips one that does not parse', () => {
    const pieces = catalogue({ devCharts: [tune('dev-sample'), { not: 'a chart' }] });
    expect(pieces.devSamples().map((c) => c.id)).toEqual(['dev-sample']);
    expect(pieces.devSamples()).toBe(pieces.devSamples());
  });

  it('lays out each piece once: a second call, and find, reuse the list', () => {
    const pieces = new PieceCatalogue({ ...bundledPieceSources(), ownPieces: () => [], showDrafts: true });
    const spy = vi.mocked(layoutStaff);
    const first = pieces.list();
    expect(first.length).toBeGreaterThan(0);
    spy.mockClear();
    const second = pieces.list();
    expect(second.map((p) => p.chart.id)).toEqual(first.map((p) => p.chart.id));
    expect(second).not.toBe(first); // a caller may sort or filter its copy
    expect(pieces.find(first[0]!.chart.id)?.chart).toBe(first[0]!.chart);
    expect(spy).not.toHaveBeenCalled();
  });

  it('a change to the own pieces builds the list again, laying out only the new piece', () => {
    let mine: Piece[] = [];
    const pieces = catalogue({ ownPieces: () => [...mine] }); // like OwnPieces.pieces(): a new array each call, the same charts
    pieces.list();
    const spy = vi.mocked(layoutStaff);
    spy.mockClear();
    mine = [own('my-own-tune')];
    expect(ids(pieces.list())).toContain('my-own-tune');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockClear();
    pieces.list(); // same own pieces in a new array: nothing laid out again
    expect(spy).not.toHaveBeenCalled();
    mine = [];
    expect(ids(pieces.list())).not.toContain('my-own-tune');
  });
});
