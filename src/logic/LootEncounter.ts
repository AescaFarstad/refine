import type { ActiveRaid, GameState } from './GameState';
import type { LootRarity } from './RaidLib';
import { createLootEncounterLogEntry, createMonsterLootEncounterLogEntry, type LootEncounterLogEntry, type MonsterLootEncounterLogEntry } from './RaidLog';
import Perks from './Perks';
import { TMP_LOOT_BUFF_PER_FULL_BAGS_SKIP_PCT } from './Const';
import type { ItemDefinition } from './ItemLib';

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function rarityRank(r: ItemDefinition['rarity']): number {
  switch (r) {
    case 'common': return 0;
    case 'uncommon': return 1;
    case 'rare': return 2;
    case 'legendary': return 3;
  }
}

function findReplacementCandidate(
  gs: GameState,
  usedVolumeBefore: number,
  capacity: number,
  newItemId: string,
  bagItemCounts: Record<string, number>
): { replacedItemId: string; usedVolumeAfter: number } | null {
  const newDef = gs.lib.getItem(newItemId);
  const newAfter = usedVolumeBefore + newDef.volume;
  if (newAfter <= capacity) return null;

  let best: { replacedItemId: string; usedVolumeAfter: number; replacedScore: number; replacedVolume: number } | null = null;

  for (const [oldItemId, count] of Object.entries(bagItemCounts)) {
    if (count <= 0) continue;
    const oldDef = gs.lib.getItem(oldItemId);
    const usedAfter = usedVolumeBefore - oldDef.volume + newDef.volume;
    if (usedAfter > capacity) continue;

    const newScoreOkHigherRarity = (newDef.score >= oldDef.score * 1.1) && (rarityRank(newDef.rarity) > rarityRank(oldDef.rarity));
    const newScoreOkSameOrLowerRarity = (newDef.score >= oldDef.score * 1.2) && (rarityRank(newDef.rarity) <= rarityRank(oldDef.rarity));
    if (!newScoreOkHigherRarity && !newScoreOkSameOrLowerRarity) continue;

    const candidate = { replacedItemId: oldItemId, usedVolumeAfter: usedAfter, replacedScore: oldDef.score, replacedVolume: oldDef.volume };
    if (!best) {
      best = candidate;
      continue;
    }
    if (candidate.replacedScore !== best.replacedScore) {
      if (candidate.replacedScore < best.replacedScore) best = candidate;
      continue;
    }
    if (candidate.replacedVolume !== best.replacedVolume) {
      if (candidate.replacedVolume > best.replacedVolume) best = candidate;
      continue;
    }
  }

  if (!best) return null;
  return { replacedItemId: best.replacedItemId, usedVolumeAfter: best.usedVolumeAfter };
}

export interface LootEncounterContext {
  items: string[];
  poolsByRarity: Record<LootRarity, string[]>;
  baseLootChance: number;
  bannedItemIds?: string[];
}

export type LootRarityWeights = Record<LootRarity, number>;

export function computeEffectiveRarityBuff(
  lootChanceBonus: number,
  lootingRarityBuff: number,
  rarityBuff: number
): number {
  return lootChanceBonus * 0.5 + (lootingRarityBuff + rarityBuff) * 2;
}

export function computeLootRarityWeights(
  poolSizes: Record<LootRarity, number>,
  effLootChance: number
): LootRarityWeights {
  return {
    common: poolSizes.common > 0 ? 200 : 0,
    uncommon: poolSizes.uncommon > 0 ? 50 + effLootChance / 2 : 0,
    rare: poolSizes.rare > 0 ? 20 + effLootChance / 4 : 0,
    legendary: poolSizes.legendary > 0 ? 10 + effLootChance / 7 : 0,
  };
}

