<template>
  <div v-if="visible && gear" class="modal-backdrop" @click.self="close">
    <div class="modal">
      <header class="modal-header">
        <div>
          <h3 class="modal-title">Edit Gear XP</h3>
          <p class="modal-subtitle">{{ gear.name }}: {{ currentXp }} XP</p>
        </div>
      </header>

      <section class="modal-body">
        <div class="button-grid">
          <button class="btn xp-btn add" @click="adjustXp(1)">+1</button>
          <button class="btn xp-btn add" @click="adjustXp(6)">+6</button>
          <button class="btn xp-btn add" @click="adjustXp(12)">+12</button>
          <button class="btn xp-btn subtract" @click="adjustXp(-1)">-1</button>
          <button class="btn xp-btn subtract" @click="adjustXp(-6)">-6</button>
          <button class="btn xp-btn subtract" @click="adjustXp(-12)">-12</button>
        </div>
      </section>

      <footer class="modal-actions">
        <button class="btn secondary" @click="reset">Reset</button>
        <button class="btn primary" @click="close">Close</button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getGameStateMutable, uiState } from '../logic/UIState';
import { saveAutosave } from '../logic/SaveLoad';

const visible = computed(() => uiState.editGearXpModalOpen);

const gear = computed(() => {
  const gs = getGameStateMutable();
  const gearId = uiState.editGearXpGearId;
  if (!gearId) return null;
  return gs.lib.gear.get(gearId) ?? null;
});

const currentXp = computed(() => {
  const gearId = uiState.editGearXpGearId;
  if (!gearId) return 0;
  return uiState.gearXpById[gearId] ?? 0;
});

function close(): void {
  uiState.editGearXpModalOpen = false;
  uiState.editGearXpGearId = '';
}

function setXp(nextXp: number): void {
  const gs = getGameStateMutable();
  const gearId = uiState.editGearXpGearId;
  if (!gearId) return;
  const value = Math.max(0, nextXp | 0);
  gs.gearXpById[gearId] = value;
  uiState.gearXpById = {
    ...uiState.gearXpById,
    [gearId]: value,
  };
  saveAutosave(gs);
}

function adjustXp(delta: number): void {
  setXp(currentXp.value + delta);
}

function reset(): void {
  setXp(0);
}
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
  width: 360px;
  max-width: 94vw;
  background: linear-gradient(180deg, rgba(20, 28, 40, 0.98), rgba(10, 15, 26, 0.94));
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7), inset 0 1px 0 var(--panel-shine);
  padding: 16px;
  display: grid;
  gap: 16px;
}

.modal-title {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.modal-subtitle {
  margin: 4px 0 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.button-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.btn {
  border: 1px solid var(--panel-border);
  border-radius: 4px;
  padding: 10px 12px;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 800;
}

.xp-btn.add {
  background: rgba(34, 197, 94, 0.16);
}

.xp-btn.subtract {
  background: rgba(239, 68, 68, 0.14);
}

.btn.secondary {
  background: rgba(148, 163, 184, 0.12);
}

.btn.primary {
  background: rgba(79, 209, 197, 0.18);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
