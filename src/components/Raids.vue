<template>
  <div class="raids-view">

    <div class="raid-main-bg">
      <RaidSetup />

      <RaidGear v-if="hasSelection" />
    </div>
    <RaidDeploy v-if="hasSelection" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { uiState } from '../logic/UIState';
import RaidSetup from './RaidSetup.vue';
import RaidGear from './RaidGear.vue';
import RaidDeploy from './RaidDeploy.vue';
import { globalInputQueue } from '../logic/Model';
import { CmdSelectRaid } from '../logic/input/InputCommands';
import { IS_DEBUG } from '../logic/Const';

const hasSelection = computed(() => !!uiState.activeRaidId);

function isLockedById(id: string): boolean {
  return !uiState.unlockedRaidIds.includes(id);
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


onMounted(() => {
  if (IS_DEBUG && !uiState.activeRaidId) {
    const id = firstUnlockedRaidId();
    if (id) onSelectRaid(id);
  }
});

watch(() => uiState.raidOrder.join('|'), () => {
  if (IS_DEBUG && !uiState.activeRaidId) {
    const id = firstUnlockedRaidId();
    if (id) onSelectRaid(id);
  }
});
</script>

<style scoped>
.raids-view { display: flex; flex-direction: column; gap: 14px; padding: 12px; }
.raids-view :deep(.panel) { background: transparent !important; box-shadow: none !important; border: none !important; }
/* Unified background for raid details, quests, and gear */
.raid-main-bg { background: var(--panel-bg); border-radius: 6px; padding: 0px; display: flex; flex-direction: column; gap: 14px; }
</style>
