<template>
  <div v-if="visible" class="maze-oracle-menu" @click.stop>
    <div class="oracle-panel">
      <div v-if="oracleState === 'riddling'" class="oracle-header">ORACLE</div>

      <div v-if="oracleState === 'riddling'" class="oracle-body">
        <div ref="oracleTopRowRef" class="oracle-top-row" style="position: relative;">
          <div
            v-if="lastFailedSealAttempt"
            class="oracle-last-anchor"
            @mouseenter="showLastFailedSealAttempt"
            @mouseleave="hideLastFailedSealAttempt"
          >
            <div
              v-if="hoveredLastFailedSealAttempt"
              ref="oracleLastPreviewRef"
              class="oracle-last-preview"
            >
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
              :marker-keys="mismatchMarkerKeys"
              @toggle-cell="toggleSealCell"
            />
          </div>

          <div class="oracle-controls">
            <button type="button" class="clear-btn" @click="clearSeal">Clear</button>

            <div class="oracle-color-grid">
              <button
                v-for="option in colorOptions"
                :key="option.id"
                type="button"
                class="color-btn"
                :class="{ active: selectedColor === option.id }"
                :title="option.label"
                :aria-label="option.label"
                :style="colorButtonStyle(option.hex)"
                @click="selectedColor = option.id"
              >
                <span class="color-btn-core" :style="{ background: option.hex }" />
              </button>
            </div>

            <button type="button" class="validate-btn" :disabled="!canValidateSeal" @click="onValidateSeal">
              <span class="validate-label">Validate</span>
              <span class="validate-price">
                <span class="validate-cost" :style="{ color: chronotracesSpec.color }">
                  {{ ORACLE_VALIDATE_COST }}{{ chronotracesSpec.glyph }}
                </span>
              </span>
            </button>

            <div class="validate-message-slot">
              <div v-if="sealFailed" class="validate-error">The seal did not fit</div>
            </div>
          </div>
        </div>

        <div class="oracle-riddle" :style="oracleRiddleStyle">
          <div class="oracle-riddle-text">{{ currentOracleRiddle }}</div>
        </div>
      </div>

      <template v-else-if="oracleState === 'inert'">
        <div class="oracle-header">ORACLE</div>
        <div class="oracle-inert">
          <button type="button" class="oracle-activate-btn" :disabled="!canActivateOracle" @click="onActivateOracle">
            <span class="oracle-activate-icon" :style="philosophersStoneStyle" />
            <span>Insert philosopher's stone</span>
          </button>
          <div class="oracle-inert-text">Solve the Oracle's riddle to learn how to escape the time loop</div>
        </div>
      </template>

      <template v-else-if="oracleState === 'riddlePassed'">
        <div class="oracle-header">ORACLES OPENED: {{ oraclesOpened }} / {{ oraclesTotal }}</div>
        <div class="oracle-escape-hint">
          <div class="oracle-escape-hint-text">Open all oracles to escape the time loop.</div>
        </div>
      </template>

      <div v-if="oracleState === 'riddling'" class="oracle-help-section" :style="oracleRiddleStyle">
        <span class="oracle-help-label">How to crack the oracle</span>
        <span class="oracle-help-detail">Guess the missing word in [...] and find a way to express it on the wafer. <br>Offset doesn't matter.<br>Rotation does.</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import OracleWafer from './OracleWafer.vue';
import { getMazeOracleState } from '../logic/Maze';
import { globalInputQueue } from '../logic/Model';
import {
  compactOracleSealColors,
  evaluateOracleSeal,
  getOracleRiddle,
  ORACLE_VALIDATE_COST,
  type OracleSealColor,
  type OracleSealAttempt,
  type OracleSealCellColors,
} from '../logic/Oracle';
import { ESSENCE_COLORS } from '../logic/RenderConstants';
import { getResourceSpec } from '../logic/Resources';
import { getGameState, uiState, type DeepReadonly } from '../logic/UIState';
import { CmdMazeActivateOracle, CmdMazeValidateOracleSeal } from '../logic/input/InputCommands';
import atlasStorage from '../logic/AtlasStorage';
import { atlasSpriteStyle } from '../logic/AtlasSpriteStyle';

