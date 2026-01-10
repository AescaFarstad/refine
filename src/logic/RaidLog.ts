/* Properties here should be non-optional. Include all necessary info as an immutable copy, so that it'd store the accurate values as of at the time of creation.*/
export interface PreparationEncounterLogEntry {
  kind: 'PreparationEncounter';
  timeSpentSec: number;
  elapsedTotalSec: number;
  tacticNames: string[];
  damageBefore: number;
  damageAfter: number;
  hpBefore: number;
  hpAfter: number;
  maxHpBefore: number;
  maxHpAfter: number;
  blockChanceBefore: number;
  blockChanceAfter: number;
}

export interface WalkEncounterLogEntry {
  kind: 'WalkEncounter';
  hpBefore: number;
  hpAfter: number;
  timeSpentSec: number;
  elapsedTotalSec: number;
  speedKmH: number;
  maxSpeedKmH: number;  // speed at full health (for comparison)
  maxHp: number;
  hasPainkiller: boolean;
  hpHealed: number;
}

export interface QuestEncounterLogEntry {
  kind: 'QuestEncounter';
  questId: string;
  success: boolean;
  timeSpentSec: number;
  elapsedTotalSec: number;
}

export interface FightEvent {
  myHitRoll: number;
  theirDodgeValue: number;
  // Damage you dealt with your successful hit (0 on miss)
  damageDealt: number;
  // Damage reflected back to the monster (applies on their counter only)
  reflectedDamage: number;
  theirHitValue: number;    // enemy's attack roll
  myBlockRoll: number;      // our block check value
  damageReceived: number;   // 0 if blocked/no counter
  timeSpentSec: number;     // time consumed by this round
  elapsedTotalSec: number;
  biopsyTriggered: boolean; // true on killing blow when biopsy/aspirator extracts loot
  theirHpBefore: number;
  theirHpAfter: number;
  myHpBefore: number;
  myHpAfter: number;
  blocked: boolean;
  hitLanded: boolean;
  stunTriggered: boolean;
  hitChanceBefore: number;  // hit chance before stun bonus
  hitChanceAfter: number;   // hit chance after stun bonus
  summonTriggered: boolean; // true when monster summons another of its kind
  selfDestructed: boolean;  // true when monster self-destructs on successful attack
}

export interface FightEncounterLogEntry {
  kind: 'FightEncounter';
  dieFromOvertime: boolean;
  fightLog: FightEvent[];
  monsterId: string;
  monsterName: string;
  timeSpentSec: number;
  elapsedTotalSec: number;
  hpBeforeRegen: number;
  hpAfterRegen: number;
  selfDestructed: boolean; // true if the monster self-destructed (no corpse left)
  summoned: boolean; // true if this fight was summoned by another monster (doesn't count toward progress)
}

export interface LootEncounterLogEntry {
  kind: 'LootEncounter';
  source: 'raid';
  skipped: boolean;
  skipReason: '' | 'bags_full' | 'zone_collapsing';
  timeSpentSec: number;
  elapsedTotalSec: number;
  myRoll: number;
  checkValue: number;
  itemId: string;
  replacedItemId: string; // item discarded to make room
  tmpLootBuffNextRaidPct: number;
  capacity: number;
  volumeBefore: number;
  volumeAfter: number;
  discarded: boolean;
  requiredVolume: number;
  biopsyChance: number;
  biopsyRoll: number;
  biopsySuccess: boolean;
}

export interface MonsterLootEncounterLogEntry {
  kind: 'MonsterLootEncounter';
  source: 'monster';
  skipped: boolean;
  skipReason: '' | 'bags_full' | 'zone_collapsing';
  timeSpentSec: number;
  elapsedTotalSec: number;
  myRoll: number;
  checkValue: number;
  itemId: string;
  replacedItemId: string; // item discarded to make room
  tmpLootBuffNextRaidPct: number;
  capacity: number;
  volumeBefore: number;
  volumeAfter: number;
  discarded: boolean;
  requiredVolume: number;
  biopsyChance: number;
  biopsyRoll: number;
  biopsySuccess: boolean;
}

export interface ZoneCollapseLogEntry {
  kind: 'ZoneCollapse';
  timeSpentSec: number;
  elapsedTotalSec: number;
  timeLimit: number;
  elapsedTime: number;
}

export type RaidEventLogEntry =
  | PreparationEncounterLogEntry
  | WalkEncounterLogEntry
  | QuestEncounterLogEntry
  | FightEncounterLogEntry
  | LootEncounterLogEntry
  | MonsterLootEncounterLogEntry
  | ZoneCollapseLogEntry;

export interface RaidEventLog {
  entries: RaidEventLogEntry[];
}

