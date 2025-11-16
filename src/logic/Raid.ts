import type { GameState, ActiveRaid } from './GameState';
import type { RaidDefinition, EncounterDef, FightEncounterDef } from './RaidLib';
import type { GearDefinition } from './GearLib';
import type { RaidEventLog } from './RaidLog';
import { handleWalkEncounter } from './WalkEncounter';
import { handleLootLikeEncounter, handleMonsterLootEncounter } from './LootEncounter';
import { handleFightEncounter } from './FightEncounter';
import SeededRandom from './core/SeededRandom';
import { getEffectiveRaidDefinition } from './RaidMutation';
import Perks from './Perks';

export interface RaidRunResult {
  success: boolean;
  log: RaidEventLog;
  timeSpentSec: number;
}

function shuffleInPlace<T>(arr: T[], rnd: { get: () => number }): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd.get() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
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
        const qid = (step.encounter as any).questId as string;
        for (let i = 0; i < c; i++) questPool.push({ type: 'QuestEncounter', questId: qid } as EncounterDef);
        break;
      }
      // MonsterLootEncounter is dynamically inserted by the runner and should not be present here
      default:
        break;
    }
  }

  const bucketsCount = Math.max(1, walkCount + 1);
  const buckets: Array<{ items: EncounterDef[]; fights: number } > = new Array(bucketsCount).fill(null as any).map(() => ({ items: [], fights: 0 }));

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
    shuffleInPlace(b.items, gs.random);
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
    perks: Array.isArray(r.perks) ? [...r.perks] : [],
    lootChanceBonus: r.lootChanceBonus,
    hitChance: r.hitChance,
    blockChance: r.blockChance,
    reflectOnHitPct: r.reflectOnHitPct,
    reflectOnBlockPct: r.reflectOnBlockPct,
  } as ActiveRaid;
}

export function runRaid(gs: GameState, raidDef: RaidDefinition, dryRun = false): RaidRunResult {
  const raid = dryRun ? cloneActiveRaidState(gs.raid) : gs.raid;
  const simRnd = dryRun
    // use unique-ish random seed so multiple dry runs vary even in tight loops
    ? new SeededRandom(((Date.now() + Math.floor(Math.random() * 0x7fffffff)) | 0))
    : gs.random;
  const gsForRun: GameState = dryRun ? ({ ...(gs as any), random: simRnd, raid } as GameState) : gs;
  const log: RaidEventLog = { entries: [] };
  // Elapsed time since the beginning of the raid
  let timeSpentSec = 0;

  // Build a mutable encounter queue expanded and ordered per concept buckets
  const queue: EncounterDef[] = buildEncounterQueue(gsForRun, raidDef);

  while (queue.length > 0) {
    const enc = queue.shift()!;
    switch (enc.type) {
      case 'WalkEncounter': {
        const entry = handleWalkEncounter(raid);
        timeSpentSec += entry.timeSpentSec;
        // annotate cumulative time after this encounter
        (entry as any).elapsedTotalSec = timeSpentSec;
        log.entries.push(entry);
        break;
      }
      case 'QuestEncounter': {
        const qid = (enc as any).questId as string;
        const quest = gsForRun.lib.quests.get(qid)!;
        const entry = { kind: 'QuestEncounter', questId: qid, success: true, timeSpentSec: Math.round(quest.encounterTimeMin * 60) } as any;
        timeSpentSec += entry.timeSpentSec;
        (entry as any).elapsedTotalSec = timeSpentSec;
        log.entries.push(entry);
        break;
      }
      case 'LootEncounter': {
        const entry = handleLootLikeEncounter(gsForRun, raid, { baseLootChance: raidDef.baseLootChance, items: raidDef.items });
        timeSpentSec += entry.timeSpentSec;
        (entry as any).elapsedTotalSec = timeSpentSec;
        log.entries.push(entry);
        break;
      }
      case 'FightEncounter': {
        const monsterId = (enc as any).monsterId as string;
        const fight = handleFightEncounter(gsForRun, raid, { monsterId });
        // For the fight, annotate cumulative time per round and for the entry itself
        let t = timeSpentSec;
        const rounds = Array.isArray(fight.entry.fightLog) ? fight.entry.fightLog : [];
        for (let i = 0; i < rounds.length; i++) {
          const ev: any = rounds[i];
          t += Math.max(0, ev.timeSpentSec || 0);
          ev.elapsedTotalSec = t;
        }
        timeSpentSec += fight.timeSpentSec;
        (fight.entry as any).elapsedTotalSec = timeSpentSec;
        log.entries.push(fight.entry);
        // If the last event indicates an aspirator loot opportunity, insert a separate MonsterLootEncounter next
        const lastEv = fight.entry.fightLog[fight.entry.fightLog.length - 1] as any;
        if (lastEv && lastEv.encounterCreated) {
          queue.unshift({ type: 'MonsterLootEncounter', monsterId } as any);
        }
        // If we died during the fight, terminate the raid early
        if (raid.hp <= 0) {
          return { success: false, log, timeSpentSec };
        }
        break;
      }
      case 'MonsterLootEncounter': {
        const mid = (enc as any).monsterId as string;
        const m = gsForRun.lib.monsters.get(mid)!;
        const entry = handleMonsterLootEncounter(gsForRun, raid, m.lootItemId);
        timeSpentSec += entry.timeSpentSec;
        (entry as any).elapsedTotalSec = timeSpentSec;
        log.entries.push(entry);
        break;
      }
    }
  }

  return { success: true, log, timeSpentSec };
}

