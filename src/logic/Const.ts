import { uiState } from './UIState';

export let ENABLE_QUEST_PREREQS = true;

export const ESSENCE_CREDITS = 10;
export const ESSENCE_CHRONOTRACES = 10;
export const ESSENCE_TEMPORAL_FLUX = 1;
export const REFINE_TIME = 4 * 3600
export const FAILURE_PER_EMPTY_CELL = 5
export const CYAN_SUCCESS_BONUS_PCT = 10
export const CYAN_YIELD_BONUS_PCT = 10
export const MAGENTA_SUCCESS_PENALTY_PCT = 25
export const MAGENTA_YIELD_BONUS_PCT = 20
export const BLACK_YIELD_PENALTY_PCT = 50
export const MAGENTA_CRYSTAL_YIELD_PER_ESSENCE = 1
export const BLACK_FRACTAL_YIELD_PER_ESSENCE = 1
export const WHITE_SPICE_YIELD_PER_ESSENCE = 1
export const WAFER_CHARGE_BONUS_PCT = 15
export const SIGNATURE_YIELD_BONUS_PCT = 20
export const UNIQUE_ITEMS_YIELD_BONUS_PCT = 2
export const WAFER_HEIGHT = 12;
export const WAFER_WIDTH = 20;
export const WAFER_UPGRADE_BASE_COST = 100;
export const WAFER_CANVAS_WIDTH = 800;
export const WAFER_CANVAS_HEIGHT = 400;

export const RESEARCH_PANE_SIZE = 100;
export const RESEARCH_OBSTACLE_PRICE = 5;
export const RESEARCH_OBSTACLE_PRICE_GROWTH = 2;
export const RESEARCH_OBSTACLES_REQUIRED_FOR_SIGNATURE_LEARN: number[] = [18, 23, 25, 28, 32, 35, 39, 42, 46, 51, 54, 56, 62, 74, 80, 89];

export const TMP_LOOT_BUFF_PER_FULL_BAGS_SKIP_PCT = 1;

export const REGEN_INTERVAL_SEC = 600;




export function setEnableQuestPrereqs(enabled: boolean): void {
  ENABLE_QUEST_PREREQS = enabled;
  // Increment version to trigger Vue reactivity
  uiState.questPrereqsVersion++;
}
