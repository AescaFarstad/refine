import type { ActiveRaid, GameState } from './GameState';
import type { FightEncounterLogEntry, FightEvent, LootEncounterLogEntry } from './RaidLog';
import Perks from './Perks';
import { FEATURE_SUMMON, FEATURE_SELF_DESTRUCT, SUMMON_CHANCE_PER_ROUND } from './MonsterFeatures';

function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }

export interface FightEncounterContext {
  monsterId: string;
}

export interface FightEncounterResult {
  entry: FightEncounterLogEntry & { monsterId: string; monsterName: string; timeSpentSec: number };
  timeSpentSec: number;
  extras: Array<LootEncounterLogEntry>;
  summonedMonsterId: string | null; // If non-null, another fight with this monster should be queued
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
  const canSummon = m.features.includes(FEATURE_SUMMON);
  const canSelfDestruct = m.features.includes(FEATURE_SELF_DESTRUCT);
  const armor = m.armor;
  const damageCap = m.damageCap;

  const fightLog: FightEvent[] = [];
  let totalTime = 0;
  let dieFromOvertime = false;
  let biopsyTriggered = false;
  let stunTriggered = false;
  let summonedMonsterId: string | null = null;
  let monsterSelfDestructed = false;

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
      let dmg = r.damage;
      if (damageCap > 0) dmg = Math.min(dmg, damageCap);
      dmg = Math.max(0, dmg - armor);
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
      // Check for summon at end of round (only if both combatants survive and not already summoned)
      let summonJustTriggered = false;
      if (canSummon && !summonedMonsterId && myHpBefore > 0 && theirHpAfter > 0 && Math.floor(gs.random.get() * 100) < SUMMON_CHANCE_PER_ROUND) {
        summonedMonsterId = monsterId;
        summonJustTriggered = true;
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
        elapsedTotalSec: 0,
        biopsyTriggered: false,
        theirHpBefore,
        theirHpAfter,
        myHpBefore,
        myHpAfter: myHpBefore,
        blocked: false,
        hitLanded: true,
        stunTriggered: stunJustTriggered,
        hitChanceBefore,
        hitChanceAfter,
        summonTriggered: summonJustTriggered,
        selfDestructed: false,
      };
      fightLog.push(ev);
      totalTime += roundTime;
      monsterHp = theirHpAfter;
      if (monsterHp <= 0) {
        // Only create monster loot encounter if we have biopsy chance AND have spare volume in bags
        const capacity = gs.volume + r.bagsVolume;
        const hasRoom = r.usedVolume < capacity;
        if (r.biopsyChance > 0 && m.lootItemId && hasRoom) {
          biopsyTriggered = true;
          fightLog[fightLog.length - 1].biopsyTriggered = true;
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
      // Apply damage cap and armor to reflected damage too
      if (reflect > 0) {
        if (damageCap > 0) reflect = Math.min(reflect, damageCap);
        reflect = Math.max(0, reflect - armor);
      }
      if (reflect > 0) {
        monsterHp = monsterHp - reflect;
      }
      const theirHpAfterReflect = theirHpBefore - reflect;
      // Self-destruct: monster dies after successful attack (not blocked)
      const selfDestructTriggered = canSelfDestruct && !blocked && received > 0;
      if (selfDestructTriggered) {
        monsterHp = 0;
        monsterSelfDestructed = true;
      }
      const theirHpFinal = selfDestructTriggered ? 0 : theirHpAfterReflect;
      // Check for summon at end of round (only if both combatants survive and not already summoned)
      let summonJustTriggered = false;
      if (canSummon && !summonedMonsterId && myHpAfter > 0 && theirHpFinal > 0 && Math.floor(gs.random.get() * 100) < SUMMON_CHANCE_PER_ROUND) {
        summonedMonsterId = monsterId;
        summonJustTriggered = true;
      }
      const ev: FightEvent = {
        myHitRoll: myRoll,
        theirDodgeValue: hitCheck,
        // Player missed this round; any outgoing damage is reflection and logged separately
        damageDealt: 0,
        reflectedDamage: reflect,
        timeSpentSec: immovable ? 0 : roundTime,
        elapsedTotalSec: 0,
        biopsyTriggered: false,
        theirHitValue: theirHit,
        myBlockRoll: blockCheck,
        damageReceived: received,
        theirHpBefore,
        theirHpAfter: theirHpFinal,
        myHpBefore,
        myHpAfter,
        blocked,
        hitLanded: false,
        stunTriggered: false,
        hitChanceBefore: 0,
        hitChanceAfter: 0,
        summonTriggered: summonJustTriggered,
        selfDestructed: selfDestructTriggered,
      };
      fightLog.push(ev);
      totalTime += ev.timeSpentSec;
      r.hp = myHpAfter;
      if (r.hp <= 0) {
        // Defeat
        break;
      }
      if (monsterHp <= 0) {
        // Victory due to reflect or self-destruct (no corpse for self-destruct)
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
    elapsedTotalSec: 0,
    hpBeforeRegen: 0,
    hpAfterRegen: 0,
    selfDestructed: monsterSelfDestructed,
  };

  const extras: LootEncounterLogEntry[] = [];

  // If we killed the monster and biopsy triggered, create a follow-up loot roll using monster's loot item
  if (!dieFromOvertime && monsterHp <= 0 && biopsyTriggered && m.lootItemId) {
    // We add a synthetic loot entry that will be fleshed out by the existing LootEncounter handler logic in the raid runner.
    // Here we only signal that it should happen; actual loot logic will be executed in Raid.ts after this entry.
  }

  return { entry, timeSpentSec: totalTime, extras, summonedMonsterId };
}
