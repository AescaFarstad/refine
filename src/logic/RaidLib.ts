// New RaidLib definitions (single final type name)
export type EncounterType = 'WalkEncounter' | 'LootEncounter' | 'MonsterLootEncounter' | 'FightEncounter' | 'QuestEncounter';

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
}

export interface QuestEncounterDef {
  type: 'QuestEncounter';
  questId: string;
}

export type EncounterDef = WalkEncounterDef | LootEncounterDef | MonsterLootEncounterDef | FightEncounterDef | QuestEncounterDef;

// Source-of-truth and runtime type for raids
export interface RaidDefinition {
  id: string;
  name: string;
  reachRequired: number;
  baseLootChance: number;
  items?: string[];
  encounters: Array<{ count: number; encounter: EncounterDef }>;
  order: number;
}
