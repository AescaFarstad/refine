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
      <MazePane />
      <div class="maze-info">
        <span class="maze-info-flux">∿ {{ remainingPool }} / {{ totalPool }}</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MazePane from './MazePane.vue';
import { uiState, getGameState } from '../logic/UIState';
import { axialToIndex } from '../logic/Research';
import { MAZE_ENTRANCE } from '../logic/Maze';

const entranceOwned = computed(() => {
  // Re-evaluate when research changes
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.researchOwnedCount;
  const gs = getGameState();
  const idx = axialToIndex(MAZE_ENTRANCE.x, MAZE_ENTRANCE.y);
  if (idx === -1) return false;
  return gs.researchCells[idx]?.owned === true;
});

const totalPool = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.timeFlux;
  return getGameState().timeFlux;
});

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

.maze-info {
  position: absolute;
  left: 12px;
  top: 12px;
  padding: 4px 10px;
  border: 1px solid var(--panel-border);
  border-radius: 4px;
  background: var(--panel-bg);
  color: var(--text-primary);
  font-size: 13px;
  z-index: 10;
  pointer-events: none;
}

.maze-info-flux {
  color: #48bb78;
}
</style>
