<template>
  <component
    v-if="currentUI"
    :is="currentComponent"
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

const currentUI = computed(() => uiState.pendingUIModals[0] ?? null);

const currentComponent = computed(() => {
  if (!currentUI.value) return null;
  return REWARD_UI_COMPONENTS[currentUI.value] ?? null;
});

function dismissCurrent(rewards?: Reward[]) {
  if (currentUI.value) {
    globalInputQueue.push(new CmdDismissUIModal({ ui: currentUI.value, rewards }));
  }
}
</script>
