<template>
  <div v-if="visible" class="maze-nexus-menu">
    <div class="nexus-panel">
      <div class="nexus-title">Maze Nexus</div>
      <div class="nexus-subtitle">Drag onto the maze</div>
      <div class="nexus-items">
        <div
          v-for="[id, item] in items"
          :key="id"
          class="nexus-item"
          :class="{ 'cannot-afford': !canAfford(item.price), 'impassable': !isPassable(item) }"
          @pointerdown="onItemPointerDown(item, $event)"
        >
          <div v-if="previewCanvases[id]" class="nexus-item-preview" :ref="(el) => mountCanvas(el as HTMLElement | null, id)"></div>
          <div class="nexus-item-text">
            <span class="nexus-item-name">{{ item.name }}</span>
            <div class="nexus-item-desc">{{ item.description }}</div>
            <div v-if="!isPassable(item)" class="nexus-item-impassable">Impassable</div>
          </div>
          <div class="nexus-item-price-area">
            <span class="nexus-item-price">{{ item.price }}<span class="nexus-item-price-glyph">∿</span></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { parseNexusItemDefinitions, type NexusItemDefinition } from '../logic/NexusLib';
import rawNexusItems from '../data/nexus';
import { startMazeManualDrag } from '../logic/MazeNexusDnd';
import { createNexusPreviewCanvas } from '../logic/drawNexusPreview';
import { uiState } from '../logic/UIState';

defineProps<{
  visible: boolean;
}>();

const items = parseNexusItemDefinitions(rawNexusItems);

const PREVIEW_SIZE = 48;

const previewCanvases: Record<string, HTMLCanvasElement> = {};
for (const [id, def] of items) {
  const cells = def.placableInstanceDescription?.cells;
  if (!cells || cells.length === 0) continue;
  const canvas = createNexusPreviewCanvas(cells, PREVIEW_SIZE, def.placableInstanceDescription?.image ?? '', def.glyph);
  if (canvas) previewCanvases[id] = canvas;
}

function mountCanvas(el: HTMLElement | null, id: string): void {
  if (!el) return;
  const canvas = previewCanvases[id];
  if (!canvas) return;
  if (el.firstChild !== canvas) {
    el.textContent = '';
    el.appendChild(canvas);
  }
}

function canAfford(price: number): boolean {
  return uiState.credits >= price;
}

function isPassable(item: NexusItemDefinition): boolean {
  return item.placableInstanceDescription?.passable !== false;
}

function onItemPointerDown(item: NexusItemDefinition, event: PointerEvent): void {
  if (event.button !== 0) return;
  event.preventDefault();
  startMazeManualDrag(item, event);
}
</script>

<style scoped>
.maze-nexus-menu {
  position: absolute;
  right: 12px;
  top: 12px;
  z-index: 14;
  pointer-events: auto;
}

.nexus-panel {
  border: 1px solid rgba(148, 163, 184, 0.7);
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.9);
  color: rgba(226, 232, 240, 0.95);
  padding: 8px 14px;
  min-width: 300px;
}

.nexus-title {
  font-size: 14px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(226, 232, 240, 0.95);
  margin-bottom: 2px;
}

.nexus-subtitle {
  font-size: 14px;
  color: rgba(226, 232, 240, 0.85);
  margin-bottom: 8px;
}

.nexus-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nexus-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  cursor: grab;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.03);
  transition: background 0.15s, transform 0.12s ease;
}

.nexus-item:hover {
  background: rgba(255, 255, 255, 0.07);
}

.nexus-item:active {
  cursor: grabbing;
  transform: scale(0.92);
  transition: none;
}

.nexus-item.cannot-afford:hover .nexus-item-price {
  animation: flash-red 0.4s ease;
}

@keyframes flash-red {
  0% { color: #48bb78; }
  40% { color: #f56565; }
  100% { color: #48bb78; }
}

.nexus-item-preview {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
}

.nexus-item-text {
  flex: 1;
  min-width: 0;
}

.nexus-item-name {
  font-size: 15px;
  font-weight: 500;
  display: block;
}

.nexus-item-desc {
  font-size: 13px;
  color: rgba(148, 163, 184, 0.8);
  margin-top: 2px;
}

.nexus-item-price-area {
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
  padding: 4px 10px;
  align-self: stretch;
  display: flex;
  align-items: center;
}

.nexus-item-price {
  font-size: 18px;
  font-weight: 600;
  color: #48bb78;
}

.nexus-item-price-glyph {
  margin-right: 2px;
}

.nexus-item-impassable {
  font-size: 11px;
  color: rgba(168, 162, 150, 0.8);
  margin-top: 2px;
  letter-spacing: 0.03em;
}

.nexus-item.impassable .nexus-item-preview {
  filter: sepia(0.4) saturate(0.5) brightness(0.85);
}
</style>
