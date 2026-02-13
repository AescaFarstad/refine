<template>
  <div class="research-tab" ref="researchTab">
    <ResearchParallax :offset="parallaxOffset" :zoom="parallaxZoom" />
    <ResearchPane ref="researchPane" :panel-highlight="hoveredHighlight" @hover-cell="onHoverCell" />
    <ResearchHighlight @entry-hover="onHighlightEntryHover" />
    <EditResearchPane v-if="editResearchOpen" />
    <div
      v-if="hoverPreview && hoverPreview.reachable && !hoverPreview.alreadyOwned"
      class="hover-top-panel hover-panel"
    >
      <div>
        Research {{ hoverPreview.pathLength }} nodes
      </div>
      <div>
        Clear {{ hoverPreview.pathCost }} ⬤ in the path for
        <span class="resource-price" :style="{ color: chronoColor }">
          {{ hoverPreview.price }} {{ chronotracesSpec.glyph }}
        </span>
        <span v-if="hoverPreview.missingCost > 0" :style="{ color: '#ef4444', marginLeft: '6px' }">
          (missing {{ hoverPreview.missingCost }} {{ chronotracesSpec.glyph }})
        </span>
      </div>
    </div>
    <div
      v-if="showHintPanel && hoveredNode && hintStyle"
      ref="hintRef"
      class="hover-hint hover-panel"
      :class="hintBelow ? 'hover-hint-below' : 'hover-hint-above'"
      :style="hintStyle"
    >
      <ResearchNodeHint :cell="hoveredNode.cell" :node="hoveredNode.node" :archetype="hoveredNode.archetype" />
    </div>

    <!-- Left panel: Obstacle info -->
    <div class="left-info-panel info-panel">
      <div>Obstacles cleared: {{ uiState.researchOwnedCount }}</div>
      <div>
        Cost grows by <span class="resource-price" :style="{ color: chronoColor }">
          {{ RESEARCH_OBSTACLE_PRICE_GROWTH }}{{ chronotracesSpec.glyph }}
        </span> per obstacle
      </div>
      <div>
        Next:
        <span class="resource-price" :style="{ color: chronoColor }">
          {{ nextClearCost }}{{ chronotracesSpec.glyph }}
        </span>
      </div>
    </div>

    <!-- Right panel: Controls -->
    <div class="right-info-panel info-panel">
      <div>Drag the pane with left mouse button</div>
      <div>Zoom with mouse wheel</div>
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
            {{ hoverPreview.price }} {{ chronotracesSpec.name }}
          </span>
          <span v-if="hoverPreview.pathCost > 0">
            ({{ hoverPreview.pathCost }} obstacle<span v-if="hoverPreview.pathCost !== 1">s</span>)
          </span>
          <span v-if="!hoverPreview.canAfford"> — cannot afford</span>
        </span>
      </span>
    </div>
    <div v-if="learnedSignatures.length > 0 && !uiState.hasDiscoveredSignatures" class="signature-deck">
      <CardDeck
        :items="learnedSignatures"
        :card-width="signatureCardWidth"
        :card-height="signatureCardHeight"
        :overlap="20"
        :squeeze="0.6"
        :lift="12"
      >
        <template #default="{ item, width, height }">
          <SignatureCard :sig-id="item.id" :width="width" :height="height" />
        </template>
      </CardDeck>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Point2 } from '../logic/ItemLib';
import ResearchPane from './ResearchPane.vue';
import ResearchParallax from './ResearchParallax.vue';
import { uiState, getGameState, getGameLib } from '../logic/UIState';
import { axialToIndex, calculateResearchNodePrice, findCheapestPath } from '../logic/Research';
import EditResearchPane from './EditResearchPane.vue';
import ResearchNodeHint from './researchHints/ResearchNodeHint.vue';
import type { ResearchCell } from '../logic/GameState';
import type { ResearchArchetype, ResearchNodeInstance } from '../logic/ResearchLib';
import { axialToPixel } from '../logic/HexMath';
import { RESEARCH_OBSTACLE_PRICE, RESEARCH_OBSTACLE_PRICE_GROWTH } from '../logic/Const';
import { getResourceSpec } from '../logic/Resources';
import CardDeck from './CardDeck.vue';
import SignatureCard from './SignatureCard.vue';
import { useResearchNodeHintPlacement } from '../logic/useResearchNodeHintPlacement';
import ResearchHighlight from './ResearchHighlight.vue';
import type { ResearchHighlightHover } from '../logic/ResearchHighlightHover';

