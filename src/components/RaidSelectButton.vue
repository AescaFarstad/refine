<template>
  <button class="raid-select-btn" type="button" @click="$emit('open')">
    <span class="label">{{ label }}</span>
    <span class="chevron">▼</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { uiState } from '../logic/UIState';

defineEmits<{ open: [] }>();

const selectedRaid = computed(() => {
  if (!uiState.activeRaidId) return null;
  return uiState.raids.find(r => r.id === uiState.activeRaidId) || null;
});

const label = computed(() => {
  if (selectedRaid.value) return `Selected raid: ${selectedRaid.value.name}`;
  return 'Select raid...';
});
</script>

<style scoped>
.raid-select-btn {
  width: 100%;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--raid-item-bg, rgba(255,255,255,0.08));
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  color: var(--text-primary);
  font-weight: 800;
  font-size: 24px;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: background 0.15s;
}
.raid-select-btn:hover {
  background: rgba(255,255,255,0.12);
}
.label {
  flex: 1;
  text-align: left;
}
.chevron {
  font-size: 10px;
  opacity: 0.6;
}
</style>
