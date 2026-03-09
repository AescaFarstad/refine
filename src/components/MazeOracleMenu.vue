<template>
  <div v-if="visible" class="maze-oracle-menu" @click.stop>
    <div class="oracle-panel">
      <div class="oracle-header">ORACLE</div>

      <div v-if="oracleState === 'riddling'" class="oracle-body">
        <div class="oracle-riddle">
          <div class="section-label">Riddle</div>
          <div class="oracle-riddle-text">{{ currentOracleRiddle }}</div>
        </div>

        <div class="oracle-seal">
          <div class="section-label">Seal</div>
          <OracleWafer
            :cell-colors="sealColors"
            :marker-keys="mismatchMarkerKeys"
            @toggle-cell="toggleSealCell"
          />
        </div>

        <div class="oracle-controls">
          <div class="section-label">Essence</div>
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
            <span>Validate seal</span>
            <span class="validate-price">{{ ORACLE_VALIDATE_COST }} chronotraces</span>
          </button>

          <div v-if="!canValidateSeal" class="validate-hint">
            Need {{ ORACLE_VALIDATE_COST }} chronotraces
          </div>
        </div>
      </div>

      <div v-else-if="oracleState === 'riddlePassed'" class="oracle-body oracle-body-passed">
        <div class="oracle-riddle">
          <div class="section-label">Riddle</div>
          <div class="oracle-riddle-text">{{ currentOracleRiddle }}</div>
        </div>

        <div class="oracle-passed">
          <div class="section-label">Seal</div>
          <div class="oracle-passed-text">Accepted.</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
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

watch(() => uiState.mazeVisitedOracleNodeId, clearSeal, { flush: 'sync' });

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
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.97), rgba(8, 12, 22, 0.96));
  color: rgba(226, 232, 240, 0.95);
  padding: 0;
  width: max-content;
  max-width: calc(100vw - 24px);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.38);
}

.oracle-header {
  font-size: 14px;
  letter-spacing: 0.06em;
  color: rgba(226, 232, 240, 0.96);
  background: rgba(15, 23, 42, 0.9);
  border-radius: 8px 8px 0 0;
  padding: 10px 16px;
}

.oracle-body {
  display: flex;
  flex-direction: row;
  align-items: start;
  gap: 16px;
  padding: 16px;
  min-width: 760px;
}

.oracle-riddle {
  flex: 0 0 250px;
}

.section-label {
  margin-bottom: 8px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(148, 163, 184, 0.9);
}

.oracle-riddle-text {
  min-height: 220px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.72);
  padding: 12px;
  line-height: 1.5;
  color: rgba(241, 245, 249, 0.97);
  white-space: pre-wrap;
}

.oracle-seal {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 0 0 auto;
}

.oracle-controls {
  display: grid;
  gap: 12px;
  align-content: start;
  flex: 0 0 120px;
}

.oracle-color-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.color-btn {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--oracle-color) 58%, rgba(248, 250, 252, 0.32));
  border-radius: 4px;
  background:
    radial-gradient(circle at 30% 28%, rgba(255, 255, 255, 0.22), transparent 42%),
    linear-gradient(180deg, color-mix(in srgb, var(--oracle-color) 44%, rgba(15, 23, 42, 0.94)), color-mix(in srgb, var(--oracle-color) 72%, rgba(15, 23, 42, 0.98)));
  cursor: pointer;
  transition: transform 120ms ease, border-color 120ms ease, background 120ms ease, box-shadow 120ms ease;
}

.color-btn:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--oracle-color) 78%, rgba(255, 255, 255, 0.75));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--oracle-color) 28%, transparent), 0 0 14px color-mix(in srgb, var(--oracle-color) 30%, transparent);
}

.color-btn.active {
  border-color: color-mix(in srgb, var(--oracle-color) 82%, rgba(255, 255, 255, 0.9));
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--oracle-color) 48%, rgba(255, 255, 255, 0.22)),
    0 0 18px color-mix(in srgb, var(--oracle-color) 34%, transparent);
}

.color-btn-core {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.32),
    0 0 10px color-mix(in srgb, var(--oracle-color) 46%, transparent);
}

.validate-btn {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  min-height: 56px;
  padding: 10px 12px;
  border: 1px solid rgba(245, 158, 11, 0.42);
  border-radius: 4px;
  background: linear-gradient(180deg, rgba(120, 53, 15, 0.94), rgba(92, 38, 7, 0.98));
  color: rgba(255, 247, 237, 0.98);
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-align: left;
}

.validate-btn:disabled {
  opacity: 0.56;
  cursor: not-allowed;
}

.validate-price {
  color: rgba(253, 230, 138, 0.95);
  font-size: 11px;
}

.validate-hint {
  color: rgba(248, 113, 113, 0.95);
  font-size: 11px;
  line-height: 1.4;
}

.oracle-body-passed {
  align-items: stretch;
}

.oracle-passed {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 180px;
}

.oracle-passed-text {
  display: grid;
  place-items: center;
  min-height: 96px;
  border: 1px solid rgba(74, 222, 128, 0.28);
  border-radius: 4px;
  background: linear-gradient(180deg, rgba(20, 83, 45, 0.28), rgba(8, 47, 73, 0.32));
  color: rgba(220, 252, 231, 0.98);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

@media (max-width: 760px) {
  .oracle-body {
    min-width: 0;
    flex-direction: column;
  }

  .oracle-riddle-text {
    min-height: 0;
  }

  .oracle-seal {
    align-items: flex-start;
  }

  .oracle-controls {
    flex: 0 0 auto;
  }

  .oracle-passed {
    min-width: 0;
  }
}
</style>
