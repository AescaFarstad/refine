<template>
  <div class="signatures" :style="atlasVars">
    <div class="signatures-grid">
      <div
        v-for="sig in signaturesForLevel"
        :key="sig.id"
        class="sig-entry"
        :class="{ incomplete: !isCompleted(sig.id), unknown: !isLearned(sig.id), glowing: isInWafer(sig.id) }"
      >
        <div class="sig-sprite" :style="sigSpriteStyle(sig.id)" />
        <div class="sig-name">{{ displayName(sig.id, sig.name) }}</div>
        <SignatureHint
          class="sig-hint"
          :signature="sig"
          :completed="isCompleted(sig.id)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ReadonlySignatureDefinition } from '../logic/SignatureLib';
import { uiState } from '../logic/UIState';
import atlasStorage from '../logic/AtlasStorage';
import SignatureHint from './SignatureHint.vue';

const props = defineProps<{
  waferSignatureIds?: string[];
}>();

const signaturesForLevel = computed<ReadonlySignatureDefinition[]>(() => {
  const lib = uiState.lib!;
  const level = uiState.signatureLevel;
  return Array.from(lib.signatures.values()).filter(s => s.level === level);
});

const moleculesSource = atlasStorage.getMoleculesSource()!;
const atlasW = moleculesSource.naturalWidth;
const atlasH = moleculesSource.naturalHeight;
const atlasVars = {
  '--sig-atlas': `url(${moleculesSource.src})`,
  '--sig-atlas-size': `${atlasW}px ${atlasH}px`,
} as Record<string, string>;

const learnedIdSet = computed(() => new Set(uiState.learnedSignatureIds));
const completedIdSet = computed(() => new Set(uiState.completedSignatureIds));
const waferIdSet = computed(() => new Set(props.waferSignatureIds || []));

function isLearned(id: string): boolean {
  return learnedIdSet.value.has(id);
}

function isCompleted(id: string): boolean {
  return completedIdSet.value.has(id);
}

function isInWafer(id: string): boolean {
  return waferIdSet.value.has(id) && !completedIdSet.value.has(id);
}

function displayName(id: string, name: string): string {
  return isCompleted(id) ? name : '???';
}

function sigSpriteStyle(id: string): Record<string, string> {
  const sig = uiState.lib!.signatures.get(id)!;
  const key =
    !isLearned(id) ? `sig:card:unknownColor:${sig.color}` :
      isCompleted(id) ? `sig:card:done:${id}` :
        `sig:card:open:${id}`;
  const f = atlasStorage.getMoleculesFrame(key)!;
  return {
    backgroundPosition: `-${f.x}px -${f.y}px`,
  } as Record<string, string>;
}
</script>

<style scoped>
.signatures {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.signatures-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.title {
  font-weight: 700;
  letter-spacing: 0.02em;
}

.sub {
  color: var(--text-secondary);
  font-size: 12px;
}

.signatures-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 10px;
  justify-items: center;
}

.sig-entry {
  position: relative;
  display: grid;
  grid-template-rows: auto auto;
  gap: 4px;
  justify-items: center;
}

.sig-sprite {
  width: 90px;
  height: 90px;
  display: block;
  background-image: var(--sig-atlas);
  background-repeat: no-repeat;
  background-size: var(--sig-atlas-size);
}

.sig-name {
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.1;
}

.sig-entry.incomplete {
  opacity: 0.5;
}

.sig-entry.incomplete:hover {
  opacity: 1;
}

.sig-entry.unknown .sig-name {
  color: rgba(251, 146, 60, 0.85);
  font-weight: 800;
}

.sig-hint {
  display: none;
  position: absolute;
  left: 50%;
  bottom: calc(100% + 10px);
  transform: translateX(-50%);
  z-index: 30;
  pointer-events: none;
}

.sig-entry:hover .sig-hint {
  display: block;
}

.sig-entry.glowing {
  opacity: 1;
  animation: sig-glow 1.5s ease-in-out infinite;
}

@keyframes sig-glow {
  0%, 100% {
    filter: drop-shadow(0 0 4px rgba(79, 209, 197, 0.6));
  }
  50% {
    filter: drop-shadow(0 0 12px rgba(79, 209, 197, 0.9));
  }
}
</style>
