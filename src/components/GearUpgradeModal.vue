<template>
  <div v-if="visible" class="modal-backdrop" @click.self="close">
    <div class="modal-group">
      <div class="modal-window left-window">
        <div :class="['pane-header', { 'pane-header-gain': hoveredSpDelta > 0, 'pane-header-loss': hoveredSpDelta < 0 }]">
          <div class="pane-header-title">{{ skillPointsSpec.name }}: {{ skillPoints }} {{ skillPointsSpec.glyph }}<span v-if="hoveredSpDelta" :class="['sp-delta', hoveredSpDelta > 0 ? 'sp-gain' : 'sp-loss']">{{ hoveredSpDelta > 0 ? '+1' : '-1' }}</span></div>
          <div class="pane-header-subtitle">Increase how many items from the category<br>can be equipped at once</div>
        </div>

        <section class="modal-body">
          <div class="category-list">
            <div
              v-for="cat in visibleCategories"
              :key="cat.id"
              :class="['category-card', {
                'interactive': showGearXpPane,
                'highlighted': showGearXpPane && cat.id === focusCategory,
                'flash': showGearXpPane && cat.id === focusCategory,
              }]"
              @click="showGearXpPane ? focus(cat.id) : undefined"
            >
              <div class="category-top">
                <div class="category-name">{{ cat.name }}</div>
                <div class="category-slots">{{ slotCircles(cat.id) }}</div>
              </div>
              <div class="category-action">
                <button
                  v-if="canUpgrade(cat.id)"
                  :class="['slot-btn', 'actionable']"
                  @click.stop="upgrade(cat.id)"
                >
                  <span class="slot-btn-label">Add slot</span>
                  <span class="slot-btn-cost">{{ getUpgradeCost(cat.id) }} {{ skillPointsSpec.glyph }}</span>
                </button>
                <div v-else class="slot-status">
                  <template v-if="getUpgradeCost(cat.id) >= 999">Max</template>
                  <template v-else>{{ getUpgradeCost(cat.id) }} {{ skillPointsSpec.glyph }}</template>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer class="modal-actions">
          <button class="btn-close" @click="close">Close</button>
        </footer>
      </div>

      <div v-if="showGearXpPane" class="modal-window right-window">
        <GearXPUpgrade />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { uiState, getGameState } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdUpgradeGearCategory } from '../logic/input/InputCommands';
import { getResourceSpec } from '../logic/Resources';
import { DISCOVERY } from '../logic/DiscoveryLib';
import GearXPUpgrade from './GearXPUpgrade.vue';

const visible = computed(() => uiState.gearUpgradeModalOpen);

const skillPoints = computed(() => {
  return uiState.skillPoints;
});

const skillPointsSpec = getResourceSpec('skillPoints');
// const skillPointsLabelLower = skillPointsSpec.name.toLowerCase();

const hoveredSpDelta = computed(() => uiState.gearUpgradeHoveredSkillPoints);
const focusCategory = computed(() => uiState.gearUpgradeFocusCategory);
const showGearXpPane = computed(() => {
  uiState.discoveryCounter;
  return getGameState().discoveries[DISCOVERY.GEAR_XP] === true;
});

interface CategoryInfo {
  id: string;
  name: string;
  currentSlots: number;
}

const visibleCategories = computed<CategoryInfo[]>(() => {
  const gs = getGameState();
  if (!gs) return [];

  const list = (uiState.unlockedGear && uiState.unlockedGear.length > 0)
    ? uiState.unlockedGear
    : (gs?.unlockedGear);
  const unlocked = new Set<string>(list);

  const hasUnlockedItems = new Set<string>();
  gs.lib.gear.forEach(g => {
    if (unlocked.has(g.id)) hasUnlockedItems.add(g.category);
  });

  const categories: CategoryInfo[] = [];
  gs.lib.gearCategories.forEach((def, id) => {
    if (hasUnlockedItems.has(id) && !(def as any)?.hidden) {
      const currentSlots = Math.max(0, gs.gearLevels?.[id] ?? 0);
      categories.push({
        id,
        name: def.name || id,
        currentSlots,
      });
    }
  });

  return categories;
});

function slotCircles(catId: string): string {
  const gs = getGameState();
  if (!gs) return '';
  const slots = Math.max(0, gs.gearLevels?.[catId] ?? 0);
  return Array(slots).fill('◌').join(' ');
}

