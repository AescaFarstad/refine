<template>
  <div v-if="isUntracked && achi.type === 'pay'" class="achi-pay-btn achi-pay-preview" :style="payBtnVars">
    <span>Pay {{ achi.paramNum }}</span>
    <span v-if="paySpec.iconImage.length === 0" class="achi-resource-glyph" :style="{ color: paySpec.color }">{{ paySpec.glyph }}</span>
    <span v-else class="achi-resource-icon" :style="payIconStyle" />
    <span class="achi-owned">(you have {{ ownedAmount }})</span>
  </div>

  <div v-else-if="isUntracked" class="achi-item achi-item-preview" :style="earnItemVars">
    <div class="achi-content">
      <span v-if="achi.type === 'earn'" class="achi-progress-label">{{ achi.paramNum }}<span v-if="achi.symbol" class="achi-progress-symbol" :style="{ color: achi.symbolColor }">{{ achi.symbol }}</span></span>
      <span class="achi-description">{{ achi.description }}</span>
    </div>
  </div>

  <button v-else-if="isComplete" type="button" class="achi-complete-btn" :style="earnItemVars" @click="acknowledge">
    <span class="achi-complete-label">COMPLETE</span>
    <span class="achi-progress-label">{{ achi.paramNum }}<span v-if="achi.symbol" class="achi-progress-symbol" :style="{ color: achi.symbolColor }">{{ achi.symbol }}</span></span>
    <span class="achi-description">{{ achi.description }}</span>
  </button>

  <div v-else-if="achi.type === 'earn'" class="achi-item" :style="earnItemVars">
    <div class="achi-progress-fill" :style="{ width: `${progressPct}%` }" />
    <div class="achi-content">
      <span class="achi-progress-label"><span class="achi-progress-current" :class="{ 'achi-progress-flash': progressFlash }">{{ progressValue }} /</span> {{ achi.paramNum }}<span v-if="achi.symbol" class="achi-progress-symbol" :style="{ color: achi.symbolColor }">{{ achi.symbol }}</span></span>
      <span class="achi-description">{{ achi.description }}</span>
    </div>
    <span v-if="showProjectedValue" class="achi-projected-value" :class="{ 'achi-projected-flash': projectedFlash, 'achi-projected-complete': projectedValue >= achi.paramNum }">{{ displayedProjectedValue }}</span>
  </div>

  <button v-else type="button" class="achi-pay-btn" :style="payBtnVars" :disabled="!canPay" @click="pay">
    <span>Pay {{ achi.paramNum }}</span>
    <span v-if="paySpec.iconImage.length === 0" class="achi-resource-glyph" :style="{ color: paySpec.color }">{{ paySpec.glyph }}</span>
    <span v-else class="achi-resource-icon" :style="payIconStyle" />
    <span class="achi-owned">(you have {{ ownedAmount }})</span>
  </button>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, type CSSProperties } from 'vue';
import type { AchiDefinition } from '../logic/AchiLib';
import { ACHI_STATE_COMPLETE } from '../logic/Achi';
import type { MazeResourceKey } from '../logic/pane/MazeOverlayState';
import { MAZE_RESOURCE_SPECS } from '../logic/MazeResourceVisuals';
import { getGameState, uiState } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdPayAchi, CmdAcknowledgeAchi } from '../logic/input/InputCommands';
import atlasStorage from '../logic/AtlasStorage';
import { atlasSpriteStyle } from '../logic/AtlasSpriteStyle';

const props = defineProps<{
  achi: AchiDefinition;
  achiVersion: number;
  expectedState: 'tracked' | 'untracked';
}>();

const state = computed(() => {
  const achiVersion = props.achiVersion;
  if (achiVersion < 0) throw new Error(`Invalid achi version: ${achiVersion}`);
  const gameState = getGameState().achi[props.achi.id];
  if (props.expectedState === 'tracked' && !gameState) {
    throw new Error(`Expected tracked achievement state for ${props.achi.id}`);
  }
  if (props.expectedState === 'untracked' && gameState) {
    throw new Error(`Expected untracked achievement state for ${props.achi.id}`);
  }
  // GameState is intentionally non-reactive. Return a new snapshot when its
  // reactive version changes so downstream computed values are invalidated.
  return gameState ? { ...gameState } : undefined;
});

const isUntracked = computed(() => {
  state.value;
  return props.expectedState === 'untracked';
});
const trackedState = computed(() => state.value!);

