import type { Essence } from './ItemLib';
import { RECIPE_TIME } from './Const';

export interface RecipeDefinition {
  id: string;
  name: string;
  ingredients: Essence;
  // Class controlling time multiplier
  timeClass: TimeClass;
  // Duration in seconds to refine (computed)
  duration: number;
  // Quality id from recipe_qualities
  quality: string;
}

export class Recipe {
  public id: string = "";
  public name: string = "";
  public ingredients: Essence = {};
  public timeClass: TimeClass = 'normal';
  public duration: number = 0;
  public quality: string = 'standard';
}

// Time classes available for recipes
export type TimeClass = 'terribly_slow' | 'slow' | 'normal' | 'fast' | 'ultra_fast';

// Base seconds per essence at 'normal' timeClass
export const BASE_SECONDS_PER_ESSENCE = 60;

// Data-file definition: no id/duration, includes timeClass
export interface RecipeDataDefinition {
  name: string;
  ingredients: Essence;
  quality: string;
  timeClass: TimeClass;
}

export function computeRecipeDurationSec(ingredients: Essence, timeClass: TimeClass): number {
  const sum = Object.values(ingredients || {}).reduce((a, vAny) => a + Math.max(0, Math.round(Number(vAny) || 0)), 0);
  const mod = RECIPE_TIME[(timeClass || 'normal') as TimeClass] || 1;
  return Math.max(0, Math.round(sum * BASE_SECONDS_PER_ESSENCE * mod));
}
