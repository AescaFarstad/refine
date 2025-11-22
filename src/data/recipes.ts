import type { RecipeDataDefinition } from '../logic/RecipeLib';

export const recipeDefinitions: Record<string, RecipeDataDefinition> = {
  c1: {
    name: 'C1',
    ingredients: { red: 24, green: 24, blue: 24 },
    quality: 'standard',
    timeClass: 'normal',
  },
  c2: {
    name: 'C2',
    ingredients: { red: 8, green: 12 },
    quality: 'crude',
    timeClass: 'fast',
  },
  c3: {
    name: 'C3',
    ingredients: { red: 12, blue: 12 },
    quality: 'improvised',
    timeClass: 'normal',
  },
  c4: {
    name: 'C4',
    ingredients: { red: 16 },
    quality: 'flawed',
    timeClass: 'slow',
  },
  c5: {
    name: 'C5',
    ingredients: { red: 8, green: 4, blue: 16 },
    quality: 'patched',
    timeClass: 'normal',
  },
};

export default recipeDefinitions;
