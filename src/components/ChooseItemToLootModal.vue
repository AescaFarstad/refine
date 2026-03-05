<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-backdrop" @click.self="cancel">
      <div class="modal">
        <header class="modal-header">
          <h3 class="modal-title">Materialization</h3>
          <div class="modal-subtitle">Choose one known raid item to claim at the start of this raid.</div>
          <div class="header-bars">
            <div class="bar-panel bags-bar" :style="{ '--bar-pct': bagsBarPct + '%' }">
              <div class="bar-label">
                {{ freeVolumeAfter }} / {{ bagsCapacity }} free volume
                <span v-if="overflowVolume > 0" class="bar-overflow"> (overflow {{ overflowVolume }})</span>
              </div>
            </div>
          </div>
        </header>

        <div class="items-grid-wrap">
          <ItemGrid
            :items="knownItems"
            :clickable="true"
            :show-volumes="true"
            :highlight-ids="highlightIds"
            @item-click="selectItem"
          />
        </div>

        <footer class="modal-actions">
          <button class="btn primary" type="button" :disabled="!canProceed" @click="proceed">Proceed</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import { getGameState, uiState } from '../logic/UIState';
import ItemGrid from './ItemGrid.vue';
import { globalInputQueue } from '../logic/Model';
import { CmdStartRaid } from '../logic/input/InputCommands';
import { clearChooseItemToLootModalState } from '../logic/startRaidWithPerkFlow';

const visible = computed(() => uiState.chooseItemToLootModalOpen);

const selectedItemId = computed({
  get: () => uiState.chooseItemToLootSelectedItemId,
  set: (value: string) => {
    uiState.chooseItemToLootSelectedItemId = value;
  },
});

const knownItems = computed(() => {
  const gs = getGameState();
  const ids = [...uiState.chooseItemToLootKnownItemIds];
  ids.sort((a, b) => {
    const ao = gs.lib.getItem(a).order;
    const bo = gs.lib.getItem(b).order;
    if (ao !== bo) return ao - bo;
    return a.localeCompare(b);
  });
  return ids.map(id => ({ id, quantity: 1 }));
});

const highlightIds = computed<Record<string, boolean>>(() => (selectedItemId.value ? { [selectedItemId.value]: true } : {}));

const bagsCapacity = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.raidKey;
  return Math.max(0, getGameState().raid.bagsVolume);
});

const bagsUsedBefore = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.raidKey;
  return Math.max(0, getGameState().raid.usedVolume);
});

const selectedItemVolume = computed(() => {
  const id = selectedItemId.value;
  if (!id) return 0;
  return getGameState().lib.getItem(id).volume;
});
const canProceed = computed(() => !!selectedItemId.value);

const bagsUsedAfter = computed(() => bagsUsedBefore.value + selectedItemVolume.value);
const freeVolumeAfter = computed(() => Math.max(0, bagsCapacity.value - bagsUsedAfter.value));
const overflowVolume = computed(() => Math.max(0, bagsUsedAfter.value - bagsCapacity.value));
const bagsBarPct = computed(() => {
  if (bagsCapacity.value <= 0) return 0;
  return Math.min(100, (freeVolumeAfter.value / bagsCapacity.value) * 100);
});

function selectItem(id: string) {
  selectedItemId.value = id;
}

function proceed() {
  const raidId = uiState.chooseItemToLootRaidId;
  const itemId = selectedItemId.value;
  if (!itemId) return;
  clearChooseItemToLootModalState();
  globalInputQueue.push(new CmdStartRaid({ id: raidId, materializationItemId: itemId }));
}

function cancel() {
  clearChooseItemToLootModalState();
}

watch(
  knownItems,
  (items) => {
    if (selectedItemId.value && !items.some(it => it.id === selectedItemId.value)) selectedItemId.value = '';
  },
  { immediate: true }
);

watch(visible, (next) => {
  document.body.style.overflow = next ? 'hidden' : '';
});

onBeforeUnmount(() => {
  document.body.style.overflow = '';
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.62);
  display: grid;
  place-items: center;
  z-index: 11000;
}

.modal {
  width: 900px;
  max-width: 96vw;
  max-height: 90vh;
  overflow: auto;
  background: linear-gradient(180deg, rgba(20, 28, 40, 0.98), rgba(10, 15, 26, 0.94));
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7), inset 0 1px 0 var(--panel-shine);
  padding: 14px;
  display: grid;
  gap: 12px;
}

.modal-header {
  display: grid;
  gap: 8px;
}

.modal-title {
  margin: 0;
  font-size: 20px;
  letter-spacing: 0.03em;
}

.modal-subtitle {
  color: var(--text-secondary);
  font-size: 13px;
}

.header-bars {
  display: flex;
  gap: 12px;
}

.bar-panel {
  position: relative;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  width: 280px;
  max-width: 100%;
  min-width: 140px;
  overflow: hidden;
}

.bar-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  width: var(--bar-pct, 0%);
  border-radius: 5px;
  background: rgba(246, 173, 85, 0.45);
  transition: width 0.15s ease-out;
}

.bar-label {
  position: relative;
  z-index: 1;
  font-size: 12px;
  font-weight: 600;
  opacity: 0.95;
}

.bar-overflow {
  color: #fecaca;
}

.items-grid-wrap {
  min-height: 120px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
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

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
