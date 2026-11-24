import { z } from 'zod';
import { strings, type StringKey } from '../text/strings.ts';

/**
 * The closed list of piece styles (core_05 item 1), kept as content in `content/pieces/styles.json`. A piece names
 * its styles in `styles` of its meta file; the linter refuses a word that is not here, and the info card shows the names.
 * Free `tags` stay for technique and provenance.
 */
const styleSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'use lowercase words joined by dashes'),
  nameKey: z.string(),
});

export const styleListSchema = z
  .object({
    schemaVersion: z.literal(1),
    note: z.string().optional(),
    styles: z.array(styleSchema).min(1),
  })
  .superRefine((list, ctx) => {
    const seen = new Set<string>();
    list.styles.forEach((style, i) => {
      if (seen.has(style.id)) ctx.addIssue({ code: 'custom', message: `style "${style.id}" is listed twice`, path: ['styles', i, 'id'] });
      if (!(style.nameKey in strings)) ctx.addIssue({ code: 'custom', message: `"${style.nameKey}" has no string in src/core/text/strings.ts`, path: ['styles', i, 'nameKey'] });
      seen.add(style.id);
    });
  });

export interface PieceStyle {
  id: string;
  nameKey: StringKey;
}

export interface StyleList {
  styles: PieceStyle[];
}

/** Check and read a style list file; throws with every problem when it is not valid. */
export function parseStyleList(raw: unknown): StyleList {
  const parsed = styleListSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`style list: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  return { styles: parsed.data.styles.map((s) => ({ id: s.id, nameKey: s.nameKey as StringKey })) };
}

/** The name keys of a piece's styles that the list knows, in the piece's order and without repeats. */
export function styleNameKeys(list: StyleList, ids: readonly string[]): StringKey[] {
  const keys = new Map(list.styles.map((s) => [s.id, s.nameKey]));
  return [...new Set(ids)].flatMap((id) => (keys.has(id) ? [keys.get(id)!] : []));
}
