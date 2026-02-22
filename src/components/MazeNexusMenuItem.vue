<template>
  <div
    class="nexus-item"
    :class="{ 'cannot-afford': !canAfford, 'mode-select': mode === 'select', 'special-action': isSpecialAction }"
    @pointerdown.stop="onPointerDown"
    @click.stop="onClick"
  >
    <div class="nexus-item-main">
      <div
        v-if="!isSpecialAction"
        class="nexus-item-preview"
        :ref="(el) => mountCanvas(el as HTMLElement | null, id, rotationStep)"
      ></div>
      <div class="nexus-item-text" :class="{ 'nexus-item-text-special': isSpecialAction }">
        <button
          v-if="isTimeSingularityAction"
          class="nexus-item-special-btn"
          type="button"
          :disabled="!canAfford"
          :style="timeSingularityButtonStyle"
        >
          Singularity {{ price }}<span class="nexus-item-special-btn-glyph">⧖</span>
        </button>
        <span v-else class="nexus-item-name">{{ item.name }}</span>
        <div v-if="showNewBanner && !isSpecialAction" class="nexus-item-new">NEW</div>
        <span v-if="!isSpecialAction" class="nexus-item-price">{{ price }}<span class="nexus-item-price-glyph">∿</span></span>
      </div>
    </div>
    <div
      v-if="showMenuHint"
      class="nexus-item-hint"
      :class="{ 'nexus-item-hint-top': hintPosition === 'top' }"
      role="tooltip"
      aria-hidden="true"
    >
      <div class="hint-root">
        <div class="hint-body">
          <div class="hint-row hint-row-multiline">
            <span class="hint-value nexus-item-hint-desc">
              <template v-for="(line, lineIndex) in parsedDescriptionLines" :key="`line-${lineIndex}`">
                <template v-for="(token, tokenIndex) in line" :key="`line-${lineIndex}-token-${tokenIndex}`">
                  <span v-if="token.kind === 'text'">{{ token.text }}</span>
                  <span
                    v-else
                    class="hint-inline-upgrade-image"
                    :ref="(el) => mountHintPreviewCanvas(el as HTMLElement | null, token.itemId)"
                  ></span>
                </template>
                <br v-if="lineIndex < parsedDescriptionLines.length - 1" />
              </template>
            </span>
          </div>
          <div v-if="!item.placableInstanceDescription.passable" class="hint-row hint-row-impassable">
            <span class="hint-impassable-badge">IMPASSABLE</span>
          </div>
          <div v-if="item.effectRadius > 0" class="hint-row">
            <span class="hint-label">Effect radius</span>
            <span class="hint-value">{{ item.effectRadius }}</span>
          </div>
          <div v-if="item.limitRadius > 0" class="hint-row">
            <span class="hint-label">Minimum separation</span>
            <span class="hint-value">{{ item.limitRadius * 2 }}</span>
          </div>
          <div v-if="item.priceIncrease[0] > 0" class="hint-row hint-row-price-increase">
            <span class="hint-label">Price increase</span>
            <span class="hint-value hint-value-price-increase">+{{ item.priceIncrease[0] }}<span class="nexus-item-price-glyph">∿</span></span>
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
import { computed } from 'vue';
import { RESOURCE_SPECS } from '../logic/Resources';

type UINexusItem = DeepReadonly<NexusItemDefinition>;
type DescriptionToken =
  | { kind: 'text'; text: string }
  | { kind: 'upgradeImage'; itemId: string };

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
const HINT_PREVIEW_SIZE = 22;
const DESCRIPTION_LINE_BREAK_REGEX = /<br\s*\/?>/gi;
const DESCRIPTION_UPGRADE_IMAGE_TAG_REGEX = /<upgrade:([a-z0-9_]+)>/g;
const isSpecialAction = computed(() => props.item.specialAction !== '');
const isTimeSingularityAction = computed(() => props.item.specialAction === 'time_singularity');
const showMenuHint = computed(() => props.item.showMenuHint);
const parsedDescriptionLines = computed<DescriptionToken[][]>(() => parseDescription(props.item.description));
const timeSingularityButtonStyle = {
  '--time-singularity-disabled-color': RESOURCE_SPECS.chronotraces.color,
  '--time-singularity-disabled-bg': RESOURCE_SPECS.chronotraces.bgColor,
};

