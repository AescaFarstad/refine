<template>
  <div class="oracle-header">ORACLE</div>
  <div class="oracle-stage0-panel">
    <AchiItem :achi="stage0Achi" :achi-version="uiState.achiVersion" expected-state="tracked" />
    <div class="oracle-stage0-hint">
      Gather more information about the maze to learn how to approach the oracles.
    </div>
  </div>
</template>

<script setup lang="ts">
import AchiItem from './AchiItem.vue';
import { getGameState, uiState } from '../logic/UIState';

const stage0Achi = getGameState().lib.achi.items.get('maze_chrono_t0')!;
</script>
