/**
 * The campaign's monsters as plain data (ft_1_06): per monster whether it is unlocked and, per level, whether it is
 * beaten and whether it can be played now. Pure: a scene of Keri (ft_1_19) draws this and never decides what is selectable itself.
 */
import type { Ladder } from './content';
import { isUnlocked, selectable, type CampaignLevel, type CampaignState } from './campaign';

export interface MapLevelView {
  level: CampaignLevel;
  beaten: boolean;
  selectable: boolean;
}

export interface MapMonsterView {
  /** 0-based, in ladder order. */
  index: number;
  name: string;
  unlocked: boolean;
  levels: MapLevelView[];
}

/** The map: every monster of the ladder, in order, with its state from the campaign save. */
export function campaignMapView(ladder: Ladder, state: CampaignState): MapMonsterView[] {
  return ladder.monsters.map((monster, index) => ({
    index,
    name: monster.name,
    unlocked: isUnlocked(state, index),
    levels: ([1, 2, 3] as const).map((level) => ({
      level,
      beaten: state.beaten[index]?.[level - 1] === true,
      selectable: selectable(state, index, level),
    })),
  }));
}
