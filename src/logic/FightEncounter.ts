import type { ActiveRaid, GameState } from './GameState';
import type { FightEncounterLogEntry, FightEvent, LootEncounterLogEntry } from './RaidLog';
import Perks from './Perks';

function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }

export interface FightEncounterContext {
  monsterId: string;
}

export interface FightEncounterResult {
  entry: FightEncounterLogEntry & { monsterId: string; monsterName: string; timeSpentSec: number };
  timeSpentSec: number;
  extras: Array<LootEncounterLogEntry>;
}

export function handleFightEncounter(gs: GameState, r: ActiveRaid, ctx: FightEncounterContext): FightEncounterResult {
  const { monsterId } = ctx;
  const m = gs.lib.monsters.get(monsterId)!;
  const monsterName = m.name;
  let monsterHp = m.hp;

  const baseHit = r.hitChance;
  const baseBlock = r.blockChance;

  const theirDodge = m.dodge;
  const theirAccuracy = m.accuracy;
  const theirDamage = m.damage;

  const roundTime = 60 + (r.perks.includes(Perks.CAREFUL_MANEUVERING) ? 60 : 0);
  const immovable = r.perks.includes(Perks.IMMOVABLE_WALL);
  const hasStun = r.perks.includes(Perks.STUN);

  const fightLog: FightEvent[] = [];
  let totalTime = 0;
  let dieFromOvertime = false;
  let encounterCreated = false;
  let stunTriggered = false;

  // Up to 100 rounds
  for (let round = 0; round < 100; round++) {
    const myHpBefore = r.hp;
    const theirHpBefore = monsterHp;

    // Apply stun bonus if triggered
    const stunBonus = (hasStun && stunTriggered) ? 25 : 0;
    const hitCheck = clamp(baseHit + stunBonus - theirDodge, 0, 100);
    const myRoll = Math.floor(gs.random.get() * 100);

    if (myRoll <= hitCheck) {
      // Hit landed; they don't counter-attack this round
      const dmg = r.damage;
      const theirHpAfter = theirHpBefore - dmg;

      // Trigger stun on first successful hit with 50% probability (can only happen once per fight)
      // But only if the enemy survives this hit
      let stunJustTriggered = false;
      let hitChanceBefore = baseHit - theirDodge;
      let hitChanceAfter = baseHit - theirDodge;
      if (hasStun && !stunTriggered && theirHpAfter > 0 && Math.floor(gs.random.get() * 100) < 50) {
        stunTriggered = true;
        stunJustTriggered = true;
        // Calculate actual hit chances (not clamped) for display
        hitChanceAfter = baseHit + 25 - theirDodge;
      }
      const ev: FightEvent = {
        myHitRoll: myRoll,
        theirDodgeValue: hitCheck,
        damageDealt: dmg,
        reflectedDamage: 0,
        theirHitValue: 0,
        myBlockRoll: 0,
        damageReceived: 0,
        timeSpentSec: roundTime,
        encounterCreated: false,
        theirHpBefore,
        theirHpAfter,
        myHpBefore,
        myHpAfter: myHpBefore,
        blocked: false,
        hitLanded: true,
        stunTriggered: stunJustTriggered,
        hitChanceBefore,
        hitChanceAfter,
      } as any;
      fightLog.push(ev);
      totalTime += roundTime;
      monsterHp = theirHpAfter;
      if (monsterHp <= 0) {
        // Only create monster loot encounter if we have biopsy chance AND have spare volume in bags
        const capacity = Math.max(0, (gs.volume || 0)) + Math.max(0, (r.bagsVolume || 0));
        const usedVolume = Math.max(0, r.usedVolume || 0);
        const hasRoom = usedVolume < capacity;
        if (r.biopsyChance > 0 && m?.lootItemId && hasRoom) {
          encounterCreated = true;
          // Mark on the last event to allow UI to show a sub-line
          (fightLog[fightLog.length - 1] as any).encounterCreated = true;
        }
        break;
      }
    } else {
      // Missed; they counter-attack, we attempt to block
      const blockCheck = clamp(baseBlock - theirAccuracy, 0, 100);
      const theirHit = Math.floor(gs.random.get() * 100);
      const blocked = (theirHit <= blockCheck);
      const received = blocked ? 0 : theirDamage;
      const myHpAfter = myHpBefore - received;
      // Reflective damage (from gear) is based on monster base damage in both cases
      let reflect = 0;
      if (!blocked && r.reflectOnHitPct > 0) {
        reflect = Math.round(theirDamage * r.reflectOnHitPct / 100);
      }
      if (blocked && r.reflectOnBlockPct > 0) {
        reflect = Math.round(theirDamage * r.reflectOnBlockPct / 100);
      }
      if (reflect > 0) {
        monsterHp = monsterHp - reflect;
      }
      const ev: FightEvent = {
        myHitRoll: myRoll,
        theirDodgeValue: hitCheck,
        // Player missed this round; any outgoing damage is reflection and logged separately
        damageDealt: 0,
        reflectedDamage: reflect,
        timeSpentSec: immovable ? 0 : roundTime,
        encounterCreated: false,
        theirHitValue: theirHit,
        myBlockRoll: blockCheck,
        damageReceived: received,
        theirHpBefore,
        theirHpAfter: theirHpBefore - reflect,
        myHpBefore,
        myHpAfter,
        blocked,
        hitLanded: false,
        stunTriggered: false,
        hitChanceBefore: 0,
        hitChanceAfter: 0,
      } as any;
      fightLog.push(ev);
      totalTime += ev.timeSpentSec;
      r.hp = myHpAfter;
      if (r.hp <= 0) {
        // Defeat
        break;
      }
      if (monsterHp <= 0) {
        // Victory due to reflect
        break;
      }
    }
  }

  // If both alive after 100 rounds, die from overexertion
  if (r.hp > 0 && monsterHp > 0 && fightLog.length >= 100) {
    r.hp = 0;
    dieFromOvertime = true;
  }

  // Prepare entry
  const entry: FightEncounterLogEntry & { monsterId: string; monsterName: string; timeSpentSec: number } = {
    kind: 'FightEncounter',
    dieFromOvertime,
    fightLog,
    monsterId,
    monsterName,
    timeSpentSec: totalTime,
    hpBeforeRegen: 0,
    hpAfterRegen: 0,
  } as any;

  const extras: LootEncounterLogEntry[] = [];

  // If we killed the monster and have aspirator perk, create a follow-up loot roll using monster's loot item
  if (!dieFromOvertime && monsterHp <= 0 && encounterCreated && m?.lootItemId) {
    // We add a synthetic loot entry that will be fleshed out by the existing LootEncounter handler logic in the raid runner.
    // Here we only signal that it should happen; actual loot logic will be executed in Raid.ts after this entry.
  }

  return { entry, timeSpentSec: totalTime, extras };
}