const isComplete = computed(() => props.expectedState === 'tracked' && trackedState.value.state === ACHI_STATE_COMPLETE);

const payTarget = computed(() => props.achi.paramStr as MazeResourceKey);
const paySpec = computed(() => MAZE_RESOURCE_SPECS[payTarget.value]);

const progressValue = computed(() => props.expectedState === 'untracked' ? 0 : Math.min(trackedState.value.best, props.achi.paramNum));
const projectedValue = computed(() => props.expectedState === 'untracked' ? 0 : trackedState.value.projectedValue);
const showProjectedValue = computed(() => props.achi.type === 'earn' && projectedValue.value > 0);

const displayedProjectedValue = ref(projectedValue.value);
const projectedFlash = ref(false);
let flashTimeout: ReturnType<typeof setTimeout> | undefined;
let displayTimeout: ReturnType<typeof setTimeout> | undefined;
let pendingValue: number | null = null;

watch(projectedValue, async (newVal) => {
  if (pendingValue !== null) {
    displayedProjectedValue.value = pendingValue;
  }
  pendingValue = newVal;
  clearTimeout(displayTimeout);
  displayTimeout = setTimeout(() => {
    displayedProjectedValue.value = pendingValue!;
    pendingValue = null;
  }, 200);

  projectedFlash.value = false;
  await nextTick();
  projectedFlash.value = true;
  clearTimeout(flashTimeout);
  flashTimeout = setTimeout(() => { projectedFlash.value = false; }, 400);
});

const progressFlash = ref(false);
let progressFlashTimeout: ReturnType<typeof setTimeout> | undefined;
watch(progressValue, async () => {
  progressFlash.value = false;
  await nextTick();
  progressFlash.value = true;
  clearTimeout(progressFlashTimeout);
  progressFlashTimeout = setTimeout(() => { progressFlash.value = false; }, 400);
});
const progressPct = computed(() => props.achi.paramNum <= 0 ? 0 : Math.max(0, Math.min(100, progressValue.value / props.achi.paramNum * 100)));

const ownedAmount = computed(() => {
  uiState.countableGear;
  uiState.credits;
  uiState.chronotraces;
  uiState.shardDust;

  switch (payTarget.value) {
    case 'credits':
      return uiState.credits;
    case 'chronotraces':
      return uiState.chronotraces;
    case 'shardDust':
      return uiState.shardDust;
    case 'zone_crystal':
    case 'fractal':
    case 'spice':
    case 'philosophers_stone':
      return uiState.countableGear[payTarget.value] ?? 0;
  }
});

const canPay = computed(() => ownedAmount.value >= props.achi.paramNum);

const earnItemVars = computed<Record<string, string>>(() => {
  const c = props.achi.color;
  if (!c) {
    const out: Record<string, string> = {};
    return out;
  }
  return { '--achi-color': c };
});

const payBtnVars = computed<Record<string, string>>(() => {
  if (props.achi.type !== 'pay') {
    const out: Record<string, string> = {};
    return out;
  }
  return { '--achi-color': paySpec.value.color };
});

const payIconStyle = computed<CSSProperties>(() => {
  if (paySpec.value.iconImage.length === 0) return {};
  const source = atlasStorage.getItemsSource();
  const frame = atlasStorage.getItemsFrame(paySpec.value.iconImage);
  if (!source || !frame) return {};
  return atlasSpriteStyle(source, frame, { size: 22, mode: 'fit', allowUpscale: false }) as CSSProperties;
});


function pay(): void {
  if (!canPay.value) return;
  globalInputQueue.push(new CmdPayAchi({ id: props.achi.id }));
}

function acknowledge(): void {
  globalInputQueue.push(new CmdAcknowledgeAchi({ id: props.achi.id }));
}
</script>

<style scoped>
.achi-item {
  position: relative;
  overflow: hidden;
  background: var(--panel-bg);
  border-radius: 8px;
  padding: 8px 14px;
  display: flex;
  align-items: center;
}

.achi-progress-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: linear-gradient(90deg, color-mix(in srgb, var(--achi-color, rgb(20, 184, 166)) 28%, transparent), color-mix(in srgb, var(--achi-color, rgb(56, 189, 248)) 18%, transparent));
}

