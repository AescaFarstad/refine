<template>
  <div v-if="visible" class="modal-backdrop" @click.self="close">
    <div :class="['modal', { 'with-xp-pane': showGearXpPane }]">
      <div class="modal-left">
        <header class="modal-header">
          <div>
            <h3 class="modal-title">{{ skillPointsSpec.name }}: {{ skillPoints }} ◌</h3>
            <p class="modal-subtitle">Increase how many items from the category can be equipped at once</p>
          </div>
        </header>

        <section class="modal-body">
          <div class="category-list">
            <div
              v-for="cat in visibleCategories"
              :key="cat.id"
              :class="['category-row', { 'highlighted': cat.id === focusCategory, 'flash': cat.id === focusCategory }]"
              @click="focus(cat.id)"
            >
              <div class="category-name">{{ cat.name }}</div>
              <div class="category-slots">{{ slotCircles(cat.id) }}</div>
              <div class="category-action">
                <button
                  v-if="canUpgrade(cat.id)"
                  class="btn upgrade"
                  @click.stop="upgrade(cat.id)"
                >
                  Add slot for <span class="cost-highlight">{{ getUpgradeCost(cat.id) }}</span> {{ skillPointsLabelLower }}
                </button>
                <div v-else class="requirement-label">
                  <template v-if="getUpgradeCost(cat.id) >= 999">Maximum reached</template>
                  <template v-else>Requires <span class="cost-dim">{{ getUpgradeCost(cat.id) }}</span> {{ skillPointsLabelLower }}</template>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer class="modal-actions">
          <button class="btn primary" @click="close">Close</button>
        </footer>
      </div>

      <div v-if="showGearXpPane" class="modal-right">
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
const skillPointsLabelLower = skillPointsSpec.name.toLowerCase();

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

.modal {
  width: max-content;
  max-width: 96vw;
  background: linear-gradient(180deg, rgba(20, 28, 40, 0.98), rgba(10, 15, 26, 0.94));
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7), inset 0 1px 0 var(--panel-shine);
  padding: 16px;
  display: grid;
  grid-template-columns: 420px;
  gap: 16px;
  max-height: 90vh;
}

.modal.with-xp-pane {
  grid-template-columns: 420px max-content;
}

.modal-left {
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 16px;
}

.modal-right {
  padding-top: 24px;
  overflow: visible;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.modal-subtitle {
  margin: 4px 0 0 0;
  font-size: 13px;
  font-weight: 400;
  color: var(--text-secondary);
  opacity: 0.7;
  letter-spacing: 0.01em;
}

.modal-body {
  overflow: auto;
}


.category-list {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.category-row {
  display: grid;
  grid-template-columns: auto auto 1fr;
  align-items: center;
  gap: 24px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
  transition: background 0.3s ease;
  cursor: pointer;
}

.category-row.highlighted {
  background: rgba(79, 209, 197, 0.15);
  border: 1px solid rgba(79, 209, 197, 0.3);
}

.category-row.flash {
  animation: flash-highlight 0.8s ease-out;
}

@keyframes flash-highlight {
  0% {
    background: rgba(79, 209, 197, 0.4);
    box-shadow: 0 0 20px rgba(79, 209, 197, 0.6);
  }
  100% {
    background: rgba(79, 209, 197, 0.15);
    box-shadow: none;
  }
}


.category-name {
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 13px;
  min-width: 140px;
}

.category-slots {
  font-weight: 900;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  min-width: 60px;
  text-align: left;
}

.category-action {
  display: flex;
  justify-content: flex-end;
  min-height: 32px;
  align-items: center;
}

@media (max-width: 900px) {
  .modal {
    width: 96vw;
  }

  .modal-columns {
    grid-template-columns: 1fr;
  }
}

.requirement-label {
  font-size: 13px;
  color: var(--text-secondary);
  opacity: 0.6;
  padding: 6px 10px;
  font-style: italic;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.btn {
  padding: 10px 14px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-radius: 4px;
  border: 1px solid var(--panel-border);
  cursor: pointer;
  background: rgba(255, 255, 255, 0.03);
  color: inherit;
  font-size: 12px;
}

.btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

.btn.primary {
  background: rgba(79, 209, 197, 0.14);
  color: var(--accent);
}

.btn.primary:hover {
  background: rgba(79, 209, 197, 0.22);
}

.btn.upgrade {
  background: rgba(34, 197, 94, 0.18);
  color: #86efac;
  border-color: rgba(34, 197, 94, 0.35);
  padding: 6px 10px;
  white-space: nowrap;
  letter-spacing: 0.04em;
  font-size: 11px;
}

.btn.upgrade:hover {
  background: rgba(34, 197, 94, 0.28);
}

.cost-highlight {
  font-weight: 900;
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.15);
  padding: 2px 6px;
  border-radius: 3px;
}

.cost-dim {
  font-weight: 700;
  opacity: 0.8;
}
</style>
