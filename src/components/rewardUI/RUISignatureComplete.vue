<template>
  <div class="modal-backdrop">
    <div class="modal">
      <div class="modal-body">
        <div class="signatures-grid" :class="gridClass">
          <div v-for="sig in completedSignatures" :key="sig.id" class="signature-display">
            <div class="sig-wafer" :style="sigWaferStyle(sig.id)" />
            <div class="sig-info">
              <span class="sig-name">{{ sig.name }}</span>
            </div>
          </div>
        </div>
        <p class="completion-text">
          Signature complete. It gives a permanent <span class="bonus-value">{{ yieldBonusPct }}%</span> yield bonus.
        </p>
      </div>
      <footer class="modal-actions">
        <button class="btn primary" @click="close">OK</button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { uiState } from '../../logic/UIState';
import atlasStorage from '../../logic/AtlasStorage';
import type { Reward } from '../../logic/Reward';
import { SIGNATURE_YIELD_BONUS_PCT } from '../../logic/Const';

const props = defineProps<{
  params?: { signatureIds?: string[] };
}>();

const emit = defineEmits<{
  close: [rewards?: Reward[]]
}>();

const yieldBonusPct = SIGNATURE_YIELD_BONUS_PCT;

const completedSignatures = computed(() => {
  if (!uiState.lib) return [];
  const ids = props.params?.signatureIds ?? [];
  return ids
    .map(id => uiState.lib!.signatures.get(id))
    .filter(Boolean) as { id: string; name: string }[];
});

const gridClass = computed(() => {
  const count = completedSignatures.value.length;
  if (count <= 1) return 'grid-1';
  if (count <= 2) return 'grid-2';
  if (count <= 4) return 'grid-2x2';
  return 'grid-3';
});

function sigWaferStyle(id: string): Record<string, string> {
  const src = atlasStorage.getMoleculesSource();
  if (!src) return {};
  const f = atlasStorage.getMoleculesFrame(`sig:wafer:${id}`);
  if (!f) return {};
  const targetSize = 128;
  const scale = Math.min(targetSize / f.w, targetSize / f.h);
  return {
    width: `${Math.round(f.w * scale)}px`,
    height: `${Math.round(f.h * scale)}px`,
    backgroundImage: `url(${src.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${f.x * scale}px -${f.y * scale}px`,
    backgroundSize: `${src.naturalWidth * scale}px ${src.naturalHeight * scale}px`,
  };
}

function close() {
  emit('close');
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2vh 2vw;
  z-index: 10000;
  overflow: hidden;
}

.modal {
  max-width: 96vw;
  min-width: 320px;
  background: linear-gradient(180deg, rgba(20, 28, 40, 0.98), rgba(10, 15, 26, 0.94));
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7), inset 0 1px 0 var(--panel-shine);
  padding: 16px;
}

.modal-body {
  min-height: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.signatures-grid {
  display: grid;
  gap: 16px;
  justify-items: center;
}

.signatures-grid.grid-1 {
  grid-template-columns: 1fr;
}

.signatures-grid.grid-2 {
  grid-template-columns: repeat(2, 1fr);
}

.signatures-grid.grid-2x2 {
  grid-template-columns: repeat(2, 1fr);
}

.signatures-grid.grid-3 {
  grid-template-columns: repeat(3, 1fr);
}

.signature-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.sig-wafer {
  display: block;
}

.sig-info {
  text-align: center;
}

.sig-name {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--accent);
  text-shadow: 0 0 8px var(--accent);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.sig-name::before,
.sig-name::after {
  font-size: 0.9rem;
  font-weight: 400;
  letter-spacing: -0.15em;
  animation: bracket-pulse 2.5s ease-in-out infinite;
}

.sig-name::before {
  content: '⟧⟧⟧';
  background: linear-gradient(90deg, transparent 0%, var(--accent) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.sig-name::after {
  content: '⟦⟦⟦';
  background: linear-gradient(90deg, var(--accent) 0%, transparent 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation-delay: 1.25s;
}

@keyframes bracket-pulse {
  0%, 100% { letter-spacing: -0.15em; opacity: 0.7; }
  50% { letter-spacing: 0.05em; opacity: 1; }
}

.completion-text {
  text-align: center;
  color: var(--text-secondary);
  margin: 0;
  font-size: 0.95rem;
}

.bonus-value {
  color: var(--accent);
  font-weight: 600;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 14px;
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
</style>