// Convenience wrapper for explicit dry runs
export function dryRunRaid(gs: GameState, raidDef: RaidDefinition): RaidRunResult {
  return runRaid(gs, raidDef, true);
}

export function recomputeActiveRaidEstimates(gs: GameState, simulations = 100): void {
  const id = (gs.raid?.id || '').trim();
  if (!id) {
    (gs as any).raidSurvivalEstimatePct = 0;
    (gs as any).raidTimeEstimateSec = 0;
    return;
  }
  const def = getEffectiveRaidDefinition(gs, id);
  if (!def) {
    (gs as any).raidSurvivalEstimatePct = 0;
    (gs as any).raidTimeEstimateSec = 0;
    return;
  }
  const n = Math.max(1, Math.floor(simulations || 0));
  let wins = 0;
  // Sum time only for successful runs to estimate time conditioned on success
  let successTimeSum = 0;
  for (let i = 0; i < n; i++) {
    const res = runRaid(gs, def, true);
    if (res.success) {
      wins++;
      successTimeSum += Math.max(0, res.timeSpentSec || 0);
    }
  }
  (gs as any).raidSurvivalEstimatePct = Math.round((wins / n) * 100);
  (gs as any).raidTimeEstimateSec = wins > 0 ? Math.round(successTimeSum / wins) : 0;
}

export function recomputeActiveRaidParams(gs: GameState, raidId: string): void {
  gs.raid.id = raidId;
  gs.raid.baseSpeed = gs.speed;
  gs.raid.hp = gs.health;
  gs.raid.speedBonusPct = 0;
  gs.raid.speedBonusFlat = 0;
  gs.raid.regenPerKm = 0;
  gs.raid.weight = 0;
  gs.raid.maxWeight = gs.baseMaxWeight;
  gs.raid.bagsVolume = 0;
  gs.raid.usedVolume = 0;
  gs.raid.damage = gs.damage;
  gs.raid.hitChance = gs.chanceToHit;
  gs.raid.blockChance = gs.chanceToBlock;
  gs.raid.perks = [];
  gs.raid.lootChanceBonus = 0;
  gs.raid.reflectOnHitPct = 0;
  gs.raid.reflectOnBlockPct = 0;
  gs.selectedGearPrice = 0;

  const gearIds: string[] = (gs.loadouts && gs.loadouts[raidId]) ? gs.loadouts[raidId] : [];
  for (const gid of gearIds) {
    const g = gs.lib.gear.get(gid)!;
    gs.raid.speedBonusPct += g.speedPercent;
    gs.raid.speedBonusFlat += g.speedFlat;
    gs.raid.regenPerKm += g.regenPerKm;
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
    if (g.perk) gs.raid.perks.push(g.perk);
    gs.selectedGearPrice += g.price;
  }
  // Perk-only effects are applied contextually in encounters (e.g., Immovable Wall affects time on counter rounds)
  gs.raid.maxHp = gs.raid.hp;

  // Auto-apply overweight penalty if current loadout exceeds max carry weight
  if (gs.raid.weight > gs.raid.maxWeight) {
    const ow = gs.lib.gear.get('overweight');
    if (ow) {
      gs.raid.hitChance += ow.chanceToHit;
      gs.raid.blockChance += ow.chanceToBlock;
      // Do not add price/weight or modify loadout; this is implicit
    } else {
      // Fallback if missing definition
      gs.raid.hitChance += -10;
      gs.raid.blockChance += -10;
    }
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
