<template>
  <div class="timeline-log" @mouseenter="open = true" @mouseleave="open = false">
    <slot>
      <button class="log-button" type="button">Log</button>
    </slot>
    <div v-if="open" class="log-menu">
      <div v-if="entries.length === 0" class="empty">No events yet</div>
      <div v-for="entry in entries" :key="entry.key" class="log-entry">
        <span class="log-time"><span>{{ entry.time }}</span> <span class="ago">ago</span></span>
        <span class="log-resolution" :style="{ color: entry.color }">{{ entry.resolution }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { getGameLib, getGameState, uiState } from '../logic/UIState';
import { formatRewardHintText } from '../logic/RewardHintText';
import { formatDurationHM } from '../logic/StringUtils';
import { getResourceSpec } from '../logic/Resources';

const open = ref(false);

const entries = computed(() => {
  uiState.timelineVersion;
  uiState.timeMinutes;
  const gs = getGameState();
  const lib = getGameLib();
  return gs.timelineEvents
    .filter(entry => entry.executed)
    .slice()
    .reverse()
    .map((entry, idx) => {
      const archetype = lib.timeline.archetypes.get(entry.archetypeId)!;
      const reward = entry.resolvedOptionIndex >= 0 ? archetype.options[entry.resolvedOptionIndex]! : null;
      return {
        key: `${entry.eventId}:${entry.at}:${idx}`,
        time: formatDurationHM(Math.max(0, gs.gameTime - entry.at)),
        resolution: entry.resolvedDescription || (reward ? formatRewardHintText(reward, lib) : 'No affordable option'),
        color: reward?.kind === 'resource' ? getResourceSpec(reward.resource).color : '#f8fafc',
      };
    });
});
</script>

<style scoped>
.timeline-log {
  position: relative;
  z-index: 20;
  flex: 0 0 auto;
}

.log-button {
  height: 34px;
  min-width: 48px;
  padding: 0 12px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: #cbd5e1;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  cursor: default;
}

.timeline-log:hover .log-button {
  border-color: rgba(34, 211, 238, 0.5);
  background: rgba(34, 211, 238, 0.12);
  color: #f8fafc;
}

.log-menu {
  position: absolute;
  left: 0;
  top: 100%;
  width: 300px;
  max-height: 360px;
  overflow: auto;
  padding: 20px 8px 8px;
  border: 0;
  border-radius: 6px;
  background: linear-gradient(180deg, transparent 0, transparent 12px, rgba(15, 23, 42, 0.96) 12px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
}

.log-menu::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 12px;
}

.log-menu::-webkit-scrollbar {
  width: 8px;
}

.log-menu::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.72);
  border-radius: 8px;
}

.log-menu::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.42);
  border: 2px solid rgba(15, 23, 42, 0.72);
  border-radius: 8px;
}

.log-menu::-webkit-scrollbar-thumb:hover {
  background: rgba(34, 211, 238, 0.58);
}

.empty {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 700;
}

.log-entry {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 7px 4px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.log-entry:last-child {
  border-bottom: 0;
}

.log-time {
  width: 64px;
  flex: 0 0 64px;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 800;
  text-align: left;
}

.ago {
  color: rgba(148, 163, 184, 0.55);
}

.log-resolution {
  min-width: 0;
  color: #f8fafc;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.35;
  overflow-wrap: anywhere;
  white-space: normal;
}
</style>
