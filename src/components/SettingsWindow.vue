<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-backdrop" @click.self="close">
      <div class="modal">
        <div class="modal-body">
          <textarea
            v-model="jsonSave"
            class="save-input"
            spellcheck="false"
            placeholder="JSON save appears here. Paste JSON here to import."
          />
          <div class="row-actions">
            <button class="action-btn" type="button" @click="exportJson">Export save as JSON</button>
            <button class="action-btn" type="button" @click="importJson">Import save from JSON</button>
          </div>

          <div class="row-actions">
            <button class="action-btn" type="button" @click="exportBase64">Export save as base64</button>
            <button class="action-btn" type="button" @click="importBase64">Import save from base64</button>
          </div>

          <div class="row-actions">
            <button
              class="action-btn wipe-save-btn"
              type="button"
              :style="wipeButtonStyle"
              :disabled="wipingInProgress"
              @pointerdown.prevent="startWipeHold"
              @pointerup="cancelWipeHold"
              @pointerleave="cancelWipeHold"
              @pointercancel="cancelWipeHold"
            >
              Hold 1s to wipe the save (can't be undone)
            </button>
          </div>

          <div v-if="showTestSaveLoadButton" class="row-actions">
            <button class="action-btn" type="button" @click="runTestSaveLoad">TestSaveLoad</button>
          </div>

          <div v-if="showTestSaveLoadButton" class="dev-slot-grid">
            <div
              v-for="slotIndex in devSlotIndices"
              :key="slotIndex"
              class="dev-slot-column"
            >
              <p class="dev-slot-title">Slot {{ slotIndex + 1 }}</p>
              <button class="action-btn slot-btn" type="button" @click="saveDevSlot(slotIndex)">Save</button>
              <button class="action-btn slot-btn" type="button" @click="loadDevSlot(slotIndex)">Load</button>
              <button class="action-btn slot-btn" type="button" @click="compareDevSlot(slotIndex)">Compare</button>
            </div>
          </div>

          <SaveDiffVisualizer
            v-if="diffMismatch"
            :mismatch="diffMismatch"
            :left-label="diffLeftLabel"
            :right-label="diffRightLabel"
          >
            <template #actions>
              <div class="row-actions">
                <button class="action-btn" type="button" @click="copyDiffLeftRaw">Copy {{ diffLeftLabel }} raw JSON</button>
                <button class="action-btn" type="button" @click="copyDiffRightRaw">Copy {{ diffRightLabel }} raw JSON</button>
              </div>
            </template>
          </SaveDiffVisualizer>

          <p class="status-line" :class="{ ok: statusOk, bad: !statusOk }">{{ statusText }}</p>
        </div>
        <footer class="modal-actions">
          <button class="close-btn" type="button" @click="close">Close</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { GameState } from '../logic/GameState';
import { getGameState, getGameStateMutable, replaceGameState, uiState } from '../logic/UIState';
import {
  cancelPendingAutosave,
  flushAutosave,
  loadFromBase64,
  loadFromJson,
  saveToBase64,
  saveToJson,
  wipeAutosave,
} from '../logic/SaveLoad';
import { DISCOVERY } from '../logic/DiscoveryLib';
import SaveDiffVisualizer from './SaveDiffVisualizer.vue';
import {
  DEV_SAVE_SLOT_COUNT,
  compareGameStateWithDevSlot,
  loadGameStateFromDevSlot,
  runSaveLoadRoundtripTest,
  saveGameStateToDevSlot,
  type SaveLoadMismatch,
} from '../logic/dev/TestSaveLoad';

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const jsonSave = ref('');
const statusText = ref('');
const statusOk = ref(true);
const diffMismatch = ref<SaveLoadMismatch | null>(null);
const diffLeftRawJson = ref('');
const diffRightRawJson = ref('');
const diffLeftLabel = ref('Left');
const diffRightLabel = ref('Right');
const devSlotIndices = Array.from({ length: DEV_SAVE_SLOT_COUNT }, (_unused, index) => index);
const WIPE_HOLD_DURATION_MS = 1000;
const wipeHoldStartMs = ref<number | null>(null);
const wipeHoldProgressPct = ref(0);
const wipeHoldRafId = ref<number | null>(null);
const wipingInProgress = ref(false);

const wipeButtonStyle = computed<Record<string, string>>(() => ({
  background: `linear-gradient(90deg, rgba(239, 68, 68, 0.55) ${wipeHoldProgressPct.value}%, rgba(127, 29, 29, 0.14) ${wipeHoldProgressPct.value}%)`,
}));

const showTestSaveLoadButton = computed(() => {
  // Force recompute when discoveries mutate.
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.discoveryCounter;
  return getGameState().discoveries[DISCOVERY.DEV] === true;
});

function setStatus(text: string, ok: boolean): void {
  statusText.value = text;
  statusOk.value = ok;
}

function getSlotLabel(slotIndex: number): string {
  return `Slot ${slotIndex + 1}`;
}

function clearDiff(): void {
  diffMismatch.value = null;
  diffLeftRawJson.value = '';
  diffRightRawJson.value = '';
}

function forceLoadState(gameState: GameState): void {
  cancelPendingAutosave();
  replaceGameState(gameState);
  flushAutosave(gameState);
}

function removeWipeHoldListeners(): void {
  window.removeEventListener('pointerup', cancelWipeHold);
  window.removeEventListener('pointercancel', cancelWipeHold);
}

function clearWipeHold(resetProgress: boolean): void {
  if (wipeHoldRafId.value !== null) {
    cancelAnimationFrame(wipeHoldRafId.value);
    wipeHoldRafId.value = null;
  }
  wipeHoldStartMs.value = null;
  removeWipeHoldListeners();
  if (resetProgress) wipeHoldProgressPct.value = 0;
}

function wipeMainSave(): void {
  wipingInProgress.value = true;
  wipeAutosave();
  replaceGameState(new GameState());
  clearDiff();
  jsonSave.value = '';
  setStatus('Main autosave wiped. Loaded blank GameState.', true);
  wipeHoldProgressPct.value = 0;
  wipingInProgress.value = false;
}

function tickWipeHold(timestamp: number): void {
  if (wipeHoldStartMs.value === null) return;
  const elapsedMs = timestamp - wipeHoldStartMs.value;
  const progress = Math.min(1, elapsedMs / WIPE_HOLD_DURATION_MS);
  wipeHoldProgressPct.value = progress * 100;
  if (progress >= 1) {
    clearWipeHold(false);
    wipeMainSave();
    return;
  }
  wipeHoldRafId.value = requestAnimationFrame(tickWipeHold);
}

function startWipeHold(): void {
  if (wipeHoldStartMs.value !== null || wipingInProgress.value) return;
  wipeHoldStartMs.value = performance.now();
  wipeHoldProgressPct.value = 0;
  window.addEventListener('pointerup', cancelWipeHold);
  window.addEventListener('pointercancel', cancelWipeHold);
  wipeHoldRafId.value = requestAnimationFrame(tickWipeHold);
}

function cancelWipeHold(): void {
  if (wipeHoldStartMs.value === null) return;
  clearWipeHold(true);
}

async function writeClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard || !window.isSecureContext) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function readClipboard(): Promise<string | null> {
  if (!navigator.clipboard || !window.isSecureContext) return null;
  try {
    const text = await navigator.clipboard.readText();
    return text;
  } catch {
    return null;
  }
}