const hoverCell = ref<Point2 | null>(null);
const researchPane = ref<InstanceType<typeof ResearchPane> | null>(null);
const researchTab = ref<HTMLElement | null>(null);
const hoveredHighlight = ref<ResearchHighlightHover | null>(null);

const editResearchOpen = computed(() => uiState.editResearchOpen);

const parallaxOffset = computed<Point2>(() => {
  const pane = researchPane.value;
  if (!pane) return { x: 0, y: 0 };
  // offset is a Ref exposed from ResearchPane
  const off = pane.offset;
  if (!off) return { x: 0, y: 0 };
  return { x: off.x, y: off.y };
});

const parallaxZoom = computed(() => {
  const pane = researchPane.value;
  if (!pane) return 1;
  // zoom is a Ref exposed from ResearchPane
  return pane.zoom ?? 1;
});

function onHoverCell(cell: Point2 | null): void {
  hoverCell.value = cell;
}

function onHighlightEntryHover(hover: ResearchHighlightHover | null): void {
  hoveredHighlight.value = hover;
}

const chronotracesSpec = getResourceSpec('chronotraces');
const chronoColor = chronotracesSpec.color;

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
      missingCost: 0,
    };
  }

  const pathCost = path.cost;
  const pathLength = path.pathLength;
  const price = calculateResearchNodePrice(gs, pathCost);
  const canAfford = gs.chronotraces >= price;
  const missingCost = Math.max(0, price - gs.chronotraces);

  return {
    reachable: true,
    alreadyOwned: !!rc.owned,
    pathCost,
    pathLength,
    price,
    canAfford,
    missingCost,
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
  for (const reward of hn.archetype?.rewards ?? []) {
    if (reward.kind === 'refining_yield_pct_bonus') return true;
    if (reward.kind === 'refining_success_chance_bonus') return true;
    if (reward.kind === 'refining_speed_pct_bonus') return true;
  }
  return hn.archetype?.type === 'gear' || hn.archetype?.type === 'resource' || hn.archetype?.type === 'stat' || hn.archetype?.type === 'discovery';
});

const showHoverPreviewPanel = computed(() => {
  const hp = hoverPreview.value;
  if (!hp) return false;
  return hp.reachable && !hp.alreadyOwned;
});

const signatureCardWidth = 120;
const signatureCardHeight = 140;

const learnedSignatures = computed(() => uiState.learnedSignatureIds.map((id) => ({ id })));

const hoverNodePosition = computed<Point2 | null>(() => {
  const cell = hoverCell.value;
  if (!cell || !researchPane.value) return null;

  const paneZoom = researchPane.value.zoom;
  const paneOffset = researchPane.value.offset;
  const paneOrigin = researchPane.value.origin;
  const paneHexSize = researchPane.value.HEX_SIZE;

  if (!paneZoom || !paneOffset || !paneOrigin || !paneHexSize) return null;

  const worldPos = axialToPixel(cell, paneHexSize, paneOrigin);

  const screenX = worldPos.x * paneZoom + paneOffset.x;
  const screenY = worldPos.y * paneZoom + paneOffset.y;

  return {
    x: screenX,
    y: screenY,
  };
});

const { hintRef, hintBelow, hintStyle } = useResearchNodeHintPlacement({
  anchor: hoverNodePosition,
  container: researchTab,
  visible: showHintPanel,
});

const nextClearCost = computed(() => {
  // Touch reactive deps so cost updates when ownership changes
  const _ownedCount = uiState.researchOwnedCount;

  const gs = getGameState();
  const ownedCount = gs.researchOwnedCount;
  return RESEARCH_OBSTACLE_PRICE + ownedCount * RESEARCH_OBSTACLE_PRICE_GROWTH;
});
</script>

<style scoped>
.research-tab {
  position: relative;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at 50% 0%, rgba(15, 23, 42, 0.9), #020617);
  overflow: hidden;
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
  pointer-events: none;
  user-select: none;
  z-index: 25;
}

.hover-hint-above {
  transform: translate(-50%, -100%);
}

.hover-hint-below {
  transform: translate(-50%, 0%);
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

.info-panel {
  position: absolute;
  top: 12px;
  padding: 6px 12px;
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.7);
  color: rgba(226, 232, 240, 0.95);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.02em;
  pointer-events: none;
  user-select: none;
  z-index: 25;
}

.left-info-panel {
  left: 12px;
  text-align: left;
}

.right-info-panel {
  right: 12px;
  text-align: right;
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

.signature-deck {
  position: absolute;
  left: 12px;
  bottom: 12px;
  width: min(420px, 45vw);
  max-width: 420px;
  pointer-events: auto;
  z-index: 30;
}
</style>
