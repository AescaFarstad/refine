import type { RaidMutation } from './RaidMutation';

export type EncounterType =
  | 'PreparationEncounter'
  | 'ResourcesEncounter'
  | 'WalkEncounter'
  | 'LootEncounter'
  | 'MonsterLootEncounter'
  | 'FightEncounter'
  | 'QuestEncounter';

export type LootRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface PreparationEncounterDef {
  type: 'PreparationEncounter';
  timeSpentSec: number;
  damageBonus: number;
  hpBonus: number;
  blockChanceBonus: number;
  tacticNames: string[];  // (display only)
  gearId: string;         // gear item that added this preparation
  gearImage: string;      // image key for display
}

export interface WalkEncounterDef {
  type: 'WalkEncounter';
}

export interface ResourcesEncounterDef {
  type: 'ResourcesEncounter';
}

export interface LootEncounterDef {
  type: 'LootEncounter';
}

export interface MonsterLootEncounterDef {
  type: 'MonsterLootEncounter';
  monsterId: string;
  injected?: boolean;
}

export interface FightEncounterDef {
  type: 'FightEncounter';
  monsterId: string;
  injected?: boolean;
}

export interface QuestEncounterDef {
  type: 'QuestEncounter';
  questId: string;
}

export type EncounterDef =
  | PreparationEncounterDef
  | ResourcesEncounterDef
  | WalkEncounterDef
  | LootEncounterDef
  | MonsterLootEncounterDef
  | FightEncounterDef
  | QuestEncounterDef;

export interface RaidDefinition {
  id: string;
  name: string;
  locationImageId: string;
  description?: string;
  baseLootChance: number;
  items: string[];
  itemPoolsByRarity: Record<LootRarity, string[]>;
  allPotentialItems: string[];
  encounters: Array<{ count: number; encounter: EncounterDef }>;
  order: number;
  zoneCollapseSec: number;
  zoneCollapseStepPerMutation: number;
  initialMutations: RaidMutation[];
}

export type RawRaidDefinition = Omit<RaidDefinition, 'id' | 'order' | 'itemPoolsByRarity' | 'allPotentialItems' | 'initialMutations'> & {
  initialMutations?: RaidMutation[];
};

function emptyItemPoolsByRarity(): Record<LootRarity, string[]> {
  return { common: [], uncommon: [], rare: [], legendary: [] };
}

export function parseRaidDefinitions(raw: Record<string, RawRaidDefinition>): {
  raidSources: Map<string, RaidDefinition>;
  raids: Map<string, RaidDefinition>;
} {
  const raidSources = new Map<string, RaidDefinition>();
  const raidsCopy = new Map<string, RaidDefinition>();
  let orderIndex = 0;

  for (const id in raw) {
    if (!Object.prototype.hasOwnProperty.call(raw, id)) continue;
    const def = raw[id];
    const withId: RaidDefinition = {
      id,
      name: def.name,
      locationImageId: def.locationImageId,
      description: def.description,
      baseLootChance: def.baseLootChance,
      items: def.items,
      encounters: def.encounters,
      order: orderIndex++,
      zoneCollapseSec: def.zoneCollapseSec,
      zoneCollapseStepPerMutation: def.zoneCollapseStepPerMutation,
      itemPoolsByRarity: emptyItemPoolsByRarity(),
      allPotentialItems: [...def.items],
      initialMutations: def.initialMutations ?? [],
    };
    raidSources.set(id, withId);

    const cloned: RaidDefinition = {
      id: withId.id,
      name: withId.name,
      locationImageId: withId.locationImageId,
      description: withId.description,
      baseLootChance: withId.baseLootChance,
      items: [...withId.items],
      encounters: withId.encounters.map(step => ({
        count: Math.max(0, step.count | 0),
        encounter: { ...step.encounter },
      })),
      order: withId.order,
      zoneCollapseSec: withId.zoneCollapseSec,
      zoneCollapseStepPerMutation: withId.zoneCollapseStepPerMutation,
      itemPoolsByRarity: emptyItemPoolsByRarity(),
      allPotentialItems: [...def.items],
      initialMutations: [...withId.initialMutations],
    };
    raidsCopy.set(id, cloned);
  }

  return { raidSources, raids: raidsCopy };
}
