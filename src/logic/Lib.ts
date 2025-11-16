import type { RaidDefinition } from "./RaidLib";
import type { GearDefinition, RawGearDefinition } from './GearLib';
import { parseGearDefinitions } from './GearLib';
import type { GearCategoryDefinition } from './GearCategoryLib';
import type { QuestDefinition } from './QuestLib';
import { ItemDefinition } from "./ItemLib";
import type { MonsterDefinition } from './MonsterLib';
import monstersData from '../data/monsters';
import { RecipeDefinition, computeRecipeDurationSec } from "./RecipeLib";
import { RecipeQualityDefinition } from "./RecipeQualityLib";
import type { RecipeUpgradeDefinition } from './RecipeUpgradeLib';
import { parseResearchTiers, type ResearchTier, type ResearchDataFile } from './ResearchLib';
import type { MazeDefinition } from './MazeLib';
import raidsData from '../data/raids';
import questsData from '../data/quests';
import gearData from '../data/gear';
import gearCategoriesData from '../data/gear_categories';
import itemsData from '../data/items';
import recipesData from '../data/recipes';
import recipeQualitiesData from '../data/recipe_qualities';
import researchData from '../data/research';
import recipeUpgradesData from '../data/recipe_upgrades';
import mazeData from '../data/maze';

export interface LibItem {
  id: string;
} 


export class Lib {

  public isLoaded: boolean = false;
  public raidSources: Map<string, RaidDefinition> = new Map();
  public raids: Map<string, RaidDefinition> = new Map();
  public quests: Map<string, QuestDefinition> = new Map();
  public gear: Map<string, GearDefinition> = new Map();
  public gearCategories: Map<string, GearCategoryDefinition> = new Map();
  public items: Map<string, ItemDefinition> = new Map();
  public monsters: Map<string, MonsterDefinition> = new Map();
  // Base recipes (immutable copy of data definitions)
  public baseRecipes: Map<string, RecipeDefinition> = new Map();
  // Active recipes (modifiable at runtime via upgrades)
  public recipes: Map<string, RecipeDefinition> = new Map();
  // Bumped whenever a recipe is upgraded to help UI react to changes
  public recipesVersion: number = 0;
  public recipeQualities: Map<string, RecipeQualityDefinition> = new Map();
  public recipeUpgrades: Map<string, RecipeUpgradeDefinition> = new Map();
  public research: ResearchTier[] = [];
  public mazes: Map<string, MazeDefinition> = new Map();
  // Ordered levels array (sorted by numeric prefix lN_)
  public mazeLevels: MazeDefinition[] = [];

  constructor() {
    this.loadAllDefinitions();
  }

  private loadAllDefinitions(): void {
    if (this.isLoaded) {
      return;
    }

    try {
      // Load raids (source of truth) and create a deep, independent working copy
      this.raidSources = this._processDataDefinitions<RaidDefinition>(raidsData as unknown as Record<string, RaidDefinition>);
      {
        const raidsCopy = new Map<string, RaidDefinition>();
        this.raidSources.forEach((def, id) => {
          const cloned: RaidDefinition = {
            id: def.id,
            name: def.name,
            reachRequired: def.reachRequired,
            baseLootChance: def.baseLootChance,
            items: Array.isArray(def.items) ? [...def.items] : undefined,
            encounters: (def.encounters || []).map(step => ({
              count: Math.max(0, step.count | 0),
              // Encounter objects in our union are flat; shallow-clone is sufficient
              encounter: { ...(step.encounter as any) },
            })),
          };
          raidsCopy.set(id, cloned);
        });
        this.raids = raidsCopy;
      }
      this.gearCategories = this._processDataDefinitions<GearCategoryDefinition>(gearCategoriesData as unknown as Record<string, GearCategoryDefinition>);
      // Normalize gear: ensure all numeric fields are present with defaults
      this.gear = parseGearDefinitions(gearData as unknown as Record<string, RawGearDefinition>);
      // Normalize items: convert optional numeric rarity (1..4) to string rarity and ensure presence
      {
        const raw: Record<string, any> = itemsData as unknown as Record<string, any>;
        const map = new Map<string, ItemDefinition>();
        for (const key in raw) {
          if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
          const d = raw[key] || {};
          const rn = Number.isFinite(d.rarity) ? Number(d.rarity) : 1;
          const rarity = (rn >= 4
            ? 'legendary'
            : rn === 3
              ? 'rare'
              : rn === 2
                ? 'uncommon'
                : 'common') as ItemDefinition['rarity'];
          const def: ItemDefinition = {
            id: key,
            name: d.name,
            volume: d.volume,
            essence: d.essence || {},
            rarity,
          };
          map.set(key, def);
        }
        this.items = map;
      }
      this.quests = this._processDataDefinitions<QuestDefinition>(questsData as unknown as Record<string, QuestDefinition>);
      this.monsters = this._processDataDefinitions<MonsterDefinition>(monstersData as unknown as Record<string, MonsterDefinition>);
      // Keep base copy and modded working copy
      this.baseRecipes = this._processDataDefinitions<RecipeDefinition>(recipesData as unknown as Record<string, RecipeDefinition>);
      // Compute derived durations based on time class and ingredients
      this.baseRecipes.forEach((rec) => {
        const tc = ((rec as any).timeClass || 'normal') as any;
        (rec as any).timeClass = tc;
        (rec as any).duration = computeRecipeDurationSec((rec as any).ingredients || {}, tc);
      });
      this.recipes = new Map<string, RecipeDefinition>(this.baseRecipes);
      this.recipeQualities = this._processDataDefinitions<RecipeQualityDefinition>(recipeQualitiesData);
      this.recipeUpgrades = this._processDataDefinitions<RecipeUpgradeDefinition>(recipeUpgradesData);
      this.research = parseResearchTiers(researchData as ResearchDataFile);
      this.mazes = this._processDataDefinitions<MazeDefinition>(mazeData);
      this.mazeLevels = this._buildOrderedMazeLevels(this.mazes);
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

  private _buildOrderedMazeLevels(map: Map<string, MazeDefinition>): MazeDefinition[] {
    const arr: Array<{ idx: number; id: string; def: MazeDefinition }> = [];
    map.forEach((def, id) => {
      const m = /^l(\d+)_/.exec(id);
      const idx = m ? parseInt(m[1] || '0', 10) : Number.POSITIVE_INFINITY;
      arr.push({ idx: isNaN(idx) ? Number.POSITIVE_INFINITY : idx, id, def });
    });
    arr.sort((a, b) => (a.idx === b.idx ? (a.id < b.id ? -1 : 1) : a.idx - b.idx));
    return arr.map(o => o.def);
  }
}
