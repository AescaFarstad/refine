<template>
  <div class="oracle-header">ORACLE</div>

  <div class="oracle-body">
    <div ref="oracleTopRowRef" class="oracle-top-row" style="position: relative;">
      <div
        v-if="lastFailedSealAttempt"
        class="oracle-last-anchor"
        @mouseenter="showLastFailedSealAttempt"
        @mouseleave="hideLastFailedSealAttempt"
      >
        <div v-if="hoveredLastFailedSealAttempt" class="oracle-last-preview">
          <OracleWafer
            :cell-colors="hoveredLastFailedSealAttempt.cellColors"
            :marker-keys="hoveredLastFailedSealAttempt.mismatchMarkerKeys"
            :interactive="false"
          />
        </div>
        <button
          type="button"
          class="oracle-last-btn"
          @focus="showLastFailedSealAttempt"
          @blur="hideLastFailedSealAttempt"
        >
          Last
        </button>
      </div>

      <div class="oracle-seal">
        <OracleWafer
          :cell-colors="sealColors"
          :marker-keys="displayedMismatchMarkerKeys"
          :interactive="!isValidating"
          @toggle-cell="toggleSealCell"
        />
        <OracleWaferValidationAnimation
          v-if="isValidating"
          :elapsed-ms="validationElapsedMs"
          :success="validationWillSucceed"
          :cell-colors="validationCellColors"
        />
      </div>

      <div class="oracle-controls">
        <button type="button" class="clear-btn" :disabled="isValidating" @click="clearSeal">Clear</button>

        <div class="oracle-color-grid">
          <button
            v-for="option in colorOptions"
            :key="option.id"
            type="button"
            class="color-btn"
            :class="{ active: selectedColor === option.id }"
            :disabled="isValidating"
            :title="option.label"
            :aria-label="option.label"
            :style="colorButtonStyle(option.hex)"
            @click="selectedColor = option.id"
          >
            <span class="color-btn-core" :style="{ background: option.hex }" />
          </button>
        </div>

        <button
          type="button"
          class="validate-btn"
          :class="{ validating: isValidating }"
          :disabled="!canValidateSeal"
          @click="startValidation"
        >
          <span v-if="isValidating" class="validate-progress" :style="validateProgressStyle" />
          <span class="validate-content">
            <span class="validate-label">Validate</span>
            <span class="validate-price">
              <span class="validate-cost" :style="{ color: chronotracesSpec.color }">
                {{ ORACLE_VALIDATE_COST }}{{ chronotracesSpec.glyph }}
              </span>
            </span>
          </span>
        </button>

        <div class="validate-message-slot">
          <div v-if="sealFailed && !isValidating" class="validate-error">The seal did not fit</div>
        </div>
      </div>
    </div>

    <div class="oracle-riddle" :style="oracleSectionStyle">
      <div class="oracle-riddle-text">{{ currentOracleRiddle }}</div>
    </div>
  </div>

  <div class="oracle-possibilities-section" :style="oracleSectionStyle">
    <button
      v-if="!hasDiscoveredOracleHints"
      type="button"
      class="oracle-possibilities-btn"
      :disabled="!canShowPossibilities"
      @click="onShowPossibilities"
    >
      <span>Show possibilities</span>
      <span class="oracle-possibilities-cost" :class="{ insufficient: !canShowPossibilities }">
        <span class="oracle-possibilities-icon" :style="philosophersStoneStyle" />
        {{ philosophersStoneCount }} / {{ ORACLE_POSSIBILITIES_COST }}
      </span>
    </button>

    <div v-else class="oracle-signature-grid" :style="signatureAtlasVars">
      <div
        v-for="signature in oraclePossibilitySignatures"
        :key="signature.id"
        class="oracle-signature-entry"
        :class="{
          learned: isSignatureCompleted(signature.id),
          discovered: isSignatureDiscovered(signature.id),
          completed: isOracleSignatureCompleted(signature.id),
        }"
      >
        <div class="oracle-signature-sprite-wrap">
          <div class="oracle-signature-sprite" :style="oracleSignatureSpriteStyle(signature.id)" />
          <div v-if="isOracleSignatureCompleted(signature.id)" class="oracle-signature-cross" />
        </div>
        <div class="oracle-signature-name">{{ oracleSignatureName(signature.id, signature.name) }}</div>
      </div>
    </div>
  </div>

  <div class="oracle-help-section" :style="oracleSectionStyle">
    <span class="oracle-help-label">How to crack the oracle</span>
    <span class="oracle-help-detail">
      Guess the missing word in [...] and find a way to express it on the wafer.
      <br>Offset doesn't matter.<br>Rotation does.
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import OracleWafer from './OracleWafer.vue';
import OracleWaferValidationAnimation from './OracleWaferValidationAnimation.vue';
import atlasStorage from '../logic/AtlasStorage';
import { atlasSpriteStyle } from '../logic/AtlasSpriteStyle';
import { ORACLE_POSSIBILITIES_COST } from '../logic/Const';
import { DISCOVERY } from '../logic/DiscoveryLib';
import { globalInputQueue } from '../logic/Model';
import {
  compactOracleSealColors,
  getOracleProgressAtNode,
  getOracleRiddle,
  ORACLE_VALIDATE_COST,
  predictOracleSealValidation,
  type OracleSealAttempt,
  type OracleSealCellColors,
  type OracleSealColor,
} from '../logic/Oracle';
import { ESSENCE_COLORS } from '../logic/RenderConstants';
import { getResourceSpec } from '../logic/Resources';
import type { ReadonlySignatureDefinition } from '../logic/SignatureLib';
import { getSignatureAtlasVars, getSignatureSpriteStyle } from '../logic/signatureVisuals';
import { CmdMazeShowOraclePossibilities, CmdMazeValidateOracleSeal } from '../logic/input/InputCommands';
import { getGameState, uiState, type DeepReadonly } from '../logic/UIState';

