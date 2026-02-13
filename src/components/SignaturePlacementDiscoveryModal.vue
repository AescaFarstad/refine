<template>
  <div v-if="visible" class="modal-backdrop" @click.self="acknowledge">
    <div class="modal">
      <section class="modal-body">
        <div class="sig-display" :style="sigStyleTransform" />
        <div class="modal-text">
          You've just created a signature pattern on the wafer. Successfully refining it will grant permanent rewards.
        </div>
      </section>

      <footer class="modal-actions">
        <button class="btn primary" @click="acknowledge">Close</button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { uiState } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdAcknowledgeSignaturePlacementDiscovery } from '../logic/input/InputCommands';
import atlasStorage from '../logic/AtlasStorage';

const visible = computed(() => uiState.showSignaturePlacementDiscoveryModal);
const sigId = computed(() => uiState.signaturePlacementDiscoveryId);

const moleculesSource = atlasStorage.getMoleculesSource()!;

const sigStyleTransform = computed(() => {
  if (!moleculesSource) return {};
  const key = `sig:wafer:${sigId.value}`;
  const f = atlasStorage.getMoleculesFrame(key);
  if (!f) return {};

  return {
    backgroundImage: `url(${moleculesSource.src})`,
    backgroundPosition: `-${f.x}px -${f.y}px`,
    width: `${f.w}px`,
    height: `${f.h}px`,
  };
});

function acknowledge(): void {
  globalInputQueue.push(new CmdAcknowledgeSignaturePlacementDiscovery());
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
  width: 520px;
  max-width: 96vw;
  background: linear-gradient(180deg, rgba(20, 28, 40, 0.98), rgba(10, 15, 26, 0.94));
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7), inset 0 1px 0 var(--panel-shine);
  padding: 16px;
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 16px;
  max-height: 90vh;
}

.modal-body {
  display: grid;
  justify-items: center;
  gap: 12px;
  min-height: 240px;
  align-content: center;
}

.sig-display {
  display: block;
  image-rendering: auto;
  background-repeat: no-repeat;
}

.modal-text {
  color: rgba(255, 255, 255, 0.75);
  font-size: 14px;
  font-weight: 600;
  white-space: pre-wrap;
  text-align: center;
  max-width: 420px;
}

.modal-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
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
</style>