function mountCanvas(el: HTMLElement | null, id: string, rotationStep: number): void {
  if (!el) return;
  const renderedStep = Number(el.dataset.rotationStep ?? -1);
  if (el.firstChild && renderedStep === rotationStep) return;
  el.replaceChildren(createNexusPreviewFrameCanvas(id, PREVIEW_SIZE, rotationStep));
  el.dataset.rotationStep = String(rotationStep);
}

function mountHintPreviewCanvas(el: HTMLElement | null, id: string): void {
  if (!el) return;
  if (el.firstChild && el.dataset.nexusItemId === id) return;
  el.replaceChildren(createNexusPreviewFrameCanvas(id, HINT_PREVIEW_SIZE, 0));
  el.dataset.nexusItemId = id;
}

function parseDescription(input: string): DescriptionToken[][] {
  const lines = input.split(DESCRIPTION_LINE_BREAK_REGEX);
  return lines.map(parseDescriptionLine);
}

function parseDescriptionLine(line: string): DescriptionToken[] {
  const tokens: DescriptionToken[] = [];
  let cursor = 0;
  DESCRIPTION_UPGRADE_IMAGE_TAG_REGEX.lastIndex = 0;

  let match = DESCRIPTION_UPGRADE_IMAGE_TAG_REGEX.exec(line);
  while (match) {
    const fullMatch = match[0]!;
    const itemId = match[1]!;
    const matchStart = match.index;

    if (matchStart > cursor) {
      tokens.push({
        kind: 'text',
        text: line.slice(cursor, matchStart),
      });
    }

    tokens.push({
      kind: 'upgradeImage',
      itemId,
    });

    cursor = matchStart + fullMatch.length;
    match = DESCRIPTION_UPGRADE_IMAGE_TAG_REGEX.exec(line);
  }

  if (cursor < line.length) {
    tokens.push({
      kind: 'text',
      text: line.slice(cursor),
    });
  }

  if (tokens.length === 0) {
    tokens.push({
      kind: 'text',
      text: '',
    });
  }

  return tokens;
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
  gap: 8px;
  padding: 6px 10px 10px;
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
  height: 52px;
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

.nexus-item-text-special {
  padding-top: 2px;
}

.nexus-item-name {
  font-size: 16px;
  font-weight: 600;
  display: block;
  margin-top: 4px;
  margin-left: -10px;
}

.nexus-item.special-action .nexus-item-name {
  margin: 0;
  font-size: 30px;
  line-height: 1.05;
  text-align: center;
  letter-spacing: 0.03em;
}

.nexus-item.special-action {
  min-height: 60px;
  padding: 0;
  align-items: center;
  justify-content: center;
}

.nexus-item.special-action .nexus-item-main {
  width: 100%;
  height: 100%;
  justify-content: center;
  align-items: center;
  gap: 0;
}

.nexus-item.special-action .nexus-item-text {
  width: 100%;
  height: 100%;
  padding-top: 0;
  display: grid;
  place-items: center;
  margin-left: 0;
}

.nexus-item-special-btn {
  border: 1px solid rgba(253, 224, 71, 0.45);
  background: rgba(113, 63, 18, 0.45);
  color: #fef08a;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0.02em;
  border-radius: 8px;
  padding: 11px 14px;
  cursor: pointer;
  line-height: 1;
}

.nexus-item-special-btn-glyph {
  margin-left: 2px;
}

.nexus-item-special-btn:disabled {
  color: var(--time-singularity-disabled-color);
  border-color: var(--time-singularity-disabled-color);
  background: var(--time-singularity-disabled-bg);
  cursor: not-allowed;
}

.nexus-item-price {
  position: absolute;
  right: 0;
  top: 0;
  font-size: 15px;
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
  padding: 3px 6px;
  z-index: 1;
}

.nexus-item.cannot-afford .nexus-item-price {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.14);
}

.nexus-item-price-glyph {
  margin-left: 2px;
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

.hint-row-price-increase {
  margin-top: 8px;
}

.hint-value-price-increase {
  color: #48bb78;
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

.hint-inline-upgrade-image {
  width: 22px;
  height: 22px;
  display: inline-block;
  vertical-align: middle;
  margin: 0 2px;
}

.hint-inline-upgrade-image canvas {
  display: block;
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

.hint-row-impassable {
  display: block;
  margin-top: 6px;
}

.hint-impassable-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  color: #f87171;
  background: rgba(239, 68, 68, 0.18);
  border-radius: 4px;
  padding: 2px 6px;
}
</style>
