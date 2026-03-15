export interface GearDefinition {
  id: string;
  name: string;
  category: string; // simple string category for now
  // Core stats
  speedPercent: number;    // additive percent (e.g., 10 => +10%)
  speedFlat: number;       // flat km/h added after percent
  regenPerKm: number;      // HP per km walked
  regenAfterCombat: number; // HP after each encounter
  regenPer10Minutes: number;
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
  armor: number; // flat damage reduction against monster attacks
  attackSkipCount: number; // number of successful enemy hits negated per fight
  stunChance: number; // percent chance to stun on a landed hit
  // Reflective damage stats (percent of monster's damage returned)
  // - onHit: when monster successfully hits you (not blocked)
  // - onBlock: when you block the monster's hit
  reflectOnHitPct: number;
  reflectOnBlockPct: number;
  biopsyChance: number;
  reimbursed: number; // percentage of gear cost reimbursed on death in combat (not zone collapse)
  rarityBuff: number; // increases chance of higher rarity loot
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

  // Passive raid resource generation (credits per hour) for the raid this gear is equipped on.
  raidPassiveCreditsPerHour: number;
  // If true, adds a ResourcesEncounter at the start of the raid.
  gatherRaidResources: boolean;
  // Permanent raid resource storage increase applied on successful raid completion.
  raidResourceStorageBonus: number;

  // Zone stability boost in seconds (applied on successful raid completion)
  zoneBoost: number;

  // Price change applied after each successful raid (can be positive or negative)
  priceChange: number;

  // If true, a successful raid does not apply success-based zone deterioration.
  preventsSuccessZoneDeterioration: boolean;

  // Visual - key into items.json sprite atlas
  image: string;

  // Optional custom description
  description: string;

  xp: readonly number[];
  ups: Readonly<Record<string, GearUpgradeDefinition>>;
}

export interface GearUpgradeStats {
  speedPercent: number;
  speedFlat: number;
  regenPerKm: number;
  regenAfterCombat: number;
  regenPer10Minutes: number;
  weight: number;
  maxWeight: number;
  hp: number;
  volume: number;
  lootChance: number;
  damage: number;
  price: number;
  chanceToHit: number;
  chanceToBlock: number;
  armor: number;
  attackSkipCount: number;
  stunChance: number;
  reflectOnHitPct: number;
  reflectOnBlockPct: number;
  biopsyChance: number;
  reimbursed: number;
  rarityBuff: number;
  prepTimeMin: number;
  walkMultiplier: number;
  walkDelta: number;
  hpMult: number;
  raidPassiveCreditsPerHour: number;
  raidResourceStorageBonus: number;
  zoneBoost: number;
  priceChange: number;
}

export interface GearUpgradeDefinition extends GearUpgradeStats {
  id: string;
  title: string;
  removePerk: boolean;
  changeDescription: string;
  skillPoints: number; // -1 = costs 1 SP (default), 0 = free, 1 = grants 1 SP
}

export const GEAR_UPGRADE_STAT_KEYS = [
  'speedPercent',
  'speedFlat',
  'regenPerKm',
  'regenAfterCombat',
  'regenPer10Minutes',
  'weight',
  'maxWeight',
  'hp',
  'volume',
  'lootChance',
  'damage',
  'price',
  'chanceToHit',
  'chanceToBlock',
  'armor',
  'attackSkipCount',
  'stunChance',
  'reflectOnHitPct',
  'reflectOnBlockPct',
  'biopsyChance',
  'reimbursed',
  'rarityBuff',
  'prepTimeMin',
  'walkMultiplier',
  'walkDelta',
  'hpMult',
  'raidPassiveCreditsPerHour',
  'raidResourceStorageBonus',
  'zoneBoost',
  'priceChange',
] as const satisfies readonly (keyof GearUpgradeStats)[];

export function createEmptyGearUpgradeStats(): GearUpgradeStats {
  return {
    speedPercent: 0,
    speedFlat: 0,
    regenPerKm: 0,
    regenAfterCombat: 0,
    regenPer10Minutes: 0,
    weight: 0,
    maxWeight: 0,
    hp: 0,
    volume: 0,
    lootChance: 0,
    damage: 0,
    price: 0,
    chanceToHit: 0,
    chanceToBlock: 0,
    armor: 0,
    attackSkipCount: 0,
    stunChance: 0,
    reflectOnHitPct: 0,
    reflectOnBlockPct: 0,
    biopsyChance: 0,
    reimbursed: 0,
    rarityBuff: 0,
    prepTimeMin: 0,
    walkMultiplier: 0,
    walkDelta: 0,
    hpMult: 0,
    raidPassiveCreditsPerHour: 0,
    raidResourceStorageBonus: 0,
    zoneBoost: 0,
    priceChange: 0,
  };
}

export type RawGearUpgradeDefinition = Partial<GearUpgradeStats> & {
  title?: string;
  removePerk?: boolean;
  changeDescription?: string;
  skillPoints?: number;
};

