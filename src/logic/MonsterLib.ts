export interface MonsterDefinition {
  id: string;
  name: string;
  hp: number;
  dodge: number;    // percent
  accuracy: number; // percent
  damage: number;
  lootItemId: string; // item dropped for MonsterLootEncounter
  features: string[];
  armor: number;     // flat damage reduction on all incoming damage
  damageCap: number; // max damage per hit (0 = no cap)
}

