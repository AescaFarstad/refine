
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
}

export interface LootEncounterLogEntry {
  kind: 'LootEncounter';
  source: 'raid' | 'monster';
  skipped: boolean;
  timeSpentSec: number;
  elapsedTotalSec: number;
  myRoll: number;
  checkValue: number;
  itemId: string;
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
  | ZoneCollapseLogEntry;

export interface RaidEventLog {
  entries: RaidEventLogEntry[];
}