const FAILURE_ANIMATION_DURATION_MS = 2000;
const SUCCESS_ANIMATION_DURATION_MS = 3000;

const colorOptions = [
  { id: 'red', label: 'Red', hex: ESSENCE_COLORS.red },
  { id: 'green', label: 'Green', hex: ESSENCE_COLORS.green },
  { id: 'blue', label: 'Blue', hex: ESSENCE_COLORS.blue },
  { id: 'gray', label: 'Gray', hex: ESSENCE_COLORS.gray },
  { id: 'yellow', label: 'Yellow', hex: ESSENCE_COLORS.yellow },
  { id: 'magenta', label: 'Magenta', hex: ESSENCE_COLORS.magenta },
] as const;

const selectedColor = ref<OracleSealColor>('red');
const sealColors = computed<OracleSealCellColors>(() => uiState.mazeOracleSealCellColors);
const mismatchMarkerKeys = computed(() => uiState.mazeOracleSealMismatchMarkerKeys);
const oracleTopRowRef = ref<HTMLElement | null>(null);
const oracleTopRowWidth = ref(0);
const hoveredLastFailedSealAttempt = ref<DeepReadonly<OracleSealAttempt> | null>(null);
const sealFailed = ref(false);
const isValidating = ref(false);
const validationProgress = ref(0);
const validationElapsedMs = ref(0);
const validationWillSucceed = ref(false);
const validationCellColors = ref<Record<string, OracleSealColor>>({});
const displayedMismatchMarkerKeys = computed(() => isValidating.value ? [] : mismatchMarkerKeys.value);
const chronotracesSpec = getResourceSpec('chronotraces');
const signatureAtlasVars = getSignatureAtlasVars();
let oracleTopRowObserver: ResizeObserver | null = null;
let validationAnimationFrameId: number | null = null;

const currentNodeId = computed(() => uiState.mazeVisitedOracleNodeId);
const currentOracleRiddle = computed(() => {
  uiState.lib;
  return getOracleRiddle(getGameState(), currentNodeId.value);
});
const hasSealColors = computed(() => Object.values(uiState.mazeOracleSealCellColors).some(color => color != null));
const canValidateSeal = computed(() => {
  uiState.chronotraces;
  return !isValidating.value && uiState.chronotraces >= ORACLE_VALIDATE_COST && hasSealColors.value;
});
const validateProgressStyle = computed(() => ({ width: `${validationProgress.value * 100}%` }));
const lastFailedSealAttempt = computed(() => {
  uiState.mazeVersion;
  return getOracleProgressAtNode(getGameState(), currentNodeId.value).lastFailedSealAttempt;
});
const oracleSectionStyle = computed(() => oracleTopRowWidth.value > 0
  ? { width: `${oracleTopRowWidth.value}px` }
  : {});
