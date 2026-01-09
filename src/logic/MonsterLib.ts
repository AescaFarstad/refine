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
  upgrade?: string;  // optional: specific monster ID to upgrade to
}

export type RawMonsterDefinition =
  & Omit<MonsterDefinition, 'id' | 'features' | 'armor' | 'damageCap'>
  & { features?: string[]; armor?: number; damageCap?: number };

export function parseMonsterDefinitions(raw: Record<string, RawMonsterDefinition>): Map<string, MonsterDefinition> {
  const map = new Map<string, MonsterDefinition>();
  for (const key in raw) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const d = raw[key];
    map.set(key, {
      id: key,
      name: d.name,
      hp: d.hp,
      dodge: d.dodge,
      accuracy: d.accuracy,
      damage: d.damage,
      lootItemId: d.lootItemId,
      features: d.features ?? [],
      armor: Math.max(0, d.armor ?? 0),
      damageCap: Math.max(0, d.damageCap ?? 0),
      upgrade: d.upgrade,
    });
  }
  return map;
}
