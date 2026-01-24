<template>
  <component
    v-if="currentEntry"
    :is="currentComponent"
    :params="currentEntry.params"
    @close="dismissCurrent"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { uiState } from '../../logic/UIState';
import { globalInputQueue } from '../../logic/Model';
import { CmdDismissUIModal } from '../../logic/input/InputCommands';
import type { Reward } from '../../logic/Reward';
import { REWARD_UI_COMPONENTS } from './RewardUIRegistry';

const currentEntry = computed(() => uiState.pendingUIModals[0] ?? null);

const currentComponent = computed(() => {
  if (!currentEntry.value) return null;
  return REWARD_UI_COMPONENTS[currentEntry.value.ui] ?? null;
});

function dismissCurrent(rewards?: Reward[]) {
  if (currentEntry.value) {
    globalInputQueue.push(new CmdDismissUIModal({ ui: currentEntry.value.ui, rewards }));
  }
}
</script>
