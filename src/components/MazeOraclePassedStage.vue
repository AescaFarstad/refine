<template>
  <div class="oracle-header">ORACLES OPENED: {{ oraclesOpened }} / {{ oraclesTotal }}</div>
  <div class="oracle-escape-hint">
    <div class="oracle-escape-hint-text">Open all oracles to escape the time loop.</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getGameState, uiState } from '../logic/UIState';

const oraclesTotal = computed(() => {
  uiState.mazeVersion;
  return Object.keys(getGameState().mazeOracleStateByNodeId).length;
});

const oraclesOpened = computed(() => {
  uiState.mazeVersion;
  return Object.values(getGameState().mazeOracleStateByNodeId).filter(state => state === 'riddlePassed').length;
});
</script>
