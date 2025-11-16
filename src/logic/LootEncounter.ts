import type { ActiveRaid, GameState } from './GameState';
import type { LootEncounterLogEntry } from './RaidLog';
import Perks from './Perks';

type Cat = 'common' | 'uncommon' | 'rare' | 'legendary';

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function computeCapacity(gs: GameState, r: ActiveRaid): number {
  // Base player volume plus gear-provided capacity accumulated into r.bagsVolume
  const base = Math.max(0, (gs.volume || 0));
  const gear = Math.max(0, (r.bagsVolume || 0));
  return base + gear;
}

export interface LootEncounterContext {
  // Items available to roll from; if empty or undefined, nothing can be found
  items?: string[];
  // Base chance in percent to find something (0..100) before gear bonuses
  baseLootChance: number;
}

export function handleLootLikeEncounter(gs: GameState, r: ActiveRaid, ctx: LootEncounterContext): LootEncounterLogEntry {
  const capacity = computeCapacity(gs, r);
  const before = Math.max(0, r.usedVolume || 0);

  // If bags already full, skip searching altogether
  if (before >= capacity) {
    return {
      kind: 'LootEncounter',
      source: 'raid',
      skipped: true,
      timeSpentSec: 0,
      myRoll: 0,
      checkValue: 0,
      itemId: '',
      capacity,
      volumeBefore: before,
      volumeAfter: before,
      discarded: false,
      requiredVolume: 0,
    };
  }

  // Spend time searching: 60s base plus 60s if perk Thorough Search
  const thorough = (r.perks || []).includes(Perks.THOROUGH_SEARCH);
  const timeSpentSec = 60 + (thorough ? 60 : 0);

  const lootBonus = Math.max(0, r.lootChanceBonus || 0);
  const checkValue = clamp((ctx.baseLootChance || 0) + lootBonus, 0, 100);
  const myRoll = Math.floor(gs.random.get() * 100);

  const entry: LootEncounterLogEntry = {
    kind: 'LootEncounter',
    source: 'raid',
    skipped: false,
    timeSpentSec,
    myRoll,
    checkValue,
    itemId: '',
    capacity,
    volumeBefore: before,
    volumeAfter: before,
    discarded: false,
    requiredVolume: 0,
  };

  if (myRoll > checkValue) {
    // No valuables found
    return entry;
  }

  const source = Array.isArray(ctx.items) ? ctx.items : [];
  if (!source.length) {
    // Nothing to pick from even on success
    return entry;
  }

  // Build rarity pools from available source ids
  const pools: Record<Cat, string[]> = {
    common: [], uncommon: [], rare: [], legendary: [],
  };
  for (const id of source) {
    const def = gs.lib.items.get(id);
    if (!def) continue;
    const cat = (def.rarity || 'common') as Cat;
    (pools[cat] || pools.common).push(id);
  }

  const poolSizes: Record<Cat, number> = {
    common: pools.common.length,
    uncommon: pools.uncommon.length,
    rare: pools.rare.length,
    legendary: pools.legendary.length,
  };

  const effLooting = Math.max(0, gs.looting || 0);
  const weights: Record<Cat, number> = {
    common: poolSizes.common > 0 ? 200 : 0,
    uncommon: poolSizes.uncommon > 0 ? 50 + effLooting / 2 : 0,
    rare: poolSizes.rare > 0 ? 20 + effLooting / 5 : 0,
    legendary: poolSizes.legendary > 0 ? effLooting / 10 : 0,
  };

  const entries: Array<[Cat, number]> = ([
    ['common', weights.common],
    ['uncommon', weights.uncommon],
    ['rare', weights.rare],
    ['legendary', weights.legendary],
  ]).filter(([, w]) => w > 0) as Array<[Cat, number]>;

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
    // Fallback: no suitable pool; treat as no find
    return entry;
  }

  // We found an item; check capacity to decide if it fits
  const def = gs.lib.items.get(picked);
  const vol = Math.max(0, def?.volume || 0);
  const after = before + vol;

  entry.itemId = picked;
  entry.volumeBefore = before;
  entry.capacity = capacity;

  if (after <= capacity) {
    // Add to used volume; item fits
    r.usedVolume = after;
    entry.volumeAfter = after;
    entry.discarded = false;
  } else {
    // Not enough space; discard
    entry.volumeAfter = before;
    entry.discarded = true;
    entry.requiredVolume = Math.max(0, after - capacity);
  }

  return entry;
}

export function handleMonsterLootEncounter(gs: GameState, r: ActiveRaid, itemId: string): LootEncounterLogEntry {
  const capacity = computeCapacity(gs, r);
  const before = Math.max(0, r.usedVolume || 0);
  const timeSpentSec = 60; // fixed 1 minute to harvest

  const entry: LootEncounterLogEntry = {
    kind: 'LootEncounter',
    source: 'monster',
    skipped: false,
    timeSpentSec,
    myRoll: 0,
    checkValue: 0,
    itemId,
    capacity,
    volumeBefore: before,
    volumeAfter: before,
    discarded: false,
    requiredVolume: 0,
  };

  const def = gs.lib.items.get(itemId)!;
  const vol = Math.max(0, def.volume || 0);
  const after = before + vol;

  if (after <= capacity) {
    r.usedVolume = after;
    entry.volumeAfter = after;
    entry.discarded = false;
  } else {
    entry.volumeAfter = before;
    entry.discarded = true;
    entry.requiredVolume = Math.max(0, after - capacity);
  }

  return entry;
}
