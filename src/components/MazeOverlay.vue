<template>
  <div class="maze-overlay-root">
    <div v-if="showLeftPanel" class="maze-panel panel-left">
      <div v-if="hasAnyHighResources" class="panel-title">Highest picked up</div>
      <div v-if="hasAnyHighResources" class="resource-row">
        <span
          v-for="entry in highEntries"
          :key="`high-${entry.key}`"
          class="resource-slot"
        >
          <span
            v-if="entry.amount > 0"
            class="resource-chip"
            :style="resourceChipStyle(entry.key)"
            @mouseenter="onResourcePillEnter(entry.key)"
            @mouseleave="onResourcePillLeave"
          >
            {{ entry.amount }}{{ entry.spec.glyph }}
          </span>
        </span>
      </div>
      <div v-if="hasAttemptResources" class="deposit-hint">
        Return to the entrance to deposit resources.
        <br>
        Everything above your previous best will be banked.
      </div>
      <div
        v-if="isHoveringEntrance && depositPreviewEntries.length > 0"
        class="resource-row banked-row"
      >
        <span
          v-for="entry in depositPreviewEntries"
          :key="`banked-${entry.key}`"
          class="resource-chip banked-chip"
          :style="resourceChipStyle(entry.key)"
        >
          +{{ entry.amount }}{{ entry.spec.glyph }}
        </span>
      </div>
      <div v-if="props.highMovementUsed > 0" class="journey-cost-line">
        Highest completed journey cost: <span class="movement-value">{{ props.highMovementUsed }}∿</span>
        <button class="reset-btn" @click="onResetHighMovement">reset</button>
      </div>
    </div>

    <div class="panel-center-stack">
      <div class="movement-wrap">
        <div class="maze-panel panel-center movement-panel">
          Remaining movement pool <span class="movement-value">{{ remainingPool }}∿</span>
        </div>
        <div
          class="maze-panel panel-center movement-cost-panel"
          :class="{ 'is-hidden': hoverPathCost <= 0 }"
        >
          -{{ hoverPathCost }}∿
        </div>
      </div>

      <div class="maze-panel panel-center attempt-panel">
        <div class="resource-row">
          <span
            v-for="entry in attemptEntries"
            :key="`attempt-${entry.key}`"
            class="resource-slot"
          >
            <span
              v-if="entry.amount > 0"
              class="resource-chip"
              :style="resourceChipStyle(entry.key)"
              @mouseenter="onResourcePillEnter(entry.key)"
              @mouseleave="onResourcePillLeave"
            >
              {{ entry.amount }}{{ entry.spec.glyph }}
            </span>
          </span>
        </div>
      </div>
    </div>

    <div
      v-for="hint in hoverResourceHints"
      :key="`${hint.resourceKey}-${hint.screenX}-${hint.screenY}`"
      class="resource-hover-hint map-hint"
      :style="resourceHintStyle(hint)"
    >
      <span class="hint-amount" :style="{ color: RESOURCE_SPECS[hint.resourceKey].color }">
        {{ hint.amount }}{{ RESOURCE_SPECS[hint.resourceKey].glyph }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RESOURCE_SPECS } from '../logic/Resources';
import type {
  MazeResourceHoverHint,
  MazeResourceKey,
  MazeResourceTotals,
} from '../logic/pane/MazeOverlayState';
import { MAZE_RESOURCE_KEYS } from '../logic/pane/MazeOverlayState';

const props = defineProps<{
  remainingPool: number;
  attemptResources: MazeResourceTotals;
  highResources: MazeResourceTotals;
  hoverResourceHints: MazeResourceHoverHint[];
  hoverPathCost: number;
  isHoveringEntrance: boolean;
  highMovementUsed: number;
}>();

const emit = defineEmits<{
  (e: 'resource-pill-hover', resourceKey: MazeResourceKey | null): void;
  (e: 'reset-high-movement'): void;
}>();

interface ResourceEntry {
  key: MazeResourceKey;
  amount: number;
  spec: (typeof RESOURCE_SPECS)[MazeResourceKey];
}

function buildEntries(resources: MazeResourceTotals): ResourceEntry[] {
  return MAZE_RESOURCE_KEYS.map((key) => ({
    key,
    amount: resources[key],
    spec: RESOURCE_SPECS[key],
  }));
}

