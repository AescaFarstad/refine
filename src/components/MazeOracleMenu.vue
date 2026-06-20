<template>
  <div v-if="visible" class="maze-oracle-menu" @click.stop>
    <div class="oracle-panel">
      <MazeOracleStage0 v-if="showStage0Challenge" />
      <MazeOracleInertStage v-else-if="oracleState === 'inert'" />
      <MazeOracleRiddlingStage v-else-if="oracleState === 'riddling'" />
      <MazeOraclePassedStage v-else-if="oracleState === 'riddlePassed'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import MazeOracleStage0 from './MazeOracleStage0.vue';
import MazeOracleInertStage from './MazeOracleInertStage.vue';
import MazeOracleRiddlingStage from './MazeOracleRiddlingStage.vue';
import MazeOraclePassedStage from './MazeOraclePassedStage.vue';
import { DISCOVERY } from '../logic/DiscoveryLib';
import { getMazeOracleState } from '../logic/Maze';
import { globalInputQueue } from '../logic/Model';
import { CmdTriggerOracleStage0 } from '../logic/input/InputCommands';
import { getGameState, uiState } from '../logic/UIState';

const props = defineProps<{
  visible: boolean;
}>();

const showStage0Challenge = computed(() => {
  uiState.discoveryCounter;
  const discoveries = getGameState().discoveries;
  return discoveries[DISCOVERY.ORACLE_STAGE_0] === true
    && discoveries[DISCOVERY.ORACLE_STAGE_1] !== true;
});

const oracleState = computed(() => {
  uiState.mazeVersion;
  if (uiState.mazeVisitedOracleNodeId < 0) return null;
  return getMazeOracleState(getGameState(), uiState.mazeVisitedOracleNodeId);
});

watch(
  () => [props.visible, uiState.mazeVisitedOracleNodeId] as const,
  triggerOracleStage0,
  { flush: 'sync', immediate: true },
);

function triggerOracleStage0() {
  if (!props.visible || uiState.mazeVisitedOracleNodeId < 0) return;
  if (getGameState().discoveries[DISCOVERY.ORACLE_STAGE_0] === true) return;
  globalInputQueue.push(new CmdTriggerOracleStage0());
}
</script>

<style src="./MazeOracleMenu.css"></style>
