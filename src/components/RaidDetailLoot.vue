<template>
  <div v-if="hasDiscoveredMonsters">
    <template v-if="!hasDiscoveredLoot && lootCount > 0">
      <div class="discover-container">
        <button class="discover-btn" @click="discoverLoot">Review raid looting opportunities</button>
      </div>
    </template>

    <div v-if="hasDiscoveredLoot && lootCount > 0" class="enc-table">
      <table class="table">
        <thead>
          <tr>
            <th></th>
            <th>Count</th>
            <th>Find item chance</th>
            <th>Rarity %</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="scavenge-cell">
              <span class="scavenge-label">Scavenge sites</span>
              <div class="scavenge-hint">
                <div v-for="prob in lootRarityProbabilities" :key="prob.rarity" class="hint-row">
                  <div class="hint-header" :class="prob.rarity">{{ prob.rarity }} {{ prob.pct }}%</div>
                  <div v-if="getKnownItemsForRarity(prob.rarity).length > 0" class="hint-items">
                    <ItemDisplay v-for="item in getKnownItemsForRarity(prob.rarity)" :key="item.id" :id="item.id" :minor="true" />
                  </div>
                  <div v-else class="hint-empty">No such items have been extracted yet</div>
                </div>
              </div>
            </td>
            <td>{{ lootCount }}</td>
            <td>{{ lootChanceBasePct }}%<template v-if="lootChanceBuffPct"> + {{ lootChanceBuffPct }}%</template></td>
            <td class="rarity-probs">
              <template v-for="(prob, idx) in lootRarityProbabilities" :key="prob.rarity">
                <span v-if="idx > 0" class="rarity-sep">&nbsp;-&nbsp;</span>
                <span class="rarity-val" :class="prob.rarity">{{ formatRarityPct(prob.pct) }}</span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { uiState, getGameState, getGameLib } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdDiscover } from '../logic/input/InputCommands';
import { DISCOVERY } from '../logic/DiscoveryLib';
import type { RaidDefinition } from '../logic/RaidLib';
import ItemDisplay from './ItemDisplay.vue';
import { computeLootRarityWeights, computeEffectiveRarityBuff } from '../logic/LootEncounter';

const props = defineProps<{
  raid: RaidDefinition;
  lootCount: number;
}>();

const raid = computed(() => props.raid);
const lootCount = computed(() => props.lootCount);

const hasDiscoveredMonsters = computed(() => uiState.hasDiscoveredRaidMonsters);
const hasDiscoveredLoot = computed(() => uiState.hasDiscoveredRaidLoot);

function discoverLoot(): void {
  globalInputQueue.push(new CmdDiscover({ discoveryId: DISCOVERY.UI_RAID_LOOT }));
}

const lootChanceBasePct = computed(() => {
  uiState.raidKey;
  const raidValue = raid.value;
  const gs = getGameState();
  return Math.max(0, Math.min(100, Math.round(raidValue.baseLootChance + gs.raid.lootChanceBonus)));
});

const lootChanceBuffPct = computed(() => {
  uiState.raidKey;
  const gs = getGameState();
  return Math.max(0, Math.round(gs.raid.tmpLootBuffAppliedPct));
});

interface RarityProbability {
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  weight: number;
  pct: number;
}

const lootRarityProbabilities = computed<RarityProbability[]>(() => {
  uiState.raidKey;
  const raidValue = raid.value;
  const gs = getGameState();
  const raidEntry = gs.unlockedRaids.find(rr => rr.id === raidValue.id)!;
  const effRarityBuff = computeEffectiveRarityBuff(gs.raid.lootChanceBonus, raidEntry.lootingRarityBuff, gs.raid.rarityBuff);

  const bannedSet = new Set(raidEntry.bannedItemIds);
  const hasBans = bannedSet.size > 0;
  const poolSizes = {
    common: hasBans
      ? raidValue.itemPoolsByRarity.common.filter(id => !bannedSet.has(id)).length
      : raidValue.itemPoolsByRarity.common.length,
    uncommon: hasBans
      ? raidValue.itemPoolsByRarity.uncommon.filter(id => !bannedSet.has(id)).length
      : raidValue.itemPoolsByRarity.uncommon.length,
    rare: hasBans
      ? raidValue.itemPoolsByRarity.rare.filter(id => !bannedSet.has(id)).length
      : raidValue.itemPoolsByRarity.rare.length,
    legendary: hasBans
      ? raidValue.itemPoolsByRarity.legendary.filter(id => !bannedSet.has(id)).length
      : raidValue.itemPoolsByRarity.legendary.length,
  };

  const weights = computeLootRarityWeights(poolSizes, effRarityBuff);

  const total = weights.common + weights.uncommon + weights.rare + weights.legendary;
  if (total <= 0) return [];

  const result: RarityProbability[] = [];
  for (const r of ['common', 'uncommon', 'rare', 'legendary'] as const) {
    if (weights[r] > 0) {
      result.push({
        rarity: r,
        weight: weights[r],
        pct: Math.round((weights[r] / total) * 1000) / 10,
      });
    }
  }
  return result;
});

