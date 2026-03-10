import { createRaidDamageBreakdown, createRaidTimeBreakdownSec, type GameState, type ActiveRaid, type RaidDamageBreakdown, type RaidTimeBreakdownSec } from './GameState';
import type { RaidDefinition, EncounterDef, FightEncounterDef, QuestEncounterDef, MonsterLootEncounterDef } from './RaidLib';
import type { GearDefinition } from './GearLib';
import { createFightEncounterLogEntry, createLootEncounterLogEntry, createMonsterLootEncounterLogEntry, createQuestEncounterLogEntry, createResourcesEncounterLogEntry, createZoneCollapseLogEntry, type LootEncounterLogEntry, type MonsterLootEncounterLogEntry, type RaidEventLog, type RaidEventLogEntry } from './RaidLog';
import { handleWalkEncounter } from './WalkEncounter';
import { handleLootLikeEncounter, handleMonsterLootEncounter } from './LootEncounter';
import { handleFightEncounter } from './FightEncounter';
import { handlePreparationEncounter, createPreparationEncounter, type GearPreparationPlan } from './PreparationEncounter';
import SeededRandom from './core/SeededRandom';
import { applyRaidMutation, questIsActive, type RaidMutation } from './RaidMutation';
import type { Reward } from './Reward';
import { Perks } from './Perks';

export interface RaidRunResult {
  success: boolean;
  log: RaidEventLog;
  bagItemCounts: Record<string, number>;
  discardedItemCounts: Record<string, number>;
  timeSpentSec: number;
  timeBreakdownSec: RaidTimeBreakdownSec;
  plannedEncounters: number;
  barelyInTime: boolean;
  questsCompleted: string[];
  rewardsApplied: Reward[];
  raidMutationsApplied: RaidMutation[];
  raidItemsAdded: string[];
  lootChanceDeltaApplied: number;
  lootingRarityBuffDeltaApplied: number;
  reimbursedCredits: number;
  diedToMonster: boolean;
  diedToZoneCollapse: boolean;
}

/** Stamps a log entry with current player state for status bar display */
function stampEntry<T extends RaidEventLogEntry>(entry: T, raid: ActiveRaid): T {
  entry.currentHp = raid.hp;
  entry.currentMaxHp = raid.maxHp;
  entry.bagsUsed = raid.usedVolume;
  entry.bagsCapacity = raid.bagsVolume;
  return entry;
}

/**
 * Applies time-based regen using threshold approach.
 * Regen timer starts when HP first drops below maximum.
 * Regen ticks every 600 seconds after the timer starts.
 * If HP is full when threshold is crossed, regen is wasted (threshold still advances).
 * Returns the new nextRegenThresholdSec value to be tracked across encounters.
 * A value of 0 means the timer hasn't started yet (HP never dropped below max).
 */
function applyTimeBasedRegen<T extends RaidEventLogEntry>(
  entry: T,
  raid: ActiveRaid,
  totalElapsedSec: number,
  nextRegenThresholdSec: number
): number {
  if (raid.regenPer10Minutes <= 0 || totalElapsedSec <= 0) return nextRegenThresholdSec;

  // If timer hasn't started yet (0), check if HP is below max to activate it
  if (nextRegenThresholdSec === 0) {
    if (raid.hp < raid.maxHp) {
      // Start the timer - first tick will be 600 seconds from now
      nextRegenThresholdSec = totalElapsedSec + 600;
    }
    return nextRegenThresholdSec;
  }

  let totalHealed = 0;
  let ticksCrossed = 0;
  const hpBefore = raid.hp;

  while (nextRegenThresholdSec <= totalElapsedSec) {
    // Threshold crossed - heal if HP is missing, otherwise wasted
    if (raid.hp < raid.maxHp) {
      const missing = raid.maxHp - raid.hp;
      const healed = Math.min(raid.regenPer10Minutes, missing);
      raid.hp += healed;
      totalHealed += healed;
      ticksCrossed++;
    }
    nextRegenThresholdSec += 600;
  }

  if (totalHealed > 0) {
    entry.timeRegenHpBefore = hpBefore;
    entry.timeRegenHpAfter = raid.hp;
    entry.timeRegenDurationSec = ticksCrossed * 600;
  }

  return nextRegenThresholdSec;
}

function loadoutGear(gs: GameState, raidId: string): GearDefinition[] {
  const ids: string[] = gs.loadouts[raidId] ?? [];
  return ids.map(id => gs.lib.gear.get(id)!);
}

function hasGatherResourcesTactic(gear: GearDefinition[]): boolean {
  return gear.some(g => g.gatherRaidResources);
}

export function getLoadoutPassiveCreditsPerHour(gs: GameState, raidId: string): number {
  let perHour = 0;
  const gear = loadoutGear(gs, raidId);
  for (const g of gear) {
    perHour += g.raidPassiveCreditsPerHour;
  }
  return perHour;
}