.achi-content {
  position: relative;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.achi-progress-label {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  flex: 0 0 auto;
  color: rgba(248, 250, 252, 0.96);
  font-size: 15px;
  font-weight: 800;
}

.achi-progress-current {
  color: rgba(148, 163, 184, 0.6);
}

.achi-progress-flash {
  animation: achi-progress-pulse 0.4s ease-out;
}

@keyframes achi-progress-pulse {
  0% { color: rgba(248, 250, 252, 0.96); }
  100% { color: rgba(148, 163, 184, 0.6); }
}

.achi-progress-symbol {
  font-weight: 900;
}

.achi-description {
  color: rgba(203, 213, 225, 0.55);
  font-size: 14px;
  line-height: 1.25;
  min-width: 0;
}

.achi-projected-value {
  position: absolute;
  inset: 0 0 0 auto;
  z-index: 2;
  pointer-events: none;
  display: flex;
  align-items: center;
  padding: 0 12px;
  background: var(--panel-bg, rgb(15, 23, 42));
  color: color-mix(in srgb, var(--achi-color, rgb(56, 189, 248)) 82%, white);
  font-size: 16px;
  font-weight: 900;
  line-height: 1;
}

.achi-projected-complete {
  color: rgb(134, 239, 172);
}

.achi-projected-flash {
  animation: achi-projected-pulse 0.4s ease-out;
}

@keyframes achi-projected-pulse {
  0% {
    color: white;
    background: color-mix(in srgb, var(--achi-color, rgb(56, 189, 248)) 35%, var(--panel-bg, rgb(15, 23, 42)));
  }
  100% {
    color: color-mix(in srgb, var(--achi-color, rgb(56, 189, 248)) 82%, white);
    background: var(--panel-bg, rgb(15, 23, 42));
  }
}

.achi-pay-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid color-mix(in srgb, var(--achi-color, rgb(79, 209, 197)) 35%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--achi-color, rgb(20, 184, 166)) 14%, var(--panel-bg));
  color: rgba(240, 253, 250, 0.95);
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
}

.achi-pay-preview {
  width: max-content;
  cursor: default;
}

.achi-pay-btn:hover {
  background: color-mix(in srgb, var(--achi-color, rgb(20, 184, 166)) 25%, var(--panel-bg));
  border-color: color-mix(in srgb, var(--achi-color, rgb(79, 209, 197)) 55%, transparent);
}

.achi-pay-btn:disabled {
  cursor: default;
  opacity: 0.45;
}

.achi-pay-btn:disabled:hover {
  background: color-mix(in srgb, var(--achi-color, rgb(20, 184, 166)) 14%, var(--panel-bg));
  border-color: color-mix(in srgb, var(--achi-color, rgb(79, 209, 197)) 35%, transparent);
}

.achi-resource-icon {
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
}

.achi-resource-glyph {
  font-weight: 900;
}

.achi-owned {
  color: rgba(148, 163, 184, 0.6);
}

.achi-complete-btn {
  position: relative;
  overflow: hidden;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid color-mix(in srgb, var(--achi-color, rgb(74, 222, 128)) 45%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--achi-color, rgb(34, 197, 94)) 14%, var(--panel-bg));
  color: rgba(240, 253, 250, 0.95);
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
}

.achi-complete-btn::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: linear-gradient(
    100deg,
    transparent 35%,
    color-mix(in srgb, var(--achi-color, rgb(134, 239, 172)) 45%, transparent) 50%,
    transparent 65%
  );
  transform: translateX(-100%);
  animation: achi-complete-sweep 2.8s ease-in-out infinite;
}

@keyframes achi-complete-sweep {
  0% { transform: translateX(-100%); }
  60%, 100% { transform: translateX(100%); }
}

@media (prefers-reduced-motion: reduce) {
  .achi-complete-btn::before {
    animation: none;
    opacity: 0;
  }
}

.achi-complete-btn:hover {
  background: color-mix(in srgb, var(--achi-color, rgb(34, 197, 94)) 25%, var(--panel-bg));
  border-color: color-mix(in srgb, var(--achi-color, rgb(74, 222, 128)) 65%, transparent);
}

.achi-complete-label {
  position: absolute;
  inset: 0 0 0 auto;
  z-index: 1;
  display: flex;
  align-items: center;
  padding: 0 12px;
  background: color-mix(in srgb, rgb(22, 163, 74) 82%, var(--panel-bg));
  color: rgb(240, 253, 244);
  letter-spacing: 0.06em;
}
</style>
