import { PIECE_HIGH, PIECE_LOW, levelsFileSchema, parseNoteName, type LevelDefinition } from '../chart';
import { formatIssues } from '../issues';
import type { Diagnostic } from './diagnostics';

const KEYBOARD_LOW = PIECE_LOW;
const KEYBOARD_HIGH = PIECE_HIGH;

export interface LoadedLevels {
  levels: LevelDefinition[];
  diagnostics: Diagnostic[];
}

/** Read and check `content/curriculum/levels.json`. Problems in the table are errors: every lint result depends on it. */
export function parseLevels(text: string, file = 'levels.json'): LoadedLevels {
  const diagnostics: Diagnostic[] = [];
  const error = (message: string) => void diagnostics.push({ severity: 'error', file, message });

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    error(`not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    return { levels: [], diagnostics };
  }
  const parsed = levelsFileSchema.safeParse(raw);
  if (!parsed.success) {
    for (const line of formatIssues(parsed.error)) error(line);
    return { levels: [], diagnostics };
  }

  const seen = new Set<number>();
  for (const level of parsed.data.levels) {
    const at = `level ${level.level}`;
    if (seen.has(level.level)) error(`${at} appears twice`);
    seen.add(level.level);
    if (level.range.low > level.range.high) error(`${at}: range low is above high`);
    if (level.range.low < KEYBOARD_LOW || level.range.high > KEYBOARD_HIGH) {
      error(`${at}: range ${level.range.low} to ${level.range.high} is outside the keys a piece may use (${KEYBOARD_LOW} to ${KEYBOARD_HIGH})`);
    }
    if (level.bars.min > level.bars.max) error(`${at}: bars min is above max`);
    for (const [hand, notes] of Object.entries(level.fingerings)) {
      if (!level.hands.includes(hand as 'RH' | 'LH')) error(`${at}: fingerings for ${hand}, which is not one of the level's hands`);
      for (const name of Object.keys(notes)) {
        try {
          parseNoteName(name);
        } catch {
          error(`${at}: "${name}" in the ${hand} fingerings is not a note name like C4`);
        }
      }
    }
  }
  const numbers = parsed.data.levels.map((l) => l.level);
  if (numbers.some((n, i) => i > 0 && n <= numbers[i - 1]!)) error('levels must be listed in increasing order');
  return { levels: parsed.data.levels, diagnostics };
}

const ALL_KEYS = [-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7];

/**
 * The levels as a piece outside the curriculum is checked against: an own piece from the editor or a piece of the private
 * folder (no limits on them). Chords, accidentals and every key pass; the rest of each level still says how far the
 * piece is from it, and its problems are shown, never a reason to leave the piece out (ft_Y_04 slice 2).
 */
export function unlimitedLevels(levels: readonly LevelDefinition[]): LevelDefinition[] {
  return levels.map((l) => ({ ...l, chords: true, accidentals: true, keys: ALL_KEYS, voices: 2 }));
}
