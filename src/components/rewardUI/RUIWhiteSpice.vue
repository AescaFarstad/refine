<template>
  <div class="modal-backdrop">
    <div class="modal">
      <div class="modal-body">
        <div class="gear-display">
          <GearItem
            v-if="spiceGear"
            :gear="spiceGear"
            :selected="false"
            :unaffordable="false"
            :blocked="false"
            :price="0"
            :count="spiceCount"
            :hintRight="true"
          />
        </div>
        <p class="description-text">
          {{ sourceEssenceLabel }} essences now leave behind a stable concentrate.<br /> Each refined
          <span class="essence-icon" :style="essenceStyle" />
          will now give <span class="highlight">Spice</span>
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
import GearItem from '../GearItem.vue';
import { getGameState, uiState } from '../../logic/UIState';
import atlasStorage from '../../logic/AtlasStorage';
import { atlasSpriteStyle } from '../../logic/AtlasSpriteStyle';
import type { Reward } from '../../logic/Reward';
import { getMonochromeEssenceBehavior } from '../../logic/DiscoveryLib';

const emit = defineEmits<{
  close: [rewards?: Reward[]]
}>();

const spiceGear = computed(() => {
  return uiState.lib?.gear.get('spice');
});

const spiceCount = computed(() => uiState.countableGear.spice || 0);

const source = atlasStorage.getItemsSource();

const sourceEssenceKey = computed(() => {
  return getMonochromeEssenceBehavior(getGameState().discoveries).spiceYieldEssence;
});

const sourceEssenceLabel = computed(() => {
  return sourceEssenceKey.value === 'black' ? 'Black' : 'White';
});

const sourceFrame = computed(() => {
  return atlasStorage.getItemsFrame(sourceEssenceKey.value)!;
});

const essenceStyle = computed(() => {
  const f = sourceFrame.value;
  return atlasSpriteStyle(source, f, { size: 20, mode: 'fit', allowUpscale: false });
});

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
  min-height: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.gear-display {
  min-width: 240px;
}

.gear-display :deep(.gear-item) {
  width: 100%;
}

.description-text {
  text-align: center;
  color: var(--text-secondary);
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
}

.essence-icon {
  display: inline-block;
  vertical-align: middle;
  margin: 0 2px;
}

.highlight {
  color: var(--accent);
  font-weight: 700;
  text-shadow: 0 0 6px var(--accent);
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
