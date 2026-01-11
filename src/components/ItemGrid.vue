<template>
  <div class="item-grid-wrap" :class="{ 'molecules-visible': showMolecule }" :style="moleculeAtlasVars">
    <div class="item-grid base-grid" :class="{ minor, clickable }">
      <div
        v-for="it in items"
        :key="it.id"
        class="grid-item"
        :class="{ clickable, dim: !!dimIds && !!dimIds[it.id] }"
        :draggable="false"
        @click="onItemClick(it.id)"
        @pointerdown="onPointerDown(it.id, $event)"
        @mouseenter="onItemHover(it.id)"
        @dragstart.prevent
      >
        <ItemDisplay
          :id="it.id"
          :quantity="it.quantity"
          :minor="minor"
          :no-tooltip="noTooltip"
          :show-score="showScores"
          :show-volume="showVolumes"
        />
      </div>
    </div>
    <div class="item-grid molecule-grid" :class="{ minor }">
      <div v-for="it in items" :key="'mol-' + it.id" class="grid-item">
        <div v-if="hasMolecule(it.id)" class="mol-sprite" :class="{ minor }" :style="moleculeSpriteStyle(it.id)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import ItemDisplay from './ItemDisplay.vue';
import itemsData from '../data/items';
import { startManualDrag, ManualDragEvents } from '../logic/ManualDrag';
import type { ItemDefinition } from '../logic/ItemLib';
import atlasStorage from '../logic/AtlasStorage';

const props = defineProps<{
  items: Array<{ id: string; quantity: number }>;
  minor?: boolean;
  clickable?: boolean;
  draggable?: boolean;
  draggableIds?: Record<string, boolean>;
  dimIds?: Record<string, boolean>;
  showMolecule?: boolean;
  noTooltip?: boolean;
  showRarityLabels?: boolean;
  rarityLabels?: Record<string, string>;
  showScores?: boolean;
  showVolumes?: boolean;
}>();

const emit = defineEmits<{
  (e: 'item-click', id: string): void;
  (e: 'item-drag-start', id: string): void;
  (e: 'item-drag-end', id: string): void;
  (e: 'item-hover', id: string): void;
}>();

const moleculesSource = atlasStorage.getMoleculesSource()!;
const moleculeAtlasVars = {
  '--mol-atlas': `url(${moleculesSource.src})`,
  '--mol-atlas-size': `${moleculesSource.naturalWidth}px ${moleculesSource.naturalHeight}px`,
} as Record<string, string>;

function hasMolecule(id: string): boolean {
  return !!atlasStorage.getMoleculesFrame(`mol:${id}`);
}

function moleculeSpriteStyle(id: string): Record<string, string> {
  const f = atlasStorage.getMoleculesFrame(`mol:${id}`)!;
  return {
    backgroundPosition: `-${f.x}px -${f.y}px`,
  } as Record<string, string>;
}

// Drag image handled centrally via RefineUIBehaviour



function isItemDraggable(id: string): boolean {
  if (!props.draggableIds) return true;
  return !!props.draggableIds[id];
}

function onItemClick(id: string) {
  if (!props.clickable) return;
  emit('item-click', id);
}

function onItemHover(id: string) {
  emit('item-hover', id);
}

function onPointerDown(id: string, event: PointerEvent) {
  if (!props.draggable) return;
  if (event.button !== 0) return; // primary button only
  // Prevent native drag/select behavior
  event.preventDefault();

  const itemDef = (itemsData as Record<string, ItemDefinition>)[id]!;
  const molecule = itemDef.molecule;

  // Kick off manual drag follower
  startManualDrag({ id, molecule }, event);
  emit('item-drag-start', id);
}

function onManualDragEnd(_e: Event) {
  // Bubble up to parent so it can clear dragging state
  emit('item-drag-end', '');
}

onMounted(() => {
  window.addEventListener(ManualDragEvents.End, onManualDragEnd as any);
});

onUnmounted(() => {
  window.removeEventListener(ManualDragEvents.End, onManualDragEnd as any);
});
</script>

<style scoped>
.item-grid-wrap {
  position: relative;
}
.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
}
.item-grid.minor {
  opacity: 0.85;
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  gap: 6px;
}
.grid-item { position: relative; }
.grid-item.clickable { cursor: pointer; }
.grid-item.dim { opacity: 0.38; }
/* Prevent native drag and selection inside the grid */
.item-grid, .item-grid * { user-select: none; -webkit-user-drag: none; }

/* CSS overlay for molecule rendering */
.molecule-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.05s ease;
}
.item-grid-wrap.molecules-visible .molecule-grid {
  opacity: 1;
}

.item-grid-wrap.molecules-visible .base-grid {
  opacity: 0.18;
}

.mol-sprite {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 96px;
  height: 96px;
  transform: translate(-50%, -50%);
  background-image: var(--mol-atlas);
  background-repeat: no-repeat;
  background-size: var(--mol-atlas-size);
}

.mol-sprite.minor {
  transform: translate(-50%, -50%) scale(0.5);
}
</style>
