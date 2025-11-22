import type { RecipeUpgradeDefinition } from '../logic/RecipeUpgradeLib';

export const recipeUpgradeDefinitions: Record<string, Omit<RecipeUpgradeDefinition, 'id'>> = {
  green_up: {
    effect: 'modifyEssences',
    params: { green: 4 },
  },
  blue_down: {
    effect: 'modifyEssences',
    params: { blue: -4 },
  },
  increase_quality: {
    effect: 'increaseQuality',
  },
};

export default recipeUpgradeDefinitions;

