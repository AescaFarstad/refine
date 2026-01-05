import type { GameState, ActiveRaid } from './GameState';
import type { RaidDefinition, EncounterDef, FightEncounterDef, QuestEncounterDef } from './RaidLib';
import type { GearDefinition } from './GearLib';
import { createLootEncounterLogEntry, createMonsterLootEncounterLogEntry, createQuestEncounterLogEntry, createZoneCollapseLogEntry, type LootEncounterLogEntry, type MonsterLootEncounterLogEntry, type RaidEventLog } from './RaidLog';
import { handleWalkEncounter } from './WalkEncounter';
import { handleLootLikeEncounter, handleMonsterLootEncounter } from './LootEncounter';
import { handleFightEncounter } from './FightEncounter';
import { handlePreparationEncounter, createPreparationEncounter } from './PreparationEncounter';
import SeededRandom from './core/SeededRandom';
import { applyPermanentRaidMutation, cloneRaid, applyRaidMutation, questIsActive, type RaidMutation } from './RaidMutation';
import type { QuestResourceRewards } from './QuestLib';

export interface RaidRunResult {
  success: boolean;
  log: RaidEventLog;
  bagItemCounts: Record<string, number>;
  discardedItemCounts: Record<string, number>;
  timeSpentSec: number;
  plannedEncounters: number;
  barelyInTime: boolean;
  questsCompleted: string[];
  skillPointsGained: number;
  resourcesGained: QuestResourceRewards;
  raidMutationsApplied: RaidMutation[];
  raidItemsAdded: string[];
  lootChanceDeltaApplied: number;
  lootingRarityBuffDeltaApplied: number;
}

function loadoutGear(gs: GameState, raidId: string): GearDefinition[] {
  const ids: string[] = gs.loadouts[raidId] ?? [];
  return ids.map(id => gs.lib.gear.get(id)!);
}

