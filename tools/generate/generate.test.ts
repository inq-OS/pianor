// Covers ft_0_12.AC1, ft_0_12.AC2.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pieceMetaSchema } from '../../src/core/chart';
import { layoutStaff } from '../../src/core/layout/staff';
import { listPieceFolders } from '../piece/folder';
import { loadLevelsFile } from '../piece/levels';
import { GENERATOR_KINDS, BadRequest, GenerateError, generatePiece, pieceId, regenerate, type GenerateRequest, type GeneratorKind } from './index';
import { melodiesOf, referenceWindows, sharesWindow, windowKeys } from './similarity';
import { checkPiece } from '../../src/core/piece/check';
import { contentStyles } from '../piece/styles';

const root = join(__dirname, '../..');
const { levels } = loadLevelsFile(join(root, 'content/curriculum/levels.json'));
const context = { levels };

/** Every kind at every level, for every hand the level plays and every meter it allows. */
const cases: { kind: GeneratorKind; level: number; hand: 'RH' | 'LH' | 'both'; meter: string }[] = [];
for (const kind of GENERATOR_KINDS) {
  for (const lv of levels) {
    for (const meter of lv.meters.map((m) => `${m.num}/${m.den}`)) {
      for (const hand of lv.hands) cases.push({ kind, level: lv.level, hand, meter });
      if (kind === 'echo' && lv.hands.length > 1) cases.push({ kind, level: lv.level, hand: 'both', meter });
    }
  }
}

const request = (c: (typeof cases)[number], seed: number): GenerateRequest => ({ kind: c.kind, level: c.level, seed, hand: c.hand, ...(c.meter === '4/4' && c.level !== 3 ? {} : { meter: c.meter }) });

const SEEDS_PER_CASE = 3;
/** Seeds for the case at `index`: three of 1 to 12, four apart, starting one further on for each case. */
const seedsFor = (index: number): number[] => Array.from({ length: SEEDS_PER_CASE }, (_, k) => 1 + ((index + 4 * k) % 12));

describe('every generator, at every level the table has', () => {
  it('has a case for each kind, level, hand and meter', () => {
    expect(new Set(cases.map((c) => c.kind))).toEqual(new Set(GENERATOR_KINDS));
    expect(cases.length).toBeGreaterThan(60);
  });

  it('still uses every seed from 1 to 12 for every kind, three to a case', () => {
    for (const kind of GENERATOR_KINDS) {
      const used = new Set(cases.flatMap((c, i) => (c.kind === kind ? seedsFor(i) : [])));
      expect([...used].sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, k) => k + 1));
    }
    expect(new Set(seedsFor(0)).size).toBe(SEEDS_PER_CASE);
  });

  it('makes pieces that pass piece:lint with no error and no warning, for many seeds (property)', () => {
    const failures: string[] = [];
    let made = 0;
    // Three seeds per case, shifted from case to case so that seeds 1 to 12 are all still used at every kind;
    // all twelve on every case made a thousand pieces and timed out in CI under coverage.
    cases.forEach((c, i) => {
      for (const seed of seedsFor(i)) {
        try {
          const piece = generatePiece(request(c, seed), context);
          made++;
          const again = checkPiece({ styles: contentStyles, folder: piece.id, abc: piece.abc, meta: piece.metaJson, levels });
          if (again.diagnostics.length > 0 || !again.ok) failures.push(`${piece.id}: ${again.diagnostics[0]?.message}`);
          // a piece the staff cannot draw is left out of the game, so every generated piece must be drawn on every screen
          for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 600 }]) {
            try {
              if (!layoutStaff(piece.check.compiled.chart!, { viewport }).fits) failures.push(`${piece.id}: does not fit ${viewport.width}x${viewport.height}`);
            } catch (e) {
              failures.push(`${piece.id}: cannot be drawn: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        } catch (e) {
          failures.push(`${c.kind} L${c.level} ${c.hand} ${c.meter} seed ${seed}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    });
    expect(failures.slice(0, 25)).toEqual([]);
    expect(made).toBe(cases.length * SEEDS_PER_CASE);
    // compiled, linted and laid out; under coverage in CI the old twelve seeds came near two minutes and passed
    // them twice on a busy day, so the limit stays well above that
  }, 300_000);
});