async function exportJson(): Promise<void> {
  const json = saveToJson(getGameStateMutable());
  jsonSave.value = json;
  const copied = await writeClipboard(json);
  if (copied) {
    setStatus('Exported JSON and copied to clipboard.', true);
    return;
  }
  setStatus('Exported JSON text.', true);
}

async function exportBase64(): Promise<void> {
  const base64 = saveToBase64(getGameStateMutable());
  const copied = await writeClipboard(base64);
  if (copied) {
    setStatus('Exported base64 save to clipboard.', true);
    return;
  }
  window.prompt('Copy base64 save:', base64);
  setStatus('Base64 save shown in prompt (clipboard API unavailable).', true);
}

async function importJson(): Promise<void> {
  const source = jsonSave.value.trim().length > 0 ? jsonSave.value : ((await readClipboard()) ?? '');
  const loaded = loadFromJson(source);
  if (loaded === false) {
    setStatus('Malformed JSON save (textarea/clipboard).', false);
    return;
  }

  forceLoadState(loaded);
  clearDiff();
  setStatus('Imported save from JSON.', true);
}

async function importBase64(): Promise<void> {
  const clipboardText = await readClipboard();
  const input = (clipboardText && clipboardText.trim().length > 0)
    ? clipboardText
    : window.prompt('Paste base64 save to import:');
  if (input === null) return;

  const loaded = loadFromBase64(input.trim());
  if (loaded === false) {
    setStatus('Malformed base64 save.', false);
    return;
  }

  forceLoadState(loaded);
  clearDiff();
  setStatus('Imported save from base64.', true);
}

async function runTestSaveLoad(): Promise<void> {
  const result = runSaveLoadRoundtripTest(getGameStateMutable());
  diffLeftRawJson.value = result.originalRawJson;
  diffRightRawJson.value = result.roundTripRawJson;
  diffLeftLabel.value = 'Original';
  diffRightLabel.value = 'Roundtrip';

  if (result.loadFailed) {
    diffMismatch.value = null;
    setStatus(`TestSaveLoad failed: ${result.loadFailureReason}`, false);
    return;
  }

  if (result.equal) {
    diffMismatch.value = null;
    setStatus('TestSaveLoad passed: raw JSON matches after save/load roundtrip.', true);
    return;
  }

  diffMismatch.value = result.mismatch!;
  setStatus(`TestSaveLoad mismatch at char ${result.mismatch!.index}.`, false);
}