interface KnownItemsByRarity {
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  items: Array<{ id: string; name: string }>;
}

const knownItemsByRarity = computed<KnownItemsByRarity[]>(() => {
  uiState.raidKey;
  const raidValue = raid.value;
  const gs = getGameState();
  const lib = getGameLib();
  const raidEntry = gs.unlockedRaids.find(rr => rr.id === raidValue.id)!;
  const foundSet = new Set(raidEntry.foundItemIds);
  const bannedSet = new Set(raidEntry.bannedItemIds);

  const result: KnownItemsByRarity[] = [];
  for (const r of ['common', 'uncommon', 'rare', 'legendary'] as const) {
    const pool = raidValue.itemPoolsByRarity[r];
    const knownItems: Array<{ id: string; name: string }> = [];
    for (const id of pool) {
      if (bannedSet.has(id)) continue;
      if (foundSet.has(id)) {
        const def = lib.items.get(id)!;
        knownItems.push({ id, name: def.name });
      }
    }
    if (knownItems.length > 0 || pool.filter(id => !bannedSet.has(id)).length > 0) {
      result.push({ rarity: r, items: knownItems });
    }
  }
  return result;
});

function getKnownItemsForRarity(rarity: string): Array<{ id: string; name: string }> {
  const group = knownItemsByRarity.value.find(g => g.rarity === rarity)!;
  return group.items;
}

function formatRarityPct(pct: number): string {
  if (pct === 0) return '0';
  if (pct >= 10) return Math.round(pct).toString();
  return pct.toFixed(1);
}
</script>

<style scoped>
.enc-table { margin-top: 8px; }
.enc-table + .enc-table { margin-top: 16px; }
.table { border-collapse: collapse; }
.table th, .table td { text-align: left; padding: 6px clamp(16px, 4vw, 48px); }
.table th:first-child, .table td:first-child { border-right: 1px solid rgba(255,255,255,0.28); width: var(--raid-table-first-col); min-width: var(--raid-table-first-col); padding-right: 8px; padding-left: 0; }
.table th:nth-child(2), .table td:nth-child(2) { min-width: 60px; }
.table thead th:not(:first-child) { border-bottom: 1px solid rgba(255,255,255,0.28); }
.table thead th { font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; }

.discover-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 50px;
  margin: 8px 0;
}
.discover-btn {
  height: 32px;
  padding: 0 14px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-radius: 4px;
  border: 1px solid rgba(34,197,94,0.5);
  background: rgba(34,197,94,0.32);
  color: #86efac;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.discover-btn:hover {
  background: rgba(34,197,94,0.45);
}

.scavenge-cell {
  position: relative;
}
.scavenge-label {
  text-decoration: underline;
  text-decoration-style: dashed;
  text-underline-offset: 3px;
  cursor: default;
}
.scavenge-hint {
  position: absolute;
  top: 50%;
  left: calc(100% + 12px);
  transform: translateY(-50%);
  display: none;
  z-index: 3000;
  background: var(--hint-bg, rgba(10, 14, 20, 0.95));
  border: 1px solid var(--hint-border, rgba(255, 255, 255, 0.15));
  border-radius: 4px;
  padding: 10px 14px;
  min-width: 200px;
  width: max-content;
  max-width: 360px;
  font-size: 13px;
  font-weight: 500;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}
.scavenge-hint::before {
  content: '';
  position: absolute;
  top: 50%;
  right: 100%;
  width: 10px;
  height: 10px;
  background: var(--hint-bg, rgba(10, 14, 20, 0.95));
  border-left: 1px solid var(--hint-border, rgba(255, 255, 255, 0.15));
  border-bottom: 1px solid var(--hint-border, rgba(255, 255, 255, 0.15));
  transform: translateY(-50%) rotate(45deg);
}
.scavenge-cell:hover .scavenge-hint {
  display: block;
}
.hint-row {
  margin-bottom: 8px;
}
.hint-row:last-child {
  margin-bottom: 0;
}
.hint-header {
  font-weight: 700;
  font-size: 12px;
  text-transform: capitalize;
  margin-bottom: 2px;
}
.hint-header.common { color: #9ca3af; }
.hint-header.uncommon { color: #22c55e; }
.hint-header.rare { color: #3b82f6; }
.hint-header.legendary { color: #f59e0b; }
.hint-items {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.hint-empty {
  font-size: 11px;
  color: var(--text-secondary);
  font-style: italic;
  margin-top: 2px;
}

.rarity-probs {
  white-space: nowrap;
}
.rarity-sep {
  color: var(--text-secondary);
  opacity: 0.5;
  margin: 0 1px;
}
.rarity-val.common { color: #9ca3af; }
.rarity-val.uncommon { color: #22c55e; }
.rarity-val.rare { color: #3b82f6; }
.rarity-val.legendary { color: #f59e0b; }
</style>
