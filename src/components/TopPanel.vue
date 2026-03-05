<template>
  <header class="top-panel">
    <div class="bar">
      <Tabs />

      <!-- Current time display -->
      <div class="metric time-metric"><span class="label">Time</span><span class="value time-value">{{ timeDisplay }}</span></div>

      <div class="spacer"></div>

      <div class="actions">
        <button v-if="showCheatButton" class="settings-btn" type="button" aria-label="Edit research pane" @click="openEditResearch">
          <span class="settings-icon" :style="scaffoldIconStyle"></span>
        </button>
        <button v-if="showCheatButton" class="settings-btn" type="button" aria-label="Open cheat tools" @click="openCheats">
          <span class="settings-icon" :style="cheatIconStyle"></span>
        </button>
        <button class="settings-btn" type="button" aria-label="Open settings" @click="openSettings">
          <span class="settings-icon" :style="gearIconStyle"></span>
        </button>
      </div>
    </div>

    <SettingsWindow :visible="settingsOpen" @close="closeSettings" />
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { getGameState, getGameStateMutable, timeDisplay, uiState } from '../logic/UIState';
import atlasStorage from '../logic/AtlasStorage';
import { atlasSpriteStyle } from '../logic/AtlasSpriteStyle';
import { DISCOVERY } from '../logic/DiscoveryLib';
import { globalInputQueue } from '../logic/Model';
import { CheatAddResearchVision } from '../logic/cheat/CheatCommands';
import { CmdSwitchTab } from '../logic/input/InputCommands';
import Tabs from './Tabs.vue';
import SettingsWindow from './SettingsWindow.vue';

const settingsOpen = ref(false);
const itemsSource = atlasStorage.getItemsSource();
const gearFrame = atlasStorage.getItemsFrame('gear')!;
const cheatFrame = atlasStorage.getItemsFrame('field_scanner')!;
const scaffoldFrame = atlasStorage.getItemsFrame('scaffold')!;

const gearIconStyle = computed(() => {
  return atlasSpriteStyle(itemsSource, gearFrame, {
    size: 20,
    mode: 'fit',
    allowUpscale: false,
  });
});

const cheatIconStyle = computed(() => {
  return atlasSpriteStyle(itemsSource, cheatFrame, {
    size: 20,
    mode: 'fit',
    allowUpscale: false,
  });
});

const scaffoldIconStyle = computed(() => {
  return atlasSpriteStyle(itemsSource, scaffoldFrame, {
    size: 20,
    mode: 'fit',
    allowUpscale: false,
  });
});

const showCheatButton = computed(() => {
  uiState.discoveryCounter; // reactivity trigger
  return getGameState().discoveries[DISCOVERY.DEV] === true;
});

function openCheats(): void {
  uiState.cheatOpen = true;
}

function openEditResearch(): void {
  globalInputQueue.push(new CmdSwitchTab({ tab: 'research' }));
  uiState.editResearchOpen = true;
  const gs = getGameStateMutable();
  gs.cheats.push(new CheatAddResearchVision({ amount: 1000 }));
}

function openSettings(): void {
  settingsOpen.value = true;
}

function closeSettings(): void {
  settingsOpen.value = false;
}
</script>

<style scoped>
.top-panel {
  display: block;
  background: rgba(26, 35, 50, 0.5);
  color: #e2e8f0; /* slate-200 */
  border-bottom: 1px solid rgba(79, 209, 197, 0.2);
  box-shadow: 0 1px 0 0 rgba(79, 209, 197, 0.1);
  position: relative;
  z-index: 100;
  backdrop-filter: blur(12px);
}

.bar {
  height: 64px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
}

.spacer { flex: 1 1 auto; }
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-btn {
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

.settings-btn:hover {
  filter: brightness(1.2);
  background: rgba(79, 209, 197, 0.16);
}

.settings-btn:active {
  filter: brightness(0.95);
}

.settings-icon {
  display: block;
}

.metric {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.label {
  font-size: 12px;
  color: #94a3b8; /* slate-400 */
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.value {
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

/* Reserve stable width for time to avoid layout shift as it changes */
.time-metric .time-value {
  display: inline-block;
  min-width: 5ch;
  text-align: right;
  white-space: nowrap;
}
</style>
