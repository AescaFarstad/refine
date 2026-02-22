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
      <div v-if="canAccessNexus" class="nexus-items" :class="{ 'nexus-items-two-col': items.length > 6 }">
        <div
          v-for="entry in items"
          :key="`${entry.id}:${entry.rotationStep}`"
          class="nexus-item"
          :class="{ 'cannot-afford': !canAfford(entry.id) }"
          @pointerdown="onItemPointerDown(entry, $event)"
        >
          <div class="nexus-item-main">
            <div class="nexus-item-preview" :ref="(el) => mountCanvas(el as HTMLElement | null, entry.id, entry.rotationStep)"></div>
            <div class="nexus-item-text">
              <span class="nexus-item-name">{{ entry.item.name }}</span>
              <div v-if="!isPassable(entry.item)" class="nexus-item-impassable">Impassable</div>
              <span class="nexus-item-price">{{ getLivePrice(entry.id) }}<span class="nexus-item-price-glyph">∿</span></span>
            </div>
          </div>
          <div class="nexus-item-hint" role="tooltip" aria-hidden="true">
            <div class="hint-root">
              <div class="hint-body">
                <div class="hint-row hint-row-multiline">
                  <span class="hint-value nexus-item-hint-desc" v-html="entry.item.description"></span>
                </div>
                <div v-if="entry.item.effectRadius > 0" class="hint-row">
                  <span class="hint-label">Effect radius</span>
                  <span class="hint-value">{{ entry.item.effectRadius }}</span>
                </div>
                <div v-if="entry.item.limitRadius > 0" class="hint-row">
                  <span class="hint-label">Minimum separation</span>
                  <span class="hint-value">{{ entry.item.limitRadius * 2 }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { NexusItemDefinition } from '../logic/NexusLib';
import { startMazeManualDrag } from '../logic/MazeNexusDnd';
import type { DeepReadonly } from '../logic/UIState';
import { getGameState, uiState } from '../logic/UIState';
import { DISCOVERY } from '../logic/DiscoveryLib';
import { globalInputQueue } from '../logic/Model';
import { CmdSwitchTab } from '../logic/input/InputCommands';
import { getMazeNexusItemPlacementRotationStep } from '../logic/Maze';
import {
  createNexusPreviewFrameCanvas,
  NEXUS_UI_PREVIEW_SIZE,
} from '../logic/NexusPreviewCanvas';

defineProps<{
  visible: boolean;
}>();

type UINexusItem = DeepReadonly<NexusItemDefinition>;
type UINexusMenuEntry = {
  id: string;
  item: UINexusItem;
  rotationStep: number;
};

const items = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.lib;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.mazeVersion;

  const gs = getGameState();
  const isPlaced = (itemId: string): boolean => gs.researchCells.some(cell => cell.nexusId === itemId);
  return Array.from(gs.lib.nexusItems.entries())
    .filter(([, item]) => !item.placedOnce || !isPlaced(item.id))
    .map(([id, item]): UINexusMenuEntry => ({
      id,
      item,
      rotationStep: getMazeNexusItemPlacementRotationStep(gs, id),
    }));
});

const PREVIEW_SIZE = NEXUS_UI_PREVIEW_SIZE;
const canAccessNexus = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.discoveryCounter;
  return getGameState().discoveries[DISCOVERY.REFINEMENT_FAILED] === true;
});

function mountCanvas(el: HTMLElement | null, id: string, rotationStep: number): void {
  if (!el) return;
  const renderedStep = Number(el.dataset.rotationStep ?? -1);
  if (el.firstChild && renderedStep === rotationStep) return;
  el.replaceChildren(createNexusPreviewFrameCanvas(id, PREVIEW_SIZE, rotationStep));
  el.dataset.rotationStep = String(rotationStep);
}

function getLivePrice(itemId: string): number {
  return getGameState().lib.nexusItems.get(itemId)!.price;
}

function canAfford(itemId: string): boolean {
  return uiState.timeFlux >= getLivePrice(itemId);
}

function isPassable(item: UINexusItem): boolean {
  return item.placableInstanceDescription.passable;
}

