<template>
  <div v-if="visible" class="maze-nexus-menu">
    <div class="nexus-panel">
      <div v-if="canAccessNexus" class="nexus-header">MAZE NEXUS <span class="nexus-header-sep">-</span> Drag upgrades onto the maze:</div>
      <div v-else class="nexus-header nexus-header-locked">
        <div class="nexus-locked-title">NEXUS</div>
        <button class="btn primary nexus-locked-message-btn" type="button" @click="goToRefineTab">
          Fail items refinement at least once to access the Nexus
        </button>
      </div>
      <div v-if="canAccessNexus" class="nexus-items" :class="{ 'nexus-items-two-col': availableItems.length > 6 }">
        <template v-for="entry in availableItems" :key="`${entry.id}:${entry.rotationStep}`">
          <MazeNexusMenuItem
            v-if="entry.item.specialAction === ''"
            :id="entry.id"
            :item="entry.item"
            :rotation-step="entry.rotationStep"
            :price="entry.price"
            :can-afford="canAffordEntry(entry)"
            :show-new-banner="entry.showNewBanner"
            mode="drag"
            @drag-start="onItemDragStart(entry, $event)"
          />
          <MazeNexusMenuItem
            v-else
            :id="entry.id"
            :item="entry.item"
            :rotation-step="entry.rotationStep"
            :price="entry.price"
            :can-afford="canAffordEntry(entry)"
            :show-new-banner="entry.showNewBanner"
            mode="select"
            @select="openSpecialUpgrade(entry)"
          />
        </template>

        <div v-if="showAddUpgradeAction" class="nexus-add-upgrade" @click="openUpgradeSelection">
          Add an upgrade
        </div>
      </div>
    </div>
  </div>
  <MazeNexusUpgradeModal
    :visible="upgradeModalVisible"
    :choices="offerChoices"
    @select="selectUpgrade"
    @postpone="postponeUpgradeSelection"
  />
  <RefundResetRegretModal
    :visible="refundResetRegretModalVisible"
    @proceed="proceedSpecialUpgrade"
    @postpone="postponeSpecialUpgrade"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { NexusItemDefinition } from '../logic/NexusLib';
import { startMazeManualDrag } from '../logic/MazeNexusDnd';
import type { DeepReadonly } from '../logic/UIState';
import { getGameState, uiState } from '../logic/UIState';
import { DISCOVERY } from '../logic/DiscoveryLib';
import { globalInputQueue } from '../logic/Model';
import {
  CmdMazeActivateNexusSpecialUpgrade,
  CmdMazePrepareUpgradeOffer,
  CmdMazeSelectNexusUpgrade,
  CmdSwitchTab,
} from '../logic/input/InputCommands';
import {
  getMazeNexusItemPlacementRotationStep,
} from '../logic/Maze';
import {
  canChooseMazeNexusUpgrade,
  getMazeNexusUpgradeChoicesFromSeed,
  MAZE_NEXUS_NO_UPGRADE_OFFER_SEED,
  willPlacementGrantMazeNexusUpgradeOpportunity,
} from '../logic/MazeNexusUpgradeProgress';
import MazeNexusMenuItem from './MazeNexusMenuItem.vue';
import MazeNexusUpgradeModal from './MazeNexusUpgradeModal.vue';
import RefundResetRegretModal from './RefundResetRegretModal.vue';

defineProps<{
  visible: boolean;
}>();

type UINexusItem = DeepReadonly<NexusItemDefinition>;
type UINexusMenuEntry = {
  id: string;
  item: UINexusItem;
  rotationStep: number;
  price: number;
  showNewBanner: boolean;
};

const selectionModalOpen = ref(false);
const refundResetRegretModalVisible = ref(false);
const selectedSpecialUpgradeId = ref('');

const canAccessNexus = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.discoveryCounter;
  return getGameState().discoveries[DISCOVERY.REFINEMENT_FAILED] === true;
});

const availableItems = computed<UINexusMenuEntry[]>(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.lib;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.mazeVersion;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.mazeNexusAvailableUpgradeIds;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.mazeNexusPlacedUpgradeIds;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.mazeNexusUpgradeOpportunityCount;

  const gs = getGameState();
  return gs.mazeNexusAvailableUpgradeIds.map((id): UINexusMenuEntry => ({
    id,
    item: gs.lib.nexusItems.get(id)!,
    rotationStep: getMazeNexusItemPlacementRotationStep(gs, id),
    price: gs.lib.nexusItems.get(id)!.price,
    showNewBanner: willPlacementGrantMazeNexusUpgradeOpportunity(gs, id),
  }));
});

const offerChoices = computed<UINexusMenuEntry[]>(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.lib;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.mazeVersion;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.mazeNexusAvailableUpgradeIds;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.mazeNexusUpgradeOpportunityCount;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.mazeNexusUpgradeOfferSeed;

  const gs = getGameState();
  const offerSeed = gs.mazeNexusUpgradeOfferSeed;
  if (offerSeed === MAZE_NEXUS_NO_UPGRADE_OFFER_SEED) return [];

  return getMazeNexusUpgradeChoicesFromSeed(gs, offerSeed).map((id): UINexusMenuEntry => ({
    id,
    item: gs.lib.nexusItems.get(id)!,
    rotationStep: getMazeNexusItemPlacementRotationStep(gs, id),
    price: gs.lib.nexusItems.get(id)!.price,
    showNewBanner: false,
  }));
});

