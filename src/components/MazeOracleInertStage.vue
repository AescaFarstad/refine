<template>
  <div class="oracle-header">ORACLE</div>
  <div class="oracle-inert">
    <div class="oracle-inert-text">
      Power-up the oracle with some philosopher's stones and it will present its riddle.
    </div>
    <button type="button" class="oracle-activate-btn" :disabled="!canActivateOracle" @click="onActivateOracle">
      <span class="oracle-activate-icon" :style="philosophersStoneStyle" />
      <span>Insert philosopher's stone</span>
      <span class="oracle-activate-cost">{{ philosophersStoneCount }} / {{ oracleActivationCost }}</span>
    </button>
    <div class="oracle-stone-count">You have {{ philosophersStoneCount }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import atlasStorage from '../logic/AtlasStorage';
import { atlasSpriteStyle } from '../logic/AtlasSpriteStyle';
import { getOracleActivationCost } from '../logic/Oracle';
import { globalInputQueue } from '../logic/Model';
import { CmdMazeActivateOracle } from '../logic/input/InputCommands';
import { getGameState, uiState } from '../logic/UIState';

const philosophersStoneCount = computed(() => {
  uiState.countableGear;
  return uiState.countableGear.philosophers_stone ?? 0;
});

const oracleActivationCost = computed(() => {
  uiState.mazeVersion;
  return getOracleActivationCost(getGameState());
});

const canActivateOracle = computed(() => philosophersStoneCount.value >= oracleActivationCost.value);

const philosophersStoneStyle = computed<Record<string, string>>(() => {
  const frame = atlasStorage.getItemsFrame('fracture_4')!;
  return atlasSpriteStyle(atlasStorage.getItemsSource(), frame, { size: 20, mode: 'fit', allowUpscale: false });
});

function onActivateOracle() {
  if (!canActivateOracle.value) return;
  globalInputQueue.push(new CmdMazeActivateOracle({ nodeId: uiState.mazeVisitedOracleNodeId }));
}
</script>
