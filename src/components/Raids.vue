<template>
  <div class="raids-view">
    <RaidSelection />
    <div class="raid-main-bg">
      <RaidSetup v-if="hasSelection" />
      <RaidGear />
    </div>
    <RaidDeploy />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { uiState, getGameState } from '../logic/UIState';
import RaidSelection from './RaidSelection.vue';
import RaidSetup from './RaidSetup.vue';
import RaidGear from './RaidGear.vue';
import RaidDeploy from './RaidDeploy.vue';
import { globalInputQueue } from '../logic/Model';
import { CmdSelectRaid } from '../logic/input/InputCommands';

const hasSelection = computed(() => !!(uiState.activeRaidId || uiState.raidOrder[0]));

function isLockedById(id: string): boolean {
  const def = uiState.raids.find(r => r.id === id);
  if (!def) return true;
  const gs = getGameState();
  const reach = gs?.reach || 0;
  return reach < Math.max(0, (def as any).reachRequired || 0);
}

function firstUnlockedRaidId(): string | null {
  for (const id of uiState.raidOrder) {
    if (!isLockedById(id)) return id;
  }
  return null;
}

function onSelectRaid(id: string) {
  if (!id) return;
  if (isLockedById(id)) return;
  globalInputQueue.push(new CmdSelectRaid({ id }));
}

// Ensure a default selection exists once raids are loaded
onMounted(() => {
  if (!uiState.activeRaidId) {
    const id = firstUnlockedRaidId();
    if (id) onSelectRaid(id);
  }
});
watch(() => uiState.raidOrder.join('|'), () => {
  if (!uiState.activeRaidId) {
    const id = firstUnlockedRaidId();
    if (id) onSelectRaid(id);
  }
});
</script>

<style scoped>
.raids-view { display: flex; flex-direction: column; gap: 14px; }
.raids-view :deep(.panel) { background: transparent !important; box-shadow: none !important; border: none !important; }
/* Unified background for raid details, quests, and gear */
.raid-main-bg { background: var(--panel-bg); border-radius: 6px; padding: 0px; display: flex; flex-direction: column; gap: 14px; }
</style>