defineProps<{
  visible: boolean;
}>();

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
const oracleLastPreviewRef = ref<HTMLElement | null>(null);
const oracleTopRowWidth = ref(0);
const hoveredLastFailedSealAttempt = ref<DeepReadonly<OracleSealAttempt> | null>(null);
const chronotracesSpec = getResourceSpec('chronotraces');
const itemsAtlasSource = atlasStorage.getItemsSource();

const currentOracleNode = computed(() => {
  uiState.lib;
  const nodeId = uiState.mazeVisitedOracleNodeId;
  if (nodeId < 0) return null;
  return getGameState().lib.research.nodes.get(nodeId)!;
});

const currentOracleRiddle = computed(() => {
  uiState.lib;
  const nodeId = uiState.mazeVisitedOracleNodeId;
  if (nodeId < 0) return '';
  return getOracleRiddle(getGameState(), nodeId);
});

const oracleState = computed(() => {
  uiState.mazeVersion;
  const nodeId = uiState.mazeVisitedOracleNodeId;
  if (nodeId < 0) return null;
  return getMazeOracleState(getGameState(), nodeId);
});

const hasSealColors = computed(() => {
  const cellColors = uiState.mazeOracleSealCellColors;
  return Object.values(cellColors).some((c) => c != null);
});

const canValidateSeal = computed(() => {
  uiState.chronotraces;
  return uiState.chronotraces >= ORACLE_VALIDATE_COST && oracleState.value === 'riddling' && hasSealColors.value;
});

const canActivateOracle = computed(() => {
  uiState.countableGear;
  return oracleState.value === 'inert' && (uiState.countableGear.philosophers_stone ?? 0) > 0;
});

const philosophersStoneStyle = computed<Record<string, string>>(() => {
  const frame = atlasStorage.getItemsFrame('fracture_4')!;
  return atlasSpriteStyle(itemsAtlasSource, frame, { size: 20, mode: 'fit', allowUpscale: false });
});

const sealFailed = ref(false);
const lastFailedSealAttempt = computed(() => {
  uiState.mazeVersion;
  const nodeId = uiState.mazeVisitedOracleNodeId;
  if (nodeId < 0) return null;
  return getGameState().mazeOracleLastFailedSealAttemptByNodeId[String(nodeId)] ?? null;
});
const oraclesTotal = computed(() => {
  uiState.mazeVersion;
  return Object.keys(getGameState().mazeOracleStateByNodeId).length;
});

const oraclesOpened = computed(() => {
  uiState.mazeVersion;
  return Object.values(getGameState().mazeOracleStateByNodeId).filter(s => s === 'riddlePassed').length;
});

const oracleRiddleStyle = computed(() => {
  if (oracleTopRowWidth.value > 0) {
    return {
      width: `${oracleTopRowWidth.value}px`,
    };
  }

  return {};
});

watch(() => uiState.mazeVisitedOracleNodeId, clearSeal, { flush: 'sync' });
watch(() => uiState.mazeVisitedOracleNodeId, hideLastFailedSealAttempt, { flush: 'sync' });
watch([oracleState, () => uiState.mazeVisitedOracleNodeId], async () => {
  await nextTick();
  bindOracleTopRowObserver();
}, { flush: 'post', immediate: true });

let oracleTopRowObserver: ResizeObserver | null = null;

function toggleSealCell(key: string) {
  sealFailed.value = false;
  uiState.mazeOracleSealMismatchMarkerKeys = [];
  const cellColors = uiState.mazeOracleSealCellColors;
  cellColors[key] = cellColors[key] === selectedColor.value ? null : selectedColor.value;
}

function colorButtonStyle(hex: string) {
  return {
    '--oracle-color': hex,
  };
}

function clearSeal() {
  sealFailed.value = false;
  uiState.mazeOracleSealMismatchMarkerKeys = [];
  uiState.mazeOracleSealCellColors = {};
}

