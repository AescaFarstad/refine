<template>
  <div class="modal-backdrop">
    <div class="modal" :class="{ maximized: isMaximized, 'has-signatures': newSignatures.length > 0 }">
      <div class="modal-body">
        <img
          src="/images/church_symbols.webp"
          alt="Church symbols"
          class="symbols-image"
          :class="{ clickable: !isMaximized }"
          @click="isMaximized = !isMaximized"
        />
        <p class="symbols-text">The walls are strewn with refinement symbols.</p>

        <div v-if="newSignatures.length > 0" class="signatures-section">
          <p class="signatures-label">
            {{ showSignatures ? `You learned ${newSignatures.length} new signature${newSignatures.length > 1 ? 's' : ''}:` : 'Arranging items on the wafer in these patterns should improve yields from refining.' }}
          </p>
          <div class="signatures-grid">
            <div
              v-for="sig in newSignatures"
              :key="sig.id"
              class="sig-column"
            >
              <div class="sig-wafer" :style="sigWaferStyle(sig.id)" />
              <div class="sig-sprite" :style="sigSpriteStyle(sig.id)" />
            </div>
          </div>
        </div>
      </div>
      <footer class="modal-actions">
        <button class="btn primary" @click="close">Hm...</button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { uiState } from '../../logic/UIState';
import atlasStorage from '../../logic/AtlasStorage';
import type { Reward } from '../../logic/Reward';
import { DISCOVERY } from '../../logic/DiscoveryLib';

const isMaximized = ref(false);

const emit = defineEmits<{
  close: [rewards?: Reward[]]
}>();

const MAX_SIGNATURES = 6;

const showSignatures = computed(() => {
  return uiState.hasDiscoveredSignatures;
});

const newSignatures = computed(() => {
  if (!uiState.lib) return [];
  const learned = new Set(uiState.learnedSignatureIds);
  const unlearned = Array.from(uiState.lib.signatures.values())
    .filter(sig => !learned.has(sig.id))
    .slice(0, MAX_SIGNATURES);
  return unlearned as { id: string; name: string }[];
});

const moleculesSource = atlasStorage.getMoleculesSource();
const atlasW = moleculesSource?.naturalWidth ?? 0;
const atlasH = moleculesSource?.naturalHeight ?? 0;
const atlasVars = moleculesSource ? {
  '--sig-atlas': `url(${moleculesSource.src})`,
  '--sig-atlas-size': `${atlasW}px ${atlasH}px`,
} : {};

function sigSpriteStyle(id: string): Record<string, string> {
  const sig = uiState.lib?.signatures.get(id);
  if (!sig) return {};
  const key = `sig:card:open:${id}`;
  const f = atlasStorage.getMoleculesFrame(key)!;
  return {
    ...(atlasVars as Record<string, string>),
    backgroundPosition: `-${f.x}px -${f.y}px`,
  };
}

function sigWaferStyle(id: string): Record<string, string> {
  const src = atlasStorage.getMoleculesSource();
  if (!src) return {};
  const f = atlasStorage.getMoleculesFrame(`sig:wafer:${id}`);
  if (!f) return {};
  const targetSize = 96;
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
  const idsToLearn = newSignatures.value.map(s => s.id);
  const rewards: Reward[] = [];
  if (idsToLearn.length > 0) {
    rewards.push({ kind: 'learn_signatures', signatureIds: idsToLearn });
  }
  rewards.push({ kind: 'discovery', discoveryId: DISCOVERY.SIGNATURES });
  emit('close', rewards.length > 0 ? rewards : undefined);
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
  background: linear-gradient(180deg, rgba(20, 28, 40, 0.98), rgba(10, 15, 26, 0.94));
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7), inset 0 1px 0 var(--panel-shine);
  padding: 16px;
  transition: min-width 0.2s ease, max-width 0.2s ease;
}

.modal.has-signatures {
  min-width: 480px;
}

.modal.maximized {
  width: auto;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal.maximized .modal-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.modal-body {
  min-height: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.symbols-image {
  max-width: 100%;
  width: auto;
  height: 320px;
  border-radius: 4px;
  transition: transform 0.2s ease;
}

.modal.has-signatures .symbols-image {
  height: 400px;
}

.symbols-image.clickable {
  cursor: zoom-in;
}

.symbols-image.clickable:hover {
  transform: scale(1.02);
}

.modal.maximized .symbols-image {
  cursor: zoom-out;
  max-width: 100%;
  max-height: 80vh;
  height: auto;
  flex: 1 1 auto;
  width: auto;
  object-fit: contain;
}

.symbols-text {
  text-align: center;
  color: var(--text-secondary);
  font-style: italic;
  margin: 0;
}

.signatures-section {
  margin-top: 8px;
  width: 100%;
}

.signatures-label {
  text-align: center;
  color: var(--accent);
  font-weight: 600;
  margin: 0 0 8px;
}

.signatures-grid {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 16px;
}

.sig-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.sig-wafer {
  display: block;
  opacity: 0.85;
}

.sig-sprite {
  width: 80px;
  height: 90px;
  display: block;
  background-image: var(--sig-atlas);
  background-repeat: no-repeat;
  background-size: var(--sig-atlas-size);
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
