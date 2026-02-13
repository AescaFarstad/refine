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
  upgrade?: string;
  strength: number;
  inferredUpgrade: string | null; // the actual upgrade used: explicit upgrade or next stronger monster
}

export type RawMonsterDefinition =
  & Omit<MonsterDefinition, 'id' | 'features' | 'armor' | 'damageCap' | 'strength' | 'inferredUpgrade'>
  & { features?: string[]; armor?: number; damageCap?: number; strengthMult?: number };

export function parseMonsterDefinitions(raw: Record<string, RawMonsterDefinition>): Map<string, MonsterDefinition> {
  const tempMonsters: Array<{ id: string; def: Omit<MonsterDefinition, 'inferredUpgrade'>; strength: number }> = [];

  for (const key in raw) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const d = raw[key];

    const armor = Math.max(0, d.armor ?? 0);
    const damageCap = Math.max(0, d.damageCap ?? 0);
    const features = d.features ?? [];

    const strengthMult = d.strengthMult ?? 1.0;
    const cap = damageCap > 0 ? damageCap : Number.POSITIVE_INFINITY;
    const strength = (d.hp + (d.hp / cap)) * (d.damage + armor) * d.accuracy * d.dodge * strengthMult;

    tempMonsters.push({
      id: key,
      strength: strength,
      def: {
        id: key,
        name: d.name,
        hp: d.hp,
        dodge: d.dodge,
        accuracy: d.accuracy,
        damage: d.damage,
        lootItemId: d.lootItemId,
        features: features,
        armor: armor,
        damageCap: damageCap,
        upgrade: d.upgrade,
        strength: strength,
      }
    });
  }

  tempMonsters.sort((a, b) => (a.strength === b.strength ? (a.id < b.id ? -1 : 1) : a.strength - b.strength));
  const strengthIndexMap = new Map<string, number>();
  tempMonsters.forEach((m, i) => strengthIndexMap.set(m.id, i));

  // Second pass: calculate inferredUpgrade for each monster
  const map = new Map<string, MonsterDefinition>();
  for (let i = 0; i < tempMonsters.length; i++) {
    const temp = tempMonsters[i];
    let inferredUpgrade: string | null = null;

    if (temp.def.upgrade && temp.def.upgrade.trim() !== '') {
      inferredUpgrade = temp.def.upgrade;
    } else {
      // Use next stronger monster (strength-based upgrade)
      const nextIndex = i + 1;
      if (nextIndex < tempMonsters.length) {
        inferredUpgrade = tempMonsters[nextIndex].id;
      }
    }

    const monsterDef: MonsterDefinition = {
      ...temp.def,
      inferredUpgrade,
    };

    // const upgradeInfo = temp.def.upgrade
    //   ? ` -> ${temp.def.upgrade}`
    //   : (inferredUpgrade ? ` -> ${inferredUpgrade} (inferred)` : '');
    // console.log(`${temp.id}: strength=${temp.strength.toFixed(0)}${upgradeInfo}`);

    map.set(temp.id, monsterDef);
  }

  return map;
}