const canOfferNextUpgrade = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.lib;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.mazeVersion;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.mazeNexusAvailableUpgradeIds;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.mazeNexusUpgradeOpportunityCount;

  const gs = getGameState();
  return canChooseMazeNexusUpgrade(gs);
});

const showAddUpgradeAction = computed(() => canAccessNexus.value && canOfferNextUpgrade.value);

const upgradeModalVisible = computed(() => {
  return selectionModalOpen.value && offerChoices.value.length > 0;
});

watch(showAddUpgradeAction, (showAdd) => {
  if (!showAdd) {
    selectionModalOpen.value = false;
  }
});

function canAffordEntry(entry: UINexusMenuEntry): boolean {
  if (entry.item.specialAction === 'time_singularity') {
    return uiState.chronotraces >= entry.price;
  }
  return uiState.timeFlux >= entry.price;
}

function onItemDragStart(entry: UINexusMenuEntry, event: PointerEvent): void {
  if (!canAccessNexus.value) return;
  if (!entry.item.placable) return;
  if (!canAffordEntry(entry)) return;
  startMazeManualDrag({ id: entry.id, rotationStep: entry.rotationStep }, event);
}

function openSpecialUpgrade(entry: UINexusMenuEntry): void {
  if (!canAccessNexus.value) return;
  if (!canAffordEntry(entry)) return;
  if (entry.item.specialAction === 'refund_reset_regret') {
    selectedSpecialUpgradeId.value = entry.id;
    refundResetRegretModalVisible.value = true;
    return;
  }
  if (entry.item.specialAction === 'time_singularity') {
    globalInputQueue.push(new CmdMazeActivateNexusSpecialUpgrade({ nexusItemId: entry.id }));
    return;
  }
  throw new Error(`Unsupported nexus special action: ${entry.item.specialAction}`);
}

function proceedSpecialUpgrade(): void {
  if (!selectedSpecialUpgradeId.value) return;
  globalInputQueue.push(new CmdMazeActivateNexusSpecialUpgrade({ nexusItemId: selectedSpecialUpgradeId.value }));
  selectedSpecialUpgradeId.value = '';
  refundResetRegretModalVisible.value = false;
}

function postponeSpecialUpgrade(): void {
  selectedSpecialUpgradeId.value = '';
  refundResetRegretModalVisible.value = false;
}

function openUpgradeSelection(): void {
  if (!canAccessNexus.value) return;
  if (!canOfferNextUpgrade.value) return;
  globalInputQueue.push(new CmdMazePrepareUpgradeOffer());
  selectionModalOpen.value = true;
}

function selectUpgrade(nexusItemId: string): void {
  globalInputQueue.push(new CmdMazeSelectNexusUpgrade({ nexusItemId }));
  selectionModalOpen.value = false;
}

function postponeUpgradeSelection(): void {
  selectionModalOpen.value = false;
}

function goToRefineTab(): void {
  globalInputQueue.push(new CmdSwitchTab({ tab: 'refine' }));
}
</script>

<style scoped>
.maze-nexus-menu {
  position: absolute;
  right: 12px;
  top: 12px;
  z-index: 14;
  pointer-events: auto;
}

.nexus-panel {
  border: none;
  border-radius: 4px;
  color: rgba(226, 232, 240, 0.95);
  padding: 0;
  min-width: 320px;
}

.nexus-header {
  font-size: 14px;
  letter-spacing: 0.04em;
  color: rgba(226, 232, 240, 0.95);
  background: var(--panel-bg);
  border-radius: 8px;
  padding: 10px 16px;
  margin-bottom: 6px;
}

.nexus-header-sep {
  color: rgba(226, 232, 240, 0.4);
  margin: 0 2px;
}

.nexus-header-locked {
  color: rgba(248, 113, 113, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}

.nexus-locked-title {
  font-size: 22px;
  letter-spacing: 0.08em;
  font-weight: 600;
  line-height: 1;
  color: rgba(226, 232, 240, 0.95);
}

.btn {
  padding: 10px 14px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-radius: 4px;
  border: 1px solid var(--panel-border);
  cursor: pointer;
  background: rgba(255, 255, 255, 0.03);
  color: inherit;
}

.btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

.btn.primary {
  background: rgba(79, 209, 197, 0.14);
  color: var(--accent);
}

.btn.primary:hover {
  background: rgba(79, 209, 197, 0.22);
}

.nexus-locked-message-btn {
  max-width: 100%;
  text-align: center;
}

.nexus-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nexus-items-two-col {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.nexus-add-upgrade {
  display: grid;
  place-items: center;
  min-height: 76px;
  border-radius: 8px;
  background: var(--panel-bg);
  border: 1px dashed rgba(226, 232, 240, 0.25);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.nexus-add-upgrade:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(79, 209, 197, 0.6);
}
</style>
