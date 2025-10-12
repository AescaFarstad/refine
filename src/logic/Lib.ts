import { RaidDefinition } from "./RaidLib";
import { ItemDefinition } from "./ItemLib";
import { RecipeDefinition } from "./RecipeLib";
import { RecipeQualityDefinition } from "./RecipeQualityLib";
import raidsData from '../data/raids';
import itemsData from '../data/items';
import recipesData from '../data/recipes';
import recipeQualitiesData from '../data/recipe_qualities';

export interface LibItem {
  id: string;
} 


export class Lib {

  public isLoaded: boolean = false;
  public raids: Map<string, RaidDefinition> = new Map();
  public items: Map<string, ItemDefinition> = new Map();
  public recipes: Map<string, RecipeDefinition> = new Map();
  public recipeQualities: Map<string, RecipeQualityDefinition> = new Map();

  constructor() {
    this.loadAllDefinitions();
  }

  private loadAllDefinitions(): void {
    if (this.isLoaded) {
      return;
    }

    try {
      this.raids = this._processDataDefinitions<RaidDefinition>(raidsData);
      this.items = this._processDataDefinitions<ItemDefinition>(itemsData);
      this.recipes = this._processDataDefinitions<RecipeDefinition>(recipesData);
      this.recipeQualities = this._processDataDefinitions<RecipeQualityDefinition>(recipeQualitiesData);
      this.isLoaded = true;
    } catch (error) {
      console.error("Failed to process library definitions:", error);
      this.isLoaded = false;
    }
  }

  private _processDataDefinitions<T extends LibItem>(data: Record<string, any>): Map<string, T> {
    const items = new Map<string, T>();
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const itemData = data[key];
        const item: T = { ...itemData, id: key } as T;
        items.set(key, item);
      }
    }
    return items;
  }
}
