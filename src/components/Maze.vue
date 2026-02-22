<template>
  <div class="maze-tab">
    <template v-if="!entranceOwned">
      <div class="maze-placeholder">
        <p>This is the Maze of Time.</p>
        <p>You will have to navigate it to return home.</p>
        <p>Yet there seems to be no entrance.</p>
      </div>
    </template>
    <template v-else>
      <MazePane
        :highlight-resource-key="hoveredPillResourceKey"
        :class="{ 'maze-pane-blur': isPaneBlurred }"
        @resource-hover="onResourceHover"
        @resource-hover-batch="onResourceHoverBatch"
        @hover-path-cost="onHoverPathCost"
        @entrance-hover="onEntranceHover"
      />
      <MazeOverlay
        :remaining-pool="remainingPool"
        :attempt-resources="attemptResources"
        :high-resources="highResources"
        :hover-resource-hints="displayedResourceHints"
        :hover-path-cost="hoverPathCost"
        :is-hovering-entrance="isHoveringEntrance"
        :high-movement-used="highMovementUsed"
        :nexus-menu-visible="uiState.mazeNexusMenuOpen"
        :reset-reason="mazeResetReason"
        @resource-pill-hover="onResourcePillHover"
        @reset-high-movement="onResetHighMovement"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue';
import MazePane from './MazePane.vue';
import MazeOverlay from './MazeOverlay.vue';
import { uiState, getGameState } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdMazeResetHighMovement } from '../logic/input/InputCommands';
import { getOwnedMazeEntrances, isMazeNexusCell } from '../logic/Maze';
import type { MazeResourceHoverHint, MazeResourceKey, MazeResourceTotals } from '../logic/pane/MazeOverlayState';

const entranceOwned = computed(() => {
  // Re-evaluate when research changes
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.researchOwnedCount;
  const gs = getGameState();
  return getOwnedMazeEntrances(gs).length > 0;
});

const hoverResourceHint = ref<MazeResourceHoverHint | null>(null);
const hoverResourceHints = ref<MazeResourceHoverHint[]>([]);
const hoveredPillResourceKey = ref<MazeResourceKey | null>(null);
const hoverPathCost = ref(0);
const isHoveringEntrance = ref(false);

function onResourceHover(hint: MazeResourceHoverHint | null): void {
  hoverResourceHint.value = hint;
}

function onResourceHoverBatch(hints: MazeResourceHoverHint[]): void {
  hoverResourceHints.value = hints;
}

function onResourcePillHover(resourceKey: MazeResourceKey | null): void {
  hoveredPillResourceKey.value = resourceKey;
}

function onHoverPathCost(cost: number): void {
  hoverPathCost.value = cost;
}

function onEntranceHover(hovering: boolean): void {
  isHoveringEntrance.value = hovering;
}

function onResetHighMovement(): void {
  globalInputQueue.push(new CmdMazeResetHighMovement());
}

watch(
  () => uiState.mazeVersion,
  () => {
    hoverPathCost.value = 0;
    isHoveringEntrance.value = false;
    hoveredPillResourceKey.value = null;
    hoverResourceHints.value = [];
    const gs = getGameState();
    uiState.mazeNexusMenuOpen = isMazeNexusCell(gs, gs.maze.avatarCell);
  }
);

watch(
  () => uiState.mazeMovementUsed,
  (used) => {
    if (used > 0) uiState.mazeResetReason = '';
  }
);

const isPaneBlurred = ref(false);
let blurTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => uiState.mazeResetReason,
  (reason) => {
    if (blurTimer) { clearTimeout(blurTimer); blurTimer = null; }
    if (reason) {
      isPaneBlurred.value = true;
      blurTimer = setTimeout(() => { isPaneBlurred.value = false; }, 900);
    }
  }
);

onUnmounted(() => { if (blurTimer) clearTimeout(blurTimer); });

const displayedResourceHints = computed<MazeResourceHoverHint[]>(() => {
  if (hoveredPillResourceKey.value) return hoverResourceHints.value;
  if (!hoverResourceHint.value) return [];
  return [hoverResourceHint.value];
});

const attemptResources = computed<MazeResourceTotals>(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.mazeMovementUsed;
  const m = getGameState().maze;
  return {
    credits: m.collectedCredits,
    chronotraces: m.collectedChronotraces,
    shardDust: m.collectedShardDust,
  };
});

const highResources = computed<MazeResourceTotals>(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.mazeMovementUsed;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.mazeVersion;
  const gs = getGameState();
  return {
    credits: gs.mazeHighCredits,
    chronotraces: gs.mazeHighChronotraces,
    shardDust: gs.mazeHighShardDust,
  };
});

const highMovementUsed = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.mazeVersion;
  return getGameState().mazeHighMovementUsed;
});

const mazeResetReason = computed(() => uiState.mazeResetReason as '' | 'warped' | 'banked');

const remainingPool = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.timeFlux;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.mazeMovementUsed;
  const gs = getGameState();
  return Math.max(0, gs.timeFlux - gs.maze.movementUsed);
});
</script>

<style scoped>
.maze-tab {
  position: relative;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at 50% 0%, rgba(15, 23, 42, 0.9), #020617);
  overflow: hidden;
}

:deep(.maze-pane-root) {
  transition: filter 0.6s ease;
}

:deep(.maze-pane-root.maze-pane-blur) {
  filter: blur(4px);
}

.maze-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary, #94a3b8);
  font-size: 15px;
  line-height: 1.8;
  text-align: center;
  opacity: 0.7;
}
</style>