export function handleLootLikeEncounter(
  gs: GameState,
  r: ActiveRaid,
  ctx: LootEncounterContext,
  bagItemCounts: Record<string, number>,
  discardedItemCounts: Record<string, number>
): LootEncounterLogEntry {
  const before = Math.max(0, r.usedVolume || 0);
  if (before >= r.bagsVolume) {
    r.tmpLootBuffNextRaidPct += TMP_LOOT_BUFF_PER_FULL_BAGS_SKIP_PCT;
    return createLootEncounterLogEntry({
      skipped: true,
      skipReason: 'bags_full',
      tmpLootBuffNextRaidPct: r.tmpLootBuffNextRaidPct,
      capacity: r.bagsVolume,
      volumeBefore: before,
      volumeAfter: before,
    });
  }

  const thorough = (r.perks || []).includes(Perks.THOROUGH_SEARCH);
  const hackAndSlash = (r.perks || []).includes(Perks.HACK_AND_SLASH);
  const hackAndCrack = (r.perks || []).includes(Perks.HACK_AND_CRACK);
  const timeSpentSec = 300 + (thorough ? 300 : 0) - (hackAndCrack ? 240 : hackAndSlash ? 120 : 0);

  const checkValue = clamp(ctx.baseLootChance + r.lootChanceBonus + r.tmpLootBuffAppliedPct, 0, 100);
  const myRoll = Math.floor(gs.random.get() * 100);

  const entry: LootEncounterLogEntry = createLootEncounterLogEntry({
    timeSpentSec,
    myRoll,
    checkValue,
    tmpLootBuffNextRaidPct: r.tmpLootBuffNextRaidPct,
    capacity: r.bagsVolume,
    volumeBefore: before,
    volumeAfter: before,
  });

  if (myRoll > checkValue) {
    // No valuables found
    return entry;
  }

  const bannedSet = ctx.bannedItemIds && ctx.bannedItemIds.length > 0
    ? new Set(ctx.bannedItemIds)
    : null;

  const pools: Record<LootRarity, string[]> = bannedSet
    ? {
        common: ctx.poolsByRarity.common.filter(id => !bannedSet.has(id)),
        uncommon: ctx.poolsByRarity.uncommon.filter(id => !bannedSet.has(id)),
        rare: ctx.poolsByRarity.rare.filter(id => !bannedSet.has(id)),
        legendary: ctx.poolsByRarity.legendary.filter(id => !bannedSet.has(id)),
      }
    : ctx.poolsByRarity;

  const poolSizes: Record<LootRarity, number> = {
    common: pools.common.length,
    uncommon: pools.uncommon.length,
    rare: pools.rare.length,
    legendary: pools.legendary.length,
  };

  const raidEntry = gs.unlockedRaids.find(rr => rr.id === r.id)!;
  const effRarityBuff = computeEffectiveRarityBuff(r.lootChanceBonus, raidEntry.lootingRarityBuff, r.rarityBuff);
  const weights = computeLootRarityWeights(poolSizes, effRarityBuff);

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
    bagItemCounts[picked] = (bagItemCounts[picked] ?? 0) + 1;
  } else {
    const replacement = findReplacementCandidate(gs, before, r.bagsVolume, picked, bagItemCounts);
    if (replacement) {
      r.usedVolume = replacement.usedVolumeAfter;
      entry.volumeAfter = replacement.usedVolumeAfter;
      entry.replacedItemId = replacement.replacedItemId;
      entry.discarded = false;
      entry.requiredVolume = 0;
      bagItemCounts[replacement.replacedItemId] = (bagItemCounts[replacement.replacedItemId] ?? 0) - 1;
      if (bagItemCounts[replacement.replacedItemId] <= 0) delete bagItemCounts[replacement.replacedItemId];
      bagItemCounts[picked] = (bagItemCounts[picked] ?? 0) + 1;
      discardedItemCounts[replacement.replacedItemId] = (discardedItemCounts[replacement.replacedItemId] ?? 0) + 1;
    } else {
      entry.volumeAfter = before;
      entry.discarded = true;
      entry.requiredVolume = Math.max(0, after - r.bagsVolume);
      discardedItemCounts[picked] = (discardedItemCounts[picked] ?? 0) + 1;
    }
  }

  return entry;
}

export function handleMonsterLootEncounter(
  gs: GameState,
  r: ActiveRaid,
  itemId: string,
  biopsyChance: number,
  bagItemCounts: Record<string, number>,
  discardedItemCounts: Record<string, number>
): MonsterLootEncounterLogEntry {
  const before = Math.max(0, r.usedVolume || 0);
  const timeSpentSec = 60; // fixed 1 minute to harvest

  if (before >= r.bagsVolume) {
    return createMonsterLootEncounterLogEntry({
      skipped: true,
      skipReason: 'bags_full',
      tmpLootBuffNextRaidPct: r.tmpLootBuffNextRaidPct,
      capacity: r.bagsVolume,
      volumeBefore: before,
      volumeAfter: before,
      biopsyChance,
      explosiveChance: r.perks.includes(Perks.EXPLOSIVE) ? 40 : 0,
    });
  }

  const explosiveChance = r.perks.includes(Perks.EXPLOSIVE) ? 40 : 0;
  const explosiveRoll = explosiveChance > 0 ? Math.floor(gs.random.get() * 100) : 0;
  const explosiveTriggered = explosiveChance > 0 && explosiveRoll < explosiveChance;

  const biopsyRoll = explosiveTriggered ? 0 : Math.floor(gs.random.get() * 100);
  const biopsySuccess = !explosiveTriggered && biopsyRoll < biopsyChance;

  const entry: MonsterLootEncounterLogEntry = createMonsterLootEncounterLogEntry({
    timeSpentSec,
    itemId,
    tmpLootBuffNextRaidPct: r.tmpLootBuffNextRaidPct,
    capacity: r.bagsVolume,
    volumeBefore: before,
    volumeAfter: before,
    biopsyChance,
    biopsyRoll,
    biopsySuccess,
    explosiveChance,
    explosiveRoll,
    explosiveTriggered,
  });

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
    bagItemCounts[itemId] = (bagItemCounts[itemId] ?? 0) + 1;
  } else {
    const replacement = findReplacementCandidate(gs, before, r.bagsVolume, itemId, bagItemCounts);
    if (replacement) {
      r.usedVolume = replacement.usedVolumeAfter;
      entry.volumeAfter = replacement.usedVolumeAfter;
      entry.replacedItemId = replacement.replacedItemId;
      entry.discarded = false;
      entry.requiredVolume = 0;
      bagItemCounts[replacement.replacedItemId] = (bagItemCounts[replacement.replacedItemId] ?? 0) - 1;
      if (bagItemCounts[replacement.replacedItemId] <= 0) delete bagItemCounts[replacement.replacedItemId];
      bagItemCounts[itemId] = (bagItemCounts[itemId] ?? 0) + 1;
      discardedItemCounts[replacement.replacedItemId] = (discardedItemCounts[replacement.replacedItemId] ?? 0) + 1;
    } else {
      entry.volumeAfter = before;
      entry.discarded = true;
      entry.requiredVolume = Math.max(0, after - r.bagsVolume);
      discardedItemCounts[itemId] = (discardedItemCounts[itemId] ?? 0) + 1;
    }
  }

  return entry;
}
