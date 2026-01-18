export interface GearDefinition {
  id: string;
  name: string;
  category: string; // simple string category for now
  // Core stats
  speedPercent: number;    // additive percent (e.g., 10 => +10%)
  speedFlat: number;       // flat km/h added after percent
  regenPerKm: number;      // HP per km walked
  regenAfterCombat: number; // HP after each encounter
  weight: number;
  maxWeight: number;
  hp: number;
  volume: number;
  lootChance: number;
  damage: number;
  price: number;
  countable: boolean;      // if true, player has a count of these; consumed on use
  // Combat support
  chanceToHit: number;
  chanceToBlock: number;
  // Reflective damage stats (percent of monster's damage returned)
  // - onHit: when monster successfully hits you (not blocked)
  // - onBlock: when you block the monster's hit
  reflectOnHitPct: number;
  reflectOnBlockPct: number;
  biopsyChance: number;
  reimbursed: number; // percentage of gear cost reimbursed on death in combat (not zone collapse)
  perk: string;

  prepTimeMin: number;

  // Values are additive and multiplied by the number of equipped items in the referenced category.
  bonusDamagePerCategory: Record<string, number>;
  bonusHpPerCategory: Record<string, number>;
  bonusBlockChancePerCategory: Record<string, number>; // additive percent
  walkMultiplier: number; // e.g. 2 => doubles WalkEncounter count
  walkDelta: number;      // additive count change after multipliers
  hpMult: number;         // multiplier applied to HP after all flat bonuses (including preparation)
  ignoreLootEncounters: boolean;

  // Zone stability boost in seconds (applied on successful raid completion)
  zoneBoost: number;

  // Visual - key into items.json sprite atlas
  image: string;

  // Optional custom description
  description: string;
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
      regenAfterCombat: d.regenAfterCombat ?? 0,
      weight: d.weight ?? 0,
      maxWeight: d.maxWeight ?? 0,
      hp: d.hp ?? 0,
      volume: d.volume ?? 0,
      lootChance: d.lootChance ?? 0,
      damage: d.damage ?? 0,
      price: d.price ?? 0,
      countable: d.countable ?? false,
      chanceToHit: d.chanceToHit ?? 0,
      chanceToBlock: d.chanceToBlock ?? 0,
      reflectOnHitPct: d.reflectOnHitPct ?? 0,
      reflectOnBlockPct: d.reflectOnBlockPct ?? 0,
      biopsyChance: d.biopsyChance ?? 0,
      reimbursed: d.reimbursed ?? 0,
      perk: d.perk ?? '',
      prepTimeMin: d.prepTimeMin ?? 0,
      bonusDamagePerCategory: d.bonusDamagePerCategory ?? {},
      bonusHpPerCategory: d.bonusHpPerCategory ?? {},
      bonusBlockChancePerCategory: d.bonusBlockChancePerCategory ?? {},
      walkMultiplier: d.walkMultiplier ?? 1,
      walkDelta: d.walkDelta ?? 0,
      hpMult: d.hpMult ?? 1,
      ignoreLootEncounters: d.ignoreLootEncounters ?? false,
      zoneBoost: d.zoneBoost ?? 0,
      image: d.image ?? '',
      description: d.description ?? '',
    };
    map.set(key, def);
  }
  return map;
}
