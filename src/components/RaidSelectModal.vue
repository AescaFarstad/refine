<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Select Raid</h2>
          <button class="close-btn" type="button" @click="$emit('close')">✕</button>
        </div>
        <div class="modal-body">
          <!-- Left: raid list -->
          <div class="raid-list">
            <button
              v-for="r in uiState.raids"
              :key="r.id"
              class="raid-card"
              :class="{ active: r.id === previewRaidId, locked: isLocked(r) }"
              type="button"
              :disabled="isLocked(r)"
              @click="onPreview(r.id)"
              @dblclick="onSelect(r.id)"
            >
              <div class="raid-title">{{ r.name }}</div>
              <div v-if="isLocked(r)" class="raid-locked">
                <span class="txt">Locked</span>
              </div>
            </button>
          </div>
          <!-- Right: raid preview -->
          <div class="raid-preview">
            <template v-if="previewRaid">
              <div class="preview-image">
                <!-- Placeholder for raid image -->
                <div class="image-placeholder">[ Raid Image ]</div>
              </div>
              <div class="preview-name">{{ previewRaid.name }}</div>
              <div class="preview-description">
                {{ previewRaid.description || 'A challenging expedition into dangerous territory.' }}
                <template v-if="previewRaid.zoneCollapseSec && previewRaid.zoneCollapseSec > 0">
                  <br>Extract before zone collapse in {{ formatDurationHM(previewRaid.zoneCollapseSec) }} or perish.
                </template>
              </div>
              <RaidDetailsAbridged :raid="previewRaid" />
              <button class="select-btn" type="button" :disabled="isLocked(previewRaid)" @click="onSelect(previewRaid.id)">
                Select This Raid
              </button>
            </template>
            <div v-else class="no-preview">
              Select a raid to see details
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { uiState } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdSelectRaid } from '../logic/input/InputCommands';
import type { RaidDefinition } from '../logic/RaidLib';
import RaidDetailsAbridged from './RaidDetailsAbridged.vue';
import { formatDurationHM } from '../logic/StringUtils';

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{ close: [], selected: [] }>();

const previewRaidId = ref<string | null>(null);

const previewRaid = computed<RaidDefinition | null>(() => {
  if (!previewRaidId.value) return null;
  return uiState.raids.find(r => r.id === previewRaidId.value) || null;
});

function isLocked(r: RaidDefinition): boolean {
  return !uiState.unlockedRaidIds.includes(r.id);
}

function onPreview(id: string) {
  if (isLocked(uiState.raids.find(r => r.id === id)!)) return;
  previewRaidId.value = id;
}

function onSelect(id: string) {
  if (!id) return;
  const r = uiState.raids.find(rr => rr.id === id);
  if (!r || isLocked(r)) return;
  globalInputQueue.push(new CmdSelectRaid({ id }));
  emit('selected');
  emit('close');
}

watch(() => props.visible, (v) => {
  if (v) {
    previewRaidId.value = uiState.activeRaidId || firstUnlockedRaidId();
  }
});

function firstUnlockedRaidId(): string | null {
  for (const id of uiState.raidOrder) {
    const r = uiState.raids.find(rr => rr.id === id);
    if (r && !isLocked(r)) return id;
  }
  return null;
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
}
.modal-content {
  background: var(--bg-2);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  width: 95vw;
  max-width: 1200px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--panel-border);
}
.modal-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
}
.close-btn:hover {
  color: var(--text-primary);
}
.modal-body {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 16px;
  padding: 16px;
  overflow: auto;
  flex: 1;
}
/* Left panel: raid list */
.raid-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  max-height: 60vh;
}
.raid-card {
  position: relative;
  height: 72px;
  border: none;
  outline: none;
  border-radius: 6px;
  background: rgba(255,255,255,0.03);
  color: var(--text-primary);
  cursor: pointer;
  display: grid;
  place-items: center;
  font-weight: 800;
  letter-spacing: 0.02em;
  overflow: hidden;
}
.raid-card.active {
  background: rgba(74, 222, 128, 0.15);
}
.raid-card.locked {
  --locked-color: rgba(255,255,255,0.2);
  opacity: 0.7;
  cursor: not-allowed;
  border: 3px solid var(--locked-color);
}
.raid-card:disabled {
  cursor: not-allowed;
}
.raid-title {
  font-size: 16px;
}
.raid-card.locked::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  top: 24px;
  pointer-events: none;
  z-index: 1;
  background-image:
    repeating-linear-gradient(45deg, rgba(0, 0, 0, 0.38) 0, rgba(0, 0, 0, 0.38) 8px, transparent 8px, transparent 16px),
    repeating-linear-gradient(-45deg, rgba(0, 0, 0, 0.38) 0, rgba(0, 0, 0, 0.38) 8px, transparent 8px, transparent 16px);
  background-size: 20px 20px, 20px 20px;
}
.raid-locked {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--locked-color);
  font-weight: 800;
  font-size: 12px;
  padding: 0 8px;
  text-align: center;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  z-index: 2;
}
/* Right panel: raid preview */
.raid-preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.preview-image {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: rgba(255,255,255,0.03);
  border-radius: 6px;
  overflow: hidden;
}
.image-placeholder {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: var(--text-secondary);
  font-style: italic;
}
.preview-name {
  font-size: 22px;
  font-weight: 900;
}
.preview-description {
  color: var(--text-secondary);
  font-size: 15px;
  line-height: 1.5;
}
.no-preview {
  display: grid;
  place-items: center;
  height: 200px;
  color: var(--text-secondary);
  font-style: italic;
}
.select-btn {
  margin-top: auto;
  height: 48px;
  padding: 0 20px;
  font-size: 16px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-radius: 4px;
  border: 1px solid rgba(34,197,94,0.35);
  background: rgba(34,197,94,0.18);
  color: #86efac;
  cursor: pointer;
}
.select-btn:hover {
  background: rgba(34,197,94,0.28);
}
.select-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  background: rgba(34,197,94,0.10);
  border-color: rgba(34,197,94,0.22);
}
</style>
