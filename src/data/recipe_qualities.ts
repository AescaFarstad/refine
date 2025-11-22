import type { RecipeQualityDefinition } from '../logic/RecipeQualityLib';

export const recipeQualityDefinitions: Record<string, Omit<RecipeQualityDefinition, 'id'>> = {
  flawed: {
    name: 'Flawed',
    yieldMultiplier: 0.5,
    nothingChancePct: 35,
    effects: 'negative_only',
  },
  improvised: {
    name: 'Improvised',
    yieldMultiplier: 0.6,
    nothingChancePct: 25,
    effects: 'negative_only',
  },
  crude: {
    name: 'Crude',
    yieldMultiplier: 0.7,
    nothingChancePct: 15,
    effects: 'negative_and_speed',
  },
  patched: {
    name: 'Patched',
    yieldMultiplier: 0.85,
    nothingChancePct: 0,
    effects: 'negative_and_speed',
  },
  standard: {
    name: 'Standard',
    yieldMultiplier: 1.0,
    nothingChancePct: 0,
    effects: 'all',
  },
  enhanced: {
    name: 'Enhanced',
    yieldMultiplier: 1.2,
    nothingChancePct: 0,
    effects: 'all',
  },
  refined: {
    name: 'Refined',
    yieldMultiplier: 1.5,
    nothingChancePct: 0,
    effects: 'all',
  },
  special: {
    name: 'Special',
    yieldMultiplier: 2.0,
    nothingChancePct: 0,
    effects: 'positive_only',
  },
  exceptional: {
    name: 'Exceptional',
    yieldMultiplier: 3.0,
    nothingChancePct: 0,
    effects: 'positive_only',
  },
};

export default recipeQualityDefinitions;

