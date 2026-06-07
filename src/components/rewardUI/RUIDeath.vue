<template>
  <div class="modal-backdrop">
    <button
      v-if="showSettingsButton"
      :key="blinkNonce"
      class="death-settings-btn"
      :class="{ blinking: blinkNonce > 0 }"
      type="button"
      aria-label="Open settings"
      @click="openSettings"
    >
      <span class="settings-icon" :style="gearIconStyle"></span>
    </button>

    <div class="modal">
      <section class="modal-body">
        <div class="death-text">
          <p
            v-for="(line, idx) in visibleLines"
            :key="idx"
            class="death-line"
            :class="{ visible: idx < shownCount }"
          >
            {{ line }}
          </p>
        </div>
      </section>

      <footer class="modal-actions">
        <button class="btn primary" @click="advance">{{ buttonText }}</button>
      </footer>
    </div>

    <SettingsWindow :visible="settingsOpen" @close="closeSettings" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import atlasStorage from '../../logic/AtlasStorage';
import { atlasSpriteStyle } from '../../logic/AtlasSpriteStyle';
import SettingsWindow from '../SettingsWindow.vue';

defineProps<{
  params?: Record<string, unknown>;
}>();

const textParts = [
  'There is no time',
  'There is no space',
  'There is no you',
  'There is nothing',
  'And no one to aknowledge this fact',
];

const finalLine = textParts[textParts.length - 1]!;
const shownCount = ref(1);
const replacedCount = ref(0);
const buttonConverted = ref(false);
const showSettingsButton = ref(false);
const settingsOpen = ref(false);
const blinkNonce = ref(0);
const allShown = computed(() => shownCount.value >= textParts.length);
const collapseComplete = computed(() => replacedCount.value >= textParts.length - 1);
const buttonText = computed(() => buttonConverted.value ? finalLine : 'Next');
const itemsSource = atlasStorage.getItemsSource();
const gearFrame = atlasStorage.getItemsFrame('gear')!;

const gearIconStyle = computed(() => atlasSpriteStyle(itemsSource, gearFrame, {
  size: 20,
  mode: 'fit',
  allowUpscale: false,
}));

const visibleLines = computed(() => textParts.map((line, idx) => {
  if (idx < replacedCount.value) return finalLine;
  return line;
}));

function advance(): void {
  if (!allShown.value) {
    shownCount.value++;
    return;
  }
  if (!collapseComplete.value) {
    replacedCount.value++;
    return;
  }
  if (!buttonConverted.value) {
    buttonConverted.value = true;
    return;
  }
  if (!showSettingsButton.value) {
    showSettingsButton.value = true;
    return;
  }
  blinkNonce.value++;
}

function openSettings(): void {
  settingsOpen.value = true;
}

function closeSettings(): void {
  settingsOpen.value = false;
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  display: grid;
  place-items: center;
  padding: 2vh 2vw;
  z-index: 10000;
  overflow: hidden;
}

.death-settings-btn {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 10002;
  width: 40px;
  height: 40px;
  padding: 0;
  display: grid;
  place-items: center;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: filter 0.15s ease, background 0.15s ease;
}

.death-settings-btn:hover {
  filter: brightness(1.2);
  background: rgba(79, 209, 197, 0.16);
}

.death-settings-btn:active {
  filter: brightness(0.95);
}

.death-settings-btn.blinking {
  animation: settings-blink 0.65s ease-out;
}

.settings-icon {
  display: block;
}

@keyframes settings-blink {
  0%, 100% {
    box-shadow: 0 0 0 rgba(79, 209, 197, 0);
    background: rgba(255, 255, 255, 0.05);
  }
  20%, 65% {
    box-shadow: 0 0 18px rgba(79, 209, 197, 0.95), 0 0 0 4px rgba(79, 209, 197, 0.18);
    background: rgba(79, 209, 197, 0.24);
  }
}

.modal {
  width: 640px;
  max-width: 96vw;
  background: linear-gradient(180deg, rgba(9, 12, 18, 0.98), rgba(0, 0, 0, 0.96));
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 6px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  padding: 24px;
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 24px;
}

.modal-body {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 220px;
}

.death-text {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.death-line {
  color: rgba(255, 255, 255, 0.7);
  font-size: 18px;
  font-weight: 500;
  line-height: 1.5;
  text-align: center;
  margin: 0;
  opacity: 0;
  transition: opacity 0.4s ease, color 0.4s ease;
}

.death-line.visible {
  opacity: 1;
}

.modal-actions {
  display: flex;
  justify-content: center;
  min-height: 44px;
  align-items: center;
}

.btn {
  cursor: pointer;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 6px;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.88);
  font-weight: 800;
  font-size: 14px;
  letter-spacing: 0.04em;
  transition: filter 0.15s ease, background 0.15s ease;
}

.btn.primary {
  min-height: 44px;
  background: rgba(148, 163, 184, 0.12);
}

.btn:hover {
  filter: brightness(1.15);
  background: rgba(255, 255, 255, 0.08);
}
</style>