export function getLoadoutResourceStorageBonus(gs: GameState, raidId: string): number {
  let bonus = 0;
  const gear = loadoutGear(gs, raidId);
  for (const g of gear) {
    bonus += g.raidResourceStorageBonus;
  }
  return bonus;
}

export function accumulateRaidResources(gs: GameState, elapsedSec: number): void {
  const dt = Math.max(0, Number(elapsedSec) || 0);
  if (dt <= 0) return;
  const hours = dt / 3600;

  for (const raid of gs.unlockedRaids) {
    const speedPerHour = Math.max(0, raid.passiveCreditsPerHour);
    if (speedPerHour <= 0) continue;

    const current = Math.max(0, raid.uncollectedCredits);
    const cap = Math.max(0, raid.maxStoredCredits);
    const next = Math.min(cap, current + speedPerHour * hours);
    raid.uncollectedCredits = next;
  }
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

function computePreparationBonuses(gear: GearDefinition[], counts: Record<string, number>): GearPreparationPlan[] {
  const result: GearPreparationPlan[] = [];

  for (const g of gear) {
    const pt = Math.max(0, Math.trunc(g.prepTimeMin ?? 0));
    const prepTimeSec = Math.max(0, Math.trunc(pt * 60));

    const damageBonus = Math.trunc(sumBonus(g.bonusDamagePerCategory, counts));
    const hpBonus = Math.trunc(sumBonus(g.bonusHpPerCategory, counts));
    const blockChanceBonus = Math.trunc(sumBonus(g.bonusBlockChancePerCategory, counts));

    const hasAnything = prepTimeSec > 0 || damageBonus !== 0 || hpBonus !== 0 || blockChanceBonus !== 0;
    if (hasAnything) {
      result.push({
        gearId: g.id,
        gearName: g.name || g.id,
        gearImage: g.image || '',
        prepTimeSec,
        damageBonus,
        hpBonus,
        blockChanceBonus,
      });
    }
  }

  return result;
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

  // Safer Routes perk: walks come in pairs, so buckets = walkCount/2 + 1
  const hasSaferRoutes = gs.raid.perks.includes(Perks.SAFER_ROUTES);
  const walkPairs = hasSaferRoutes ? Math.floor(walkCount / 2) : walkCount;
  const bucketsCount = Math.max(1, walkPairs + 1);
  const buckets: Array<{ items: EncounterDef[]; fights: number }> = Array.from({ length: bucketsCount }, () => ({ items: [], fights: 0 }));

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
  // With Safer Routes, insert two WalkEncounters between buckets
  const queue: EncounterDef[] = [];
  for (let i = 0; i < bucketsCount; i++) {
    // Non-walk encounters for this segment
    for (const e of buckets[i].items) queue.push(e);
    // Insert WalkEncounter(s) between buckets
    if (i < walkPairs) {
      queue.push({ type: 'WalkEncounter' } as EncounterDef);
      if (hasSaferRoutes) queue.push({ type: 'WalkEncounter' } as EncounterDef);
    }
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

function applyMaterializationLootAtStart(
  gs: GameState,
  raid: ActiveRaid,
  itemId: string,
  bagItemCounts: Record<string, number>,
  discardedItemCounts: Record<string, number>,
  log: RaidEventLog
): void {
  const before = Math.max(0, raid.usedVolume || 0);
  const def = gs.lib.getItem(itemId);
  const after = before + def.volume;

  const entry = createLootEncounterLogEntry({
    injected: true,
    timeSpentSec: 0,
    myRoll: 0,
    checkValue: 100,
    itemId,
    tmpLootBuffNextRaidPct: raid.tmpLootBuffNextRaidPct,
    capacity: raid.bagsVolume,
    volumeBefore: before,
    volumeAfter: before,
  });

  if (after <= raid.bagsVolume) {
    raid.usedVolume = after;
    entry.volumeAfter = after;
    entry.discarded = false;
    bagItemCounts[itemId] = (bagItemCounts[itemId] ?? 0) + 1;
  } else {
    entry.volumeAfter = before;
    entry.discarded = true;
    entry.requiredVolume = Math.max(0, after - raid.bagsVolume);
    discardedItemCounts[itemId] = (discardedItemCounts[itemId] ?? 0) + 1;
  }

  log.entries.push(stampEntry(entry, raid));
}


export function runRaid(gs: GameState, raidDef: RaidDefinition, dryRun: boolean = false, materializationItemId: string = ''): RaidRunResult {
  const raid = dryRun ? structuredClone(gs.raid) : gs.raid;
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
  // Next time threshold (in seconds) at which regen should tick (600, 1200, 1800, etc.)
  let nextRegenThresholdSec = 0; // 0 means timer not started yet (starts when HP first drops below max)
  const timeBreakdownSec: RaidTimeBreakdownSec = createRaidTimeBreakdownSec();
  let barelyInTime = false;
  let diedToZoneCollapse = false;
  const questsCompleted: string[] = [];
  const rewardsApplied: Reward[] = [];
  const raidMutationsApplied: RaidMutation[] = [];
  const raidItemsAdded: string[] = [];
  let lootChanceDeltaApplied = 0;
  let lootingRarityBuffDeltaApplied = 0;
  let gatheredCredits = 0;

  const activeQuestIdsAtStart = new Set<string>();
  if (!dryRun) {
    gsForRun.lib.quests.forEach((q) => {
      if (questIsActive(gsForRun, q, raidDef.id)) activeQuestIdsAtStart.add(q.id);
    });
  }

  // Build a mutable encounter queue expanded and ordered per concept buckets
  const queue: EncounterDef[] = buildEncounterQueue(gsForRun, raidDef);

  const gear = loadoutGear(gsForRun, raidDef.id);
  const raidEntry = gsForRun.unlockedRaids.find(r => r.id === raidDef.id)!;
  const counts = countByCategory(gear);
  const prepBonuses = computePreparationBonuses(gear, counts);

  // Compute hpMult from gear to apply to HP bonuses for display
  let hpMult = 1;
  for (const g of gear) {
    if (g.hpMult !== 1) hpMult *= g.hpMult;
  }

  // Create individual preparation encounters for each gear item (in reverse order so first gear is first)
  // HP bonuses are multiplied by hpMult to show final impact
  for (let i = prepBonuses.length - 1; i >= 0; i--) {
    const bonus = prepBonuses[i];
    const adjustedBonus: GearPreparationPlan = {
      ...bonus,
      hpBonus: hpMult !== 1 ? Math.round(bonus.hpBonus * hpMult) : bonus.hpBonus,
    };
    const prep = createPreparationEncounter(adjustedBonus);
    if (prep) queue.unshift(prep);
  }

  if (hasGatherResourcesTactic(gear)) {
    queue.unshift({ type: 'ResourcesEncounter' });
  }

  // Store the planned encounter count before we start processing (for UI progress indicator)
  const plannedEncounters = queue.length;

  if (raid.perks.includes(Perks.MATERIALIZATION) && materializationItemId) {
    applyMaterializationLootAtStart(gsForRun, raid, materializationItemId, bagItemCounts, discardedItemCounts, log);
  }

  // Track if we just completed a walk encounter (for Safer Routes perk)
  let justWalked = false;
  const hasSaferRoutes = raid.perks.includes(Perks.SAFER_ROUTES);

  while (queue.length > 0) {
    const enc = queue.shift()!;

    const zoneCollapseLimit = raidDef.zoneCollapseSec;
    if (zoneCollapseLimit > 0 && timeSpentSec >= zoneCollapseLimit && !diedToZoneCollapse) {
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
        log.entries.push(stampEntry(collapseEntry, raid));

        if (dryRun) {
          // In dry runs, mark as zone collapse death but continue processing to get full time estimate
          diedToZoneCollapse = true;
        } else {
          // In real raids, stop immediately
          raid.hp = 0;
          return {
            success: false,
            log,
            bagItemCounts,
            discardedItemCounts,
            timeSpentSec,
            timeBreakdownSec,
            plannedEncounters,
            barelyInTime: false,
            questsCompleted,
            rewardsApplied,
            raidMutationsApplied,
            raidItemsAdded,
            lootChanceDeltaApplied,
            lootingRarityBuffDeltaApplied,
            reimbursedCredits: 0,
            diedToMonster: false,
            diedToZoneCollapse: true,
          };
        }
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
            log.entries.push(stampEntry(skippedEntry, raid));
          }
        }
        queue.length = 0;
      }
    }

    switch (enc.type) {
      case 'PreparationEncounter': {
        const entry = handlePreparationEncounter(raid, enc);
        timeSpentSec += entry.timeSpentSec;
        timeBreakdownSec.totalSec += entry.timeSpentSec;
        timeBreakdownSec.preparingSec += entry.timeSpentSec;
        entry.elapsedTotalSec = timeSpentSec;
        nextRegenThresholdSec = applyTimeBasedRegen(entry, raid, timeSpentSec, nextRegenThresholdSec);
        log.entries.push(stampEntry(entry, raid));
        break;
      }
      case 'ResourcesEncounter': {
        const beforeStored = Math.max(0, raidEntry.uncollectedCredits);
        const storageCapacity = Math.max(0, raidEntry.maxStoredCredits);
        const clampedStored = Math.min(storageCapacity, beforeStored);
        const volumeBefore = Math.max(0, raid.usedVolume);
        const freeVolume = Math.max(0, raid.bagsVolume - volumeBefore);
        const chunksCollected = Math.min(Math.floor(clampedStored / 100), freeVolume);
        const creditsCollected = chunksCollected * 100;
        const afterStored = clampedStored - creditsCollected;
        const volumeAfter = volumeBefore + chunksCollected;

        raid.usedVolume = volumeAfter;
        if (!dryRun) {
          raidEntry.uncollectedCredits = afterStored;
        }
        gatheredCredits += creditsCollected;

        const entry = createResourcesEncounterLogEntry({
          timeSpentSec: 0,
          storageBefore: clampedStored,
          storageAfter: afterStored,
          storageCapacity,
          chunksCollected,
          creditsCollected,
          volumeBefore,
          volumeAfter,
        });
        entry.elapsedTotalSec = timeSpentSec;
        nextRegenThresholdSec = applyTimeBasedRegen(entry, raid, timeSpentSec, nextRegenThresholdSec);
        log.entries.push(stampEntry(entry, raid));
        break;
      }
      case 'WalkEncounter': {
        const entry = handleWalkEncounter(raid);
        timeSpentSec += entry.timeSpentSec;
        timeBreakdownSec.totalSec += entry.timeSpentSec;
        timeBreakdownSec.walkingSec += entry.timeSpentSec;
        entry.elapsedTotalSec = timeSpentSec;
        nextRegenThresholdSec = applyTimeBasedRegen(entry, raid, timeSpentSec, nextRegenThresholdSec);
        log.entries.push(stampEntry(entry, raid));
        if (hasSaferRoutes) justWalked = true;
        break;
      }
      case 'QuestEncounter': {
        const qid = enc.questId;
        const quest = gsForRun.lib.quests.get(qid)!;
        const entry = createQuestEncounterLogEntry({ questId: qid, success: true, timeSpentSec: Math.round(quest.encounterTimeMin * 60) });
        timeSpentSec += entry.timeSpentSec;
        timeBreakdownSec.totalSec += entry.timeSpentSec;
        timeBreakdownSec.investigatingSec += entry.timeSpentSec;
        entry.elapsedTotalSec = timeSpentSec;
        nextRegenThresholdSec = applyTimeBasedRegen(entry, raid, timeSpentSec, nextRegenThresholdSec);
        log.entries.push(stampEntry(entry, raid));
        break;
      }
      case 'LootEncounter': {
        const entry = handleLootLikeEncounter(gsForRun, raid, {
          baseLootChance: raidDef.baseLootChance,
          items: raidDef.items,
          poolsByRarity: raidDef.itemPoolsByRarity,
          bannedItemIds: raidEntry.bannedItemIds,
        }, bagItemCounts, discardedItemCounts);
        timeSpentSec += entry.timeSpentSec;
        timeBreakdownSec.totalSec += entry.timeSpentSec;
        timeBreakdownSec.scavengingSec += entry.timeSpentSec;
        entry.elapsedTotalSec = timeSpentSec;
        nextRegenThresholdSec = applyTimeBasedRegen(entry, raid, timeSpentSec, nextRegenThresholdSec);
        log.entries.push(stampEntry(entry, raid));
        break;
      }
      case 'FightEncounter': {
        const monsterId = enc.monsterId;
        const injected = (enc as FightEncounterDef).injected ?? false;
        // Safer Routes: skip first fight after a walk
        if (justWalked) {
          justWalked = false;
          const monster = gsForRun.lib.monsters.get(monsterId)!;
          const skippedEntry = createFightEncounterLogEntry({
            monsterId,
            monsterName: monster.name,
            skipped: true,
            skipReason: 'safer_routes',
            injected,
            elapsedTotalSec: timeSpentSec,
          });
          log.entries.push(stampEntry(skippedEntry, raid));
          break;
        }
        const fight = handleFightEncounter(gsForRun, raid, {
          monsterId,
          injected,
          regenPer10Minutes: raid.regenPer10Minutes,
          elapsedTimeBeforeFight: timeSpentSec,
          nextRegenThresholdSec,
        });
        nextRegenThresholdSec = fight.nextRegenThresholdSec;
        let t = timeSpentSec;
        for (const ev of fight.entry.fightLog) {
          t += ev.timeSpentSec;
          ev.elapsedTotalSec = t;
        }
        timeSpentSec += fight.timeSpentSec;
        timeBreakdownSec.totalSec += fight.timeSpentSec;
        timeBreakdownSec.fightingSec += fight.timeSpentSec;
        fight.entry.elapsedTotalSec = timeSpentSec;
        fight.entry.injected = injected;
        log.entries.push(stampEntry(fight.entry, raid));
        const lastEv = fight.entry.fightLog[fight.entry.fightLog.length - 1];
        if (lastEv?.biopsyTriggered) {
          queue.unshift({ type: 'MonsterLootEncounter', monsterId, injected: true });
        }
        if (fight.summonedMonsterId) {
          queue.unshift({ type: 'FightEncounter', monsterId: fight.summonedMonsterId, injected: true });
        }
        if (raid.hp <= 0) {
          const reimbursedCredits = Math.floor(gs.selectedGearPrice * raid.reimbursedPct / 100);
          return {
            success: false,
            log,
            bagItemCounts,
            discardedItemCounts,
            timeSpentSec,
            timeBreakdownSec,
            plannedEncounters,
            barelyInTime: false,
            questsCompleted,
            rewardsApplied,
            raidMutationsApplied,
            raidItemsAdded,
            lootChanceDeltaApplied,
            lootingRarityBuffDeltaApplied,
            reimbursedCredits,
            diedToMonster: true,
            diedToZoneCollapse: false,
          };
        }
        if (raid.regenAfterCombat > 0 && !fight.entry.skipped) {
          const hpBefore = raid.hp;
          raid.hp = Math.min(raid.maxHp, raid.hp + raid.regenAfterCombat);
          const hpAfter = raid.hp;
          fight.entry.hpBeforeRegen = hpBefore;
          fight.entry.hpAfterRegen = hpAfter;
        }
        // Time-based regen is applied during the fight itself in handleFightEncounter
        break;
      }
      case 'MonsterLootEncounter': {
        const mid = enc.monsterId;
        const injected = (enc as MonsterLootEncounterDef).injected;
        const m = gsForRun.lib.monsters.get(mid)!;
        const entry = handleMonsterLootEncounter(gsForRun, raid, m.lootItemId, raid.biopsyChance, m.biopsyBuff, bagItemCounts, discardedItemCounts);
        timeSpentSec += entry.timeSpentSec;
        timeBreakdownSec.totalSec += entry.timeSpentSec;
        timeBreakdownSec.dissectingSec += entry.timeSpentSec;
        entry.elapsedTotalSec = timeSpentSec;
        entry.injected = injected ?? false;
        nextRegenThresholdSec = applyTimeBasedRegen(entry, raid, timeSpentSec, nextRegenThresholdSec);
        log.entries.push(stampEntry(entry, raid));
        break;
      }
    }
  }

  if (!dryRun) {
    const raidId = raidDef.id;
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

      for (const reward of q.rewards) {
        // Collect rewards for later application (after playback completes) via CmdConsumeOutcomeRewards
        rewardsApplied.push(reward);

        if (reward.kind === 'raid_mutation') {
          raidMutationsApplied.push(reward.mutation);
        }
        if (reward.kind === 'raid_add_item') {
          raidItemsAdded.push(...reward.itemIds);
          shouldRebuildPools = true;
        }
        if (reward.kind === 'raid_loot_chance') {
          lootChanceDeltaApplied += reward.delta;
        }
        if (reward.kind === 'raid_rarity_buff') {
          lootingRarityBuffDeltaApplied += reward.delta;
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

    // Apply permanent zone boost mutation on successful completion (from gear with zoneBoost)
    const totalZoneBoost = gear.reduce((sum, g) => sum + g.zoneBoost, 0);
    if (totalZoneBoost > 0) {
      const mutation: RaidMutation = { kind: 'ZoneCollapseTimeMutation', amount: totalZoneBoost };
      const raidDefToChange = gsForRun.lib.raids.get(raidId)!;
      applyRaidMutation(raidDefToChange, mutation);
      raidMutationsApplied.push(mutation);
    }

    // Apply price changes on successful completion (from gear with priceChange)
    // Price changes are tracked per-raid, so the same gear starts at base price in other raids
    for (const g of gear) {
      if (g.priceChange !== 0) {
        const currentAdjustment = raidEntry.gearPriceAdjustments[g.id] ?? 0;
        const newAdjustment = currentAdjustment + g.priceChange;
        // Ensure effective price (base + adjustment) doesn't go below 0
        raidEntry.gearPriceAdjustments[g.id] = Math.max(-g.price, newAdjustment);
      }
    }

    if (gsForRun.raid.perks.includes(Perks.XENO_HOUND_BAIT)) {
      const mutation: RaidMutation = { kind: 'AddMonsterMutation', monsterId: 'hound', count: 1 };
      const raidDefToChange = gsForRun.lib.raids.get(raidId)!;
      applyRaidMutation(raidDefToChange, mutation);
      raidMutationsApplied.push(mutation);
    }
  }

  if (!diedToZoneCollapse && gatheredCredits > 0) {
    rewardsApplied.push({
      kind: 'resource',
      resource: 'credits',
      amount: gatheredCredits,
    });
  }

  return {
    success: !diedToZoneCollapse,
    log,
    bagItemCounts,
    discardedItemCounts,
    timeSpentSec,
    timeBreakdownSec,
    plannedEncounters,
    barelyInTime,
    questsCompleted,
    rewardsApplied,
    raidMutationsApplied,
    raidItemsAdded,
    lootChanceDeltaApplied,
    lootingRarityBuffDeltaApplied,
    reimbursedCredits: 0,
    diedToMonster: false,
    diedToZoneCollapse,
  };
}

export function dryRunRaid(gs: GameState, raidDef: RaidDefinition): RaidRunResult {
  return runRaid(gs, raidDef, true);
}

export function getEffectiveRaidDefinition(gs: GameState, raidId: string): RaidDefinition {
  const def = structuredClone(gs.lib.raids.get(raidId)!)
  gs.lib.quests.forEach((q) => {
    if (!questIsActive(gs, q, raidId)) return;
    if (q.encounterTimeMin > 0) {
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

  const hasXenoHoundBait = gear.some(g => g.perk === Perks.XENO_HOUND_BAIT);
  if (hasXenoHoundBait) {
    applyRaidMutation(def, { kind: 'AddMonsterMutation', monsterId: 'hound', count: 1 });
  }

  // Apply zone boost from gear to preview zone collapse time
  const totalZoneBoost = gear.reduce((sum, g) => sum + g.zoneBoost, 0);
  if (totalZoneBoost > 0) {
    def.zoneCollapseSec = Math.max(0, (def.zoneCollapseSec || 0) + totalZoneBoost);
  }

  return def;
}

export function recomputeActiveRaidEstimates(gs: GameState, simulations = 100): void {
  if (!gs.raid.id || !gs.lib.raids.has(gs.raid.id)) {
    throw new Error('recomputeActiveRaidEstimates: no active raid id');
    return;
  }
  const def = getEffectiveRaidDefinition(gs, gs.raid.id);
  let wins = 0;
  let zoneCollapseDeaths = 0;
  let monsterDeaths = 0;
  let completionTimeSum = 0; // Sum of times for runs that completed (wins + zone collapse deaths)
  let completionTimeSqSum = 0;
  let minTime = Number.MAX_VALUE;
  let maxTime = 0;
  const overallSum: RaidTimeBreakdownSec = createRaidTimeBreakdownSec();
  const successSum: RaidTimeBreakdownSec = createRaidTimeBreakdownSec();
  const failureSum: RaidTimeBreakdownSec = createRaidTimeBreakdownSec();
  const zoneCollapseSum: RaidTimeBreakdownSec = createRaidTimeBreakdownSec();
  const overallDamageSum: RaidDamageBreakdown = createRaidDamageBreakdown();
  const successDamageSum: RaidDamageBreakdown = createRaidDamageBreakdown();
  const failureDamageSum: RaidDamageBreakdown = createRaidDamageBreakdown();
  const monsterDeathDamageSum: RaidDamageBreakdown = createRaidDamageBreakdown();
  const add = (dst: RaidTimeBreakdownSec, src: RaidTimeBreakdownSec): void => {
    dst.totalSec += src.totalSec;
    dst.fightingSec += src.fightingSec;
    dst.walkingSec += src.walkingSec;
    dst.preparingSec += src.preparingSec;
    dst.scavengingSec += src.scavengingSec;
    dst.dissectingSec += src.dissectingSec;
    dst.investigatingSec += src.investigatingSec;
  };
  const addDamage = (dst: RaidDamageBreakdown, src: RaidDamageBreakdown): void => {
    dst.totalDamageReceived += src.totalDamageReceived;
    dst.hpGeneratedAfterCombat += src.hpGeneratedAfterCombat;
    dst.hpGeneratedWalking += src.hpGeneratedWalking;
    dst.hpGeneratedTimeBased += src.hpGeneratedTimeBased;
    for (const [id, dmg] of Object.entries(src.damageReceivedByMonsterId)) {
      dst.damageReceivedByMonsterId[id] = (dst.damageReceivedByMonsterId[id] || 0) + dmg;
    }
  };
  const avg = (sum: RaidTimeBreakdownSec, n: number): RaidTimeBreakdownSec => {
    if (n <= 0) return createRaidTimeBreakdownSec();
    return {
      totalSec: Math.round(sum.totalSec / n),
      fightingSec: Math.round(sum.fightingSec / n),
      walkingSec: Math.round(sum.walkingSec / n),
      preparingSec: Math.round(sum.preparingSec / n),
      scavengingSec: Math.round(sum.scavengingSec / n),
      dissectingSec: Math.round(sum.dissectingSec / n),
      investigatingSec: Math.round(sum.investigatingSec / n),
    };
  };
  const avgDamage = (sum: RaidDamageBreakdown, n: number): RaidDamageBreakdown => {
    if (n <= 0) return createRaidDamageBreakdown();
    const byMonster: Record<string, number> = {};
    for (const [id, dmg] of Object.entries(sum.damageReceivedByMonsterId)) {
      byMonster[id] = Math.round(dmg / n);
    }
    return {
      totalDamageReceived: Math.round(sum.totalDamageReceived / n),
      damageReceivedByMonsterId: byMonster,
      hpGeneratedAfterCombat: Math.round(sum.hpGeneratedAfterCombat / n),
      hpGeneratedWalking: Math.round(sum.hpGeneratedWalking / n),
      hpGeneratedTimeBased: Math.round(sum.hpGeneratedTimeBased / n),
    };
  };
  const computeDamageForRun = (log: RaidEventLog): RaidDamageBreakdown => {
    const out: RaidDamageBreakdown = createRaidDamageBreakdown();
    for (const e of log.entries) {
      out.hpGeneratedTimeBased += Math.max(0, (e.timeRegenHpAfter || 0) - (e.timeRegenHpBefore || 0));
      if (e.kind === 'WalkEncounter') {
        out.hpGeneratedWalking += e.hpHealed;
        continue;
      }
      if (e.kind !== 'FightEncounter') continue;
      out.hpGeneratedAfterCombat += (e.hpAfterRegen - e.hpBeforeRegen);
      let dmg = 0;
      for (const ev of e.fightLog) dmg += ev.damageReceived;
      out.totalDamageReceived += dmg;
      if (dmg !== 0) out.damageReceivedByMonsterId[e.monsterId] = (out.damageReceivedByMonsterId[e.monsterId] || 0) + dmg;
    }
    return out;
  };


  for (let i = 0; i < simulations; i++) {
    const res = runRaid(gs, def, true);
    add(overallSum, res.timeBreakdownSec);
    const dmg = computeDamageForRun(res.log);
    addDamage(overallDamageSum, dmg);

    // Check if run is valid for time stats (success or zone collapse)
    if (res.success || res.diedToZoneCollapse) {
      const t = res.timeBreakdownSec.totalSec;
      completionTimeSum += t;
      completionTimeSqSum += t * t;
      if (t < minTime) minTime = t;
      if (t > maxTime) maxTime = t;
    }

    if (res.success) {
      wins++;
      add(successSum, res.timeBreakdownSec);
      addDamage(successDamageSum, dmg);
    } else if (res.diedToZoneCollapse) {
      // Zone collapse death: counts as failure but contributes to time estimate
      // Damage from zone collapse deaths is NOT included in failure damage breakdown
      zoneCollapseDeaths++;
      add(failureSum, res.timeBreakdownSec);
      add(zoneCollapseSum, res.timeBreakdownSec);
    } else {
      // Monster death: counts as failure and does NOT contribute to time estimate
      // Only monster deaths contribute to failure damage breakdown
      monsterDeaths++;
      add(failureSum, res.timeBreakdownSec);
      addDamage(failureDamageSum, dmg);
      addDamage(monsterDeathDamageSum, dmg);
    }
  }
  const failures = simulations - wins;
  const completedRuns = wins + zoneCollapseDeaths;
  const sim = gs.raidSimulation;
  sim.survivalEstimatePct = Math.round((wins / simulations) * 100);
  sim.timeEstimateSec = completedRuns > 0 ? Math.round(completionTimeSum / completedRuns) : (def.zoneCollapseSec || 0);
  sim.timeEstimateMinSec = completedRuns > 0 ? minTime : 0;
  sim.timeEstimateMaxSec = completedRuns > 0 ? maxTime : 0;

  if (completedRuns > 1) {
    const mean = completionTimeSum / completedRuns;
    const variance = (completionTimeSqSum / completedRuns) - (mean * mean);
    sim.timeEstimateStdDevSec = Math.sqrt(Math.max(0, variance));
  } else {
    sim.timeEstimateStdDevSec = 0;
  }
  sim.zoneCollapseDeathPct = Math.round((zoneCollapseDeaths / simulations) * 100);
  sim.zoneCollapseDeaths = zoneCollapseDeaths;
  sim.monsterDeaths = monsterDeaths;
  sim.simulations = simulations;
  sim.successes = wins;
  sim.failures = failures;
  sim.timeBreakdownOverallSec = avg(overallSum, simulations);
  sim.timeBreakdownSuccessSec = avg(successSum, wins);
  sim.timeBreakdownFailureSec = avg(failureSum, failures);
  sim.timeBreakdownZoneCollapseSec = avg(zoneCollapseSum, zoneCollapseDeaths);
  sim.damageBreakdownOverall = avgDamage(overallDamageSum, simulations);
  sim.damageBreakdownSuccess = avgDamage(successDamageSum, wins);
  sim.damageBreakdownFailure = avgDamage(monsterDeathDamageSum, monsterDeaths);
}

export function recomputeActiveRaidParams(gs: GameState, raidId: string): void {
  gs.raid.id = raidId;
  gs.raid.baseSpeed = gs.speed;
  gs.raid.hp = gs.health;
  gs.raid.speedBonusPct = 0;
  gs.raid.speedBonusFlat = 0;
  gs.raid.regenPerKm = 0;
  gs.raid.regenAfterCombat = 0;
  gs.raid.regenPer10Minutes = 0;
  gs.raid.weight = 0;
  gs.raid.maxWeight = gs.baseMaxWeight;
  gs.raid.bagsVolume = gs.volume;
  gs.raid.usedVolume = 0;
  gs.raid.damage = gs.damage;
  gs.raid.hitChance = gs.chanceToHit;
  gs.raid.blockChance = gs.chanceToBlock;
  gs.raid.armor = gs.armor;
  gs.raid.attackSkipCount = 0;
  gs.raid.stunChance = 0;
  gs.raid.perks = [];
  gs.raid.lootChanceBonus = 0;
  gs.raid.tmpLootBuffAppliedPct = 0;
  gs.raid.tmpLootBuffNextRaidPct = 0;
  gs.raid.reflectOnHitPct = 0;
  gs.raid.reflectOnBlockPct = 0;
  gs.raid.biopsyChance = 0;
  gs.raid.reimbursedPct = 0;
  gs.raid.rarityBuff = 0;
  gs.raid.preventsSuccessZoneDeterioration = false;
  gs.selectedGearPrice = 0;

  const raidEntry = gs.unlockedRaids.find(r => r.id === raidId);
  if (!raidEntry) return;
  gs.raid.tmpLootBuffAppliedPct = raidEntry.tmpLootBuff;

  const gearIds: string[] = gs.loadouts[raidId] ?? [];
  const appliedGearIds = new Set<string>();
  let hpMult = 1;
  const applyGearById = (gid: string): void => {
    if (!gid || appliedGearIds.has(gid)) return;
    appliedGearIds.add(gid);
    const g = gs.lib.gear.get(gid)!;
    gs.raid.speedBonusPct += g.speedPercent;
    gs.raid.speedBonusFlat += g.speedFlat;
    gs.raid.regenPerKm += g.regenPerKm;
    gs.raid.regenAfterCombat += g.regenAfterCombat;
    gs.raid.regenPer10Minutes += g.regenPer10Minutes;
    gs.raid.weight += g.weight;
    gs.raid.maxWeight += g.maxWeight;
    gs.raid.hp += g.hp;
    gs.raid.bagsVolume += g.volume;
    gs.raid.damage += g.damage;
    gs.raid.lootChanceBonus += g.lootChance;
    gs.raid.hitChance += g.chanceToHit;
    gs.raid.blockChance += g.chanceToBlock;
    gs.raid.armor += g.armor;
    gs.raid.attackSkipCount += g.attackSkipCount;
    gs.raid.stunChance = 100 - (100 - gs.raid.stunChance) * (100 - g.stunChance) / 100;
    gs.raid.reflectOnHitPct += g.reflectOnHitPct;
    gs.raid.reflectOnBlockPct += g.reflectOnBlockPct;
    gs.raid.biopsyChance += g.biopsyChance;
    gs.raid.reimbursedPct += g.reimbursed;
    gs.raid.rarityBuff += g.rarityBuff;
    gs.raid.preventsSuccessZoneDeterioration = gs.raid.preventsSuccessZoneDeterioration || g.preventsSuccessZoneDeterioration;
    if (g.perk) gs.raid.perks.push(g.perk);
    const priceAdjustment = raidEntry.gearPriceAdjustments[gid] ?? 0;
    gs.selectedGearPrice += Math.max(0, g.price + priceAdjustment);
    if (g.hpMult !== 1) hpMult *= g.hpMult;
  };

  for (const gid of gearIds) applyGearById(gid);

  if (gs.raid.weight > gs.raid.maxWeight) applyGearById('overweight');

  gs.raid.maxHp = gs.raid.hp;

  // Preparation bonuses are applied during runRaid via handlePreparationEncounter.
  // Here we compute final values for UI display, but store hpMult for raid to apply after preps.
  const gear = loadoutGear(gs, raidId);
  const counts = countByCategory(gear);
  const prepBonuses = computePreparationBonuses(gear, counts);

  // For UI display, show final stats (after all prep and hpMult)
  let totalPrepHpBonus = 0;
  for (const prep of prepBonuses) {
    gs.raid.damage += prep.damageBonus;
    totalPrepHpBonus += prep.hpBonus;
    gs.raid.blockChance += prep.blockChanceBonus;
  }
  gs.raid.hp += totalPrepHpBonus;
  gs.raid.maxHp += totalPrepHpBonus;

  // Apply HP multiplier after all flat bonuses (including preparation)
  if (hpMult !== 1) {
    gs.raid.hp = Math.round(gs.raid.hp * hpMult);
    gs.raid.maxHp = Math.round(gs.raid.maxHp * hpMult);
  }
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