function getUpgradeCost(catId: string): number {
  const gs = getGameState();
  if (!gs) return 999;
  const def = gs.lib.gearCategories.get(catId);
  if (!def) return 999;
  const costs = (def as any).unlockCost || [];
  const currentSlots = Math.max(0, gs.gearLevels?.[catId] ?? 0);
  const nextIndex = currentSlots - 1; // costs[0] is for 2nd slot (from 1 to 2)
  if (nextIndex < 0 || nextIndex >= costs.length) return 999;
  return Math.max(0, costs[nextIndex] || 999);
}

function canUpgrade(catId: string): boolean {
  const cost = getUpgradeCost(catId);
  if (cost >= 999) return false; // max level reached
  return skillPoints.value >= cost;
}

function upgrade(catId: string): void {
  globalInputQueue.push(new CmdUpgradeGearCategory({ categoryId: catId }));
}

function focus(catId: string): void {
  uiState.gearUpgradeFocusCategory = catId;
}

function close(): void {
  uiState.gearUpgradeModalOpen = false;
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: grid;
  place-items: center;
  z-index: 10000;
}

.modal-group {
  display: flex;
  gap: 12px;
  max-width: 96vw;
  max-height: 90vh;
  align-items: stretch;
}

.modal-window {
  background: linear-gradient(180deg, rgba(20, 28, 40, 0.98), rgba(10, 15, 26, 0.94));
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7), inset 0 1px 0 var(--panel-shine);
  padding: 16px;
}

.left-window {
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 10px;
  min-width: 320px;
}

.right-window {
  width: 946px;
  flex: 0 0 946px;
  overflow-y: auto;
  position: relative;
  z-index: 1;
}

.pane-header {
  font-size: 15px;
  font-weight: 900;
  color: var(--text-primary);
  letter-spacing: 0.04em;
  padding: 6px 12px;
  margin-bottom: 0;
  border-radius: 4px;
  transition: background 0.15s ease;
}

.pane-header-subtitle {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  opacity: 0.6;
  letter-spacing: 0.02em;
  margin-top: 2px;
}

.pane-header-gain {
  background: rgba(74, 222, 128, 0.18);
}

.pane-header-loss {
  background: rgba(239, 83, 80, 0.18);
}

.modal-body {
  overflow: auto;
}

.category-list {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.category-card {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: transparent;
  border-radius: 4px;
  transition: background 0.15s ease;
}

.category-card.interactive {
  cursor: pointer;
}

.category-card.interactive:hover {
  background: rgba(255, 255, 255, 0.08);
}

.category-card.highlighted {
  background: rgba(74, 222, 128, 0.12);
}

.category-card.flash {
  animation: flash-highlight 0.8s ease-out;
}

@keyframes flash-highlight {
  0% {
    background: rgba(74, 222, 128, 0.35);
    box-shadow: 0 0 16px rgba(74, 222, 128, 0.5);
  }
  100% {
    background: rgba(74, 222, 128, 0.12);
    box-shadow: none;
  }
}

.category-top {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 12px;
  align-items: center;
}

.category-name {
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--text-primary);
}

.category-slots {
  font-weight: 900;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  font-size: 15px;
  letter-spacing: 0.05em;
}

.category-action {
  display: flex;
  align-items: center;
}

.slot-btn {
  display: grid;
  grid-template-columns: 1fr auto;
  border: none;
  border-radius: 4px;
  padding: 0;
  color: inherit;
  cursor: pointer;
  font-family: inherit;
  overflow: hidden;
  transition: background-color 0.15s ease;
  background: var(--raid-item-bg, rgba(255,255,255,0.08));
}

.slot-btn:hover {
  background: var(--raid-item-bg-hover, rgba(255,255,255,0.14));
}

.slot-btn-label {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.06em;
  padding: 8px 12px;
  white-space: nowrap;
  color: var(--text-primary);
}

.slot-btn-cost {
  display: grid;
  place-items: center;
  padding: 8px 10px;
  background: rgba(239, 83, 80, 0.25);
  font-size: 13px;
  font-weight: 900;
  color: var(--text-primary);
  white-space: nowrap;
  letter-spacing: 0.04em;
}

.slot-status {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  opacity: 0.5;
  padding: 8px 12px;
  white-space: nowrap;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding-top: 4px;
}

.btn-close {
  padding: 8px 16px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-secondary);
  font-size: 12px;
  font-family: inherit;
  transition: background 0.15s ease;
}

.btn-close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--text-primary);
}

.sp-delta {
  font-size: inherit;
  font-weight: 900;
  margin-left: 6px;
  letter-spacing: 0.02em;
}

.sp-gain {
  color: #86efac;
}

.sp-loss {
  color: #ef5350;
}

@media (max-width: 900px) {
  .modal-group {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
