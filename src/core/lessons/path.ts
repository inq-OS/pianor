/**
 * The path through the lessons (ft_1_39 rule 13, d305): a lesson is ready once every lesson it needs has a medal, and the
 * book suggests a ready lesson. Nothing is locked: the suggestion only marks one lesson. Pure: no DOM, no engine.
 */
import type { Lesson } from './lesson';

/**
 * `AX-3 provisional:` the suggested next lesson, until the stages are data (slice 2): the first lesson by catalog id with no
 * medal whose needed lessons all have one; a needed topic with no written lesson does not hold it back. Null when every
 * lesson has a medal. `medals` holds the topics whose lesson has one.
 */
export function suggestedLesson(lessons: readonly Lesson[], medals: ReadonlySet<string>): Lesson | null {
  const written = new Set(lessons.map((l) => l.topic));
  const byId = [...lessons].sort((a, b) => a.topic.localeCompare(b.topic, 'en', { numeric: true }));
  return byId.find((l) => !medals.has(l.topic) && l.needs.every((id) => !written.has(id) || medals.has(id))) ?? null;
}
