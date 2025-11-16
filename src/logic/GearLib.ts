export interface GearDefinition {
  id: string;
  name: string;
  category: string; // simple string category for now
  // Core stats
  speedPercent: number;    // additive percent (e.g., 10 => +10%)
  speedFlat: number;       // flat km/h added after percent
  regenPerKm: number;      // HP per km walked
  weight: number;
  maxWeight: number;
  hp: number;
  volume: number;
  lootChance: number;
  damage: number;
  price: number;
  // Combat support
  chanceToHit: number;     // additive percent to base hit chance
  chanceToBlock: number;   // additive percent to base block chance
  // Reflective damage stats (percent of monster's damage returned)
  // - onHit: when monster successfully hits you (not blocked)
  // - onBlock: when you block the monster's hit
  reflectOnHitPct: number;
  reflectOnBlockPct: number;
  // Utility
  perk?: string;
}

// Raw data type for data files: allows omitting numbers which will default to 0 at load time
export type RawGearDefinition = Omit<Partial<GearDefinition>, 'id'> & { name: string; category: string };

// Normalize raw gear data into fully-typed GearDefinition map with defaults
export function parseGearDefinitions(raw: Record<string, RawGearDefinition>): Map<string, GearDefinition> {
  const map = new Map<string, GearDefinition>();
  for (const key in raw) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const d = raw[key] as RawGearDefinition;
    const def: GearDefinition = {
      id: key,
      name: d.name,
      category: d.category,
      speedPercent: d.speedPercent ?? 0,
      speedFlat: d.speedFlat ?? 0,
      regenPerKm: d.regenPerKm ?? 0,
      weight: d.weight ?? 0,
      maxWeight: d.maxWeight ?? 0,
      hp: d.hp ?? 0,
      volume: d.volume ?? 0,
      lootChance: d.lootChance ?? 0,
      damage: d.damage ?? 0,
      price: d.price ?? 0,
      chanceToHit: d.chanceToHit ?? 0,
      chanceToBlock: d.chanceToBlock ?? 0,
      reflectOnHitPct: d.reflectOnHitPct ?? 0,
      reflectOnBlockPct: d.reflectOnBlockPct ?? 0,
      perk: d.perk,
    };
    map.set(key, def);
  }
  return map;
}
