import type { ActiveRaid, GameState } from './GameState';
import type { LootRarity } from './RaidLib';
import type { LootEncounterLogEntry } from './RaidLog';
import Perks from './Perks';

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export interface LootEncounterContext {
  items: string[];
  poolsByRarity: Record<LootRarity, string[]>;
  baseLootChance: number;
}

export function handleLootLikeEncounter(gs: GameState, r: ActiveRaid, ctx: LootEncounterContext): LootEncounterLogEntry {
  const before = Math.max(0, r.usedVolume || 0);

  // If bags already full, skip searching altogether
  if (before >= r.bagsVolume) {
    return {
      kind: 'LootEncounter',
      source: 'raid',
      skipped: true,
      timeSpentSec: 0,
      elapsedTotalSec: 0,
      myRoll: 0,
      checkValue: 0,
      itemId: '',
      capacity: r.bagsVolume,
      volumeBefore: before,
      volumeAfter: before,
      discarded: false,
      requiredVolume: 0,
      biopsyChance: 0,
      biopsyRoll: 0,
      biopsySuccess: false,
    };
  }

  const thorough = (r.perks || []).includes(Perks.THOROUGH_SEARCH);
  const timeSpentSec = 300 + (thorough ? 300 : 0);

  const checkValue = clamp(ctx.baseLootChance + r.lootChanceBonus, 0, 100);
  const myRoll = Math.floor(gs.random.get() * 100);

  const entry: LootEncounterLogEntry = {
    kind: 'LootEncounter',
    source: 'raid',
    skipped: false,
    timeSpentSec,
    elapsedTotalSec: 0,
    myRoll,
    checkValue,
    itemId: '',
    capacity: r.bagsVolume,
    volumeBefore: before,
    volumeAfter: before,
    discarded: false,
    requiredVolume: 0,
    biopsyChance: 0,
    biopsyRoll: 0,
    biopsySuccess: false,
  };

  if (myRoll > checkValue) {
    // No valuables found
    return entry;
  }

  const pools = ctx.poolsByRarity

  const poolSizes: Record<LootRarity, number> = {
    common: pools.common.length,
    uncommon: pools.uncommon.length,
    rare: pools.rare.length,
    legendary: pools.legendary.length,
  };

  const raidEntry = gs.unlockedRaids.find(rr => rr.id === r.id)!;
  const effLootChance = r.lootChanceBonus + raidEntry.lootingRarityBuff;
  const weights: Record<LootRarity, number> = {
    common: poolSizes.common > 0 ? 200 : 0,
    uncommon: poolSizes.uncommon > 0 ? 50 + effLootChance / 2 : 0,
    rare: poolSizes.rare > 0 ? 20 + effLootChance / 4 : 0,
    legendary: poolSizes.legendary > 0 ? 10 + effLootChance / 7 : 0,
  };

  const entries: Array<[LootRarity, number]> = ([
    ['common', weights.common],
    ['uncommon', weights.uncommon],
    ['rare', weights.rare],
    ['legendary', weights.legendary],
  ] as Array<[LootRarity, number]>).filter(([, w]) => w > 0);

  let picked: string | null = null;
  if (entries.length > 0) {
    const total = entries.reduce((a, [, w]) => a + w, 0);
    let rroll = gs.random.get() * total;
    let chosen = entries[0][0];
    for (const [c, w] of entries) {
      if (rroll < w) { chosen = c; break; }
      rroll -= w;
    }
    const pool = pools[chosen];
    const idx = Math.floor(gs.random.get() * pool.length);
    picked = pool[idx] || null;
  }

  if (!picked) {
    return entry;
  }

  const def = gs.lib.getItem(picked);
  const after = before + def.volume;

  entry.itemId = picked;
  entry.volumeBefore = before;
  entry.capacity = r.bagsVolume;

  if (after <= r.bagsVolume) {
    r.usedVolume = after;
    entry.volumeAfter = after;
    entry.discarded = false;
  } else {
    entry.volumeAfter = before;
    entry.discarded = true;
    entry.requiredVolume = Math.max(0, after - r.bagsVolume);
  }

  return entry;
}

export function handleMonsterLootEncounter(gs: GameState, r: ActiveRaid, itemId: string, biopsyChance: number): LootEncounterLogEntry {
  const before = Math.max(0, r.usedVolume || 0);
  const timeSpentSec = 60; // fixed 1 minute to harvest

  const biopsyRoll = Math.floor(gs.random.get() * 100);
  const biopsySuccess = biopsyRoll < biopsyChance;

  const entry: LootEncounterLogEntry = {
    kind: 'LootEncounter',
    source: 'monster',
    skipped: false,
    timeSpentSec,
    elapsedTotalSec: 0,
    myRoll: 0,
    checkValue: 0,
    itemId,
    capacity : r.bagsVolume,
    volumeBefore: before,
    volumeAfter: before,
    discarded: false,
    requiredVolume: 0,
    biopsyChance,
    biopsyRoll,
    biopsySuccess,
  };

  if (!biopsySuccess) {
    entry.itemId = '';
    return entry;
  }

  const def = gs.lib.getItem(itemId);
  const after = before + def.volume;

  if (after <= r.bagsVolume) {
    r.usedVolume = after;
    entry.volumeAfter = after;
    entry.discarded = false;
  } else {
    entry.volumeAfter = before;
    entry.discarded = true;
    entry.requiredVolume = Math.max(0, after - r.bagsVolume);
  }

  return entry;
}
