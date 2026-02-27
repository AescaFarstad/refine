<template>
  <div class="raids-view">
    <div
      v-if="locationsAtlasReady && locationsAtlasSource && activeRaid"
      class="raid-bg-image"
      :style="raidBackgroundStyle"
    />
    <div class="raid-main-bg">
      <RaidSetup />

      <RaidGear v-if="hasSelection" />
    </div>
    <RaidDeploy v-if="hasSelection" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { uiState } from '../logic/UIState';
import RaidSetup from './RaidSetup.vue';
import RaidGear from './RaidGear.vue';
import RaidDeploy from './RaidDeploy.vue';
import atlasStorage from '../logic/AtlasStorage';
import { locationsAtlasFrames } from '../data/locationsAtlas';

const hasSelection = computed(() => !!uiState.activeRaidId);

const locationsAtlasSource = ref<HTMLImageElement | null>(atlasStorage.getLocationsSource());
const locationsAtlasReady = ref<boolean>(atlasStorage.isLocationsAtlasLoaded());

const activeRaid = computed(() => {
  if (!uiState.activeRaidId) return null;
  return uiState.raids.find(r => r.id === uiState.activeRaidId) || null;
});

const raidBackgroundStyle = computed(() => {
  const raid = activeRaid.value!;
  const source = locationsAtlasSource.value!;
  const frame = locationsAtlasFrames[raid.locationImageId]!;

  const atlasW = source.naturalWidth;
  const atlasH = source.naturalHeight;

  // Calculate viewport dimensions (approximate, the background will scale via CSS)
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 1080;

  // Scale to cover the entire viewport while maintaining aspect ratio
  const scaleX = viewportW / frame.w;
  const scaleY = viewportH / frame.h;
  const scale = Math.max(scaleX, scaleY);

  // Center the image
  const scaledFrameW = frame.w * scale;
  const scaledFrameH = frame.h * scale;
  const offsetX = (scaledFrameW - viewportW) / 2;
  const offsetY = (scaledFrameH - viewportH) / 2;

  return {
    backgroundImage: `url(${source.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${frame.x * scale + offsetX}px -${frame.y * scale + offsetY}px`,
    backgroundSize: `${atlasW * scale}px ${atlasH * scale}px`,
  } as Record<string, string>;
});

onMounted(async () => {
  if (!locationsAtlasReady.value) {
    try { await atlasStorage.loadLocationsAtlas(); } catch (_e) { /* noop */ }
    locationsAtlasReady.value = atlasStorage.isLocationsAtlasLoaded();
    locationsAtlasSource.value = atlasStorage.getLocationsSource();
  }

});
</script>

<style scoped>
.raids-view {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 12px;
  --raid-panel-bg: rgba(23, 33, 47, 0.82);
  --raid-item-bg: rgba(255, 255, 255, 0.06);
}
.raids-view :deep(.panel) { background: transparent !important; box-shadow: none !important; border: none !important; }
.raid-bg-image {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  opacity: 0.55;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}
/* Unified background for raid details, quests, and gear */
.raid-main-bg {
  position: relative;
  background: var(--raid-panel-bg);
  border-radius: 6px;
  padding: 0px;
  display: flex;
  flex-direction: column;
  z-index: 1;
}
.raids-view > :not(.raid-bg-image) {
  position: relative;
  z-index: 1;
}
/* Allow gear hints to float above the deploy panel below */
.raid-main-bg:has(.gear-item:hover) {
  z-index: 2;
}
</style>
