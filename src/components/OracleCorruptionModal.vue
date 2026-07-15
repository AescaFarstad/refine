<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-backdrop" @click.self="close" @pointerdown.stop>
      <div class="modal" @pointerdown.stop @click.stop>
        <div class="modal-body">
          <p class="corruption-copy">
            You can reach inside the oracle and get a bonus:</p>
          <div v-if="bonuses.length > 0" class="bonus-row">
            <button
              v-for="bonus in bonuses"
              :key="bonus.id"
              type="button"
              class="corruption-box"
              :class="{ selected: selectedBonusId === bonus.id }"
              @click="selectBonus(bonus.id)"
            >
              <OracleBonusDisplay :bonus="bonus" />
              <span class="box-count">{{ getBonusRemainingCount(bonus.id) }} left</span>
            </button>
          </div>
          <div v-else class="corruption-empty">No bonuses available for this oracle.</div>

          <p class="corruption-copy corruption-warning">
            However this will defile it — the oracle will spread corruption whenever you move in the maze.
          </p>
          <p class="corruption-copy corruption-prompt">
            To stop the corruption, choose a challenge to complete:
          </p>

          <div v-if="challenges.length > 0" class="challenge-list">
            <button
              v-for="challenge in challenges"
              :key="challenge.id"
              type="button"
              class="corruption-option"
              :class="{ selected: selectedChallengeId === challenge.id }"
              @click="selectChallenge(challenge.id)"
            >
              <AchiItem :achi="challenge" :achi-version="uiState.achiVersion" expected-state="untracked" />
            </button>
          </div>
          <div v-else class="corruption-empty">No challenges available for this oracle.</div>
          <p class="corruption-copy corruption-warning">
            Warning: the challenges are <b>not</b> retroactive.
          </p>
          <p class="corruption-copy corruption-prompt">
            Completing the challenge will also reveal the order of this oracle in the illumination sequence.
          </p>
        </div>

        <footer class="modal-actions">
          <button class="btn" type="button" @click="close">Cancel</button>
          <button class="btn primary" type="button" :disabled="!canConfirm" @click="confirm">Confirm</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AchiItem from './AchiItem.vue';
import OracleBonusDisplay from './OracleBonusDisplay.vue';
import { getGameLib, getGameState, uiState } from '../logic/UIState';
import {
  canCorruptOracle,
  getOracleBonusUsedCount,
  isOracleCorruptionBonusEligible,
  isOracleCorruptionChallengeEligible,
} from '../logic/Oracle';
import type { OracleBonusDefinition } from '../logic/OracleBonusLib';
import type { AchiDefinition } from '../logic/AchiLib';
import { globalInputQueue } from '../logic/Model';
import { CmdCorruptOracle } from '../logic/input/InputCommands';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const selectedBonusId = ref<string | null>(null);
const selectedChallengeId = ref<string | null>(null);

const bonuses = computed<OracleBonusDefinition[]>(() => {
  uiState.mazeVersion;
  if (!props.visible) return [];
  const gs = getGameState();
  const nodeId = uiState.mazeVisitedOracleNodeId;
  return Array.from(getGameLib().oracleBonuses.values())
    .filter(bonus => isOracleCorruptionBonusEligible(gs, nodeId, bonus.id));
});

const challenges = computed<AchiDefinition[]>(() => {
  uiState.mazeVersion;
  uiState.achiVersion;
  if (!props.visible) return [];
  const gs = getGameState();
  const nodeId = uiState.mazeVisitedOracleNodeId;
  return Array.from(getGameLib().achi.items.values())
    .filter(achi => isOracleCorruptionChallengeEligible(gs, nodeId, achi.id))
    .sort((a, b) => a.order - b.order);
});

const canConfirm = computed(() => {
  uiState.mazeVersion;
  uiState.achiVersion;
  if (selectedBonusId.value === null || selectedChallengeId.value === null) return false;
  return canCorruptOracle(
    getGameState(),
    uiState.mazeVisitedOracleNodeId,
    selectedBonusId.value,
    selectedChallengeId.value,
  );
});

function selectBonus(id: string): void {
  selectedBonusId.value = id;
}

function selectChallenge(id: string): void {
  selectedChallengeId.value = id;
}

function getBonusRemainingCount(id: string): number {
  const bonus = getGameLib().oracleBonuses.get(id)!;
  return bonus.count - getOracleBonusUsedCount(getGameState(), id);
}