function onItemPointerDown(entry: UINexusMenuEntry, event: PointerEvent): void {
  if (event.button !== 0) return;
  event.preventDefault();
  if (!canAccessNexus.value) return;
  if (!canAfford(entry.id)) return;
  startMazeManualDrag({ id: entry.id, rotationStep: entry.rotationStep }, event);
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
  min-width: 320px;
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

.nexus-items-two-col {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.nexus-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  cursor: grab;
  border-radius: 8px;
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

.nexus-item.cannot-afford:hover .nexus-item-price {
  animation: flash-red-bg 0.55s ease-in-out infinite;
}

@keyframes flash-red-bg {
  0%, 100% {
    background: rgba(239, 68, 68, 0.14);
  }
  50% {
    background: rgba(239, 68, 68, 0.32);
  }
}

.nexus-item-main {
  display: flex;
  align-items: flex-start;
  gap: 18px;
  min-width: 0;
  flex: 1;
}

.nexus-item-preview {
  flex-shrink: 0;
  align-self: center;
  width: 56px;
  height: 56px;
}

.nexus-item-preview canvas {
  display: block;
}

.nexus-item-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding-top: 18px;
}

.nexus-item-name {
  font-size: 16px;
  font-weight: 600;
  display: block;
  margin-top: 4px;
  margin-left: -10px;
}

.nexus-item-price {
  position: absolute;
  right: 0;
  top: 0;
  font-size: 18px;
  font-weight: 800;
  color: #48bb78;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  width: fit-content;
  background: rgba(72, 187, 120, 0.16);
  border-top-left-radius: 0;
  border-top-right-radius: 8px;
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 8px;
  padding: 4px 10px;
  z-index: 1;
}

.nexus-item.cannot-afford .nexus-item-price {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.14);
}

.nexus-item-price-glyph {
  margin-left: 2px;
}

.nexus-item-impassable {
  position: absolute;
  right: 0;
  bottom: 0;
  font-size: 12px;
  color: rgba(168, 162, 150, 0.9);
  letter-spacing: 0.03em;
  line-height: 1.1;
  background: rgba(148, 163, 184, 0.16);
  border-top-left-radius: 8px;
  border-top-right-radius: 0;
  border-bottom-right-radius: 8px;
  border-bottom-left-radius: 0;
  padding: 3px 8px;
  z-index: 1;
}

.nexus-item-hint {
  position: absolute;
  right: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
  background: var(--hint-bg, rgba(10, 14, 20, 0.95));
  border: 1px solid var(--hint-border, rgba(148, 163, 184, 0.25));
  border-radius: 4px;
  padding: 8px 10px;
  min-width: 220px;
  max-width: 280px;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  z-index: 35;
  transition: opacity 0.12s ease;
}

.nexus-item-hint::before {
  content: '';
  position: absolute;
  top: 50%;
  right: -6px;
  width: 10px;
  height: 10px;
  background: var(--hint-bg, rgba(10, 14, 20, 0.95));
  border-right: 1px solid var(--hint-border, rgba(148, 163, 184, 0.25));
  border-top: 1px solid var(--hint-border, rgba(148, 163, 184, 0.25));
  transform: translateY(-50%) rotate(45deg);
}

.nexus-item:hover .nexus-item-hint {
  opacity: 1;
  visibility: visible;
}

.nexus-item:active .nexus-item-hint {
  opacity: 0;
  visibility: hidden;
}

.hint-root {
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.hint-body {
  font-size: 14px;
  font-weight: 600;
}

.hint-row {
  white-space: nowrap;
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 8px;
  align-items: baseline;
  margin: 2px 0;
}

.hint-row-multiline {
  white-space: normal;
}

.hint-label {
  color: var(--text-secondary);
  font-size: 13px;
  letter-spacing: 0.06em;
  font-weight: 800;
}

.hint-value {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 800;
  white-space: pre-line;
}

.nexus-item-hint-desc {
  font-size: 13px;
  font-weight: 700;
  color: rgba(226, 232, 240, 0.95);
}

</style>
