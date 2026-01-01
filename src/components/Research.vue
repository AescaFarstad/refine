<template>
  <div class="research-tab">
    <ResearchPane @hover-cell="onHoverCell" />
    <EditResearchPane v-if="editResearchOpen" />
    <div
      v-if="showHoverTopPanel"
      class="hover-top-panel"
      :class="{ 'hint-only': showHintPanel && !showHoverPreviewPanel }"
    >
      <div v-if="showHoverPreviewPanel && hoverPreview" class="hover-preview hover-panel">
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
      <div v-if="showHintPanel && hoveredNode" class="hover-hint hover-panel">
        <ResearchNodeHint :cell="hoveredNode.cell" :node="hoveredNode.node" :archetype="hoveredNode.archetype" />
      </div>
    </div>
    <div v-if="hoverCell" class="coord-label">
      <span>q: {{ hoverCell.x }}, r: {{ hoverCell.y }} • dist: {{ hoverDistance }}</span>
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
import { uiState, getGameState, getGameLib } from '../logic/UIState';
import { axialToIndex, calculateResearchNodePrice, findCheapestPath } from '../logic/Research';
import { getShardDisplay } from '../utils/ShardDisplay';
import EditResearchPane from './EditResearchPane.vue';
import ResearchNodeHint from './researchHints/ResearchNodeHint.vue';
import type { ResearchCell } from '../logic/GameState';
import type { ResearchArchetype, ResearchNodeInstance } from '../logic/ResearchLib';

const hoverCell = ref<Point2 | null>(null);

const editResearchOpen = computed(() => uiState.editResearchOpen);

function onHoverCell(cell: Point2 | null): void {
  hoverCell.value = cell;
}

const chronoColor = getShardDisplay('chronotraces').color;

const hoverDistance = computed(() => {
  const cell = hoverCell.value;
  if (!cell) return 0;
  // Distance from origin in axial coordinates
  return Math.max(Math.abs(cell.x), Math.abs(cell.y), Math.abs(cell.x + cell.y));
});

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

const hoveredNode = computed<null | { cell: ResearchCell; node: ResearchNodeInstance | null; archetype: ResearchArchetype | null }>(() => {
  const cell = hoverCell.value;
  if (!cell) return null;

  const gs = getGameState();
  const idx = axialToIndex(cell.x, cell.y);
  if (idx === -1) return null;

  const rc = gs.researchCells[idx];
  if (!rc || !rc.revealed) return null;

  const lib = getGameLib();
  const archetype = lib.research.archetypes.get(rc.archetypeId) ?? null;
  const node = lib.research.nodes.get(rc.nodeId) ?? null;

  return { cell: rc, node, archetype };
});

const showHintPanel = computed(() => {
  const hn = hoveredNode.value;
  if (!hn) return false;
  if (hn.cell.blocked) return false;
  return hn.archetype?.type === 'gear' || hn.archetype?.type === 'resource' || hn.archetype?.type === 'stat';
});

const showHoverPreviewPanel = computed(() => {
  return !!(hoverPreview.value && hoverPreview.value.price > 0);
});

const showHoverTopPanel = computed(() => {
  return !!(showHintPanel.value || showHoverPreviewPanel.value);
});
</script>

<style scoped>
.research-tab {
  position: relative;
  width: 100%;
  height: 100%;
}

.hover-top-panel {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: inline-block;
  pointer-events: none;
  user-select: none;
  z-index: 25;
}

.hover-preview {
  position: relative;
}

.hover-hint {
  position: absolute;
  top: 0;
  left: 100%;
  margin-left: 10px;
}

.hint-only .hover-hint {
  position: relative;
  top: auto;
  left: auto;
  margin-left: 0;
}

.hover-panel {
  padding: 4px 10px;
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.7);
  color: rgba(226, 232, 240, 0.95);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-align: center;
}

.resource-price {
  font-weight: 700;
}

.coord-label {
  position: absolute;
  bottom: 8px;
  right: 8px;
  padding: 5px 10px;
  border-radius: 5px;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(148, 163, 184, 0.5);
  color: var(--text-primary);
  font-size: 13.75px;
  pointer-events: none;
  z-index: 25;
}
</style>