describe('the same seed gives the same piece', () => {
  it('byte for byte, for every kind, and a different seed gives a different piece', () => {
    for (const kind of GENERATOR_KINDS) {
      const a = generatePiece({ kind, level: 1, seed: 7 }, context);
      const b = generatePiece({ kind, level: 1, seed: 7 }, context);
      expect(b.abc).toBe(a.abc);
      expect(b.metaJson).toBe(a.metaJson);
      expect(b.id).toBe(a.id);
    }
    const abcs = new Set(Array.from({ length: 20 }, (_, seed) => generatePiece({ kind: 'reading-drill', level: 1, seed }, context).abc));
    expect(abcs.size).toBeGreaterThan(15);
  });

  it('a seed written as text is a seed too, and the number 12 and the text "12" are one seed', () => {
    const text = generatePiece({ kind: 'phrase', level: 1, seed: 'rainy day' }, context);
    expect(text.id).toContain('s-rainy-day'.replace('s-', 's'));
    expect(text.title).toBe('Little Tune 1.rainy-day');
    expect(generatePiece({ kind: 'echo', level: 1, seed: 12 }, context).abc).toBe(generatePiece({ kind: 'echo', level: 1, seed: '12' }, context).abc);
  });
});

describe('what a generated piece is', () => {
  const piece = generatePiece({ kind: 'five-finger', level: 1, seed: 3 }, context);
  const meta = pieceMetaSchema.parse(JSON.parse(piece.metaJson));

  it('is a draft with an id, a title, its source and a licence, and a record of how to make it again', () => {
    expect(meta).toMatchObject({ id: 'gen-five-finger-l1-rh-s3', title: 'Finger Walk 1.3', level: 1, status: 'draft', hands: ['RH'], license: 'CC0-1.0' });
    expect(meta.source).toContain('generated');
    expect(meta.generator).toEqual({ kind: 'five-finger', seed: 3, params: { level: 1 } });
    expect(meta.tags).toEqual(expect.arrayContaining(['generated', 'five-finger']));
    expect(piece.attempts).toBeGreaterThanOrEqual(1);
  });

  it('has the style "exercise" from the closed list, not a style word in its tags', () => {
    expect(meta.styles).toEqual(['exercise']);
  });

  it('is plain ABC a person can read and change, with fingerings from the level and a closing bar line', () => {
    expect(piece.abc).toMatch(/^X:1\nT:Finger Walk 1\.3\nM:4\/4\nL:1\/4\nQ:1\/4=66\nK:C\n% /);
    expect(piece.abc).toContain('!1!C');
    expect(piece.abc.trimEnd().endsWith('|]')).toBe(true);
  });

  it('has phrases of two bars or more, inside the piece', () => {
    for (const phrase of meta.phrases) {
      expect(phrase.bars[1] - phrase.bars[0] + 1).toBeGreaterThanOrEqual(2);
      expect(phrase.bars[1]).toBeLessThanOrEqual(piece.check.compiled.chart!.bars.length);
    }
  });

  it('ends on the tonic, in the last bar', () => {
    for (const kind of GENERATOR_KINDS) {
      const chart = generatePiece({ kind, level: 2, seed: 5 }, context).check.compiled.chart!;
      for (const melody of melodiesOf(chart)) expect(melody.at(-1)!.midi % 12).toBe(0);
    }
  });

  it('puts the id in the folder-name form the piece loader requires', () => {
    expect(pieceId({ kind: 'echo', level: 4, seed: 'A b', bars: 8, meter: '3/4', pattern: 'runs', motif: '0 1' }, 'both')).toMatch(/^gen-echo-l4-both-sa-b-b8-m34-runs-mo[a-z0-9]{1,4}$/);
    for (const c of cases.slice(0, 40)) expect(pieceId({ kind: c.kind, level: c.level, seed: 1 }, 'rh')).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe('each kind does what it says', () => {
  const chartOf = (r: GenerateRequest) => generatePiece(r, context).check.compiled.chart!;

  it('five-finger stays in the hand position and uses the fingers the level lists', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const chart = chartOf({ kind: 'five-finger', level: 1, seed });
      expect(chart.notes.every((n) => n.midi >= 60 && n.midi <= 67)).toBe(true);
      expect(chart.notes.every((n) => n.finger !== undefined)).toBe(true);
    }
  });

  it('five-finger skips only where the level allows a third, and says so when asked for a pattern it cannot make', () => {
    expect(() => generatePiece({ kind: 'five-finger', level: 1, seed: 1, pattern: 'skips' }, context)).toThrow(BadRequest);
    const chart = chartOf({ kind: 'five-finger', level: 3, seed: 1, pattern: 'skips' });
    const m = melodiesOf(chart)[0]!;
    expect(m.slice(1).some((n, i) => Math.abs(n.midi - m[i]!.midi) >= 3)).toBe(true);
  });

  it('five-finger pairs plays most notes twice in a row', () => {
    const m = melodiesOf(chartOf({ kind: 'five-finger', level: 1, seed: 4, pattern: 'pairs' }))[0]!;
    const repeats = m.slice(1).filter((n, i) => n.midi === m[i]!.midi).length;
    expect(repeats).toBeGreaterThanOrEqual(Math.floor(m.length / 2) - 2);
  });

  it('scale climbs to the top of the register and comes back down, note by note', () => {
    const m = melodiesOf(chartOf({ kind: 'scale', level: 5, seed: 2 }))[0]!;
    const midis = m.map((n) => n.midi);
    expect(Math.min(...midis)).toBe(60);
    expect(Math.max(...midis)).toBe(72);
    const peak = midis.indexOf(72);
    expect(midis.slice(0, peak + 1)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    expect(midis.slice(peak)).toEqual([72, 71, 69, 67, 65, 64, 62, 60]);
    const lh = melodiesOf(chartOf({ kind: 'scale', level: 5, seed: 2, hand: 'LH' }))[0]!.map((n) => n.midi);
    expect([Math.min(...lh), Math.max(...lh)]).toEqual([48, 60]);
  });

  it('a scale that leaves the hand position writes no finger that would strand the hand (ft_1_30.AC8)', () => {
    const notes = chartOf({ kind: 'scale', level: 5, seed: 2 }).notes;
    const g4 = notes.filter((n) => n.midi === 67);
    expect(g4.every((n) => n.finger !== 5)).toBe(true);
    // the first notes of the climb keep the position's fingers
    expect(notes.slice(0, 3).map((n) => n.finger)).toEqual([1, 2, 3]);
    // inside the position every note keeps the table's finger
    const position = chartOf({ kind: 'five-finger', level: 1, seed: 3 }).notes;
    const table: Record<number, number> = { 60: 1, 62: 2, 64: 3, 65: 4, 67: 5 };
    expect(position.map((n) => n.finger)).toEqual(position.map((n) => table[n.midi]));
  });

  it('scale at level 1 is the five notes of the position', () => {
    const midis = melodiesOf(chartOf({ kind: 'scale', level: 1, seed: 9 }))[0]!.map((n) => n.midi);
    expect([...new Set(midis)].sort((a, b) => a - b)).toEqual([60, 62, 64, 65, 67]);
  });

  it('reading-drill visits most of the notes and has rests now and then (every level allows them)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const l1 = chartOf({ kind: 'reading-drill', level: 1, seed });
      expect(new Set(l1.notes.map((n) => n.midi)).size).toBeGreaterThanOrEqual(4);
    }
    const withRests = Array.from({ length: 30 }, (_, seed) => chartOf({ kind: 'reading-drill', level: 3, seed })).filter((c) => c.rests.length > 0);
    expect(withRests.length).toBeGreaterThan(5);
  });

  it('reading-drill at level 5 uses eighth notes now and then, in pairs on a beat, and the staff draws every one', () => {
    let withEighths = 0;
    for (let seed = 0; seed < 30; seed++) {
      const chart = chartOf({ kind: 'reading-drill', level: 5, seed });
      const eighths = chart.notes.filter((n) => n.dur === 240);
      if (eighths.length > 0) withEighths++;
      expect(eighths.every((n) => (n.tick % 480 === 0 ? chart.notes.some((m) => m.tick === n.tick + 240 && m.dur === 240) : chart.notes.some((m) => m.tick === n.tick - 240 && m.dur === 240)))).toBe(true);
      expect(layoutStaff(chart, { viewport: { width: 1366, height: 768 } }).fits).toBe(true);
    }
    expect(withEighths).toBeGreaterThan(5);
  });

  it('the staff draws the eighths of a generated piece as beamed pairs (it once could not draw them)', () => {
    const seed = Array.from({ length: 30 }, (_, i) => i + 1).find((n) => chartOf({ kind: 'reading-drill', level: 5, seed: n }).notes.some((m) => m.dur === 240));
    expect(seed).toBeDefined();
    const chart = chartOf({ kind: 'reading-drill', level: 5, seed: seed! });
    const eighths = chart.notes.filter((n) => n.dur === 240).length;
    expect(layoutStaff(chart, { viewport: { width: 1280, height: 720 } }).beams.length).toBe(eighths / 2);
  });

  it('echo repeats each call bar\'s rhythm in the bar after it', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const chart = chartOf({ kind: 'echo', level: 1, seed, bars: 8 });
      for (let pair = 0; pair < 4; pair++) {
        const rhythm = (bar: number) => chart.notes.filter((n) => n.bar === bar).map((n) => [n.tick - chart.bars[bar]!.startTick, n.dur]);
        expect(rhythm(pair * 2 + 1)).toEqual(rhythm(pair * 2));
      }
    }
  });

  it('echo with both hands: the right hand calls, the left answers the same notes an octave lower, and never together', () => {
    const chart = chartOf({ kind: 'echo', level: 4, seed: 6, hand: 'both' });
    expect(chart.tracks.filter((t) => t.role === 'play').map((t) => t.hand)).toEqual(['RH', 'LH']);
    const rh = chart.notes.filter((n) => n.track === 'rh');
    const lh = chart.notes.filter((n) => n.track === 'lh');
    expect(lh.map((n) => n.midi + 12)).toEqual(rh.map((n) => n.midi));
    expect(rh.every((n) => n.bar % 2 === 0)).toBe(true);
    expect(lh.every((n) => n.bar % 2 === 1)).toBe(true);
    expect(chart.rests.filter((r) => r.dur === 1920)).toHaveLength(8); // 8 bars: each hand waits through 4 of them with a whole-bar rest
  });

  it('echo needs an even number of bars, and a level with two hands to use both', () => {
    expect(() => generatePiece({ kind: 'echo', level: 1, seed: 1, bars: 5 }, context)).toThrow(BadRequest);
    expect(() => generatePiece({ kind: 'echo', level: 1, seed: 1, hand: 'both' }, context)).toThrow(BadRequest);
  });

  it('phrase makes four bars from a motif, or eight with a question and an answer', () => {
    const four = chartOf({ kind: 'phrase', level: 1, seed: 1, bars: 4 });
    expect(four.bars).toHaveLength(4);
    const eight = chartOf({ kind: 'phrase', level: 1, seed: 1, bars: 8 });
    expect(eight.bars).toHaveLength(8);
    expect(eight.phrases.map((p) => p.name)).toEqual(['Question', 'Answer']);
    // the question stops away from home; the answer comes home
    const m = melodiesOf(eight)[0]!;
    const lastOfBar4 = eight.notes.filter((n) => n.bar === 3).at(-1)!;
    expect(lastOfBar4.midi).not.toBe(60);
    expect(m.at(-1)!.midi).toBe(60);
  });

  it('phrase starts with the motif it is given, and says what is wrong with one that does not fit', () => {
    const chart = chartOf({ kind: 'phrase', level: 1, seed: 2, bars: 4, motif: '0 1 2 1' });
    expect(chart.notes.filter((n) => n.bar === 0).map((n) => n.midi)).toEqual([60, 62, 64, 62]);
    expect(() => generatePiece({ kind: 'phrase', level: 1, seed: 2, motif: '0 1 2' }, context)).toThrow(/needs 4 notes/);
    expect(() => generatePiece({ kind: 'phrase', level: 1, seed: 2, motif: '0 1 2 9' }, context)).toThrow(/degrees 0 to 4/);
    expect(() => generatePiece({ kind: 'phrase', level: 1, seed: 2, motif: 'C D E F' }, context)).toThrow(/whole numbers/);
  });
});

