<template>
  <div class="maze-overlay-root">
    <div v-if="showLeftPanel" class="maze-panel panel-left">
      <div v-if="hasAnyHighResources" class="panel-title">Highest picked up:</div>
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
          <span class="movement-label tooltip-label">Remaining movement pool
            <div class="tooltip-panel">
              <div class="hint-section">
                <div class="hint-item">
                  <span class="item-text" style="color: rgba(255, 255, 255, 0.85);">If you run out of movement:</span>
                </div>
                <div class="hint-item">
                  <span class="item-text">• you will be warped to the entrance</span>
                </div>
                <div class="hint-item">
                  <span class="item-text">• movement pool will reset</span>
                </div>
                <div class="hint-item">
                  <span class="item-text">• collected resources will be forfeited</span>
                </div>
                <div class="hint-item">
                  <span class="item-text">• resources and power-ups will refresh</span>
                </div>
              </div>
              <div class="hint-section">
                <div class="hint-item">
                  <span class="item-text">To bank resources, you must return to the entrance.</span>
                </div>
              </div>
            </div>
          </span>
          <span class="movement-value movement-pool-value">{{ remainingPool }}∿</span>
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

      <div v-if="showResetBanner" class="maze-panel panel-center reset-banner" :class="{ 'banner-fading': bannerFading }">
        <div class="reset-headline" :class="bannerReasonSnapshot === 'warped' ? 'headline-red' : 'headline-green'">Warped!</div>
        <div class="reset-subtitle">
          {{ bannerReasonSnapshot === 'warped' ? '(You ran out of movement)' : 'Resources banked' }}
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
    <MazeNexusMenu :visible="nexusMenuVisible" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue';
import { RESOURCE_SPECS } from '../logic/Resources';
import type {
  MazeResourceHoverHint,
  MazeResourceKey,
  MazeResourceTotals,
} from '../logic/pane/MazeOverlayState';
import { MAZE_RESOURCE_KEYS } from '../logic/pane/MazeOverlayState';
import MazeNexusMenu from './MazeNexusMenu.vue';

const props = defineProps<{
  remainingPool: number;
  attemptResources: MazeResourceTotals;
  highResources: MazeResourceTotals;
  hoverResourceHints: MazeResourceHoverHint[];
  hoverPathCost: number;
  isHoveringEntrance: boolean;
  highMovementUsed: number;
  nexusMenuVisible: boolean;
  resetReason: '' | 'warped' | 'banked';
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

// --- Reset banner (auto-hide after 3s) ---
const showResetBanner = ref(false);
const bannerFading = ref(false);
const bannerReasonSnapshot = ref<'warped' | 'banked'>('warped');
let bannerFadeTimer: ReturnType<typeof setTimeout> | null = null;
let bannerHideTimer: ReturnType<typeof setTimeout> | null = null;

function clearBannerTimers(): void {
  if (bannerFadeTimer) { clearTimeout(bannerFadeTimer); bannerFadeTimer = null; }
  if (bannerHideTimer) { clearTimeout(bannerHideTimer); bannerHideTimer = null; }
}

watch(() => props.resetReason, (reason) => {
  clearBannerTimers();
  if (reason) {
    bannerReasonSnapshot.value = reason;
    showResetBanner.value = true;
    bannerFading.value = false;
    bannerFadeTimer = setTimeout(() => {
      bannerFading.value = true;
      bannerHideTimer = setTimeout(() => {
        showResetBanner.value = false;
        bannerFading.value = false;
      }, 350);
    }, 2400);
  } else {
    showResetBanner.value = false;
    bannerFading.value = false;
  }
});

onUnmounted(clearBannerTimers);

function resourceChipStyle(key: MazeResourceKey): Record<string, string> {
  const spec = RESOURCE_SPECS[key];
  return {
    color: spec.color,
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
  border: none;
  border-radius: 4px;
  background: var(--panel-bg);
  color: rgba(226, 232, 240, 0.95);
}

.panel-left {
  position: absolute;
  left: 12px;
  top: 12px;
  padding: 10px 16px;
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
  padding: 10px 16px;
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
  padding: 10px 28px;
  font-size: 16px;
  color: rgba(226, 232, 240, 0.95);
  pointer-events: auto;
}

.movement-label {
  text-decoration: underline dashed;
  text-decoration-color: rgba(226, 232, 240, 0.35);
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
  cursor: default;
}

.tooltip-label {
  position: relative;
  display: inline-block;
}

.tooltip-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 12px;
  background: var(--hint-bg, rgba(10, 14, 20, 0.95));
  border: 1px solid var(--hint-border, rgba(255, 255, 255, 0.15));
  border-radius: 4px;
  color: var(--text-primary, #e0e0e0);
  text-transform: none;
  letter-spacing: normal;
  font-size: 13px;
  font-weight: 500;
  width: max-content;
  max-width: 460px;
  text-align: left;
  pointer-events: none;
  opacity: 0;
  transition: opacity 150ms ease;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.tooltip-panel::after {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 10px;
  height: 10px;
  background: var(--hint-bg, rgba(10, 14, 20, 0.95));
  border-left: 1px solid var(--hint-border, rgba(255, 255, 255, 0.15));
  border-top: 1px solid var(--hint-border, rgba(255, 255, 255, 0.15));
}

.tooltip-label:hover .tooltip-panel {
  opacity: 1;
}

.hint-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 2px;
}

.hint-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 4px;
}

.item-text {
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  font-weight: 600;
}

.movement-pool-value {
  display: inline-block;
  min-width: 3.6ch;
  text-align: right;
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
  border: none;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
  text-decoration: underline dashed;
  text-decoration-color: currentColor;
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
  cursor: default;
}

.banked-row {
  margin-top: 8px;
  gap: 8px;
}

.banked-chip {
  min-width: 58px;
  text-decoration: none;
  cursor: default;
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
  border: none;
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
  background: var(--panel-bg);
  color: rgba(226, 232, 240, 0.95);
}

.hint-amount {
  font-weight: 700;
}

.map-hint {
  transform: translate(-50%, calc(-100% - 8px));
  pointer-events: none;
}

@keyframes bannerEnter {
  0%   { transform: translateY(32px); opacity: 0; }
  55%  { transform: translateY(-8px); opacity: 1; }
  75%  { transform: translateY(4px);  opacity: 1; }
  100% { transform: translateY(0);    opacity: 1; }
}

.reset-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 34px;
  margin-top: 4px;
  opacity: 1;
  background: rgb(23, 33, 47);
  transition: opacity 150ms ease;
  animation: bannerEnter 0.5s ease-out;
}

.reset-banner.banner-fading {
  opacity: 0;
}

.reset-headline {
  font-size: 38px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.headline-red {
  color: #ef4444;
}

.headline-green {
  color: #48bb78;
}

.reset-subtitle {
  font-size: 17px;
  color: rgba(226, 232, 240, 0.55);
  margin-top: 2px;
}
</style>
