// Covers ft_1_39.AC2, ft_1_39.AC6.
import { describe, expect, it } from 'vitest';
import catalogJson from '../../../content/lessons/catalog.json';
import halfStep from '../../../content/lessons/half-step.json';
import majorScale from '../../../content/lessons/major-scale.json';
import wholeStep from '../../../content/lessons/whole-step.json';
import { strings } from '../text/strings.ts';
import { loadCatalog } from './catalog.ts';
import { lessonItems, loadLessons, MAJOR_SCALE, type LessonItems } from './lesson.ts';

const catalog = loadCatalog(catalogJson);
const known = (key: string) => key in strings;
const all = [halfStep, wholeStep, majorScale];

describe('lessons as content (ft_1_39.AC6)', () => {
  it('ft_1_39.AC6 loads the first three lessons, each naming the catalog topic it teaches and the ones it needs', () => {
    const lessons = loadLessons(all, catalog, known);
    expect(lessons.map((l) => l.topic)).toEqual(['D1', 'D2', 'E1']);
    expect(lessons.find((l) => l.topic === 'E1')?.needs).toEqual(['D2', 'D3']);
  });

  it('ft_1_39.AC6 refuses a lesson naming a topic or a need the catalog does not know', () => {
    expect(() => loadLessons([{ ...halfStep, topic: 'Z9' }], catalog, known)).toThrow(/Z9/);
    expect(() => loadLessons([{ ...halfStep, needs: ['A1', 'Q99'] }], catalog, known)).toThrow(/Q99/);
  });

  it('refuses two lessons for one topic, a line with no string key, a mark past its notes and another version', () => {
    expect(() => loadLessons([halfStep, { ...halfStep, id: 'again' }], catalog, known)).toThrow(/D1/);
    expect(() => loadLessons([{ ...halfStep, show: { ...halfStep.show, line: 'lessons.no.such.line' } }], catalog, known)).toThrow(/lessons\.no\.such\.line/);
    expect(() => loadLessons([{ ...halfStep, show: { ...halfStep.show, marks: [{ from: 0, to: 99, kind: 'half' }] } }], catalog, known)).toThrow(/mark/);
    expect(() => loadLessons([{ ...halfStep, schemaVersion: 2 }], catalog, known)).toThrow();
  });

  it('ft_1_39.AC2 has no level, range or lock field: a lesson opens for every player', () => {
    for (const lesson of loadLessons(all, catalog, known)) expect(Object.keys(lesson).sort()).toEqual(['check', 'id', 'needs', 'pitfall', 'playAlong', 'schemaVersion', 'show', 'topic', 'try']);
  });
});

describe('lessonItems', () => {
  const step = (semitones: 1 | 2, direction: 'up' | 'down'): LessonItems => ({ kind: 'step', semitones, direction });

  it('makes step items whose answer is the shown note moved by the step, the same seed giving the same items', () => {
    const items = lessonItems(step(1, 'up'), 'seed', 20);
    expect(items).toEqual(lessonItems(step(1, 'up'), 'seed', 20));
    for (const item of items) expect(item.answer).toEqual([item.shown[0]! + 1]);
    for (const item of lessonItems(step(2, 'down'), 's', 20)) expect(item.answer).toEqual([item.shown[0]! - 2]);
  });

  it('never asks the same note twice in a row and stays in the right hand from middle C', () => {
    const items = lessonItems(step(1, 'up'), 'x', 40);
    for (let i = 1; i < items.length; i++) expect(items[i]!.shown).not.toEqual(items[i - 1]!.shown);
    for (const item of items) for (const k of [...item.shown, ...item.answer]) expect(k >= 59 && k <= 74, String(k)).toBe(true);
  });

  it('asks the E and H half steps among the others, the classic mistake (pitfall)', () => {
    const starts = new Set(lessonItems(step(1, 'up'), 'y', 60).map((i) => i.shown[0]));
    expect(starts.has(64) && starts.has(71)).toBe(true);
  });

  it('makes major scale items: the tonic shown, the scale one octave up as the answer', () => {
    for (const item of lessonItems({ kind: 'majorScale' }, 'z', 10)) {
      expect(item.answer).toEqual(MAJOR_SCALE.map((i) => item.shown[0]! + i));
    }
  });
});
