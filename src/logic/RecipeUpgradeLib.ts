import type { Essence } from './ItemLib';

export type RecipeUpgradeEffect = 'modifyEssences' | 'increaseQuality';

export interface RecipeUpgradeDefinition {
  id: string;
  effect: RecipeUpgradeEffect;
  // For modifyEssences, params are deltas to apply to essence values
  params?: Essence;
}

