<template>
  <div class="item-grid" :class="{ minor, clickable }">
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
        :show-molecule="showMolecule"
        :no-tooltip="noTooltip"
      />
      <div
        v-if="showRarityLabels && rarityLabels && rarityLabels[it.id]"
        class="rarity-label"
        :class="`rarity-${rarityLabels[it.id].toLowerCase()}`"
      >
        {{ rarityLabels[it.id] }}
      </div>
    </div>
  </div>


</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import ItemDisplay from './ItemDisplay.vue';
import itemsData from '../data/items';
import atlasStorage from '../logic/AtlasStorage';
import { startManualDrag, ManualDragEvents } from '../logic/ManualDrag';
import type { Molecule } from '../logic/ItemLib';

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
}>();

const emit = defineEmits<{
  (e: 'item-click', id: string): void;
  (e: 'item-drag-start', id: string): void;
  (e: 'item-drag-end', id: string): void;
  (e: 'item-hover', id: string): void;
}>();

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
  try { event.preventDefault(); } catch (_e) {}

  const itemDef = (itemsData as any)[id];
  const molecule = itemDef?.molecule as Molecule | undefined;
  if (!molecule) return;

  // Kick off manual drag follower
  startManualDrag({ id, molecule }, event);
  emit('item-drag-start', id);
}

function onManualDragEnd(_e: Event) {
  // Bubble up to parent so it can clear dragging state
  emit('item-drag-end', '');
}

onMounted(async () => {
  await atlasStorage.loadItemsAtlas();
  window.addEventListener(ManualDragEvents.End, onManualDragEnd as any);
});

onUnmounted(() => {
  window.removeEventListener(ManualDragEvents.End, onManualDragEnd as any);
});
</script>

<style scoped>
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
.rarity-label { position: absolute; bottom: 2px; left: 2px; font-size: 9px; font-weight: 700; text-shadow: 0 0 3px rgba(0, 0, 0, 0.9), 0 1px 2px rgba(0, 0, 0, 0.8); pointer-events: none; z-index: 10; letter-spacing: 0.03em; text-transform: uppercase; line-height: 1; }
.rarity-label.rarity-common { color: #9ca3af; }
.rarity-label.rarity-uncommon { color: white; }
.rarity-label.rarity-rare { color: #60a5fa; }
.rarity-label.rarity-legendary { color: #fbbf24; font-weight: 900; }
/* Prevent native drag and selection inside the grid */
.item-grid, .item-grid * { user-select: none; -webkit-user-drag: none; }
</style>
