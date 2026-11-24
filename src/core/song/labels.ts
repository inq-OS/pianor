import { z } from 'zod';

/** The ready-made list of part labels (ft_1_36 rule 16, `content/songs/labels.json`); each shows by the string key `song.label.<word>`. */
export const songLabelsSchema = z.strictObject({
  schemaVersion: z.literal(1),
  labels: z.array(z.string().regex(/^[a-z]+(-[a-z]+)*$/)).min(1),
});
