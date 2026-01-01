<template>
  <div class="gear panel">
    <div class="gear-grid">
      <div v-for="(cat, colIndex) in categories" :key="cat" class="gear-col">
        <div class="gear-cat">
          <div class="name">{{ displayCategoryName(cat) }}</div>
          <div class="slots" :aria-label="usedCount(cat) + '/' + allowedSlots(cat)">{{ slotCircles(cat) }}</div>
        </div>
        <div class="gear-items">
          <GearItem
            v-for="g in (gearByCategory[cat] || [])"
            :key="g.id"
            :gear="g"
            :selected="isSelected(g.id)"
            :unaffordable="!canAffordItem(g)"
            :blocked="isSelectionBlocked(cat, g.id)"
            :price="getPrice(g)"
            :hintRight="colIndex === 0"
            @toggle="toggleItemWithLimit(cat, g.id)"
          />
        </div>
      </div>
    </div>


  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import GearItem from './GearItem.vue';
import { uiState, getGameState } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdStartRaid, CmdToggleGear } from '../logic/input/InputCommands';
import type { GearDefinition } from '../logic/GearLib';
import type { RaidDefinition } from '../logic/RaidLib';

const activeRaidId = computed(() => uiState.activeRaidId || (uiState.raidOrder[0] || ''));
const selectedRaid = computed<RaidDefinition | null>(() => uiState.raids.find(r => r.id === activeRaidId.value) || null);

function loadout(): string[] {
  const gs = getGameState();
  const id = activeRaidId.value;
  if (!gs || !id) return [];
  return (gs.loadouts && gs.loadouts[id]) ? gs.loadouts[id] : [];
}

const categories = computed<string[]>(() => {
  // Touch reactive UI deps so recompute happens after initial sync
  // (gameRef from getGameState is not reactive by itself)
  const _dep = uiState.unlockedGear.length + uiState.raidOrder.length;
  const gs = getGameState();
  if (!gs) return [];
  const hasItems = new Set<string>();
  gs.lib.gear.forEach(g => hasItems.add(g.category));
  const arr: string[] = [];
  gs.lib.gearCategories.forEach((def, id) => {
    if (hasItems.has(id) && !(def as any)?.hidden) arr.push(id);
  });
  if (!arr.length) {
    gs.lib.gear.forEach(g => { if (!arr.includes(g.category)) arr.push(g.category); });
  }
  return arr;
});

const gearByCategory = computed<Record<string, GearDefinition[]>>(() => {
  const gs = getGameState();
  const map: Record<string, GearDefinition[]> = {};
  if (!gs) return map;
  const list = (uiState.unlockedGear && uiState.unlockedGear.length > 0)
    ? uiState.unlockedGear
    : (gs?.unlockedGear || []);
  const unlocked = new Set<string>(list);
  gs.lib.gear.forEach((g) => {
    if (!unlocked.has(g.id)) return;
    if (!map[g.category]) map[g.category] = [];
    map[g.category].push(g);
  });
  for (const k of Object.keys(map)) map[k].sort((a, b) => {
    const priceA = a.price || 0;
    const priceB = b.price || 0;
    if (priceA !== priceB) return priceA - priceB;
    return a.name < b.name ? -1 : 1;
  });
  return map;
});

function isSelected(id: string): boolean { return loadout().includes(id); }
function getPrice(g: GearDefinition): number { return Math.max(0, g.price || 0); }
function canAffordItem(g: GearDefinition): boolean { return uiState.credits >= getPrice(g); }

function toggleItem(id: string): void {
  const selected = !isSelected(id);
  globalInputQueue.push(new CmdToggleGear({ raidId: activeRaidId.value, gearId: id, selected }));
}

function allowedSlots(cat: string): number {
  const gs = getGameState();
  const def = gs?.lib?.gearCategories?.get(cat) as any;
  if (def && def.unlimited) return Number.POSITIVE_INFINITY;
  return Math.max(0, gs?.gearLevels?.[cat] ?? 0);
}
function usedCount(cat: string): number {
  const gs = getGameState();
  if (!gs) return 0;
  const ids = loadout();
  let n = 0;
  for (const id of ids) {
    const g = gs.lib.gear.get(id);
    if (g && g.category === cat) n += 1;
  }
  return n;
}
function isSelectionBlocked(cat: string, id: string): boolean { return !isSelected(id) && usedCount(cat) >= allowedSlots(cat); }
function displayCategoryName(cat: string): string { return getGameState()?.lib.gearCategories.get(cat)?.name || cat; }

function slotCircles(cat: string): string {
  const maxSlots = allowedSlots(cat);
  const max = Number.isFinite(maxSlots) ? Math.max(0, maxSlots | 0) : usedCount(cat);
  const used = Math.max(0, Math.min(usedCount(cat) | 0, max));
  return '◉'.repeat(used) + '◌'.repeat(Math.max(0, max - used));
}

function toggleItemWithLimit(cat: string, id: string): void {
  const selected = !isSelected(id);
  if (selected) {
    const max = allowedSlots(cat);
    const used = usedCount(cat);
    if (used >= max) return;
  }
  toggleItem(id);
}

// summary and deploy moved to RaidDeploy panel
</script>

<style scoped>
.gear .section-title { font-weight: 800; text-transform: uppercase; font-size: 12px; letter-spacing: 0.08em; margin-bottom: 8px; }
.gear-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 0.75fr)); gap: 12px; }
.gear-col { display: flex; flex-direction: column; gap: 6px; }
/* Column headers: single-line, no background, with divider */
.gear-cat {
  background: none;
  border-radius: 0;
  padding: 4px 2px 8px 2px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  text-align: left;
  border-bottom: 1px solid var(--panel-border);
}
.gear-cat .name { color: var(--text-secondary); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gear-cat .slots { font-weight: 900; color: var(--text-primary); white-space: nowrap; }
.gear-cat .slots { font-variant-numeric: tabular-nums; }
.gear-items { display: grid; gap: 6px; }
</style>
