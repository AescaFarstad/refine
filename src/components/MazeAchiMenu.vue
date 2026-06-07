<template>
  <div v-if="visible && trackedAchievements.length > 0" class="maze-achi-menu">
    <div class="achi-panel">
      <div class="achi-header">ORACLE CHALLENGES</div>
      <div class="achi-list" :class="achiLayout.className">
        <AchiItem
          v-for="entry in displayedTrackedAchievements"
          :key="entry.achi.id"
          :achi="entry.achi"
          :achi-version="uiState.achiVersion"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import AchiItem from './AchiItem.vue';
import { getGameLib, getGameState, uiState } from '../logic/UIState';
import type { AchiDefinition } from '../logic/AchiLib';
import { ACHI_STATE_TRACKED, ACHI_STATE_COMPLETE } from '../logic/Achi';

defineProps<{
  visible: boolean;
}>();

interface TrackedAchiEntry {
  achi: AchiDefinition;
}

const windowHeight = ref(window.innerHeight);

function onResize(): void {
  windowHeight.value = window.innerHeight;
}

onMounted(() => window.addEventListener('resize', onResize));
onUnmounted(() => window.removeEventListener('resize', onResize));

const achiLayout = computed(() => {
  const count = trackedAchievements.value.length;
  if (count <= 1) return { cols: 1, className: '' };
  // 64px top-panel bar + 12px menu top offset + ~44px header + 12px bottom margin
  const reservedHeight = 132;
  // ~62px per item row (padding + progress + description + gap)
  const maxRows = Math.max(1, Math.floor((windowHeight.value - reservedHeight) / 62));
  const cols = Math.ceil(count / maxRows);
  if (cols >= 3) return { cols: 3, className: 'achi-list-three-col' };
  if (cols >= 2) return { cols: 2, className: 'achi-list-two-col' };
  return { cols: 1, className: '' };
});

const trackedAchievements = computed<TrackedAchiEntry[]>(() => {
  const achiVersion = uiState.achiVersion;
  const achiCount = uiState.achiCount;
  const lib = getGameLib();
  const game = getGameState();
  const entries: TrackedAchiEntry[] = [];
  if (achiVersion < 0 || achiCount === 0) return entries;

  for (const achi of lib.achi.items.values()) {
    const state = game.achi[achi.id];
    if (!state || (state.state !== ACHI_STATE_TRACKED && state.state !== ACHI_STATE_COMPLETE)) continue;
    entries.push({ achi });
  }

  return entries.sort((a, b) => a.achi.order - b.achi.order);
});

const displayedTrackedAchievements = computed<TrackedAchiEntry[]>(() => {
  const entries = trackedAchievements.value;
  const cols = achiLayout.value.cols;
  if (cols <= 1) return entries;

  const rows = Math.ceil(entries.length / cols);
  const displayed: TrackedAchiEntry[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const entry = entries[col * rows + row];
      if (entry) displayed.push(entry);
    }
  }
  return displayed;
});
</script>

<style scoped>
.maze-achi-menu {
  position: absolute;
  right: 12px;
  top: 12px;
  z-index: 14;
  pointer-events: auto;
}

.achi-panel {
  max-width: calc(100vw - 24px);
}

.achi-header {
  font-size: 14px;
  letter-spacing: 0.04em;
  color: rgba(226, 232, 240, 0.95);
  background: var(--panel-bg);
  border-radius: 8px;
  padding: 10px 16px;
  margin-bottom: 6px;
}

.achi-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.achi-list-two-col {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.achi-list-three-col {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
</style>
