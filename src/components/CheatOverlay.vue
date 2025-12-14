<template>
  <div v-if="open" class="modal-backdrop">
    <div class="modal" :class="{ full: hasFullscreen }">
      <header class="modal-header" v-if="!hasFullscreen">
        <h3>Cheat Tools</h3>
      </header>

      <section class="modal-body" v-if="!hasFullscreen">
        <div class="grid">
          <button v-for="k in atlasKeys" :key="k" class="btn primary" @click="openAtlas(k)">
            Open {{ k.toUpperCase() }} Atlas
          </button>
          <button class="btn primary" type="button" @click="openMoleculeEditor">
            Open Molecule Editor
          </button>
          <button class="btn primary" type="button" @click="openEditResearchPane">
            Open Edit Research Pane
          </button>
        </div>
      </section>

      <section v-else class="viewer" :class="{ fill: hasFullscreen }">
        <DevAtlasView
          v-if="selectedAtlas"
          :atlas="selectedAtlas"
          @close="closeAll"
        />
        <DevMoleculeEditor
          v-else-if="devMoleculeEditorOpen"
          @close="closeAll"
        />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { uiState } from '../logic/UIState';
import DevAtlasView from './DevAtlasView.vue';
import DevMoleculeEditor from './DevMoleculeEditor.vue';
import { listAtlasKeys, type AtlasKey } from '../logic/AtlasStorage';

const open = computed(() => uiState.cheatOpen);
const selectedAtlas = computed(() => uiState.devAtlasKey as AtlasKey | '');
const devMoleculeEditorOpen = computed(() => uiState.devMoleculeEditorOpen);
const hasFullscreen = computed(() => !!selectedAtlas.value || devMoleculeEditorOpen.value);
const atlasKeys = computed<AtlasKey[]>(() => listAtlasKeys());

function openAtlas(key: AtlasKey) {
  uiState.devAtlasKey = key;
}

function openMoleculeEditor() {
  uiState.devAtlasKey = '';
  uiState.devMoleculeEditorOpen = true;
}

function openEditResearchPane() {
  uiState.activeTab = 'research';
  uiState.editResearchOpen = true;
  uiState.cheatOpen = false;
}

function closeAll() {
  uiState.cheatOpen = false;
  uiState.devAtlasKey = '';
  uiState.devMoleculeEditorOpen = false;
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: grid;
  place-items: center;
  z-index: 20000; /* above other modals */
}
.modal {
  width: min(90vw, 1000px);
  max-height: 90vh;
  background: linear-gradient(180deg, rgba(20, 28, 40, 0.98), rgba(10, 15, 26, 0.94));
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.7), inset 0 1px 0 var(--panel-shine);
  padding: 16px;
  display: flex;
  flex-direction: column;
}
.modal.full {
  width: 100vw;
  height: 100vh;
  max-height: none;
  border-radius: 0;
  padding: 0;
}
.modal-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.modal-header h3 { margin: 0; font-size: 18px; letter-spacing: 0.02em; }
.spacer { flex: 1; }

.modal-body { margin-top: 10px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }

.viewer { margin-top: 10px; overflow: auto; }
.viewer.fill { margin-top: 0; flex: 1; min-height: 0; }

.btn {
  padding: 8px 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  border-radius: 4px;
  border: 1px solid var(--panel-border);
  cursor: pointer;
  background: rgba(255,255,255,0.04);
  color: var(--text-primary);
}
.btn.primary { background: rgba(79, 209, 197, 0.14); color: var(--accent); }
.btn.primary:hover { background: rgba(79, 209, 197, 0.22); }
</style>