describe('requests that cannot be met', () => {
  it('say which part of the request is wrong', () => {
    expect(() => generatePiece({ kind: 'nope' as GeneratorKind, level: 1, seed: 1 }, context)).toThrow(/unknown generator/);
    expect(() => generatePiece({ kind: 'scale', level: 99, seed: 1 }, context)).toThrow(/level 99/);
    expect(() => generatePiece({ kind: 'scale', level: 1, seed: 1, hand: 'LH' }, context)).toThrow(/does not use the left hand/);
    expect(() => generatePiece({ kind: 'scale', level: 1, seed: 1, meter: '3/4' }, context)).toThrow(/meter/);
    expect(() => generatePiece({ kind: 'scale', level: 1, seed: 1, bars: 2 }, context)).toThrow(/outside level 1/);
    expect(() => generatePiece({ kind: 'five-finger', level: 1, seed: 1, pattern: 'zigzag' as 'runs' }, context)).toThrow(/pattern/);
  });
});

describe('never copying a melody', () => {
  const pieceDir = join(root, 'content/pieces');
  const reference = (() => {
    const charts = listPieceFolders(pieceDir).flatMap((folder) => {
      const meta = JSON.parse(readFileSync(join(pieceDir, folder, 'piece.meta.json'), 'utf-8')) as { generator?: { kind?: string } };
      if (GENERATOR_KINDS.includes(meta.generator?.kind as GeneratorKind)) return [];
      const abc = readFileSync(join(pieceDir, folder, 'piece.abc'), 'utf-8');
      const check = checkPiece({ styles: contentStyles, folder, abc, meta: readFileSync(join(pieceDir, folder, 'piece.meta.json'), 'utf-8'), levels });
      return check.compiled.chart ? [check.compiled.chart] : [];
    });
    return referenceWindows(charts);
  })();

  it('has the known tunes of the repository to avoid', () => {
    expect(reference.size).toBeGreaterThan(40);
  });

  it('keeps all eight-note runs of the known tunes out of everything it makes (property)', () => {
    let shared = 0;
    for (const kind of GENERATOR_KINDS) {
      for (const lv of [1, 2, 3, 4, 5]) {
        for (let seed = 1; seed <= 15; seed++) {
          const piece = generatePiece({ kind, level: lv, seed }, { levels, avoid: reference });
          if (melodiesOf(piece.check.compiled.chart!).some((m) => sharesWindow(m, reference))) shared++;
        }
      }
    }
    expect(shared).toBe(0);
  }, 120_000);

  it('really rejects a candidate that repeats a known melody, and tries again', () => {
    const first = generatePiece({ kind: 'reading-drill', level: 1, seed: 3 }, context);
    const own = new Set<string>();
    for (const m of melodiesOf(first.check.compiled.chart!)) for (const key of windowKeys(m)) own.add(key);
    const second = generatePiece({ kind: 'reading-drill', level: 1, seed: 3 }, { levels, avoid: own });
    expect(second.abc).not.toBe(first.abc);
    expect(second.attempts).toBeGreaterThan(1);
    expect(melodiesOf(second.check.compiled.chart!).some((m) => sharesWindow(m, own))).toBe(false);
  });

  it('gives up with a clear message when every candidate would copy', () => {
    // find a request whose first candidate passes, then forbid exactly that candidate and allow only one try
    let seed = 1;
    let first = generatePiece({ kind: 'five-finger', level: 1, seed }, context);
    while (first.attempts > 1) first = generatePiece({ kind: 'five-finger', level: 1, seed: ++seed }, context);
    const own = new Set<string>();
    for (const m of melodiesOf(first.check.compiled.chart!)) for (const key of windowKeys(m)) own.add(key);
    expect(() => generatePiece({ kind: 'five-finger', level: 1, seed }, { levels, avoid: own, maxAttempts: 1 })).toThrow(/copies eight notes of an existing melody/);
    expect(() => generatePiece({ kind: 'five-finger', level: 1, seed }, { levels, avoid: own, maxAttempts: 1 })).toThrow(GenerateError);
  });

  it('has no melody of its own: the generator source reads no files and holds no tune', () => {
    const files = readdirSync(__dirname).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'cli.ts' && f !== 'run.ts');
    for (const file of files) {
      const text = readFileSync(join(__dirname, file), 'utf-8');
      expect(text, file).not.toMatch(/from 'node:|readFileSync|content\/pieces|\.abc'/);
    }
  });
});

describe('regenerate', () => {
  it('makes the same piece again from what its meta file records', () => {
    for (const r of [
      { kind: 'phrase', level: 3, seed: 'x1', bars: 8, motif: '0 1 2 1' },
      { kind: 'echo', level: 4, seed: 21, hand: 'both' },
      { kind: 'scale', level: 5, seed: 8, hand: 'LH', meter: '3/4' },
      { kind: 'five-finger', level: 3, seed: 5, pattern: 'skips' },
    ] as GenerateRequest[]) {
      const original = generatePiece(r, context);
      const meta = pieceMetaSchema.parse(JSON.parse(original.metaJson));
      const again = regenerate(meta, context);
      expect(again.abc).toBe(original.abc);
      expect(again.metaJson).toBe(original.metaJson);
    }
  });

  it('refuses a piece that no generator made, or one without a seed', () => {
    const base = pieceMetaSchema.parse({ id: 'x', title: 'X', level: 1, status: 'draft', hands: ['RH'], phrases: [], source: 's', license: 'CC0-1.0', generator: { kind: 'manual' } });
    expect(() => regenerate(base, context)).toThrow(/not a generator/);
    expect(() => regenerate({ ...base, generator: { kind: 'scale' } }, context)).toThrow(/seed/);
  });
});
