<template>
  <div class="refine-root" :class="{ 'drag-active': draggingItem !== null }" @contextmenu="onContextMenu">
    <div class="main-split">
      <div class="items-bg">
        <AllItems :items="uiState.items" @pick-item="onPickItem" @drag-end="onDragEnd" />
      </div>
      <div class="center">
        <Wafer
          ref="waferRef"
          :dragging-item="draggingItem"
          @refine-start="onRefineStart"
          @clear-dragging="clearDragging"
          @pickup-item="onPickupItem"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { uiState } from '../logic/UIState';
import Wafer from './Wafer.vue';
import AllItems from './AllItems.vue';
import { getGameLib } from '../logic/UIState';
import type { Molecule } from '../logic/ItemLib';
import { CmdStartRefining } from '../logic/input/InputCommands';
import { globalInputQueue } from '../logic/Model';

const draggingItem = ref<{ id: string; molecule: Molecule; rotation: number } | null>(null);
const waferRef = ref<InstanceType<typeof Wafer> | null>(null);

function onPickItem(id: string) {
  const itemDef = getGameLib().getItem(id);

  draggingItem.value = {
    id,
    molecule: itemDef.molecule,
    rotation: 0,
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

function onPickupItem(item: { id: string; rotation: number }) {
  const itemDef = getGameLib().getItem(item.id);
  draggingItem.value = {
    id: item.id,
    molecule: itemDef.molecule,
    rotation: item.rotation,
  };
}

function onContextMenu(e: MouseEvent) {
  if (draggingItem.value) {
    e.preventDefault();
    waferRef.value?.rotate();
  }
}
</script>

<style scoped>
.refine-root { display: flex; flex-direction: column; gap: 14px; padding: 12px; }
.refine-root :deep(.panel) { background: transparent !important; box-shadow: none !important; border: none !important; }

/* Outlines hint at the source and destination without shifting either panel. */
.items-bg,
.refine-root :deep(.wafer-view) {
  outline: 1px solid transparent;
  outline-offset: 2px;
  transition: outline-color 120ms ease;
}

.drag-active .items-bg,
.drag-active :deep(.wafer-view) {
  outline-color: rgba(79, 209, 197, 0.35);
}

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
