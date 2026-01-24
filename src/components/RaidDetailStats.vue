<template>
  <div class="stat-line">
    <div class="stat"><span class="label">Health</span> <span class="value">{{ hp }} ❤︎</span></div>
    <div class="stat"><span class="label">Damage</span> <span class="value">{{ damage }} ✴</span></div>
    <div class="stat"><span class="label">Bags</span> <span class="value">{{ bagsCapacity }} ⌞ ⌝</span></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { uiState, getGameState } from '../logic/UIState';

const hp = computed(() => {
  uiState.raidKey;
  const gs = getGameState();
  return gs.raid.hp | 0;
});

const damage = computed(() => {
  uiState.raidKey;
  const gs = getGameState();
  return gs.raid.damage;
});

const bagsCapacity = computed(() => {
  uiState.raidKey;
  uiState.volume;
  const gs = getGameState();
  return Math.max(0, gs.raid.bagsVolume);
});
</script>

<style scoped>
.stat-line { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 12px; }
.stat { background: var(--raid-item-bg, rgba(255,255,255,0.08)); border-radius: 6px; padding: 6px 10px; display: flex; align-items: center; justify-content: center; gap: 8px; text-align: center; }
.stat .label { color: var(--text-secondary); font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; margin-right: 0; }
.stat .value { font-weight: 800;  font-size: 18px; }
</style>
