<template>
  <div class="raid-setup">
    <div class="left panel">
      <RaidDetails />
    </div>
    <div class="right panel">
      <RaidSelectButton @open="showModal = true" />
      <RaidQuests v-if="hasSelection" />
      <RaidSelectModal :visible="showModal" @close="showModal = false" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import RaidDetails from './RaidDetails.vue';
import RaidQuests from './RaidQuests.vue';
import RaidSelectButton from './RaidSelectButton.vue';
import RaidSelectModal from './RaidSelectModal.vue';
import { uiState } from '../logic/UIState';

const showModal = ref(false);
const hasSelection = computed(() => !!uiState.activeRaidId);
</script>

<style scoped>
.raid-setup { display: grid; grid-template-columns: 3fr 2fr; gap: 12px; }
.right { display: flex; flex-direction: column; gap: 12px; }
.right .section-title { font-weight: 800; text-transform: uppercase; font-size: 12px; letter-spacing: 0.08em; margin-bottom: 8px; }
</style>