const philosophersStoneCount = computed(() => {
  uiState.countableGear;
  return uiState.countableGear.philosophers_stone ?? 0;
});
const canShowPossibilities = computed(() => philosophersStoneCount.value >= ORACLE_POSSIBILITIES_COST);
const hasDiscoveredOracleHints = computed(() => {
  uiState.discoveryCounter;
  return getGameState().discoveries[DISCOVERY.ORACLE_HINTS] === true;
});
const philosophersStoneStyle = computed<Record<string, string>>(() => {
  const frame = atlasStorage.getItemsFrame('fracture_4')!;
  return atlasSpriteStyle(atlasStorage.getItemsSource(), frame, { size: 20, mode: 'fit', allowUpscale: false });
});
const oraclePossibilitySignatures = computed<ReadonlySignatureDefinition[]>(() => {
  uiState.lib;
  const signatures = Array.from(getGameState().lib.signatures.values());
  signatures.sort((a, b) => a.level - b.level || a.difficulty - b.difficulty || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return signatures;
});
const discoveredSignatureIdSet = computed(() => new Set(uiState.learnedSignatureIds));
const completedSignatureIdSet = computed(() => new Set(uiState.completedSignatureIds));
const completedOracleSignatureIdSet = computed(() => {
  uiState.mazeVersion;
  const completed = new Set<string>();
  const gs = getGameState();
  for (const [oracleId, progress] of Object.entries(gs.mazeOracleByOracleId)) {
    if (progress.state === 'riddlePassed') completed.add(gs.lib.oracles.get(oracleId)!.signatureId);
  }
  return completed;
});

watch(currentNodeId, () => {
  cancelValidation();
  clearSeal();
  hideLastFailedSealAttempt();
}, { flush: 'sync' });
onMounted(bindOracleTopRowObserver);

function toggleSealCell(key: string) {
  sealFailed.value = false;
  uiState.mazeOracleSealMismatchMarkerKeys = [];
  const cellColors = uiState.mazeOracleSealCellColors;
  cellColors[key] = cellColors[key] === selectedColor.value ? null : selectedColor.value;
}

function clearSeal() {
  sealFailed.value = false;
  uiState.mazeOracleSealMismatchMarkerKeys = [];
  uiState.mazeOracleSealCellColors = {};
}

function startValidation() {
  if (!canValidateSeal.value) return;
  const nodeId = currentNodeId.value;
  const cellColors = compactOracleSealColors(uiState.mazeOracleSealCellColors);
  const prediction = predictOracleSealValidation(getGameState(), nodeId, cellColors);
  const duration = prediction.success ? SUCCESS_ANIMATION_DURATION_MS : FAILURE_ANIMATION_DURATION_MS;
  const startedAt = performance.now();

  isValidating.value = true;
  validationProgress.value = 0;
  validationElapsedMs.value = 0;
  validationWillSucceed.value = prediction.success;
  validationCellColors.value = cellColors;

  const animate = (timestamp: number) => {
    validationElapsedMs.value = Math.min(duration, timestamp - startedAt);
    validationProgress.value = validationElapsedMs.value / duration;
    if (validationProgress.value < 1) {
      validationAnimationFrameId = requestAnimationFrame(animate);
      return;
    }

    validationAnimationFrameId = null;
    isValidating.value = false;
    sealFailed.value = !prediction.success;
    uiState.mazeOracleSealMismatchMarkerKeys = prediction.success
      ? []
      : [...prediction.fit.wrongColorCellKeys, ...prediction.fit.extraLitCellKeys];
    globalInputQueue.push(new CmdMazeValidateOracleSeal({ nodeId, cellColors }));
  };

  validationAnimationFrameId = requestAnimationFrame(animate);
}

function cancelValidation() {
  if (validationAnimationFrameId !== null) cancelAnimationFrame(validationAnimationFrameId);
  validationAnimationFrameId = null;
  isValidating.value = false;
  validationProgress.value = 0;
  validationElapsedMs.value = 0;
}

function onShowPossibilities() {
  if (!canShowPossibilities.value) return;
  globalInputQueue.push(new CmdMazeShowOraclePossibilities());
}

function colorButtonStyle(hex: string) {
  return { '--oracle-color': hex };
}

function showLastFailedSealAttempt() {
  hoveredLastFailedSealAttempt.value = getOracleProgressAtNode(getGameState(), currentNodeId.value).lastFailedSealAttempt;
}

function hideLastFailedSealAttempt() {
  hoveredLastFailedSealAttempt.value = null;
}

function isSignatureDiscovered(id: string): boolean {
  return discoveredSignatureIdSet.value.has(id);
}

function isSignatureCompleted(id: string): boolean {
  return completedSignatureIdSet.value.has(id);
}

function isOracleSignatureCompleted(id: string): boolean {
  return completedOracleSignatureIdSet.value.has(id);
}

function oracleSignatureName(id: string, name: string): string {
  return isSignatureCompleted(id) ? name : '???';
}

function oracleSignatureSpriteStyle(id: string): Record<string, string> {
  if (isSignatureCompleted(id)) return getSignatureSpriteStyle(id, 'completed');
  if (isSignatureDiscovered(id)) return getSignatureSpriteStyle(id, 'hidden');

  const signature = getGameState().lib.signatures.get(id)!;
  const frame = atlasStorage.getMoleculesFrame(`sig:card:unknownColor:${signature.color}`)!;
  const source = atlasStorage.getMoleculesSource()!;
  const targetHeight = 54;
  const scale = targetHeight / frame.h;
  return {
    width: `${Math.round(frame.w * scale)}px`,
    height: `${Math.round(frame.h * scale)}px`,
    backgroundImage: `url(${source.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${frame.x * scale}px -${frame.y * scale}px`,
    backgroundSize: `${source.naturalWidth * scale}px ${source.naturalHeight * scale}px`,
  };
}

function bindOracleTopRowObserver() {
  oracleTopRowObserver?.disconnect();
  const topRow = oracleTopRowRef.value!;
  oracleTopRowWidth.value = topRow.getBoundingClientRect().width;
  oracleTopRowObserver = new ResizeObserver(() => {
    oracleTopRowWidth.value = topRow.getBoundingClientRect().width;
  });
  oracleTopRowObserver.observe(topRow);
}

onUnmounted(() => {
  cancelValidation();
  oracleTopRowObserver?.disconnect();
});
</script>
