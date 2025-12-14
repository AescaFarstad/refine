import type { RaidDefinition } from "./RaidLib";
import type { GearDefinition, RawGearDefinition } from './GearLib';
import { parseGearDefinitions } from './GearLib';
import type { GearCategoryDefinition } from './GearCategoryLib';
import type { QuestDefinition } from './QuestLib';
import { ItemDefinition } from "./ItemLib";
import type { MonsterDefinition } from './MonsterLib';
import monstersData from '../data/monsters';
import type { MazeDefinition } from './MazeLib';
import raidsData from '../data/raids';
import questsData from '../data/quests';
import gearData from '../data/gear';
import gearCategoriesData from '../data/gear_categories';
import itemsData from '../data/items';
import mazeData from '../data/maze';
import { ResearchLib } from "./ResearchLib";

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
  public mazes: Map<string, MazeDefinition> = new Map();
  // Ordered levels array (sorted by numeric prefix lN_)
  public mazeLevels: MazeDefinition[] = [];
  public research: ResearchLib = new ResearchLib();

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
      this.gear = parseGearDefinitions(gearData as unknown as Record<string, RawGearDefinition>);
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
