<template>
  <div class="refine-root">
    <div class="main-split">
      <div class="items-bg">
        <AllItems :items="availableItems" @pick-item="onPickItem" @drag-end="onDragEnd" />
      </div>
      <div class="center">
        <Wafer 
          :dragging-item="draggingItem" 
          @refine-start="onRefineStart" 
          @clear-dragging="clearDragging" 
          @pickup-item="onPickupItem"
        />
      </div>
    </div>
    <RefineryOutcomeModal />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { uiState } from '../logic/UIState';
import Wafer from './Wafer.vue';
import AllItems from './AllItems.vue';
import RefineryOutcomeModal from './RefineryOutcomeModal.vue';
import { getGameLib } from '../logic/UIState';
import itemsData from '../data/items';
import type { Molecule } from '../logic/ItemLib';
import { CmdStartRefining } from '../logic/input/InputCommands';
import { globalInputQueue } from '../logic/Model';

const draggingItem = ref<{ id: string; molecule: Molecule } | null>(null);

const availableItems = computed(() => {
  return uiState.items.map(it => ({
    id: it.id,
    quantity: it.quantity,
  }));
});

function onPickItem(id: string) {
  const itemDef = (itemsData as any)[id];
  if (!itemDef || !itemDef.molecule) {
    return;
  }

  draggingItem.value = {
    id,
    molecule: itemDef.molecule,
  };
}

function clearDragging() {
  draggingItem.value = null;
}

function onDragEnd() {
  clearDragging();
}

function onRefineStart() {
  globalInputQueue.push(new CmdStartRefining());
}

function onPickupItem(item: { id: string; molecule: Molecule }) {
  draggingItem.value = item;
}
</script>

<style scoped>
.refine-root { display: flex; flex-direction: column; gap: 14px; }
.refine-root :deep(.panel) { background: transparent !important; box-shadow: none !important; border: none !important; }

.main-split {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

/* Unified background for items section */
.items-bg { 
  background: var(--panel-bg); 
  border-radius: 6px; 
  padding: 0px; 
  flex: 1 1 auto;
  min-width: 300px; /* Minimum width for 3 columns */
  max-width: 600px; /* Reasonable maximum */
}

.center {
  flex: 0 0 auto;
  display: flex;
  justify-content: center;
}

@media (max-width: 1200px) {
  .main-split { 
    flex-direction: column;
    align-items: center;
  }

  .items-bg {
    max-width: 100%;
    width: 100%;
  }
}
</style>
