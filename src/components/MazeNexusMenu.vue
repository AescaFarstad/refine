<template>
  <div v-if="visible" class="maze-nexus-menu">
    <div class="nexus-panel">
      <div v-if="canAccessNexus" class="nexus-header">MAZE NEXUS <span class="nexus-header-sep">-</span> Drag power-ups onto the maze:</div>
      <div v-else class="nexus-header nexus-header-locked">
        <div class="nexus-locked-title">NEXUS</div>
        <button class="btn primary nexus-locked-message-btn" type="button" @click="goToRefineTab">
          Fail items refinement at least once to access the Nexus
        </button>
      </div>
      <div v-if="canAccessNexus" class="nexus-items">
        <div
          v-for="[id, item] in items"
          :key="id"
          class="nexus-item"
          :class="{ 'cannot-afford': !canAfford(id), 'impassable': !isPassable(item) }"
          @pointerdown="onItemPointerDown(item, $event)"
        >
          <div v-if="hasPreview[id]" class="nexus-item-preview" :ref="(el) => mountCanvas(el as HTMLElement | null, id)"></div>
          <div class="nexus-item-text">
            <span class="nexus-item-name">{{ item.name }}</span>
            <div class="nexus-item-desc" v-html="item.description"></div>
            <div v-if="item.effectRadius > 0" class="nexus-item-stat">Effect radius: {{ item.effectRadius }}</div>
            <div v-if="item.limitRadius > 0" class="nexus-item-stat">Minimum separation: {{ item.limitRadius * 2 }}</div>
            <div v-if="!isPassable(item)" class="nexus-item-impassable">Impassable</div>
          </div>
          <div class="nexus-item-price-area">
            <span class="nexus-item-price">{{ getLivePrice(id) }}<span class="nexus-item-price-glyph">∿</span></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { parseNexusItemDefinitions, type NexusItemDefinition } from '../logic/NexusLib';
import rawNexusItems from '../data/nexus';
import { startMazeManualDrag } from '../logic/MazeNexusDnd';
import atlasStorage from '../logic/AtlasStorage';
import { getGameState, uiState } from '../logic/UIState';
import { DISCOVERY } from '../logic/DiscoveryLib';
import { globalInputQueue } from '../logic/Model';
import { CmdSwitchTab } from '../logic/input/InputCommands';

defineProps<{
  visible: boolean;
}>();

const items = parseNexusItemDefinitions(rawNexusItems);

const PREVIEW_SIZE = 56;
const canAccessNexus = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.discoveryCounter;
  return getGameState().discoveries[DISCOVERY.REFINEMENT_FAILED] === true;
});

// Check which items have atlas frames available
const hasPreview: Record<string, boolean> = {};
for (const [id] of items) {
  hasPreview[id] = !!atlasStorage.getNexusFrame(`nexus:${id}`);
}

function mountCanvas(el: HTMLElement | null, id: string): void {
  if (!el) return;
  // Only mount once - check if canvas is already there
  if (el.firstChild) return;
  const frame = atlasStorage.getNexusFrame(`nexus:${id}`);
  if (!frame) return;
  const source = atlasStorage.getNexusSource();
  const canvas = document.createElement('canvas');
  const dpr = Math.max(2, window.devicePixelRatio || 2);
  canvas.width = PREVIEW_SIZE * dpr;
  canvas.height = PREVIEW_SIZE * dpr;
  canvas.style.width = PREVIEW_SIZE + 'px';
  canvas.style.height = PREVIEW_SIZE + 'px';
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(source, frame.x, frame.y, frame.w, frame.h, 0, 0, PREVIEW_SIZE * dpr, PREVIEW_SIZE * dpr);
  }
  el.appendChild(canvas);
}

function getLivePrice(itemId: string): number {
  return getGameState().lib.nexusItems.get(itemId)!.price;
}

function canAfford(itemId: string): boolean {
  return uiState.timeFlux >= getLivePrice(itemId);
}

function isPassable(item: NexusItemDefinition): boolean {
  return item.placableInstanceDescription.passable;
}

function onItemPointerDown(item: NexusItemDefinition, event: PointerEvent): void {
  if (event.button !== 0) return;
  event.preventDefault();
  if (!canAccessNexus.value) return;
  if (!canAfford(item.id)) return;
  startMazeManualDrag(item, event);
}

function goToRefineTab(): void {
  globalInputQueue.push(new CmdSwitchTab({ tab: 'refine' }));
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
  border: none;
  border-radius: 4px;
  color: rgba(226, 232, 240, 0.95);
  padding: 0;
  min-width: 380px;
}

.nexus-header {
  font-size: 14px;
  letter-spacing: 0.04em;
  color: rgba(226, 232, 240, 0.95);
  background: var(--panel-bg);
  border-radius: 8px;
  padding: 10px 16px;
  margin-bottom: 6px;
}

.nexus-header-sep {
  color: rgba(226, 232, 240, 0.4);
  margin: 0 2px;
}

.nexus-header-locked {
  color: rgba(248, 113, 113, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}

.nexus-locked-title {
  font-size: 22px;
  letter-spacing: 0.08em;
  font-weight: 600;
  line-height: 1;
  color: rgba(226, 232, 240, 0.95);
}

.btn { padding: 10px 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; border-radius: 4px; border: 1px solid var(--panel-border); cursor: pointer; background: rgba(255,255,255,0.03); color: inherit; }
.btn:hover { background: rgba(255,255,255,0.08); }
.btn.primary { background: rgba(79, 209, 197, 0.14); color: var(--accent); }
.btn.primary:hover { background: rgba(79, 209, 197, 0.22); }

.nexus-locked-message-btn {
  max-width: 100%;
  text-align: center;
}

.nexus-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nexus-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: grab;
  border-radius: 10px;
  background: var(--panel-bg);
  transition: background 0.15s, transform 0.12s ease;
}

.nexus-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.nexus-item:active {
  cursor: grabbing;
  transform: scale(0.92);
  transition: none;
}

.nexus-item.cannot-afford {
  cursor: not-allowed;
}

.nexus-item.cannot-afford:active {
  cursor: not-allowed;
  transform: none;
}

.nexus-item.cannot-afford:hover .nexus-item-price-area {
  animation: flash-red 0.5s ease-in-out infinite;
}

@keyframes flash-red {
  0%, 100% {
    background: rgba(255, 255, 255, 0.05);
    box-shadow: none;
  }
  50% {
    background: rgba(239, 68, 68, 0.4);
    box-shadow: 0 0 12px rgba(239, 68, 68, 0.6);
  }
}

.nexus-item-preview {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
}

.nexus-item-text {
  flex: 1;
  min-width: 0;
}

.nexus-item-name {
  font-size: 17px;
  font-weight: 500;
  display: block;
}

.nexus-item-desc {
  font-size: 14px;
  color: rgba(148, 163, 184, 0.8);
  margin-top: 2px;
}

.nexus-item-price-area {
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 6px 14px;
  align-self: stretch;
  display: flex;
  align-items: center;
}

.nexus-item-price {
  font-size: 20px;
  font-weight: 600;
  color: #48bb78;
}

.nexus-item.cannot-afford .nexus-item-price {
  color: #ef4444;
}

.nexus-item-price-glyph {
  margin-right: 2px;
}

.nexus-item-stat {
  font-size: 12px;
  color: rgba(148, 163, 184, 0.65);
  margin-top: 2px;
  letter-spacing: 0.03em;
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
