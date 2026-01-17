<template>
  <div class="gear panel">
    <!-- Show button only when speed is discovered but gear is not -->
    <template v-if="hasDiscoveredSpeed && !hasDiscoveredGear">
      <div class="discover-gear-container">
        <button class="discover-gear-btn" @click="discoverGear">Review available gear</button>
      </div>
    </template>
    <!-- Show gear grid only when gear is discovered -->
    <template v-else-if="hasDiscoveredGear">
      <div class="gear-grid">
        <div v-for="(cat, colIndex) in categories" :key="cat" class="gear-col">
          <div class="gear-cat">
            <div class="name">{{ displayCategoryName(cat) }}</div>
            <div class="cat-right">
              <button
                v-if="canShowUpgradeButton(cat)"
                :class="['upgrade-btn', { 'pulse': shouldPulseUpgradeButton }]"
                @click="openUpgradeModal(cat)"
                title="Upgrade gear categories"
              >+</button>
              <div class="slots" :aria-label="usedCount(cat) + '/' + allowedSlots(cat)">{{ slotCircles(cat) }}</div>
            </div>
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
              :count="g.countable ? (uiState.countableGear[g.id] || 0) : undefined"
              :hintRight="colIndex === 0"
              @toggle="toggleItemWithLimit(cat, g.id)"
            />
          </div>
        </div>
      </div>
    </template>
    <!-- Show nothing when speed is not yet discovered -->
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import GearItem from './GearItem.vue';
import { uiState, getGameState } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdToggleGear, CmdOpenGearUpgradeModal, CmdDiscover } from '../logic/input/InputCommands';
import { DISCOVERY } from '../logic/DiscoveryLib';
import type { GearDefinition } from '../logic/GearLib';
import type { RaidDefinition } from '../logic/RaidLib';

const activeRaidId = computed(() => uiState.activeRaidId || (uiState.raidOrder[0] || ''));
const selectedRaid = computed<RaidDefinition | null>(() => uiState.raids.find(r => r.id === activeRaidId.value) || null);
const hasDiscoveredGear = computed(() => uiState.hasDiscoveredGear);
const hasDiscoveredSpeed = computed(() => uiState.hasDiscoveredRaidSpeed);

function discoverGear(): void {
  globalInputQueue.push(new CmdDiscover({ discoveryId: DISCOVERY.GEAR }));
}

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

  const list = (uiState.unlockedGear && uiState.unlockedGear.length > 0)
    ? uiState.unlockedGear
    : (gs?.unlockedGear || []);
  const unlocked = new Set<string>(list);

  // Find categories that have at least one unlocked item
  const hasUnlockedItems = new Set<string>();
  gs.lib.gear.forEach(g => {
    if (unlocked.has(g.id)) hasUnlockedItems.add(g.category);
  });

  const arr: string[] = [];
  gs.lib.gearCategories.forEach((def, id) => {
    if (hasUnlockedItems.has(id) && !(def as any)?.hidden) arr.push(id);
  });
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
    // Hide countable gear with 0 count
    if (g.countable && (uiState.countableGear[g.id] || 0) <= 0) return;
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
  const usedCircles = Array(used).fill('◉').join(' ');
  const emptyCircles = Array(Math.max(0, max - used)).fill('◌').join(' ');
  return [usedCircles, emptyCircles].filter(s => s).join(' ');
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

function canShowUpgradeButton(cat: string): boolean {
  // Use reactive uiState.skillPoints to trigger re-render when skill points change
  if ((uiState.skillPoints || 0) <= 0) return false;

  const gs = getGameState();
  if (!gs) return false;

  const def = gs.lib.gearCategories.get(cat);
  if (!def) return false;

  if ((def as any)?.hidden || (def as any)?.unlimited) return false;

  // Check if category has reached maximum level
  const costs = (def as any).unlockCost || [];
  const currentSlots = Math.max(0, gs.gearLevels?.[cat] ?? 0);
  const nextIndex = currentSlots - 1; // costs[0] is for 2nd slot (from 1 to 2)
  if (nextIndex < 0 || nextIndex >= costs.length) return false;

  return true;
}

const shouldPulseUpgradeButton = computed(() => {
  const _dep = uiState.discoveryCounter;
  const gs = getGameState();
  return gs?.discoveries?.[DISCOVERY.GEAR_UPGRADE_MODAL_OPENED] !== true;
});

function openUpgradeModal(category: string): void {
  uiState.gearUpgradeFocusCategory = category;
  globalInputQueue.push(new CmdOpenGearUpgradeModal());
  uiState.gearUpgradeModalOpen = true;
}

// summary and deploy moved to RaidDeploy panel
</script>

<style scoped>
.discover-gear-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80px;
}
.discover-gear-btn {
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
.discover-gear-btn:hover {
  background: rgba(34,197,94,0.45);
}
.gear .section-title { font-weight: 800; text-transform: uppercase; font-size: 12px; letter-spacing: 0.08em; margin-bottom: 8px;}
.gear-grid { display: flex; flex-wrap: wrap; gap: 12px; }
.gear-col { flex: 1 1 160px; max-width: 280px; display: flex; flex-direction: column; gap: 6px; }
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
.cat-right { display: flex; align-items: center; gap: 6px; }
.gear-cat .slots { font-weight: 900; color: var(--text-primary); white-space: nowrap; }
.gear-cat .slots { font-variant-numeric: tabular-nums; }
.upgrade-btn { padding: 2px 8px; font-size: 14px; font-weight: 900; background: rgba(34, 197, 94, 0.18); color: #86efac; border: 1px solid rgba(34, 197, 94, 0.35); border-radius: 3px; cursor: pointer; transition: all 100ms ease; }
.upgrade-btn:hover { background: rgba(34, 197, 94, 0.28); transform: scale(1.05); }
.upgrade-btn.pulse { animation: pulse-glow 1.5s ease-in-out infinite; }
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 4px rgba(34, 197, 94, 0.4); }
  50% { box-shadow: 0 0 12px rgba(34, 197, 94, 0.8), 0 0 20px rgba(34, 197, 94, 0.4); }
}
.gear-items { display: grid; gap: 6px; }
</style>
