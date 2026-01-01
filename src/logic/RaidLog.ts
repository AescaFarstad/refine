
export interface WalkEncounterLogEntry {
  kind: 'WalkEncounter';
  hpBefore: number;
  hpAfter: number;
  timeSpentSec: number;
  speedKmH: number;
}

export interface QuestEncounterLogEntry {
  kind: 'QuestEncounter';
  questId: string;
  success: boolean;
  timeSpentSec: number;
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
  encounterCreated: boolean;// true on killing blow when aspirator will be used
  theirHpBefore: number;
  theirHpAfter: number;
  myHpBefore: number;
  myHpAfter: number;
  blocked: boolean;
  hitLanded: boolean;
  stunTriggered: boolean;
  hitChanceBefore: number;  // hit chance before stun bonus
  hitChanceAfter: number;   // hit chance after stun bonus
}

export interface FightEncounterLogEntry {
  kind: 'FightEncounter';
  dieFromOvertime: boolean;
  fightLog: FightEvent[];
  monsterId: string;
  monsterName: string;
  timeSpentSec: number;
  hpBeforeRegen: number;
  hpAfterRegen: number;
}

export interface LootEncounterLogEntry {
  kind: 'LootEncounter';
  source: 'raid' | 'monster';
  skipped: boolean;
  timeSpentSec: number;
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

export type RaidEventLogEntry =
  | WalkEncounterLogEntry
  | QuestEncounterLogEntry
  | FightEncounterLogEntry
  | LootEncounterLogEntry;

export interface RaidEventLog {
  entries: RaidEventLogEntry[];
}
