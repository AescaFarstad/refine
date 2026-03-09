<template>
  <div v-if="visible" class="maze-oracle-menu" @click.stop>
    <div class="oracle-panel">
      <div class="oracle-header">ORACLE</div>

      <div v-if="oracleState === 'riddling'" class="oracle-body">
        <div ref="oracleTopRowRef" class="oracle-top-row">
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

            <div v-if="sealFailed" class="validate-error">The seal did not fit</div>
            <div v-else-if="!canValidateSeal" class="validate-hint">
              Need {{ ORACLE_VALIDATE_COST }} chronotraces
            </div>
          </div>
        </div>

        <div class="oracle-riddle" :style="oracleRiddleStyle">
          <div class="oracle-riddle-text">{{ currentOracleRiddle }}</div>
        </div>
      </div>

      <div v-else-if="oracleState === 'riddlePassed'" class="oracle-body">
        <div class="oracle-riddle" :style="oracleRiddleStyle">
          <div class="oracle-riddle-text">{{ currentOracleRiddle }}</div>
        </div>
        <div class="oracle-passed">
          <div class="oracle-passed-text">Accepted.</div>
        </div>
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
  type OracleSealCellColors,
} from '../logic/Oracle';
import { ESSENCE_COLORS } from '../logic/RenderConstants';
import { getResourceSpec } from '../logic/Resources';
import { getGameState, uiState } from '../logic/UIState';
import { CmdMazeValidateOracleSeal } from '../logic/input/InputCommands';

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
const oracleTopRowWidth = ref(0);
const chronotracesSpec = getResourceSpec('chronotraces');

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

const canValidateSeal = computed(() => {
  uiState.chronotraces;
  return uiState.chronotraces >= ORACLE_VALIDATE_COST && oracleState.value === 'riddling';
});

const sealFailed = computed(() => mismatchMarkerKeys.value.length > 0);
const oracleRiddleStyle = computed(() => {
  if (oracleTopRowWidth.value > 0) {
    return {
      width: `${oracleTopRowWidth.value}px`,
    };
  }

  return {};
});

watch(() => uiState.mazeVisitedOracleNodeId, clearSeal, { flush: 'sync' });
watch([oracleState, () => uiState.mazeVisitedOracleNodeId], async () => {
  await nextTick();
  bindOracleTopRowObserver();
}, { flush: 'post', immediate: true });

let oracleTopRowObserver: ResizeObserver | null = null;

function toggleSealCell(key: string) {
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
  uiState.mazeOracleSealMismatchMarkerKeys = [];
  uiState.mazeOracleSealCellColors = {};
}

function onValidateSeal() {
  const node = currentOracleNode.value;
  if (!node || !canValidateSeal.value) return;

  const evaluation = evaluateOracleSeal(getGameState(), node.nodeId, uiState.mazeOracleSealCellColors);
  uiState.mazeOracleSealMismatchMarkerKeys = evaluation.success
    ? []
    : [...evaluation.fit.wrongColorCellKeys, ...evaluation.fit.extraLitCellKeys];

  globalInputQueue.push(new CmdMazeValidateOracleSeal({
    nodeId: node.nodeId,
    cellColors: compactOracleSealColors(uiState.mazeOracleSealCellColors),
  }));
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

onUnmounted(() => {
  oracleTopRowObserver?.disconnect();
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
  border: none;
  border-radius: 4px;
  color: rgba(226, 232, 240, 0.95);
  padding: 0;
  max-width: calc(100vw - 24px);
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

.validate-error {
  color: rgba(248, 113, 113, 0.95);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
}

.validate-hint {
  color: rgba(248, 113, 113, 0.7);
  font-size: 11px;
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

@media (max-width: 480px) {
  .oracle-top-row {
    flex-direction: column;
  }

  .oracle-color-grid {
    grid-template-columns: repeat(6, 1fr);
  }
}
</style>
