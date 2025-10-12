import type { Essence } from './ItemLib';

export interface RecipeDefinition {
  id: string;
  name: string;
  ingredients: Essence;
  // Duration in seconds to refine
  duration: number;
  // Quality id from recipe_qualities
  quality: string;
}

export class Recipe {
  public id: string = "";
  public name: string = "";
  public ingredients: Essence = {};
  public duration: number = 0;
  public quality: string = 'standard';
}
