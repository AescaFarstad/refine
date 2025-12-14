<template>
  <div class="research-tab">
    <ResearchPane @hover-cell="onHoverCell" />
    <EditResearchPane v-if="editResearchOpen" />
    <div
      v-if="hoverPreview && hoverPreview.price > 0"
      class="path-summary-label"
    >
      <div>
        Research {{ hoverPreview.pathLength }} nodes
      </div>
      <div>
        Clear {{ hoverPreview.pathCost }} ⬤ in the path for
        <span class="resource-price" :style="{ color: chronoColor }">
          {{ hoverPreview.price }} ⧖
        </span>
      </div>
    </div>
    <div v-if="hoverCell" class="coord-label">
      <span>q: {{ hoverCell.x }}, r: {{ hoverCell.y }}</span>
      <span v-if="hoverPreview">
        •
        <span v-if="hoverPreview.alreadyOwned">Owned</span>
        <span v-else-if="!hoverPreview.reachable">Unreachable</span>
        <span v-else>
          Cost:
          <span class="resource-price" :style="{ color: chronoColor }">
            {{ hoverPreview.price }} chrono
          </span>
          <span v-if="hoverPreview.pathCost > 0">
            ({{ hoverPreview.pathCost }} obstacle<span v-if="hoverPreview.pathCost !== 1">s</span>)
          </span>
          <span v-if="!hoverPreview.canAfford"> — cannot afford</span>
        </span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Point2 } from '../logic/ItemLib';
import ResearchPane from './ResearchPane.vue';
import { uiState, getGameState } from '../logic/UIState';
import { axialToIndex, calculateResearchNodePrice, findCheapestPath } from '../logic/Research';
import { getShardDisplay } from '../utils/ShardDisplay';
import EditResearchPane from './EditResearchPane.vue';

const hoverCell = ref<Point2 | null>(null);

const editResearchOpen = computed(() => uiState.editResearchOpen);

function onHoverCell(cell: Point2 | null): void {
  hoverCell.value = cell;
}

const chronoColor = getShardDisplay('chronotraces').color;

const hoverPreview = computed(() => {
  const cell = hoverCell.value;
  if (!cell) return null;

  // Touch reactive deps so cost updates when resources / ownership change
  const _ownedCount = uiState.researchOwnedCount;
  const _chrono = uiState.chronotraces;
  const _radius = uiState.researchRevealRadius;

  const gs = getGameState();
  const idx = axialToIndex(cell.x, cell.y);
  if (idx === -1) return null;

  const rc = gs.researchCells[idx];
  if (!rc || !rc.revealed) return null;

  const path = findCheapestPath(gs, cell.x, cell.y);
  if (!path.reachable) {
    return {
      reachable: false,
      alreadyOwned: !!rc.owned,
      pathCost: 0,
      price: 0,
      pathLength: 0,
      canAfford: true,
    };
  }

  const pathCost = path.cost;
  const pathLength = path.pathLength;
  const price = calculateResearchNodePrice(gs, pathCost);
  const canAfford = gs.chronotraces >= price;

  return {
    reachable: true,
    alreadyOwned: !!rc.owned,
    pathCost,
    pathLength,
    price,
    canAfford,
  };
});
</script>

<style scoped>
.research-tab {
  position: relative;
  width: 100%;
  height: 100%;
}

.path-summary-label {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 10px;
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.7);
  color: rgba(226, 232, 240, 0.95);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-align: center;
  pointer-events: none;
  user-select: none;
  z-index: 25;
}

.resource-price {
  font-weight: 700;
}

.coord-label {
  position: absolute;
  bottom: 8px;
  right: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.85);
  color: var(--text-primary);
  font-size: 11px;
  pointer-events: none;
}
</style>
