import { readFileSync } from 'node:fs';
import { parseLevels, type LoadedLevels } from '../../src/core/piece/levelsTable.ts';

export { parseLevels, type LoadedLevels };

export function loadLevelsFile(path: string): LoadedLevels {
  return parseLevels(readFileSync(path, 'utf-8'), path);
}