function countByCategory(gear: GearDefinition[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const g of gear) {
    const cat = g.category.trim();
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return counts;
}

function sumBonus(map: Record<string, number> | undefined, counts: Record<string, number>): number {
  if (!map) return 0;
  let total = 0;
  for (const [cat, per] of Object.entries(map)) {
    total += per * (counts[cat] || 0);
  }
  return total;
}

function computePreparationBonuses(gear: GearDefinition[], counts: Record<string, number>) {
  let prepTimeMin = 0;
  const prepTacticNames: string[] = [];
  let damageBonus = 0;
  let hpBonus = 0;
  let blockChanceBonus = 0;

  for (const g of gear) {
    const pt = Math.max(0, Math.trunc(g.prepTimeMin ?? 0));
    if (pt > 0) prepTacticNames.push(g.name || g.id);
    prepTimeMin += pt;

    damageBonus += sumBonus(g.bonusDamagePerCategory, counts);
    hpBonus += sumBonus(g.bonusHpPerCategory, counts);
    blockChanceBonus += sumBonus(g.bonusBlockChancePerCategory, counts);
  }

  return {
    prepTimeSec: Math.max(0, Math.trunc(prepTimeMin * 60)),
    prepTacticNames,
    damageBonus: Math.trunc(damageBonus),
    hpBonus: Math.trunc(hpBonus),
    blockChanceBonus: Math.trunc(blockChanceBonus),
  };
}

function applyGearToRaidDefinition(def: RaidDefinition, gear: GearDefinition[]): void {
  let walkMultiplier = 1;
  let walkDelta = 0;
  let ignoreLootEncounters = false;

  for (const g of gear) {
    const mult = g.walkMultiplier ?? 1;
    if (mult !== 1) walkMultiplier *= mult;
    walkDelta += (g.walkDelta ?? 0);
    if (g.ignoreLootEncounters) ignoreLootEncounters = true;
  }

  if (ignoreLootEncounters) {
    // monster corpse harvesting remains intact: it's a separate encounter type
    const encounters = def.encounters;
    for (let i = encounters.length - 1; i >= 0; i--) {
      if (encounters[i].encounter.type === 'LootEncounter') encounters.splice(i, 1);
    }
  }

  if (walkMultiplier !== 1 || walkDelta !== 0) {
    const cur = totalCount(def, 'WalkEncounter');
    const scaled = Math.trunc(cur * walkMultiplier);
    const next = Math.max(0, scaled + Math.trunc(walkDelta));
    setCount(def, 'WalkEncounter', next);
  }
}

function buildEncounterQueue(gs: GameState, raid: RaidDefinition): EncounterDef[] {
  // Expand counts into flat pools by type
  let walkCount = 0;
  const lootPool: EncounterDef[] = [];
  const fightPool: EncounterDef[] = [];
  const questPool: EncounterDef[] = [];

  for (const step of raid.encounters) {
    const c = Math.max(0, step.count | 0);
    if (!c) continue;
    switch (step.encounter.type) {
      case 'WalkEncounter':
        walkCount += c;
        break;
      case 'LootEncounter':
        for (let i = 0; i < c; i++) lootPool.push({ type: 'LootEncounter' } as EncounterDef);
        break;
      case 'FightEncounter': {
        const mid = (step.encounter as FightEncounterDef).monsterId;
        for (let i = 0; i < c; i++) fightPool.push({ type: 'FightEncounter', monsterId: mid } as EncounterDef);
        break;
      }
      case 'QuestEncounter': {
        const qid = (step.encounter as QuestEncounterDef).questId;
        for (let i = 0; i < c; i++) questPool.push({ type: 'QuestEncounter', questId: qid });
        break;
      }
      // MonsterLootEncounter is dynamically inserted by the runner and should not be present here
      default:
        break;
    }
  }

  const bucketsCount = Math.max(1, walkCount + 1);
  const buckets: Array<{ items: EncounterDef[]; fights: number } > = Array.from({ length: bucketsCount }, () => ({ items: [], fights: 0 }));

  // Spread LootEncounters as evenly as possible among buckets (round-robin)
  for (let i = 0; i < lootPool.length; i++) {
    const bi = i % bucketsCount;
    buckets[bi].items.push(lootPool[i]);
  }

  // Spread FightEncounters as evenly as possible; tiebreaker = total items in bucket
  for (const f of fightPool) {
    let bestIdx = 0;
    for (let i = 1; i < bucketsCount; i++) {
      const a = buckets[bestIdx];
      const b = buckets[i];
      if (b.fights < a.fights) { bestIdx = i; continue; }
      if (b.fights === a.fights && b.items.length < a.items.length) { bestIdx = i; }
    }
    buckets[bestIdx].items.push(f);
    buckets[bestIdx].fights += 1;
  }

  // Place QuestEncounters into the middle bucket
  if (questPool.length > 0) {
    const mid = Math.floor(bucketsCount / 2);
    for (const q of questPool) buckets[mid].items.push(q);
  }

  // Shuffle within each bucket using seeded RNG
  for (const b of buckets) {
    gs.random.shuffleInPlace(b.items);
  }

  // Build final queue: bucket0, Walk, bucket1, Walk, ..., last bucket
  const queue: EncounterDef[] = [];
  for (let i = 0; i < bucketsCount; i++) {
    // Non-walk encounters for this segment
    for (const e of buckets[i].items) queue.push(e);
    // Insert a single WalkEncounter between buckets (there are walkCount walks total)
    if (i < walkCount) queue.push({ type: 'WalkEncounter' } as EncounterDef);
  }
  return queue;
}

function totalCount(def: RaidDefinition, type: string): number {
  let n = 0;
  for (const step of def.encounters) {
    if (step.encounter.type !== type) continue;
    n += Math.max(0, Math.trunc(step.count));
  }
  return n;
}

function setCount(def: RaidDefinition, type: string, newCount: number): void {
  const next = Math.max(0, Math.trunc(newCount));
  const encounters = def.encounters;
  const firstIdx = encounters.findIndex(s => s.encounter.type === type);

  for (let i = encounters.length - 1; i >= 0; i--) {
    if (encounters[i].encounter.type === type) encounters.splice(i, 1);
  }

  if (next <= 0) return;
  const entry = { count: next, encounter: { type } as EncounterDef };
  if (firstIdx >= 0 && firstIdx <= encounters.length) encounters.splice(firstIdx, 0, entry);
  else encounters.push(entry);
}


function cloneActiveRaidState(r: ActiveRaid): ActiveRaid {
  return {
    id: r.id,
    hp: r.hp,
    maxHp: r.maxHp,
    baseSpeed: r.baseSpeed,
    speedBonusPct: r.speedBonusPct,
    speedBonusFlat: r.speedBonusFlat,
    regenPerKm: r.regenPerKm,
    weight: r.weight,
    maxWeight: r.maxWeight,
    bagsVolume: r.bagsVolume,
    usedVolume: r.usedVolume,
    damage: r.damage,
    perks: [...r.perks],
    lootChanceBonus: r.lootChanceBonus,
    tmpLootBuffAppliedPct: r.tmpLootBuffAppliedPct,
    tmpLootBuffNextRaidPct: r.tmpLootBuffNextRaidPct,
    hitChance: r.hitChance,
    blockChance: r.blockChance,
    reflectOnHitPct: r.reflectOnHitPct,
    reflectOnBlockPct: r.reflectOnBlockPct,
    biopsyChance: r.biopsyChance,
  } as ActiveRaid;
}

export function runRaid(gs: GameState, raidDef: RaidDefinition, dryRun: boolean = false): RaidRunResult {
  const raid = dryRun ? cloneActiveRaidState(gs.raid) : gs.raid;
  raid.tmpLootBuffNextRaidPct = 0;
  // When running for real, use the game state's random generator (affects game state)
  // When doing a dry run/simulation, create a temporary random that doesn't affect game state
  const simRnd = dryRun
    ? new SeededRandom((Math.random() * 2147483647) | 0)
    : gs.random;
  const gsForRun: GameState = dryRun ? ({ ...gs, random: simRnd, raid }) : gs;
  const log: RaidEventLog = { entries: [] };
  const bagItemCounts: Record<string, number> = {};
  const discardedItemCounts: Record<string, number> = {};
  // Elapsed time since the beginning of the raid
  let timeSpentSec = 0;
  let barelyInTime = false;
  const questsCompleted: string[] = [];
  let skillPointsGained = 0;
  const resourcesGained: QuestResourceRewards = { credits: 0, chronotraces: 0, timeFlux: 0, shardDust: 0 };
  const raidMutationsApplied: RaidMutation[] = [];
  const raidItemsAdded: string[] = [];
  let lootChanceDeltaApplied = 0;
  let lootingRarityBuffDeltaApplied = 0;

  const activeQuestIdsAtStart = new Set<string>();
  if (!dryRun) {
    gsForRun.lib.quests.forEach((q) => {
      if (questIsActive(gsForRun, q, raidDef.id)) activeQuestIdsAtStart.add(q.id);
    });
  }

  // Build a mutable encounter queue expanded and ordered per concept buckets
  const queue: EncounterDef[] = buildEncounterQueue(gsForRun, raidDef);

  const gear = loadoutGear(gsForRun, raidDef.id);
  const counts = countByCategory(gear);
  const prepBonuses = computePreparationBonuses(gear, counts);
  const prep = createPreparationEncounter(prepBonuses);
  if (prep) queue.unshift(prep);
  // Store the planned encounter count before we start processing (for UI progress indicator)
  const plannedEncounters = queue.length;

  while (queue.length > 0) {
    const enc = queue.shift()!;

    const zoneCollapseLimit = raidDef.zoneCollapseSec;
    if (zoneCollapseLimit > 0 && timeSpentSec >= zoneCollapseLimit) {
      const remainingEncounters = [enc, ...queue];
      const hasUnsafeEncounters = remainingEncounters.some(e =>
        e.type !== 'LootEncounter' && e.type !== 'MonsterLootEncounter'
      );

      if (hasUnsafeEncounters) {
        const collapseEntry = createZoneCollapseLogEntry({
          elapsedTotalSec: timeSpentSec,
          timeLimit: zoneCollapseLimit,
          elapsedTime: timeSpentSec,
        });
        log.entries.push(collapseEntry);
        raid.hp = 0;
        return {
          success: false,
          log,
          bagItemCounts,
          discardedItemCounts,
          timeSpentSec,
          plannedEncounters,
          barelyInTime: false,
          questsCompleted,
          skillPointsGained,
          resourcesGained,
          raidMutationsApplied,
          raidItemsAdded,
          lootChanceDeltaApplied,
          lootingRarityBuffDeltaApplied,
        };
      } else {
        barelyInTime = true;
        for (const skippedEnc of remainingEncounters) {
          if (skippedEnc.type === 'LootEncounter' || skippedEnc.type === 'MonsterLootEncounter') {
            const skippedEntry: LootEncounterLogEntry | MonsterLootEncounterLogEntry =
              skippedEnc.type === 'MonsterLootEncounter'
                ? createMonsterLootEncounterLogEntry({
                  skipped: true,
                  skipReason: 'zone_collapsing',
                  elapsedTotalSec: timeSpentSec,
                  capacity: raid.bagsVolume,
                  volumeBefore: raid.usedVolume,
                  volumeAfter: raid.usedVolume,
                })
                : createLootEncounterLogEntry({
                  skipped: true,
                  skipReason: 'zone_collapsing',
                  elapsedTotalSec: timeSpentSec,
                  capacity: raid.bagsVolume,
                  volumeBefore: raid.usedVolume,
                  volumeAfter: raid.usedVolume,
                });
            log.entries.push(skippedEntry);
          }
        }
        queue.length = 0;
      }
    }

    switch (enc.type) {
      case 'PreparationEncounter': {
        const entry = handlePreparationEncounter(raid, enc);
        timeSpentSec += entry.timeSpentSec;
        entry.elapsedTotalSec = timeSpentSec;
        log.entries.push(entry);
        break;
      }
      case 'WalkEncounter': {
        const entry = handleWalkEncounter(raid);
        timeSpentSec += entry.timeSpentSec;
        entry.elapsedTotalSec = timeSpentSec;
        log.entries.push(entry);
        break;
      }
      case 'QuestEncounter': {
        const qid = enc.questId;
        const quest = gsForRun.lib.quests.get(qid)!;
        const entry = createQuestEncounterLogEntry({ questId: qid, success: true, timeSpentSec: Math.round(quest.encounterTimeMin * 60) });
        timeSpentSec += entry.timeSpentSec;
        entry.elapsedTotalSec = timeSpentSec;
        log.entries.push(entry);
        break;
      }
      case 'LootEncounter': {
        const entry = handleLootLikeEncounter(gsForRun, raid, {
          baseLootChance: raidDef.baseLootChance,
          items: raidDef.items,
          poolsByRarity: raidDef.itemPoolsByRarity,
        }, bagItemCounts, discardedItemCounts);
        timeSpentSec += entry.timeSpentSec;
        entry.elapsedTotalSec = timeSpentSec;
        log.entries.push(entry);
        break;
      }
      case 'FightEncounter': {
        const monsterId = enc.monsterId;
        const summoned = (enc as FightEncounterDef).summoned || false;
        const fight = handleFightEncounter(gsForRun, raid, { monsterId, summoned });
        let t = timeSpentSec;
        for (const ev of fight.entry.fightLog) {
          t += ev.timeSpentSec;
          ev.elapsedTotalSec = t;
        }
        timeSpentSec += fight.timeSpentSec;
        fight.entry.elapsedTotalSec = timeSpentSec;
        log.entries.push(fight.entry);
        // biopsy
        const lastEv = fight.entry.fightLog[fight.entry.fightLog.length - 1];
        if (lastEv?.biopsyTriggered) {
          queue.unshift({ type: 'MonsterLootEncounter', monsterId });
        }
        // monster summoned
        if (fight.summonedMonsterId) {
          queue.unshift({ type: 'FightEncounter', monsterId: fight.summonedMonsterId, summoned: true });
        }
        // we died
        if (raid.hp <= 0) {
          return {
            success: false,
            log,
            bagItemCounts,
            discardedItemCounts,
            timeSpentSec,
            plannedEncounters,
            barelyInTime: false,
            questsCompleted,
            skillPointsGained,
            resourcesGained,
            raidMutationsApplied,
            raidItemsAdded,
            lootChanceDeltaApplied,
            lootingRarityBuffDeltaApplied,
          };
        }
        if (raid.regenAfterEncounter > 0) {
          const hpBefore = raid.hp;
          raid.hp = Math.min(raid.maxHp, raid.hp + raid.regenAfterEncounter);
          const hpAfter = raid.hp;
          fight.entry.hpBeforeRegen = hpBefore;
          fight.entry.hpAfterRegen = hpAfter;
        }
        break;
      }
      case 'MonsterLootEncounter': {
        const mid = enc.monsterId;
        const m = gsForRun.lib.monsters.get(mid)!;
        const entry = handleMonsterLootEncounter(gsForRun, raid, m.lootItemId, raid.biopsyChance, bagItemCounts, discardedItemCounts);
        timeSpentSec += entry.timeSpentSec;
        entry.elapsedTotalSec = timeSpentSec;
        log.entries.push(entry);
        break;
      }
    }
  }

  if (!dryRun) {
    const raidId = raidDef.id;
    const raidEntry = gsForRun.unlockedRaids.find(r => r.id === raidId)!;
    raidEntry.successes += 1;

    const completedSet = new Set<string>();
    // Quests with encounterTimeMin > 0 require a QuestEncounter in the log to complete
    for (const e of log.entries) {
      if (e.kind !== 'QuestEncounter') continue;
      if (!activeQuestIdsAtStart.has(e.questId)) continue;
      if (gsForRun.completedQuests.includes(e.questId)) continue;
      completedSet.add(e.questId);
    }

    // Quests with encounterTimeMin === 0 complete just by finishing the raid
    for (const qid of activeQuestIdsAtStart) {
      if (gsForRun.completedQuests.includes(qid)) continue;
      const q = gsForRun.lib.quests.get(qid)!;
      if (q.encounterTimeMin > 0) continue;
      completedSet.add(qid);
    }

    let shouldRebuildPools = false;

    for (const qid of completedSet) {
      const q = gsForRun.lib.quests.get(qid)!;

      gsForRun.skillPoints += q.rewards.skillPoints;
      skillPointsGained += q.rewards.skillPoints;
      for (const u of q.rewards.unlocks) {
        if (!gsForRun.unlocks.includes(u)) gsForRun.unlocks.push(u);
      }

      const rr = q.rewards.resources;
      if (rr.credits) { gsForRun.credits += rr.credits; resourcesGained.credits += rr.credits; }
      if (rr.chronotraces) { gsForRun.chronotraces += rr.chronotraces; resourcesGained.chronotraces += rr.chronotraces; }
      if (rr.timeFlux) { gsForRun.timeFlux += rr.timeFlux; resourcesGained.timeFlux += rr.timeFlux; }
      if (rr.shardDust) { gsForRun.shardDust += rr.shardDust; resourcesGained.shardDust += rr.shardDust; }

      if (q.rewards.lootChanceDelta) {
        const raidDefToChange = gsForRun.lib.raids.get(raidId)!;
        const before = raidDefToChange.baseLootChance;
        const after = Math.max(0, Math.min(100, before + q.rewards.lootChanceDelta));
        raidDefToChange.baseLootChance = after;
        lootChanceDeltaApplied += (after - before);
      }

      if (q.rewards.lootingRarityBuffDelta) {
        const before = raidEntry.lootingRarityBuff;
        const after = before + q.rewards.lootingRarityBuffDelta;
        raidEntry.lootingRarityBuff = after;
        lootingRarityBuffDeltaApplied += (after - before);
      }

      for (const m of q.rewards.raidMutations) {
        applyPermanentRaidMutation(gsForRun, raidId, m);
        raidMutationsApplied.push(m);
      }

      if (q.rewards.addRaidItems.length) {
        const raidDefToChange = gsForRun.lib.raids.get(raidId)!;
        for (const itemId of q.rewards.addRaidItems) {
          if (raidDefToChange.items.includes(itemId)) continue;
          raidDefToChange.items.push(itemId);
          raidItemsAdded.push(itemId);
          shouldRebuildPools = true;
        }
      }

      gsForRun.completedQuests.push(qid);
      questsCompleted.push(qid);
      const i = gsForRun.activeQuests.indexOf(qid);
      if (i !== -1) gsForRun.activeQuests.splice(i, 1);
    }

    if (shouldRebuildPools) {
      const raidDefToChange = gsForRun.lib.raids.get(raidId)!;
      raidDefToChange.itemPoolsByRarity = gsForRun.lib.buildItemPoolsByRarity(raidDefToChange.items);
    }

    raidEntry.questCompletions += questsCompleted.length;
  }

  return {
    success: true,
    log,
    bagItemCounts,
    discardedItemCounts,
    timeSpentSec,
    plannedEncounters,
    barelyInTime,
    questsCompleted,
    skillPointsGained,
    resourcesGained,
    raidMutationsApplied,
    raidItemsAdded,
    lootChanceDeltaApplied,
    lootingRarityBuffDeltaApplied,
  };
}

export function dryRunRaid(gs: GameState, raidDef: RaidDefinition): RaidRunResult {
  return runRaid(gs, raidDef, true);
}

export function getEffectiveRaidDefinition(gs: GameState, raidId: string): RaidDefinition {
  const def = cloneRaid(gs.lib.raids.get(raidId)!);
  gs.lib.quests.forEach((q) => {
    if (!questIsActive(gs, q, raidId)) return;
    if (q.encounterTimeMin > 0) {
      // Ensure active quests with an encounter time create a quest encounter (for timing/log/completion).
      const hasOwnQuestEncounter = def.encounters.some(step =>
        step.encounter.type === 'QuestEncounter' && (step.encounter as QuestEncounterDef).questId === q.id && (step.count | 0) > 0
      );
      if (!hasOwnQuestEncounter) {
        applyRaidMutation(def, { kind: 'QuestMutation', questId: q.id, count: 1 });
      }
    }
    for (const m of q.encounters) applyRaidMutation(def, m);
  });
  const gear = loadoutGear(gs, raidId);
  applyGearToRaidDefinition(def, gear);
  return def;
}

export function recomputeActiveRaidEstimates(gs: GameState, simulations = 100): void {
  const def = getEffectiveRaidDefinition(gs, gs.raid.id);
  let wins = 0;
  let zoneCollapseDeaths = 0;
  // Sum time only for successful runs to estimate time conditioned on success
  let successTimeSum = 0;
  for (let i = 0; i < simulations; i++) {
    const res = runRaid(gs, def, true);
    if (res.success) {
      wins++;
      successTimeSum += Math.max(0, res.timeSpentSec || 0);
    } else {
      const hasZoneCollapse = res.log.entries.some(entry => entry.kind === 'ZoneCollapse');
      if (hasZoneCollapse) {
        zoneCollapseDeaths++;
      }
    }
  }
  gs.raidSurvivalEstimatePct = Math.round((wins / simulations) * 100);
  // If no wins, use zone collapse time as estimate (if applicable), otherwise 0
  gs.raidTimeEstimateSec = wins > 0 ? Math.round(successTimeSum / wins) : (def.zoneCollapseSec || 0);
  gs.raidZoneCollapseDeathPct = Math.round((zoneCollapseDeaths / simulations) * 100);
}

export function recomputeActiveRaidParams(gs: GameState, raidId: string): void {
  gs.raid.id = raidId;
  gs.raid.baseSpeed = gs.speed;
  gs.raid.hp = gs.health;
  gs.raid.speedBonusPct = 0;
  gs.raid.speedBonusFlat = 0;
  gs.raid.regenPerKm = 0;
  gs.raid.regenAfterEncounter = 0;
  gs.raid.weight = 0;
  gs.raid.maxWeight = gs.baseMaxWeight;
  gs.raid.bagsVolume = gs.volume;
  gs.raid.usedVolume = 0;
  gs.raid.damage = gs.damage;
  gs.raid.hitChance = gs.chanceToHit;
  gs.raid.blockChance = gs.chanceToBlock;
  gs.raid.perks = [];
  gs.raid.lootChanceBonus = 0;
  gs.raid.tmpLootBuffAppliedPct = 0;
  gs.raid.tmpLootBuffNextRaidPct = 0;
  gs.raid.reflectOnHitPct = 0;
  gs.raid.reflectOnBlockPct = 0;
  gs.raid.biopsyChance = 0;
  gs.selectedGearPrice = 0;

  const raidEntry = gs.unlockedRaids.find(r => r.id === raidId)!;
  gs.raid.tmpLootBuffAppliedPct = raidEntry.tmpLootBuff;

  const gearIds: string[] = gs.loadouts[raidId] ?? [];
  const appliedGearIds = new Set<string>();
  const applyGearById = (gid: string): void => {
    if (!gid || appliedGearIds.has(gid)) return;
    appliedGearIds.add(gid);
    const g = gs.lib.gear.get(gid)!;
    gs.raid.speedBonusPct += g.speedPercent;
    gs.raid.speedBonusFlat += g.speedFlat;
    gs.raid.regenPerKm += g.regenPerKm;
    gs.raid.regenAfterEncounter += g.regenAfterEncounter;
    gs.raid.weight += g.weight;
    gs.raid.maxWeight += g.maxWeight;
    gs.raid.hp += g.hp;
    gs.raid.bagsVolume += g.volume;
    gs.raid.damage += g.damage;
    gs.raid.lootChanceBonus += g.lootChance;
    gs.raid.hitChance += g.chanceToHit;
    gs.raid.blockChance += g.chanceToBlock;
    gs.raid.reflectOnHitPct += g.reflectOnHitPct;
    gs.raid.reflectOnBlockPct += g.reflectOnBlockPct;
    gs.raid.biopsyChance += g.biopsyChance;
    if (g.perk) gs.raid.perks.push(g.perk);
    gs.selectedGearPrice += g.price;
  };

  for (const gid of gearIds) applyGearById(gid);

  if (gs.raid.weight > gs.raid.maxWeight) applyGearById('overweight');

  gs.raid.maxHp = gs.raid.hp;

  const gear = loadoutGear(gs, raidId);
  const counts = countByCategory(gear);
  const prepBonuses = computePreparationBonuses(gear, counts);

  gs.raid.damage += prepBonuses.damageBonus;
  gs.raid.hp += prepBonuses.hpBonus;
  gs.raid.maxHp += prepBonuses.hpBonus;
  gs.raid.blockChance += prepBonuses.blockChanceBonus;
}

export function toggleGearForRaid(gs: GameState, raidId: string, gearId: string, selected: boolean): void {
  if (!gs.loadouts[raidId]) gs.loadouts[raidId] = [];
  const arr = gs.loadouts[raidId];
  const i = arr.indexOf(gearId);
  if (selected) {
    if (i === -1) arr.push(gearId);
  } else {
    if (i !== -1) arr.splice(i, 1);
  }
  recomputeActiveRaidParams(gs, raidId);
}
