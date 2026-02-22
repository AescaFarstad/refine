<template>
  <div
    class="nexus-item"
    :class="{ 'cannot-afford': !canAfford, 'mode-select': mode === 'select' }"
    @pointerdown.stop="onPointerDown"
    @click.stop="onClick"
  >
    <div class="nexus-item-main">
      <div class="nexus-item-preview" :ref="(el) => mountCanvas(el as HTMLElement | null, id, rotationStep)"></div>
      <div class="nexus-item-text">
        <span class="nexus-item-name">{{ item.name }}</span>
        <div v-if="!item.placableInstanceDescription.passable" class="nexus-item-impassable">Impassable</div>
        <div v-if="showNewBanner" class="nexus-item-new">NEW</div>
        <span class="nexus-item-price">{{ price }}<span class="nexus-item-price-glyph">∿</span></span>
      </div>
    </div>
    <div class="nexus-item-hint" :class="{ 'nexus-item-hint-top': hintPosition === 'top' }" role="tooltip" aria-hidden="true">
      <div class="hint-root">
        <div class="hint-body">
          <div class="hint-row hint-row-multiline">
            <span class="hint-value nexus-item-hint-desc" v-html="item.description"></span>
          </div>
          <div v-if="item.effectRadius > 0" class="hint-row">
            <span class="hint-label">Effect radius</span>
            <span class="hint-value">{{ item.effectRadius }}</span>
          </div>
          <div v-if="item.limitRadius > 0" class="hint-row">
            <span class="hint-label">Minimum separation</span>
            <span class="hint-value">{{ item.limitRadius * 2 }}</span>
          </div>
          <div v-if="item.priceIncrease[0] > 0" class="hint-row">
            <span class="hint-label">Price increase</span>
            <span class="hint-value">+{{ item.priceIncrease[0] }}<span class="nexus-item-price-glyph">∿</span></span>
          </div>
          <div v-if="showNewBanner" class="hint-separator"></div>
          <div v-if="showNewBanner" class="hint-new-line">
            <span class="hint-value hint-new-message">
              This is a <span class="hint-new-word">NEW</span> upgrade. Place it to unlock the next one.
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NexusItemDefinition } from '../logic/NexusLib';
import type { DeepReadonly } from '../logic/UIState';
import {
  createNexusPreviewFrameCanvas,
  NEXUS_UI_PREVIEW_SIZE,
} from '../logic/NexusPreviewCanvas';

type UINexusItem = DeepReadonly<NexusItemDefinition>;

const props = defineProps<{
  id: string;
  item: UINexusItem;
  rotationStep: number;
  price: number;
  canAfford: boolean;
  mode: 'drag' | 'select';
  hintPosition?: 'side' | 'top';
  showNewBanner?: boolean;
}>();

const emit = defineEmits<{
  (e: 'drag-start', event: PointerEvent): void;
  (e: 'select'): void;
}>();

const PREVIEW_SIZE = NEXUS_UI_PREVIEW_SIZE;

function mountCanvas(el: HTMLElement | null, id: string, rotationStep: number): void {
  if (!el) return;
  const renderedStep = Number(el.dataset.rotationStep ?? -1);
  if (el.firstChild && renderedStep === rotationStep) return;
  el.replaceChildren(createNexusPreviewFrameCanvas(id, PREVIEW_SIZE, rotationStep));
  el.dataset.rotationStep = String(rotationStep);
}

function onPointerDown(event: PointerEvent): void {
  if (props.mode !== 'drag') return;
  if (event.button !== 0) return;
  event.preventDefault();
  emit('drag-start', event);
}

function onClick(): void {
  if (props.mode !== 'select') return;
  emit('select');
}
</script>

<style scoped>
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

.nexus-item.mode-select {
  cursor: pointer;
}

.nexus-item.mode-select:active {
  cursor: pointer;
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

.nexus-item-new {
  position: absolute;
  left: 0;
  top: 0;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  color: #fef08a;
  background: rgba(245, 158, 11, 0.22);
  border-top-left-radius: 8px;
  border-top-right-radius: 0;
  border-bottom-right-radius: 8px;
  border-bottom-left-radius: 0;
  padding: 4px 8px;
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

.nexus-item-hint-top {
  right: auto;
  left: 50%;
  top: auto;
  bottom: calc(100% + 8px);
  transform: translateX(-50%);
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

.nexus-item-hint-top::before {
  top: auto;
  right: auto;
  left: 50%;
  bottom: -6px;
  background: var(--hint-bg, rgba(10, 14, 20, 0.95));
  border-right: 1px solid var(--hint-border, rgba(148, 163, 184, 0.25));
  border-bottom: 1px solid var(--hint-border, rgba(148, 163, 184, 0.25));
  border-top: none;
  transform: translateX(-50%) rotate(45deg);
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

.hint-separator {
  border-top: 1px solid var(--hint-border, rgba(148, 163, 184, 0.25));
  margin: 8px 0 6px;
}

.hint-new-line {
  white-space: normal;
}

.hint-value.hint-new-message {
  display: block;
  white-space: normal;
  line-height: 1.3;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;
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

.hint-new-word {
  display: inline-block;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  color: #fef08a;
  background: rgba(245, 158, 11, 0.22);
  border-radius: 4px;
  padding: 1px 5px;
  vertical-align: baseline;
}
</style>
