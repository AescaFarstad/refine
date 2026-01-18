import { uiState } from './UIState';

export let IS_DEBUG = false;
export let ENABLE_QUEST_PREREQS = true;

export const ESSENCE_CREDITS = 10;
export const ESSENCE_CHRONOTRACES = 10;
export const ESSENCE_TEMPORAL_FLUX = 1;
export const REFINE_TIME = 4 * 3600
export const FAILURE_PER_EMPTY_CELL = 5
export const CYAN_SUCCESS_BONUS_PCT = 10
export const CYAN_YIELD_BONUS_PCT = 10
export const MAGENTA_SUCCESS_PENALTY_PCT = 25
export const STABALIZER_BEACON_BONUS = 30 * 60
export const WAFER_HEIGHT = 12;
export const WAFER_WIDTH = 20;
export const WAFER_UPGRADE_BASE_COST = 100;

export const RESEARCH_PANE_SIZE = 100;
export const RESEARCH_OBSTACLE_PRICE = 5;
export const RESEARCH_OBSTACLE_PRICE_GROWTH = 3;
export const RESEARCH_OBSTACLES_REQUIRED_FOR_SIGNATURE_LEARN: number[] = [11, 13, 18, 20, 25, 28, 32, 35, 39, 42, 46, 51, 54, 56, 62, 74];

export const TMP_LOOT_BUFF_PER_FULL_BAGS_SKIP_PCT = 1;




export function setIsDebug(enabled: boolean): void {
  IS_DEBUG = enabled;
}

export function setEnableQuestPrereqs(enabled: boolean): void {
  ENABLE_QUEST_PREREQS = enabled;
  // Increment version to trigger Vue reactivity
  uiState.questPrereqsVersion++;
}