export function createPreparationEncounterLogEntry(init: Partial<PreparationEncounterLogEntry> = {}): PreparationEncounterLogEntry {
  const { kind: _kind, ...rest } = init;
  return {
    kind: 'PreparationEncounter',
    timeSpentSec: 0,
    elapsedTotalSec: 0,
    tacticNames: [],
    damageBefore: 0,
    damageAfter: 0,
    hpBefore: 0,
    hpAfter: 0,
    maxHpBefore: 0,
    maxHpAfter: 0,
    blockChanceBefore: 0,
    blockChanceAfter: 0,
    ...rest,
  };
}

export function createWalkEncounterLogEntry(init: Partial<WalkEncounterLogEntry> = {}): WalkEncounterLogEntry {
  const { kind: _kind, ...rest } = init;
  return {
    kind: 'WalkEncounter',
    hpBefore: 0,
    hpAfter: 0,
    timeSpentSec: 0,
    elapsedTotalSec: 0,
    speedKmH: 0,
    maxSpeedKmH: 0,
    maxHp: 0,
    hasPainkiller: false,
    hpHealed: 0,
    ...rest,
  };
}

export function createQuestEncounterLogEntry(init: Partial<QuestEncounterLogEntry> = {}): QuestEncounterLogEntry {
  const { kind: _kind, ...rest } = init;
  return {
    kind: 'QuestEncounter',
    questId: '',
    success: false,
    timeSpentSec: 0,
    elapsedTotalSec: 0,
    ...rest,
  };
}

export function createFightEvent(init: Partial<FightEvent> = {}): FightEvent {
  return {
    myHitRoll: 0,
    theirDodgeValue: 0,
    damageDealt: 0,
    reflectedDamage: 0,
    theirHitValue: 0,
    myBlockRoll: 0,
    damageReceived: 0,
    timeSpentSec: 0,
    elapsedTotalSec: 0,
    biopsyTriggered: false,
    theirHpBefore: 0,
    theirHpAfter: 0,
    myHpBefore: 0,
    myHpAfter: 0,
    blocked: false,
    hitLanded: false,
    stunTriggered: false,
    hitChanceBefore: 0,
    hitChanceAfter: 0,
    summonTriggered: false,
    selfDestructed: false,
    ...init,
  };
}

export function createFightEncounterLogEntry(init: Partial<FightEncounterLogEntry> = {}): FightEncounterLogEntry {
  const { kind: _kind, ...rest } = init;
  return {
    kind: 'FightEncounter',
    dieFromOvertime: false,
    fightLog: [],
    monsterId: '',
    monsterName: '',
    timeSpentSec: 0,
    elapsedTotalSec: 0,
    hpBeforeRegen: 0,
    hpAfterRegen: 0,
    selfDestructed: false,
    summoned: false,
    ...rest,
  };
}

export function createLootEncounterLogEntry(init: Partial<LootEncounterLogEntry> = {}): LootEncounterLogEntry {
  const { kind: _kind, source: _source, ...rest } = init;
  return {
    kind: 'LootEncounter',
    source: 'raid',
    skipped: false,
    skipReason: '',
    timeSpentSec: 0,
    elapsedTotalSec: 0,
    myRoll: 0,
    checkValue: 0,
    itemId: '',
    replacedItemId: '',
    tmpLootBuffNextRaidPct: 0,
    capacity: 0,
    volumeBefore: 0,
    volumeAfter: 0,
    discarded: false,
    requiredVolume: 0,
    biopsyChance: 0,
    biopsyRoll: 0,
    biopsySuccess: false,
    ...rest,
  };
}

export function createMonsterLootEncounterLogEntry(init: Partial<MonsterLootEncounterLogEntry> = {}): MonsterLootEncounterLogEntry {
  const { kind: _kind, source: _source, ...rest } = init;
  return {
    kind: 'MonsterLootEncounter',
    source: 'monster',
    skipped: false,
    skipReason: '',
    timeSpentSec: 0,
    elapsedTotalSec: 0,
    myRoll: 0,
    checkValue: 0,
    itemId: '',
    replacedItemId: '',
    tmpLootBuffNextRaidPct: 0,
    capacity: 0,
    volumeBefore: 0,
    volumeAfter: 0,
    discarded: false,
    requiredVolume: 0,
    biopsyChance: 0,
    biopsyRoll: 0,
    biopsySuccess: false,
    ...rest,
  };
}

export function createZoneCollapseLogEntry(init: Partial<ZoneCollapseLogEntry> = {}): ZoneCollapseLogEntry {
  const { kind: _kind, ...rest } = init;
  return {
    kind: 'ZoneCollapse',
    timeSpentSec: 0,
    elapsedTotalSec: 0,
    timeLimit: 0,
    elapsedTime: 0,
    ...rest,
  };
}
