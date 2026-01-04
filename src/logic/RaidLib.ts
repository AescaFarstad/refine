export type EncounterType =
  | 'PreparationEncounter'
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
}

export interface WalkEncounterDef {
  type: 'WalkEncounter';
}

export interface LootEncounterDef {
  type: 'LootEncounter';
}

export interface MonsterLootEncounterDef {
  type: 'MonsterLootEncounter';
  // Source monster definition (its lootItemId is used)
  monsterId: string;
}

export interface FightEncounterDef {
  type: 'FightEncounter';
  monsterId: string;
  summoned?: boolean; // true if this fight was summoned by another monster (default false)
}

export interface QuestEncounterDef {
  type: 'QuestEncounter';
  questId: string;
}

export type EncounterDef =
  | PreparationEncounterDef
  | WalkEncounterDef
  | LootEncounterDef
  | MonsterLootEncounterDef
  | FightEncounterDef
  | QuestEncounterDef;

export interface RaidDefinition {
  id: string;
  name: string;
  description?: string;
  baseLootChance: number;
  items: string[];
  itemPoolsByRarity: Record<LootRarity, string[]>;
  encounters: Array<{ count: number; encounter: EncounterDef }>;
  order: number;
  zoneCollapseSec: number;
  zoneCollapseStepPerMutation: number;
}