function confirm(): void {
  if (!canConfirm.value) return;
  globalInputQueue.push(new CmdCorruptOracle({
    nodeId: uiState.mazeVisitedOracleNodeId,
    bonusId: selectedBonusId.value!,
    challengeAchiId: selectedChallengeId.value!,
  }));
  close();
}

function close(): void {
  emit('close');
}

// Clear selections whenever the modal is dismissed so it reopens fresh.
watch(() => props.visible, (isVisible) => {
  if (!isVisible) {
    selectedBonusId.value = null;
    selectedChallengeId.value = null;
  }
});

watch([bonuses, challenges], () => {
  if (selectedBonusId.value !== null && !bonuses.value.some(bonus => bonus.id === selectedBonusId.value)) {
    selectedBonusId.value = null;
  }
  if (selectedChallengeId.value !== null && !challenges.value.some(challenge => challenge.id === selectedChallengeId.value)) {
    selectedChallengeId.value = null;
  }
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: grid;
  place-items: center;
  z-index: 10000;
  pointer-events: auto;
}

.modal {
  width: 760px;
  max-width: 96vw;
  background: linear-gradient(180deg, rgba(20, 28, 40, 0.98), rgba(10, 15, 26, 0.94));
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7), inset 0 1px 0 var(--panel-shine);
  padding: 16px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 16px;
  max-height: 90vh;
  pointer-events: auto;
}

.modal-title {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: rgba(226, 232, 240, 0.95);
}

.modal-body {
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.corruption-copy {
  margin: 0;
  color: rgba(203, 213, 225, 0.85);
  font-size: 14px;
  line-height: 1.4;
}

.corruption-warning {
  color: rgba(248, 180, 180, 0.85);
}

.corruption-prompt {
  margin-top: 6px;
}

.corruption-section-label {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: rgba(226, 232, 240, 0.9);
}

.corruption-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.bonus-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
  overflow: hidden;
}

.corruption-box {
  box-sizing: border-box;
  flex: 1 0 0;
  min-width: 0;
  min-height: 56px;
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  text-align: left;
  cursor: pointer;
  border: none;
  border-radius: 4px;
  padding: 18px 10px 12px;
  background: var(--raid-item-bg, rgba(255, 255, 255, 0.08));
  color: rgba(226, 232, 240, 0.92);
  font-size: 13px;
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
}

.corruption-box:hover {
  background: var(--raid-item-bg-hover, rgba(255, 255, 255, 0.14));
}

.corruption-box.selected {
  background: rgba(74, 222, 128, 0.25);
}

.box-count {
  position: absolute;
  top: 0;
  right: 0;
  padding: 3px 6px;
  border-bottom-left-radius: 6px;
  border-top-right-radius: 4px;
  background: rgba(96, 165, 250, 0.3);
  color: var(--text-primary);
  font-size: 12px;
  line-height: 1;
  font-weight: 900;
}

/* Selectable wrapper around the reused AchiItem display. */
.challenge-list {
  display: grid;
  grid-template-columns: repeat(2, max-content);
  gap: 8px;
  width: max-content;
  max-width: 100%;
  align-self: center;
  justify-content: center;
}

.corruption-option {
  box-sizing: border-box;
  width: auto;
  justify-self: stretch;
  padding: 0;
  text-align: left;
  cursor: pointer;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 8px;
  background: transparent;
  overflow: hidden;
}

.corruption-option :deep(.achi-item),
.corruption-option :deep(.achi-item-preview),
.corruption-option :deep(.achi-pay-preview) {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
}

.corruption-option :deep(.achi-content) {
  width: max-content;
  min-width: 0;
  white-space: nowrap;
}

.corruption-option :deep(.achi-description) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.corruption-option:hover {
  border-color: rgba(148, 163, 184, 0.55);
}

.corruption-option.selected {
  border-color: rgba(79, 209, 197, 0.75);
  box-shadow: inset 0 0 0 1px rgba(79, 209, 197, 0.4);
}

.corruption-empty {
  color: rgba(148, 163, 184, 0.6);
  font-size: 13px;
  font-style: italic;
  padding: 4px 0;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  cursor: pointer;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 6px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
  font-weight: 700;
  letter-spacing: 0.02em;
}

.btn.primary {
  background: rgba(79, 209, 197, 0.14);
  border-color: rgba(79, 209, 197, 0.45);
}

.btn:hover {
  filter: brightness(1.08);
}

.btn:disabled {
  cursor: default;
  opacity: 0.4;
}

.btn:disabled:hover {
  filter: none;
}
</style>
