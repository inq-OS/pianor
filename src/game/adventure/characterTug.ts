import type { Chart } from '../../core/chart';
import type { CharacterDef } from '../../core/character/character';
import { DEFAULT_EVALUATION_RULES } from '../../core/curriculum/evaluate';
import { cleanPlaysSince, playResultsFromLog } from '../../core/curriculum/fromLog';
import { tugGate, type TugGate } from '../../core/exchange/tugGate';
import { tugLevelFor } from '../../core/exchange/tugPlay';
import type { WorldState } from '../../core/island/worldState';
import type { PracticeLog } from '../../core/progression/practiceLog';
import { dayString } from '../../io/teacher/teacherDesk';
import type { PieceCatalogue } from '../pieceCatalogue';
import { TUG_RULES } from './scenesData';

type Level = 1 | 2 | 3;

/**
 * The tug `def` plays now (ft_1_21.AC6): one level above the best won with it, at least `asked`, on its phrase of that
 * level (its `phrases`, d135: the piece it taught); null when that piece is not in the game (a draft in a build).
 */
export function characterTug(def: CharacterDef, asked: Level, world: WorldState | null, pieces: PieceCatalogue): { level: Level; chart: Chart } | null {
  const chartOf = (level: Level) => {
    const piece = def.phrases[String(level) as '1' | '2' | '3']?.[0];
    return piece === undefined ? undefined : pieces.find(piece)?.chart;
  };
  const level = tugLevelFor(asked, world?.met[def.id]?.tugs.bestLevel ?? 0, (l) => chartOf(l) !== undefined);
  const chart = chartOf(level);
  return chart ? { level, chart } : null;
}

/**
 * The gate in front of `def`'s tug on `chart` at `level` (ft_1_06.AC15, ft_1_21.AC13), from the player's practice log
 * and world: the piece practised for it and, after a lost tug, played clean again.
 */
export function characterTugGate(def: CharacterDef, chart: Chart, level: Level, world: WorldState | null, log: PracticeLog): TugGate {
  const bars = chart.bars.length;
  const lastLost = world?.met[def.id]?.lastLostTug;
  return tugGate({
    plays: playResultsFromLog(log, chart.id, bars, (iso) => dayString(new Date(iso)), DEFAULT_EVALUATION_RULES),
    piece: chart.id,
    level,
    rules: TUG_RULES,
    lastPlays: DEFAULT_EVALUATION_RULES.lastPlays,
    ...(lastLost ? { lastLost } : {}),
    cleanPlaysSinceLost: lastLost ? cleanPlaysSince(log, chart.id, bars, lastLost.at) : 0,
    cooldownCleanPlays: def.meet.cooldownCleanPlays,
  });
}
