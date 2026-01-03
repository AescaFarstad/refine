import type { LootRarity, RaidDefinition } from "./RaidLib";
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
import { researchArchetypes } from '../data/research_archetypes';
import { researchPane, researchPaneEmptyCells, researchPaneVoidCells } from '../data/research_pane';

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

  public getItem(id: string): ItemDefinition {
    return this.items.get(id)!;
  }

  private _emptyItemPoolsByRarity(): Record<LootRarity, string[]> {
    return { common: [], uncommon: [], rare: [], legendary: [] };
  }

  private _buildItemPoolsByRarity(ids?: string[]): Record<LootRarity, string[]> {
    if (!Array.isArray(ids) || ids.length === 0) return this._emptyItemPoolsByRarity();
    const pools: Record<LootRarity, string[]> = this._emptyItemPoolsByRarity();
    for (const id of ids) {
      const def = this.getItem(id);
      pools[def.rarity].push(id);
    }
    return pools;
  }

  private loadAllDefinitions(): void {
    if (this.isLoaded) {
      return;
    }

    try {
      // Load raids (source of truth) and create a deep, independent working copy
      {
        const rawRaids = raidsData as unknown as Record<string, Omit<RaidDefinition, 'id' | 'order' | 'itemPoolsByRarity'>>;
        const raidSources = new Map<string, RaidDefinition>();
        const raidsCopy = new Map<string, RaidDefinition>();
        let orderIndex = 0;

        for (const id in rawRaids) {
          if (!Object.prototype.hasOwnProperty.call(rawRaids, id)) continue;
          const def = rawRaids[id];
          const withId: RaidDefinition = {
            id,
            name: def.name,
            description: def.description,
            baseLootChance: def.baseLootChance,
            items: def.items,
            encounters: def.encounters,
            order: orderIndex++,
            zoneCollapseSec: def.zoneCollapseSec,
            zoneCollapseStepPerMutation: def.zoneCollapseStepPerMutation,
            // Filled in after items load
            itemPoolsByRarity: this._emptyItemPoolsByRarity(),
          };
          raidSources.set(id, withId);

          const cloned: RaidDefinition = {
            id: withId.id,
            name: withId.name,
            description: withId.description,
            baseLootChance: withId.baseLootChance,
            items: Array.isArray(withId.items) ? [...withId.items] : undefined,
            encounters: (withId.encounters || []).map(step => ({
              count: Math.max(0, step.count | 0),
              // Encounter objects in our union are flat; shallow-clone is sufficient
              encounter: { ...(step.encounter as any) },
            })),
            order: withId.order,
            zoneCollapseSec: withId.zoneCollapseSec,
            zoneCollapseStepPerMutation: withId.zoneCollapseStepPerMutation,
            // Filled in after items load
            itemPoolsByRarity: this._emptyItemPoolsByRarity(),
          };
          raidsCopy.set(id, cloned);
        }

        this.raidSources = raidSources;
        this.raids = raidsCopy;
      }
      this.gearCategories = this._processDataDefinitions<GearCategoryDefinition>(gearCategoriesData as unknown as Record<string, GearCategoryDefinition>);
      this.gear = parseGearDefinitions(gearData as unknown as Record<string, RawGearDefinition>);

      {
        const raw: Record<string, any> = itemsData as unknown as Record<string, any>;

        // First pass: create items with temporary order
        const map = new Map<string, ItemDefinition>();
        for (const key in raw) {
          if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
          const d = raw[key] || {};

          // Handle both string and numeric rarities
          let rarity: ItemDefinition['rarity'];
          if (typeof d.rarity === 'string') {
            rarity = d.rarity as ItemDefinition['rarity'];
          } else {
            const rn = Number.isFinite(d.rarity) ? Number(d.rarity) : 1;
            rarity = (rn >= 4
              ? 'legendary'
              : rn === 3
                ? 'rare'
                : rn === 2
                  ? 'uncommon'
                  : 'common') as ItemDefinition['rarity'];
          }

          const def: ItemDefinition = {
            id: key,
            name: d.name,
            volume: d.volume,
            essence: d.essence || {},
            rarity,
            order: 999999, // temporary, will be updated below
          };
          map.set(key, def);
        }

        // Second pass: compute item order based on raids and item properties
        // Build item -> first raid appearance map
        const itemToRaid = new Map<string, number>();
        for (const raid of this.raids.values()) {
          if (!raid || !raid.id) continue;
          if (Array.isArray(raid.items)) {
            for (const itemId of raid.items) {
              if (!itemToRaid.has(itemId)) {
                itemToRaid.set(itemId, raid.order);
              }
            }
          }
        }

        // Categorize items into groups
        const devItems: string[] = [];
        const remainsItems: string[] = [];
        const raidItems: Map<number, string[]> = new Map();
        const otherItems: string[] = [];

        for (const itemId of map.keys()) {
          const d = raw[itemId] || {};
          const isDev = d.devOnly === true;
          const isRemains = itemId.includes('remains');
          const raidOrder = itemToRaid.get(itemId);

          if (isDev) {
            devItems.push(itemId);
          } else if (isRemains) {
            remainsItems.push(itemId);
          } else if (raidOrder !== undefined) {
            if (!raidItems.has(raidOrder)) {
              raidItems.set(raidOrder, []);
            }
            raidItems.get(raidOrder)!.push(itemId);
          } else {
            otherItems.push(itemId);
          }
        }

        // Sort each group alphabetically
        devItems.sort();
        remainsItems.sort();
        otherItems.sort();
        for (const items of raidItems.values()) {
          items.sort();
        }

        // Assign unique order to each item
        let currentOrder = 0;

        for (const itemId of devItems) {
          map.get(itemId)!.order = currentOrder++;
        }

        for (const itemId of remainsItems) {
          map.get(itemId)!.order = currentOrder++;
        }

        // Process raid items in raid order
        const sortedRaidOrders = Array.from(raidItems.keys()).sort((a, b) => a - b);
        for (const raidOrder of sortedRaidOrders) {
          const items = raidItems.get(raidOrder)!;
          for (const itemId of items) {
            map.get(itemId)!.order = currentOrder++;
          }
        }

        for (const itemId of otherItems) {
          map.get(itemId)!.order = currentOrder++;
        }

        this.items = map;
      }

      for (const raid of this.raidSources.values()) {
        raid.itemPoolsByRarity = this._buildItemPoolsByRarity(raid.items);
      }
      for (const raid of this.raids.values()) {
        raid.itemPoolsByRarity = this._buildItemPoolsByRarity(raid.items);
      }

      this.quests = this._processDataDefinitions<QuestDefinition>(questsData as unknown as Record<string, QuestDefinition>);
      {
        const raw: Record<string, any> = monstersData as unknown as Record<string, any>;
        const map = new Map<string, MonsterDefinition>();
        for (const key in raw) {
          if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
          const d = raw[key] || {};
          const def: MonsterDefinition = {
            id: key,
            name: d.name,
            hp: d.hp,
            dodge: d.dodge,
            accuracy: d.accuracy,
            damage: d.damage,
            lootItemId: d.lootItemId,
            features: Array.isArray(d.features) ? d.features : [],
            armor: Math.max(0, d.armor || 0),
            damageCap: Math.max(0, d.damageCap || 0),
          };
          map.set(key, def);
        }
        this.monsters = map;
      }
      this.mazes = this._processDataDefinitions<MazeDefinition>(mazeData);
      this.mazeLevels = this._buildOrderedMazeLevels(this.mazes);

      // Initialize research library with gear archetypes
      this.research.load(
        researchArchetypes,
        researchPane,
        researchPaneEmptyCells,
        researchPaneVoidCells,
        this.gear
      );

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