async function saveDevSlot(slotIndex: number): Promise<void> {
  await saveGameStateToDevSlot(getGameStateMutable(), slotIndex);
  clearDiff();
  setStatus(`${getSlotLabel(slotIndex)} saved to IndexedDB.`, true);
}

async function loadDevSlot(slotIndex: number): Promise<void> {
  const result = await loadGameStateFromDevSlot(slotIndex);
  if (!result.exists) {
    setStatus(`${getSlotLabel(slotIndex)} is empty.`, false);
    return;
  }
  if (result.loadFailed) {
    setStatus(`${getSlotLabel(slotIndex)} load failed: ${result.loadFailureReason}`, false);
    return;
  }

  forceLoadState(result.loadedState!);
  clearDiff();
  setStatus(`${getSlotLabel(slotIndex)} loaded from IndexedDB.`, true);
}

async function compareDevSlot(slotIndex: number): Promise<void> {
  const result = await compareGameStateWithDevSlot(getGameStateMutable(), slotIndex);
  diffLeftRawJson.value = result.currentRawJson;
  diffRightRawJson.value = result.savedRawJson;
  diffLeftLabel.value = 'Current';
  diffRightLabel.value = getSlotLabel(slotIndex);

  if (!result.hasSavedRaw) {
    diffMismatch.value = null;
    setStatus(`${getSlotLabel(slotIndex)} has no saved raw JSON. Save this slot first.`, false);
    return;
  }

  if (result.equal) {
    diffMismatch.value = null;
    setStatus(`${getSlotLabel(slotIndex)} compare passed: raw JSON matches current state.`, true);
    return;
  }

  diffMismatch.value = result.mismatch!;
  setStatus(`${getSlotLabel(slotIndex)} compare mismatch at char ${result.mismatch!.index}.`, false);
}

async function copyDiffLeftRaw(): Promise<void> {
  const copied = await writeClipboard(diffLeftRawJson.value);
  if (copied) {
    setStatus(`Copied ${diffLeftLabel.value} raw JSON to clipboard.`, true);
    return;
  }
  setStatus(`Failed to copy ${diffLeftLabel.value} raw JSON (clipboard API unavailable).`, false);
}

async function copyDiffRightRaw(): Promise<void> {
  const copied = await writeClipboard(diffRightRawJson.value);
  if (copied) {
    setStatus(`Copied ${diffRightLabel.value} raw JSON to clipboard.`, true);
    return;
  }
  setStatus(`Failed to copy ${diffRightLabel.value} raw JSON (clipboard API unavailable).`, false);
}

function close(): void {
  cancelWipeHold();
  emit('close');
}

onBeforeUnmount(() => {
  clearWipeHold(true);
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
}

.modal {
  width: 760px;
  max-width: 96vw;
  min-height: 320px;
  background: linear-gradient(180deg, rgba(20, 28, 40, 0.98), rgba(10, 15, 26, 0.94));
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7), inset 0 1px 0 var(--panel-shine);
  padding: 12px;
  display: grid;
  grid-template-rows: 1fr auto;
}

.modal-body {
  min-height: 240px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  margin: 0;
  font-size: 14px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.88);
}

.save-input {
  width: 100%;
  min-height: 84px;
  resize: vertical;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.22);
  border: 0;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.92);
  padding: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  line-height: 1.3;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.6) rgba(255, 255, 255, 0.06);
}

.save-input:focus {
  outline: none;
  box-shadow: 0 0 0 1px rgba(79, 209, 197, 0.45);
}

.save-input::-webkit-scrollbar {
  width: 10px;
}

.save-input::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 6px;
}

.save-input::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.65);
  border-radius: 6px;
}

.save-input::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.85);
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dev-slot-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.dev-slot-column {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
}

.dev-slot-title {
  margin: 0;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  color: rgba(226, 232, 240, 0.92);
}

.slot-btn {
  width: 100%;
}

.action-btn {
  height: 32px;
  padding: 0 10px;
  border: 1px solid rgba(79, 209, 197, 0.45);
  border-radius: 6px;
  background: rgba(79, 209, 197, 0.14);
  color: rgba(229, 253, 250, 0.95);
  font-weight: 700;
  cursor: pointer;
  transition: filter 0.15s ease;
}

.action-btn:hover {
  filter: brightness(1.15);
}

.wipe-save-btn {
  border-color: rgba(248, 113, 113, 0.8);
  color: rgba(255, 228, 228, 0.95);
}

.wipe-save-btn:disabled {
  cursor: default;
  filter: none;
}

.status-line {
  margin: 0;
  min-height: 18px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.status-line.ok {
  color: #86efac;
}

.status-line.bad {
  color: #fca5a5;
}

@media (max-width: 820px) {
  .dev-slot-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .dev-slot-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
}

.close-btn {
  height: 36px;
  padding: 0 12px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
  font-weight: 700;
  cursor: pointer;
  transition: filter 0.15s ease;
}

.close-btn:hover {
  filter: brightness(1.15);
}
</style>