const attemptEntries = computed(() => buildEntries(props.attemptResources));
const highEntries = computed(() => buildEntries(props.highResources));
const hasAttemptResources = computed(() => attemptEntries.value.some((entry) => entry.amount > 0));
const hasAnyHighResources = computed(() => highEntries.value.some((entry) => entry.amount > 0));
const showLeftPanel = computed(() => hasAttemptResources.value || hasAnyHighResources.value || props.highMovementUsed > 0);
const depositPreviewEntries = computed<ResourceEntry[]>(() => MAZE_RESOURCE_KEYS
  .map((key) => ({
    key,
    amount: Math.max(0, props.attemptResources[key] - props.highResources[key]),
    spec: RESOURCE_SPECS[key],
  }))
  .filter((entry) => props.attemptResources[entry.key] > 0));

function resourceChipStyle(key: MazeResourceKey): Record<string, string> {
  const spec = RESOURCE_SPECS[key];
  return {
    color: spec.color,
    borderColor: `${spec.color}66`,
    background: solidPillBackground(spec.color),
  };
}

function resourceHintStyle(hint: MazeResourceHoverHint): Record<string, string> {
  return {
    left: `${hint.screenX}px`,
    top: `${hint.screenY}px`,
  };
}

function onResourcePillEnter(key: MazeResourceKey): void {
  emit('resource-pill-hover', key);
}

function onResourcePillLeave(): void {
  emit('resource-pill-hover', null);
}

function onResetHighMovement(): void {
  emit('reset-high-movement');
}

function solidPillBackground(hexColor: string): string {
  const srcR = parseInt(hexColor.slice(1, 3), 16);
  const srcG = parseInt(hexColor.slice(3, 5), 16);
  const srcB = parseInt(hexColor.slice(5, 7), 16);

  // Match the previous rgba(..., 0.10) tint over Research-style panel bg (15,23,42),
  // but as an opaque color so it stays visually stable on transparent sections.
  const tintAlpha = 0.10;
  const paneR = 15;
  const paneG = 23;
  const paneB = 42;

  const outR = Math.round((srcR * tintAlpha) + (paneR * (1 - tintAlpha)));
  const outG = Math.round((srcG * tintAlpha) + (paneG * (1 - tintAlpha)));
  const outB = Math.round((srcB * tintAlpha) + (paneB * (1 - tintAlpha)));

  return `rgb(${outR}, ${outG}, ${outB})`;
}
</script>

<style scoped>
.maze-overlay-root {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 12;
}

.maze-panel {
  border: 1px solid rgba(148, 163, 184, 0.7);
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.9);
  color: rgba(226, 232, 240, 0.95);
}

.panel-left {
  position: absolute;
  left: 12px;
  top: 12px;
  padding: 6px 12px;
  min-width: 282px;
  pointer-events: auto;
}

.panel-center-stack {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.panel-center {
  padding: 6px 12px;
}

.attempt-panel {
  background: transparent;
  border: none;
  box-shadow: none;
  backdrop-filter: none;
  padding: 2px 4px;
  pointer-events: auto;
}

.movement-panel {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  color: rgba(226, 232, 240, 0.95);
  pointer-events: auto;
}

.panel-title {
  font-size: 14px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(226, 232, 240, 0.95);
  margin-bottom: 4px;
}

.resource-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.deposit-hint {
  margin-top: 6px;
  font-size: 14px;
  line-height: 1.35;
  color: rgba(226, 232, 240, 0.72);
}

.resource-slot {
  position: relative;
  display: flex;
  justify-content: center;
  flex: 0 0 86px;
}

.resource-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 66px;
  padding: 3px 12px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
}

.banked-row {
  margin-top: 8px;
  gap: 8px;
}

.banked-chip {
  min-width: 58px;
}

.journey-cost-line {
  margin-top: 6px;
  font-size: 14px;
  color: rgba(226, 232, 240, 0.72);
  display: flex;
  align-items: center;
  gap: 6px;
}

.reset-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px 6px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 4px;
  background: rgba(148, 163, 184, 0.1);
  color: rgba(226, 232, 240, 0.6);
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  pointer-events: auto;
}

.reset-btn:hover {
  background: rgba(148, 163, 184, 0.25);
  color: rgba(226, 232, 240, 0.9);
}

.movement-wrap {
  position: relative;
  pointer-events: auto;
}

.movement-value {
  color: #48bb78;
}

.movement-cost-panel {
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-left: 6px;
  font-size: 16px;
  color: #2f855a;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.movement-cost-panel.is-hidden {
  visibility: hidden;
}

.resource-hover-hint {
  position: absolute;
  padding: 3px 8px;
  font-size: 13px;
  line-height: 1.1;
  white-space: nowrap;
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.9);
  color: rgba(226, 232, 240, 0.95);
}

.hint-amount {
  font-weight: 700;
}

.map-hint {
  transform: translate(-50%, calc(-100% - 8px));
  pointer-events: none;
}
</style>
