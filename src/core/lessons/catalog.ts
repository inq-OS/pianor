/**
 * The learning catalog as data (ft_1_39, d303): every topic a piano student can learn, by area, each with a fixed id and
 * what the game can do for it today. The lesson book lists every topic; one with no lesson is a ghosted placeholder. The
 * same list is `docs/theory/learning-catalog.md`, and a test keeps the two equal. Pure: no DOM, no engine. Never saved.
 */
import { z } from 'zod';

export const TOPIC_STATUSES = ['trained', 'drawn', 'needs drawing', 'needs a feature', 'idea'] as const;

const topicSchema = z.object({ id: z.string().regex(/^[A-R]\d+$/), status: z.enum(TOPIC_STATUSES) });
const areaSchema = z.object({ id: z.string().regex(/^[A-R]$/), topics: z.array(topicSchema).min(1) });
const catalogSchema = z.object({ schemaVersion: z.literal(1), note: z.string().optional(), areas: z.array(areaSchema).min(1) });

export type Catalog = z.infer<typeof catalogSchema>;

/** Validate the catalog: its shape, every topic id under its own area's letter, and no id twice. */
export function loadCatalog(json: unknown): Catalog {
  const catalog = catalogSchema.parse(json);
  const seen = new Set<string>();
  for (const area of catalog.areas) {
    for (const topic of area.topics) {
      if (!topic.id.startsWith(area.id)) throw new Error(`catalog topic ${topic.id} is not in area ${area.id}`);
      if (seen.has(topic.id)) throw new Error(`catalog topic ${topic.id} is listed twice`);
      seen.add(topic.id);
    }
  }
  return catalog;
}

export const catalogTopicIds = (catalog: Catalog): string[] => catalog.areas.flatMap((a) => a.topics.map((t) => t.id));

/** The string key of a topic's name, and of an area's. */
export const topicNameKey = (id: string): string => `lessons.topic.${id}`;
export const areaNameKey = (id: string): string => `lessons.area.${id}`;
