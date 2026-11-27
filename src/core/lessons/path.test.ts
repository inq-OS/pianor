// Covers ft_1_39.AC2.
import { describe, expect, it } from 'vitest';
import catalogJson from '../../../content/lessons/catalog.json';
import halfStep from '../../../content/lessons/half-step.json';
import majorScale from '../../../content/lessons/major-scale.json';
import wholeStep from '../../../content/lessons/whole-step.json';
import { strings } from '../text/strings.ts';
import { loadCatalog } from './catalog.ts';
import { loadLessons } from './lesson.ts';
import { suggestedLesson } from './path.ts';

const lessons = loadLessons([majorScale, wholeStep, halfStep], loadCatalog(catalogJson), (k) => k in strings);

describe('the suggested next lesson (ft_1_39 rule 13)', () => {
  it('ft_1_39.AC2 suggests the first ready lesson by catalog order; a need with no lesson written does not hold it back', () => {
    expect(suggestedLesson(lessons, new Set())?.topic).toBe('D1');
    expect(suggestedLesson(lessons, new Set(['D1']))?.topic).toBe('D2');
    // E1 needs D2 and D3; D3 has no lesson yet
    expect(suggestedLesson(lessons, new Set(['D1', 'D2']))?.topic).toBe('E1');
    expect(suggestedLesson(lessons, new Set(['D1', 'D2', 'E1']))).toBeNull();
  });

  it('ft_1_39.AC2 suggests, never locks: a lesson whose needs have no medal is still in the list', () => {
    expect(lessons.map((l) => l.topic).sort()).toEqual(['D1', 'D2', 'E1']);
  });
});
