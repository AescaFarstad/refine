import type { ActiveRaid, GameState } from './GameState';
import { createFightEncounterLogEntry, type FightEncounterLogEntry, type FightEvent, type LootEncounterLogEntry } from './RaidLog';
import Perks from './Perks';
import { FEATURE_SUMMON, FEATURE_SUMMON2, FEATURE_SELF_DESTRUCT, SUMMON_CHANCE_PER_ROUND, SUMMON_CHANCE_PER_ROUND2 } from './MonsterFeatures';
import { REGEN_INTERVAL_SEC } from './Const';

function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }

interface RegenResult {
  healed: number;
  hpBefore: number;
  hpAfter: number;
  ticksCrossed: number;
  nextRegenThresholdSec: number;
}

function applyTimeRegen(
  r: ActiveRaid,
  regenPer10Minutes: number,
  totalElapsedAfterRound: number,
  nextRegenThresholdSec: number
): RegenResult {
  let healed = 0;
  let hpBefore = 0;
  let hpAfter = 0;
  let ticksCrossed = 0;

  if (regenPer10Minutes > 0 && r.hp > 0) {
    if (nextRegenThresholdSec === 0 && r.hp < r.maxHp) {
      nextRegenThresholdSec = totalElapsedAfterRound + REGEN_INTERVAL_SEC;
    }
    while (nextRegenThresholdSec > 0 && nextRegenThresholdSec <= totalElapsedAfterRound) {
      if (r.hp < r.maxHp) {
        if (healed === 0) {
          hpBefore = r.hp;
        }
        const missing = r.maxHp - r.hp;
        const healAmount = Math.min(regenPer10Minutes, missing);
        r.hp += healAmount;
        healed += healAmount;
        hpAfter = r.hp;
        ticksCrossed++;
      }
      nextRegenThresholdSec += REGEN_INTERVAL_SEC;
    }
  }

  return { healed, hpBefore, hpAfter, ticksCrossed, nextRegenThresholdSec };
}

export interface FightEncounterContext {
  monsterId: string;
  injected: boolean;
  regenPer10Minutes: number;
  elapsedTimeBeforeFight: number;
  /** Next time threshold (in seconds) at which regen should tick */
  nextRegenThresholdSec: number;
}

export interface FightEncounterResult {
  entry: FightEncounterLogEntry & { monsterId: string; monsterName: string; timeSpentSec: number };
  timeSpentSec: number;
  extras: Array<LootEncounterLogEntry>;
  summonedMonsterId: string | null;
  /** Updated next regen threshold (advanced past any thresholds crossed during fight) */
  nextRegenThresholdSec: number;
}