function onValidateSeal() {
  const node = currentOracleNode.value;
  if (!node || !canValidateSeal.value) return;

  const cellColors = compactOracleSealColors(uiState.mazeOracleSealCellColors);
  const evaluation = evaluateOracleSeal(getGameState(), node.nodeId, cellColors);
  sealFailed.value = !evaluation.success;
  uiState.mazeOracleSealMismatchMarkerKeys = evaluation.success
    ? []
    : [...evaluation.fit.wrongColorCellKeys, ...evaluation.fit.extraLitCellKeys];

  globalInputQueue.push(new CmdMazeValidateOracleSeal({
    nodeId: node.nodeId,
    cellColors,
  }));
}

function onActivateOracle() {
  const node = currentOracleNode.value;
  if (!node || !canActivateOracle.value) return;
  globalInputQueue.push(new CmdMazeActivateOracle({ nodeId: node.nodeId }));
}

function bindOracleTopRowObserver() {
  oracleTopRowObserver?.disconnect();
  oracleTopRowObserver = null;

  const topRow = oracleTopRowRef.value;
  if (!topRow) return;

  oracleTopRowWidth.value = topRow.getBoundingClientRect().width;
  oracleTopRowObserver = new ResizeObserver(() => {
    oracleTopRowWidth.value = topRow.getBoundingClientRect().width;
  });
  oracleTopRowObserver.observe(topRow);
}

async function showLastFailedSealAttempt() {
  const node = currentOracleNode.value;
  if (!node) return;
  hoveredLastFailedSealAttempt.value = getGameState().mazeOracleLastFailedSealAttemptByNodeId[String(node.nodeId)] ?? null;
}

function hideLastFailedSealAttempt() {
  hoveredLastFailedSealAttempt.value = null;
}

onUnmounted(() => {
  oracleTopRowObserver?.disconnect();
  hideLastFailedSealAttempt();
});
</script>

<style scoped>
.maze-oracle-menu {
  position: absolute;
  right: 12px;
  top: 12px;
  z-index: 14;
  pointer-events: auto;
}

.oracle-panel {
  position: relative;
  border: none;
  border-radius: 4px;
  color: rgba(226, 232, 240, 0.95);
  padding: 0;
  max-width: calc(100vw - 24px);
}

.oracle-last-anchor {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 0;
  z-index: 3;
}

.oracle-last-btn {
  position: absolute;
  top: 10px;
  left: 10px;
  min-width: 36px;
  min-height: 24px;
  padding: 0 6px;
  border: none;
  border-radius: 3px;
  background: rgba(51, 65, 85, 0.96);
  color: rgba(226, 232, 240, 0.92);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: default;
  box-shadow: 0 4px 12px rgba(2, 6, 23, 0.22);
}

.oracle-last-preview {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 6px;
  min-width: max-content;
  padding: 16px;
  border-radius: 8px;
  background: var(--panel-bg);
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.oracle-last-preview::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  right: -24px;
  width: 24px;
}

.oracle-header {
  font-size: 14px;
  letter-spacing: 0.04em;
  color: rgba(226, 232, 240, 0.95);
  background: var(--panel-bg);
  border-radius: 8px;
  padding: 10px 16px;
  margin-bottom: 6px;
}

.oracle-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.oracle-inert {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  background: var(--panel-bg);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 6px;
}

.oracle-activate-btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 10px 14px;
  border: 1px solid rgba(251, 113, 133, 0.35);
  border-radius: 4px;
  background: rgba(30, 41, 59, 0.9);
  color: rgba(255, 241, 242, 0.96);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
}

.oracle-activate-btn:hover {
  background: rgba(51, 65, 85, 0.95);
}

.oracle-activate-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.oracle-activate-btn:disabled:hover {
  background: rgba(30, 41, 59, 0.9);
}

.oracle-activate-icon {
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
}

.oracle-inert-text {
  max-width: 320px;
  color: rgba(226, 232, 240, 0.82);
  font-size: 15px;
  line-height: 1.4;
}

.oracle-top-row {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  background: var(--panel-bg);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 6px;
}

