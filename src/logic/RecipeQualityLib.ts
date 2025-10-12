export type RecipeEffectScope = 'negative_only' | 'negative_and_speed' | 'all' | 'positive_only';

export interface RecipeQualityDefinition {
  id: string;
  name: string;
  yieldMultiplier: number;
  nothingChancePct?: number;
  effects: RecipeEffectScope;
}

export class RecipeQuality {
  public id: string = '';
  public name: string = '';
  public yieldMultiplier: number = 1;
  public nothingChancePct?: number = 0;
  public effects: RecipeEffectScope = 'all';
}