export function handleFightEncounter(gs: GameState, r: ActiveRaid, ctx: FightEncounterContext): FightEncounterResult {
  const { monsterId, injected, regenPer10Minutes, elapsedTimeBeforeFight, nextRegenThresholdSec: inputNextThreshold } = ctx;
  const m = gs.lib.monsters.get(monsterId)!;
  const monsterName = m.name;
  const hasCamouflage = r.perks.includes(Perks.CAMOUFLAGE);
  if (hasCamouflage && Math.floor(gs.random.get() * 100) < 10) {
    const entry: FightEncounterLogEntry & { monsterId: string; monsterName: string; timeSpentSec: number } = createFightEncounterLogEntry({
      monsterId,
      monsterName,
      skipped: true,
      skipReason: 'camouflage',
      injected,
      timeSpentSec: 0,
      elapsedTotalSec: elapsedTimeBeforeFight,
    });
    return { entry, timeSpentSec: 0, extras: [], summonedMonsterId: null, nextRegenThresholdSec: inputNextThreshold };
  }
  let monsterHp = m.hp;

  const baseHit = r.hitChance;
  const baseBlock = r.blockChance;

  const theirDodge = m.dodge;
  const theirAccuracy = m.accuracy;
  const theirDamage = m.damage;

  const roundTime = 60 + (r.perks.includes(Perks.AIMING) ? 60 : 0);
  const canSummon = m.features.includes(FEATURE_SUMMON);
  const canSummon2 = m.features.includes(FEATURE_SUMMON2);
  const canSelfDestruct = m.features.includes(FEATURE_SELF_DESTRUCT);
  const armor = r.perks.includes(Perks.ARMOR_PIERCING) ? Math.floor(m.armor / 2) : m.armor;
  const damageCap = m.damageCap;

  const fightLog: FightEvent[] = [];
  let totalTime = 0;
  let dieFromOvertime = false;
  let biopsyTriggered = false;
  let summonedMonsterId: string | null = null;
  let monsterSelfDestructed = false;
  let remainingAttackSkips = r.attackSkipCount;

  let fightTimeSec = 0; // Time elapsed during this fight only
  let nextRegenThresholdSec = inputNextThreshold;
  // Up to 100 rounds
  for (let round = 0; round < 100; round++) {
    const myHpBefore = r.hp;
    const theirHpBefore = monsterHp;

    const hitCheck = clamp(baseHit - theirDodge, 0, 100);
    const myRoll = Math.floor(gs.random.get() * 100);

    if (myRoll <= hitCheck) {
      // Hit landed
      let dmg = r.damage;
      if (damageCap > 0) dmg = Math.min(dmg, damageCap);
      dmg = Math.max(0, dmg - armor);
      const theirHpAfter = theirHpBefore - dmg;

      // Roll for stun on landed hit: stunned monsters don't retaliate.
      const stunThisRound = theirHpAfter > 0 && Math.floor(gs.random.get() * 100) < r.stunChance;

      // Monster counter-attacks when it survives the hit and isn't stunned
      let theirHit = 0;
      let blockCheck = 0;
      let blocked = false;
      let received = 0;
      let attackSkipTriggered = false;
      const monsterAttacked = theirHpAfter > 0 && !stunThisRound;
      if (monsterAttacked) {
        blockCheck = clamp(baseBlock - theirAccuracy, 0, 100);
        theirHit = Math.floor(gs.random.get() * 100);
        blocked = (theirHit <= blockCheck);
        received = blocked ? 0 : Math.max(0, theirDamage - r.armor);
        if (received > 0 && remainingAttackSkips > 0) {
          received = 0;
          attackSkipTriggered = true;
          remainingAttackSkips -= 1;
        }
      }
      const myHpAfter = myHpBefore - received;
      r.hp = myHpAfter;

      // Check for summon at end of round (only if both combatants survive and not already summoned)
      let summonJustTriggered = false;
      const summonChance = canSummon2 ? SUMMON_CHANCE_PER_ROUND2 : SUMMON_CHANCE_PER_ROUND;
      if ((canSummon || canSummon2) && !summonedMonsterId && myHpAfter > 0 && theirHpAfter > 0 && Math.floor(gs.random.get() * 100) < summonChance) {
        summonedMonsterId = monsterId;
        summonJustTriggered = true;
      }
      const thisRoundTime = roundTime + (monsterAttacked ? 60 : 0);
      const totalElapsedAfterRound = elapsedTimeBeforeFight + fightTimeSec + thisRoundTime;
      const regen = applyTimeRegen(r, regenPer10Minutes, totalElapsedAfterRound, nextRegenThresholdSec);
      nextRegenThresholdSec = regen.nextRegenThresholdSec;
      const ev: FightEvent = {
        myHitRoll: myRoll,
        theirDodgeValue: hitCheck,
        damageDealt: dmg,
        reflectedDamage: 0,
        theirHitValue: theirHit,
        myBlockRoll: blockCheck,
        damageReceived: received,
        timeSpentSec: thisRoundTime,
        elapsedTotalSec: 0,
        biopsyTriggered: false,
        theirHpBefore,
        theirHpAfter,
        myHpBefore,
        myHpAfter: r.hp, // Use updated HP after regen
        blocked,
        hitLanded: true,
        stunTriggered: stunThisRound,
        monsterStunned: stunThisRound,
        attackSkipTriggered,
        summonTriggered: summonJustTriggered,
        selfDestructed: false,
        timeRegenHealed: regen.healed,
        timeRegenHpBefore: regen.hpBefore,
        timeRegenHpAfter: regen.hpAfter,
        timeRegenDurationSec: regen.ticksCrossed * REGEN_INTERVAL_SEC,
      };
      fightLog.push(ev);
      totalTime += thisRoundTime;
      fightTimeSec += thisRoundTime;
      monsterHp = theirHpAfter;
      if (r.hp <= 0) {
        // Defeat from counterattack
        break;
      }
      if (monsterHp <= 0) {
        // Only create monster loot encounter if we have biopsy chance AND have spare volume in bags
        // AND the monster did not self-destruct (self-destructing monsters leave no corpse)
        const capacity = gs.volume + r.bagsVolume;
        const hasRoom = r.usedVolume < capacity;
        if (r.biopsyChance > 0 && m.lootItemId && hasRoom && !monsterSelfDestructed) {
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
      let received = blocked ? 0 : Math.max(0, theirDamage - r.armor);
      let attackSkipTriggered = false;
      if (received > 0 && remainingAttackSkips > 0) {
        received = 0;
        attackSkipTriggered = true;
        remainingAttackSkips -= 1;
      }
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
      const summonChance = canSummon2 ? SUMMON_CHANCE_PER_ROUND2 : SUMMON_CHANCE_PER_ROUND;
      if ((canSummon || canSummon2) && !summonedMonsterId && myHpAfter > 0 && theirHpFinal > 0 && Math.floor(gs.random.get() * 100) < summonChance) {
        summonedMonsterId = monsterId;
        summonJustTriggered = true;
      }
      r.hp = myHpAfter;
      const thisRoundTime = roundTime + 60; // monster always counter-attacks on miss
      const totalElapsedAfterRound = elapsedTimeBeforeFight + fightTimeSec + thisRoundTime;
      const regen = applyTimeRegen(r, regenPer10Minutes, totalElapsedAfterRound, nextRegenThresholdSec);
      nextRegenThresholdSec = regen.nextRegenThresholdSec;
      const ev: FightEvent = {
        myHitRoll: myRoll,
        theirDodgeValue: hitCheck,
        // Player missed this round; any outgoing damage is reflection and logged separately
        damageDealt: 0,
        reflectedDamage: reflect,
        timeSpentSec: thisRoundTime,
        elapsedTotalSec: 0,
        biopsyTriggered: false,
        theirHitValue: theirHit,
        myBlockRoll: blockCheck,
        damageReceived: received,
        theirHpBefore,
        theirHpAfter: theirHpFinal,
        myHpBefore,
        myHpAfter: r.hp, // Use updated HP after regen
        blocked,
        hitLanded: false,
        stunTriggered: false,
        monsterStunned: false,
        attackSkipTriggered,
        summonTriggered: summonJustTriggered,
        selfDestructed: selfDestructTriggered,
        timeRegenHealed: regen.healed,
        timeRegenHpBefore: regen.hpBefore,
        timeRegenHpAfter: regen.hpAfter,
        timeRegenDurationSec: regen.ticksCrossed * REGEN_INTERVAL_SEC,
      };
      fightLog.push(ev);
      totalTime += thisRoundTime;
      fightTimeSec += thisRoundTime;
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

  // Prepare entry - time regen is tracked per-round in fightLog, not as a summary
  const entry: FightEncounterLogEntry & { monsterId: string; monsterName: string; timeSpentSec: number } = createFightEncounterLogEntry({
    dieFromOvertime,
    fightLog,
    monsterId,
    monsterName,
    timeSpentSec: totalTime,
    selfDestructed: monsterSelfDestructed,
    injected,
    // Time regen is shown per-round now, not as a fight summary
    timeRegenHpBefore: 0,
    timeRegenHpAfter: 0,
    timeRegenDurationSec: 0,
  });

  const extras: LootEncounterLogEntry[] = [];

  // If we killed the monster and biopsy triggered, create a follow-up loot roll using monster's loot item
  if (!dieFromOvertime && monsterHp <= 0 && biopsyTriggered && m.lootItemId) {
    // We add a synthetic loot entry that will be fleshed out by the existing LootEncounter handler logic in the raid runner.
    // Here we only signal that it should happen; actual loot logic will be executed in Raid.ts after this entry.
  }

  return { entry, timeSpentSec: totalTime, extras, summonedMonsterId, nextRegenThresholdSec };
}