.oracle-seal {
  flex: 0 0 auto;
}

.oracle-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-self: stretch;
  justify-content: flex-start;
}

.oracle-color-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.color-btn {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--oracle-color) 40%, rgba(148, 163, 184, 0.25));
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}

.color-btn:hover {
  border-color: color-mix(in srgb, var(--oracle-color) 70%, rgba(255, 255, 255, 0.6));
  box-shadow: 0 0 10px color-mix(in srgb, var(--oracle-color) 25%, transparent);
}

.color-btn.active {
  border-color: color-mix(in srgb, var(--oracle-color) 80%, rgba(255, 255, 255, 0.8));
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--oracle-color) 40%, rgba(255, 255, 255, 0.18)),
    0 0 14px color-mix(in srgb, var(--oracle-color) 30%, transparent);
}

.color-btn-core {
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.28),
    0 0 8px color-mix(in srgb, var(--oracle-color) 40%, transparent);
}

.validate-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 76px;
  gap: 7px;
  padding: 0 14px;
  border: 1px solid rgba(34, 197, 94, 0.5);
  border-radius: 4px;
  background: rgba(34, 197, 94, 0.32);
  color: #86efac;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}

.validate-btn:hover {
  background: rgba(34, 197, 94, 0.45);
}

.validate-btn:disabled {
  cursor: default;
  opacity: 0.55;
  background: rgba(34, 197, 94, 0.10);
  border-color: rgba(34, 197, 94, 0.22);
}

.validate-btn:disabled:hover {
  background: rgba(34, 197, 94, 0.10);
}

.validate-label {
  line-height: 1;
}

.validate-price {
  display: flex;
  align-items: center;
  gap: 6px;
  line-height: 1;
  font-size: 19px;
}

.validate-cost {
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.clear-btn {
  padding: 0 12px;
  min-height: 36px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(226, 232, 240, 0.8);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.clear-btn:hover {
  background: rgba(255, 255, 255, 0.10);
  border-color: rgba(148, 163, 184, 0.4);
}

.validate-message-slot {
  min-height: 1.4em;
}

.validate-error {
  color: rgba(248, 113, 113, 0.95);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
}


.oracle-riddle {
  background: var(--panel-bg);
  border-radius: 8px;
  box-sizing: border-box;
  max-width: calc(100vw - 24px);
  padding: 14px 16px;
  margin-bottom: 6px;
}

.oracle-riddle-text {
  line-height: 1.6;
  color: rgba(148, 163, 184, 0.85);
  font-size: 16px;
  font-weight: 600;
}

.oracle-passed {
  background: var(--panel-bg);
  border-radius: 8px;
  padding: 14px 16px;
}

.oracle-passed-text {
  display: grid;
  place-items: center;
  min-height: 64px;
  border: 1px solid rgba(74, 222, 128, 0.22);
  border-radius: 4px;
  background: rgba(34, 197, 94, 0.08);
  color: rgba(220, 252, 231, 0.95);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.oracle-escape-hint {
  background: var(--panel-bg);
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 6px;
}

.oracle-escape-hint-text {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  color: rgba(148, 163, 184, 0.7);
}

.oracle-help-section {
  background: var(--panel-bg);
  border-radius: 8px;
  padding: 10px 16px;
  box-sizing: border-box;
  max-width: calc(100vw - 24px);
  text-align: right;
  cursor: default;
}

.oracle-help-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: rgba(148, 163, 184, 0.7);
  text-decoration: underline;
  text-decoration-style: dashed;
  text-underline-offset: 3px;
  text-decoration-color: rgba(148, 163, 184, 0.35);
}

.oracle-help-detail {
  display: none;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
  color: rgba(148, 163, 184, 0.55);
}

.oracle-help-section:hover .oracle-help-label {
  display: none;
}

.oracle-help-section:hover .oracle-help-detail {
  display: block;
  text-align: left;
}

@media (max-width: 480px) {
  .oracle-top-row {
    flex-direction: column;
  }

  .oracle-color-grid {
    grid-template-columns: repeat(6, 1fr);
  }
}
</style>