// Raw data type for data files: allows omitting numbers which will default to 0 at load time
export type RawGearDefinition =
  Omit<Partial<GearDefinition>, 'id' | 'xp' | 'ups'> &
  { name: string; category: string; xp?: number[]; ups?: Record<string, RawGearUpgradeDefinition> };

function parseGearUpgradeDefinition(id: string, raw: RawGearUpgradeDefinition | undefined): GearUpgradeDefinition {
  const stats = createEmptyGearUpgradeStats();
  return {
    id,
    title: raw?.title ?? '',
    removePerk: raw?.removePerk ?? false,
    changeDescription: raw?.changeDescription ?? '',
    skillPoints: raw?.skillPoints ?? -1,
    speedPercent: raw?.speedPercent ?? stats.speedPercent,
    speedFlat: raw?.speedFlat ?? stats.speedFlat,
    regenPerKm: raw?.regenPerKm ?? stats.regenPerKm,
    regenAfterCombat: raw?.regenAfterCombat ?? stats.regenAfterCombat,
    regenPer10Minutes: raw?.regenPer10Minutes ?? stats.regenPer10Minutes,
    weight: raw?.weight ?? stats.weight,
    maxWeight: raw?.maxWeight ?? stats.maxWeight,
    hp: raw?.hp ?? stats.hp,
    volume: raw?.volume ?? stats.volume,
    lootChance: raw?.lootChance ?? stats.lootChance,
    damage: raw?.damage ?? stats.damage,
    price: raw?.price ?? stats.price,
    chanceToHit: raw?.chanceToHit ?? stats.chanceToHit,
    chanceToBlock: raw?.chanceToBlock ?? stats.chanceToBlock,
    armor: raw?.armor ?? stats.armor,
    attackSkipCount: raw?.attackSkipCount ?? stats.attackSkipCount,
    stunChance: raw?.stunChance ?? stats.stunChance,
    reflectOnHitPct: raw?.reflectOnHitPct ?? stats.reflectOnHitPct,
    reflectOnBlockPct: raw?.reflectOnBlockPct ?? stats.reflectOnBlockPct,
    biopsyChance: raw?.biopsyChance ?? stats.biopsyChance,
    reimbursed: raw?.reimbursed ?? stats.reimbursed,
    rarityBuff: raw?.rarityBuff ?? stats.rarityBuff,
    prepTimeMin: raw?.prepTimeMin ?? stats.prepTimeMin,
    walkMultiplier: raw?.walkMultiplier ?? stats.walkMultiplier,
    walkDelta: raw?.walkDelta ?? stats.walkDelta,
    hpMult: raw?.hpMult ?? stats.hpMult,
    raidPassiveCreditsPerHour: raw?.raidPassiveCreditsPerHour ?? stats.raidPassiveCreditsPerHour,
    raidResourceStorageBonus: raw?.raidResourceStorageBonus ?? stats.raidResourceStorageBonus,
    zoneBoost: raw?.zoneBoost ?? stats.zoneBoost,
    priceChange: raw?.priceChange ?? stats.priceChange,
  };
}

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
      regenPer10Minutes: d.regenPer10Minutes ?? 0,
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
      armor: d.armor ?? 0,
      attackSkipCount: d.attackSkipCount ?? 0,
      stunChance: d.stunChance ?? 0,
      reflectOnHitPct: d.reflectOnHitPct ?? 0,
      reflectOnBlockPct: d.reflectOnBlockPct ?? 0,
      biopsyChance: d.biopsyChance ?? 0,
      reimbursed: d.reimbursed ?? 0,
      rarityBuff: d.rarityBuff ?? 0,
      perk: d.perk ?? '',
      prepTimeMin: d.prepTimeMin ?? 0,
      bonusDamagePerCategory: d.bonusDamagePerCategory ?? {},
      bonusHpPerCategory: d.bonusHpPerCategory ?? {},
      bonusBlockChancePerCategory: d.bonusBlockChancePerCategory ?? {},
      walkMultiplier: d.walkMultiplier ?? 1,
      walkDelta: d.walkDelta ?? 0,
      hpMult: d.hpMult ?? 1,
      ignoreLootEncounters: d.ignoreLootEncounters ?? false,
      raidPassiveCreditsPerHour: d.raidPassiveCreditsPerHour ?? 0,
      gatherRaidResources: d.gatherRaidResources ?? false,
      raidResourceStorageBonus: d.raidResourceStorageBonus ?? 0,
      zoneBoost: d.zoneBoost ?? 0,
      priceChange: d.priceChange ?? 0,
      preventsSuccessZoneDeterioration: d.preventsSuccessZoneDeterioration ?? false,
      image: d.image ?? '',
      description: d.description ?? '',
      xp: Array.isArray(d.xp) ? d.xp.map(value => Math.max(0, Math.trunc(value))) : [],
      ups: Object.fromEntries(
        Object.entries(d.ups ?? {}).map(([upgradeId, upgrade]) => [upgradeId, parseGearUpgradeDefinition(upgradeId, upgrade)])
      ),
    };
    map.set(key, def);
  }
  return map;
}
