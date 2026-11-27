/**
 * A theory lesson as content (ft_1_39): the catalog topic it teaches, the topics it needs (d305), and its six steps. Show
 * is what Kiur plays (Copy asks the same notes back), Pitfall the classic mistake played once, Try and Check items made by a
 * generator, Play-along a short tune with the idea marked. Every line is a string key (d304: at most twelve words, naming and
 * pointing). A mark ties two of a step's notes and names what lies between them (a half or a whole step). Pure: no DOM, no
 * engine. Never saved.
 */
import { z } from 'zod';
import { Random } from '../random';
import { catalogTopicIds, type Catalog } from './catalog';

/** The lowest and highest key a lesson may write: the EZ-220's range. */
const KEY_RANGE = { low: 36, high: 96 } as const;

const keySchema = z.number().int().min(KEY_RANGE.low).max(KEY_RANGE.high);
const markSchema = z.object({ from: z.number().int().min(0), to: z.number().int().min(0), kind: z.enum(['half', 'whole']) });
const notesStep = z.object({ line: z.string().min(1), notes: z.array(keySchema).min(1), marks: z.array(markSchema) });

const itemsSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('step'), semitones: z.union([z.literal(1), z.literal(2)]), direction: z.enum(['up', 'down']) }),
  z.object({ kind: z.literal('majorScale') }),
]);

const lessonSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9-]+$/),
    topic: z.string().min(1),
    needs: z.array(z.string().min(1)),
    show: notesStep,
    pitfall: notesStep.extend({ reason: z.enum(['wrong-octave', 'neighbour-key', 'wrong-letter']) }),
    try: z.object({ line: z.string().min(1), items: itemsSchema }),
    playAlong: notesStep,
    check: z.object({ line: z.string().min(1), items: itemsSchema, count: z.number().int().min(1).max(20) }),
  })
  .strict();

export type Lesson = z.infer<typeof lessonSchema>;
export type LessonMark = z.infer<typeof markSchema>;
export type LessonItems = z.infer<typeof itemsSchema>;

/** One question: the notes shown on the staff, and the keys to play, in order. */
export interface LessonItem {
  shown: number[];
  answer: number[];
}

/** Semitones of the major scale from its tonic, one octave up. */
export const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11, 12] as const;

/**
 * Validate lessons against the catalog: each lesson's shape, a topic and needs the catalog knows, one lesson per topic,
 * every line a known string key (`isKey`), and every mark between two of its step's notes.
 */
export function loadLessons(jsons: readonly unknown[], catalog: Catalog, isKey: (key: string) => boolean): Lesson[] {
  const topics = new Set(catalogTopicIds(catalog));
  const taught = new Set<string>();
  return jsons.map((json) => {
    const lesson = lessonSchema.parse(json);
    for (const id of [lesson.topic, ...lesson.needs]) if (!topics.has(id)) throw new Error(`lesson ${lesson.id}: ${id} is not in the catalog`);
    if (taught.has(lesson.topic)) throw new Error(`lesson ${lesson.id}: a lesson for ${lesson.topic} exists already`);
    taught.add(lesson.topic);
    for (const line of [lesson.show.line, lesson.pitfall.line, lesson.try.line, lesson.playAlong.line, lesson.check.line]) {
      if (!isKey(line)) throw new Error(`lesson ${lesson.id}: the line ${line} has no string key`);
    }
    for (const step of [lesson.show, lesson.pitfall, lesson.playAlong]) {
      for (const mark of step.marks) {
        const from = step.notes[mark.from], to = step.notes[mark.to];
        if (from === undefined || to === undefined) throw new Error(`lesson ${lesson.id}: a mark past its notes`);
        if (Math.abs(to - from) !== (mark.kind === 'half' ? 1 : 2)) throw new Error(`lesson ${lesson.id}: a ${mark.kind} step mark between ${from} and ${to}`);
      }
    }
    return lesson;
  });
}

/**
 * `AX-3 provisional:` where step items are asked: the right hand from middle C, the shown note and the answer both between
 * B3 and D5, so the student reads them on the treble staff with no more than one ledger line.
 */
const STEP_STARTS = { up: { low: 60, high: 72 }, down: { low: 62, high: 74 } } as const;
/**
 * `AX-3 provisional:` the major scales asked, one octave up from the tonic in the right hand (up to A5): only the sharp keys
 * C, G, D, A and E for now, since lesson notes are bare MIDI and read with sharps (TODO(builder, R2) in ft_1_39).
 */
const SCALE_TONICS = [60, 67, 62, 69, 64] as const;

/**
 * `count` items of a generator, drawn by `seed` (the same seed gives the same items), never the same question twice in a row;
 * `after` is the shown start of the question just before them, if any.
 */
export function lessonItems(items: LessonItems, seed: string, count: number, after: number | null = null): LessonItem[] {
  const random = Random.derive('lesson', seed);
  const starts: readonly number[] =
    items.kind === 'majorScale'
      ? SCALE_TONICS
      : Array.from({ length: STEP_STARTS[items.direction].high - STEP_STARTS[items.direction].low + 1 }, (_, i) => STEP_STARTS[items.direction].low + i);
  const out: LessonItem[] = [];
  let previous: number | null = after;
  for (let i = 0; i < count; i++) {
    const start = random.pick(starts.filter((s) => s !== previous));
    previous = start;
    const answer = items.kind === 'majorScale' ? MAJOR_SCALE.map((s) => start + s) : [start + (items.direction === 'up' ? 1 : -1) * items.semitones];
    out.push({ shown: [start], answer });
  }
  return out;
}
