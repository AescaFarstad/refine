<template>
  <div class="oracle-header">ORACLE</div>
  <div class="oracle-activated-stage">
    <div class="oracle-activated-copy">
      <p>
        The oracle is activated
        <span class="oracle-inline-sprite" :style="activatedOracleSpriteStyle" /> and
        can be used to break out of the time loop.
      </p>
      <p>For that you need to illuminate all the oracles in the correct order.</p>
      <p>
        You have discovered {{ discoveredOracles }} / {{ oraclesTotal }}
        <span class="oracle-inline-sprite" :style="closedOracleSpriteStyle" />
      </p>
      <p>
        You have activated {{ activatedOracles }} / {{ oraclesTotal }}
        <span class="oracle-inline-sprite" :style="closedOracleSpriteStyle" />
      </p>
      <p>
        You have currently illuminated {{ illuminatedOracles }} / {{ oraclesTotal }}
        <span class="oracle-inline-sprite oracle-illuminated-sprite" :style="activatedOracleSpriteStyle" />
      </p>
    </div>

    <div class="oracle-illumination-control">
      <div class="oracle-illumination-buttons">
        <button type="button" class="oracle-illuminate-btn" :disabled="isIlluminated" @click="toggleIllumination">
          Illuminate
        </button>
        <button type="button" class="oracle-illuminate-btn" :disabled="!isIlluminated" @click="toggleIllumination">
          Dim
        </button>
      </div>
      <div v-if="!isIlluminated" class="oracle-illumination-sequence-hint">
        This will place it #{{ nextIlluminationSequencePosition }} in the illumination sequence.
      </div>
      <div v-if="isCompleteAndIncorrect" class="oracle-illumination-sequence-hint oracle-illumination-error">
        The illumination sequence is complete, but it is incorrect
      </div>
    </div>

    <button v-if="!corruptionState" type="button" class="oracle-learn-more-btn" :class="learnMoreButtonClass" @click="openCorruptionModal">
      Try to learn more from the oracle
    </button>

    <template v-else>
      <div class="oracle-bonus-state">
        <OracleBonusDisplay :bonus="corruptionBonus" />
      </div>
      <div class="oracle-corruption-state" :class="{ cleansed: !corruptionState.corrupted }">
        <span class="oracle-corruption-status">{{ corruptionStatusText }}</span>
        <AchiItem
          v-if="showCorruptionChallenge"
          :achi="corruptionChallenge"
          :achi-version="uiState.achiVersion"
          expected-state="tracked"
        />
        <div v-if="!corruptionState.corrupted" class="oracle-illumination-order">
          Illumination order: #{{ illuminationOrderPosition }} / {{ oraclesTotal }}
        </div>
      </div>
    </template>
  </div>

  <OracleCorruptionModal
    :visible="corruptionModalVisible"
    @close="closeCorruptionModal"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import AchiItem from './AchiItem.vue';
import OracleCorruptionModal from './OracleCorruptionModal.vue';
import OracleBonusDisplay from './OracleBonusDisplay.vue';
import { getGameLib, getGameState, uiState } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdMazeToggleOracleIllumination } from '../logic/input/InputCommands';
import { getOracleId, getOracleLevel, getOracleProgressAtNode } from '../logic/Oracle';
import { getOwnedMazeOracles } from '../logic/Maze';
import atlasStorage from '../logic/AtlasStorage';
import { atlasSpriteStyle } from '../logic/AtlasSpriteStyle';
import { ACHI_STATE_ACKNOWLEDGED } from '../logic/Achi';

function oracleSpriteStyle(imageKey: string): Record<string, string> {
  return atlasSpriteStyle(
    atlasStorage.getItemsSource(),
    atlasStorage.getItemsFrame(imageKey)!,
    { size: 22, mode: 'fit', allowUpscale: false },
  );
}

const activatedOracleSpriteStyle = oracleSpriteStyle('tetrahedron_strict');
const closedOracleSpriteStyle = oracleSpriteStyle('tetrahedron_inv');
const corruptionModalVisible = ref(false);

const oraclesTotal = computed(() => {
  uiState.mazeVersion;
  return Object.keys(getGameState().mazeOracleByOracleId).length;
});

const discoveredOracles = computed(() => {
  uiState.mazeVersion;
  return getOwnedMazeOracles(getGameState()).length;
});

const activatedOracles = computed(() => {
  uiState.mazeVersion;
  return Object.values(getGameState().mazeOracleByOracleId).filter(oracle => oracle.state === 'riddlePassed').length;
});

const illuminatedOracles = computed(() => {
  uiState.mazeVersion;
  return getGameState().maze.illuminatedOracleIds.length;
});

const currentOracleId = computed(() => getOracleId(getGameState(), uiState.mazeVisitedOracleNodeId));
const currentOracleLevel = computed(() => {
  uiState.mazeVersion;
  return getOracleLevel(getGameState(), uiState.mazeVisitedOracleNodeId);
});
const isIlluminated = computed(() => {
  uiState.mazeVersion;
  return getGameState().maze.illuminatedOracleIds.includes(currentOracleId.value);
});
const nextIlluminationSequencePosition = computed(() => {
  uiState.mazeVersion;
  return getGameState().maze.illuminatedOracleIds.length + 1;
});
const isCompleteAndIncorrect = computed(() => {
  uiState.mazeVersion;
  const gs = getGameState();
  return gs.maze.illuminatedOracleIds.length === gs.mazeOracleIlluminationSolution.length
    && gs.maze.illuminatedOracleIds.some((id, index) => id !== gs.mazeOracleIlluminationSolution[index]);
});
const learnMoreButtonClass = computed(() => `oracle-learn-more-btn-level-${currentOracleLevel.value}`);
const corruptionState = computed(() => {
  uiState.mazeVersion;
  uiState.achiVersion;
  return getOracleProgressAtNode(getGameState(), uiState.mazeVisitedOracleNodeId).corruption;
});
const corruptionBonus = computed(() => getGameLib().oracleBonuses.get(corruptionState.value!.bonusId)!);
const corruptionChallenge = computed(() => getGameLib().achi.items.get(corruptionState.value!.challengeAchiId)!);
const corruptionChallengeState = computed(() => getGameState().achi[corruptionState.value!.challengeAchiId]);
const showCorruptionChallenge = computed(() => corruptionChallengeState.value?.state !== ACHI_STATE_ACKNOWLEDGED);
const corruptionStatusText = computed(() => corruptionState.value!.corrupted ? 'Corrupted' : 'Cleansed');
const illuminationOrderPosition = computed(() => {
  uiState.mazeVersion;
  return getGameState().mazeOracleIlluminationSolution.indexOf(currentOracleId.value) + 1;
});

function toggleIllumination(): void {
  globalInputQueue.push(new CmdMazeToggleOracleIllumination({ nodeId: uiState.mazeVisitedOracleNodeId }));
}

function openCorruptionModal(): void {
  corruptionModalVisible.value = true;
}

function closeCorruptionModal(): void {
  corruptionModalVisible.value = false;
}
</script>
