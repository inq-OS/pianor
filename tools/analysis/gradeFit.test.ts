import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DIFFICULTY_WEIGHTS, upperPoints } from '../../src/core/piece/difficulty';
import { cipiManifest } from './cipi';
import { fitTail, gradeFitReport, gradeOf, scoreItems, targetPoints, type GradedScore } from './gradeFit';

const tmp = mkdtempSync(join(tmpdir(), 'pianor-grades-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** synthetic: `bars` bars of 4/4 at `bpm`, quarter notes climbing by `leap` steps of the C major scale, as MusicXML. */
function synthScore(bars: number, bpm: number, leap: number): string {
  const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const note = (k: number) => `<note><pitch><step>${steps[k % 7]}</step><octave>${4 + Math.floor((k % 14) / 7)}</octave></pitch><duration>1</duration><voice>1</voice></note>`;
  const measures = Array.from({ length: bars }, (_, b) => `<measure number="${b + 1}">${b === 0 ? `<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes><sound tempo="${bpm}"/>` : ''}${[0, 1, 2, 3].map((q) => note((b * 4 + q) * leap)).join('')}</measure>`);
  return `<score-partwise><part-list/><part id="P1">${measures.join('')}</part></score-partwise>`;
}

describe('fitting the points above Beginner to graded pieces (core_08.AC12)', () => {
  it('core_08.AC12 maps a label linearly onto the points, its lowest to 10 and its highest to 98', () => {
    const henle = { name: 'Henle', min: 1, max: 9 };
    expect(targetPoints(1, henle)).toBe(10);
    expect(targetPoints(9, henle)).toBe(98);
    expect(targetPoints(2, henle)).toBe(21);
    expect(targetPoints(5, henle)).toBe(54);
    expect(targetPoints(3, { min: 3, max: 3 })).toBe(10);
  });

  it('core_08.AC12 names the grade of a number of points, 20 to a grade', () => {
    expect([1, 20, 21, 40, 41, 61, 81, 100].map(gradeOf)).toEqual([0, 0, 1, 1, 2, 3, 4, 4]);
  });

  it('core_08.AC12 the game\'s points above Beginner are upperPoints with today\'s weights', () => {
    const { beginnerEnd, tail } = DIFFICULTY_WEIGHTS;
    expect(upperPoints(beginnerEnd, beginnerEnd, tail)).toBe(21);
    expect(upperPoints(beginnerEnd + 1000, beginnerEnd, tail)).toBe(100);
    expect(upperPoints(60, beginnerEnd, 20)).toBeGreaterThan(upperPoints(60, beginnerEnd, 80));
  });

  it('core_08.AC12 finds the tail that made a synthetic set, and reports how well it fits', () => {
    const scores = [24, 30, 38, 47, 58, 70, 85, 105, 130, 160];
    const items: GradedScore[] = scores.map((score, i) => ({ id: `w${i}`, label: 0, score, points: upperPoints(score, 21, 40) }));
    const fit = fitTail(items, 21);
    expect(fit.tail).toBeGreaterThan(37);
    expect(fit.tail).toBeLessThan(43);
    expect(fit.mae).toBeLessThan(1);
    expect(fit.sameGrade).toBe(1);
    expect(fit.used).toBe(10);
  });

  it('core_08.AC12 leaves out pieces that score as Beginner and counts those graded above it', () => {
    const items: GradedScore[] = [
      { id: 'easy', label: 1, score: 5, points: 10 },
      { id: 'misjudged', label: 4, score: 10, points: 43 },
      { id: 'hard', label: 9, score: 200, points: 98 },
    ];
    const fit = fitTail(items, 21);
    expect(fit.used).toBe(1);
    expect(fit.belowBeginnerEnd).toBe(1);
  });

  it('core_08.AC12 with nothing scored above Beginner keeps today\'s tail and says so', () => {
    const fit = fitTail([{ id: 'easy', label: 1, score: 5, points: 10 }], 21);
    expect(fit.used).toBe(0);
    expect(fit.tail).toBe(DIFFICULTY_WEIGHTS.tail);
  });

  it('core_08.AC12 scores a CIPI-shaped set, its hardest movement for a work, and prints the suggestion for a person to accept', () => {
    const dir = join(tmp, 'cipi');
    mkdirSync(join(dir, 'scores'), { recursive: true });
    const works = [
      { id: 'a', composer: 'X', henle: 1, movements: [[4, 60, 1]] },
      { id: 'b', composer: 'Y', henle: 5, movements: [[16, 120, 2], [16, 160, 3]] },
      { id: 'c', composer: 'Z', henle: 9, movements: [[32, 200, 4]] },
      { id: 'd', composer: 'Z', henle: 3, movements: [] },
    ];
    const index: Record<string, unknown> = {};
    for (const w of works) {
      const path: Record<string, string> = {};
      w.movements.forEach(([bars, bpm, leap], m) => {
        const file = `scores/${w.id}-${m}.musicxml`;
        writeFileSync(join(dir, file), synthScore(bars!, bpm!, leap!));
        path[String(m + 1)] = file;
      });
      index[w.id] = { composer: w.composer, henle: w.henle, path };
    }
    const { manifest, skipped } = cipiManifest(index);
    expect(skipped.map((s) => s.id)).toEqual(['d']);
    const scored = scoreItems(manifest, dir);
    expect(scored.skipped).toEqual([]);
    const b = scored.items.find((i) => i.id === 'b')!;
    expect(b.points).toBe(54);
    expect(scored.items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(scored.items.find((i) => i.id === 'a')!.score).toBeLessThan(b.score);

    const lines = gradeFitReport(manifest.name, fitTail(scored.items, DIFFICULTY_WEIGHTS.beginnerEnd), scored.skipped);
    expect(lines[0]).toContain('CIPI: 3 item(s)');
    expect(lines.join('\n')).toMatch(/tail [\d.]+ \(today \d+\)/);
    expect(lines.join('\n')).toContain('DIFFICULTY_WEIGHTS');
  });
});
