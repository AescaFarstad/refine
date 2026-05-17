<template>
  <div class="visual-timeline" :class="{ 'visual-timeline-plain': !hasTimelineDiscovery }">
    <TimelineLogDropdown v-if="hasTimelineDiscovery" class="timeline-time-log">
      <div class="time-metric"><span class="time-value">{{ timeDisplay }}</span></div>
    </TimelineLogDropdown>
    <div v-else class="timeline-time-log">
      <div class="time-metric time-metric-plain"><span class="time-value">{{ timeDisplay }}</span></div>
    </div>
    <div v-if="hasTimelineDiscovery" class="timeline-now">
      <span class="now-line"></span>
      <span class="now-label">Now</span>
    </div>
    <div v-if="hasTimelineDiscovery" class="timeline-track">
      <div v-if="raidTimePreview" class="raid-time-preview">
        <span
          class="raid-time-preview-solid"
          :style="{ width: `${raidTimePreview.solidWidthPct}%` }"
        ></span>
        <span
          class="raid-time-preview-fade"
          :style="{ left: `${raidTimePreview.fadeLeftPct}%`, width: `${raidTimePreview.fadeWidthPct}%` }"
        ></span>
      </div>
      <div class="track-line"></div>
      <div
        v-if="zoneCollapseMarker"
        class="zone-collapse-marker"
        :style="{ left: `${zoneCollapseMarker.leftPct}%` }"
      >
        <span class="zone-collapse-line"></span>
        <span class="zone-collapse-label">Zone Collapse</span>
      </div>
      <div
        v-for="marker in dayMarkers"
        :key="marker.key"
        class="day-marker"
        :style="{ left: `${marker.leftPct}%` }"
      >
        <span class="day-label">{{ marker.label }}</span>
        <span class="day-line"></span>
      </div>
      <TimelineEvent
        v-for="entry in visibleEvents"
        :key="entry.key"
        :event="entry.event"
        :archetype="entry.archetype"
        :left-pct="entry.leftPct"
        :faded="entry.faded"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { TIMELINE_MIN_SEPARATION_SEC, TIMELINE_VISIBLE_SPAN_SEC } from '../logic/Const';
import { getGameLib, getGameState, timeDisplay, uiState } from '../logic/UIState';
import TimelineEvent from './TimelineEvent.vue';
import TimelineLogDropdown from './TimelineLogDropdown.vue';

const hasTimelineDiscovery = computed(() => {
  uiState.discoveryCounter;
  return uiState.hasDiscoveredTimeline;
});

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, value));
}

const selectedRaid = computed(() => {
  const activeRaidId = uiState.activeRaidId || uiState.raidOrder[0] || '';
  return uiState.raids.find(raid => raid.id === activeRaidId)!;
});

const isRaidTabTimeline = computed(() => hasTimelineDiscovery.value && uiState.activeTab === 'raid');

const raidTimePreview = computed(() => {
  if (!isRaidTabTimeline.value) return null;
  const lowerSec = Math.max(0, uiState.raidTimeEstimateMinSec || 0);
  const upperSec = Math.max(lowerSec, uiState.raidTimeEstimateMaxSec || uiState.raidTimeEstimateSec || 0);
  if (upperSec <= 0) return null;

  const lowerPct = clampPct((lowerSec / TIMELINE_VISIBLE_SPAN_SEC) * 100);
  const upperPct = clampPct((upperSec / TIMELINE_VISIBLE_SPAN_SEC) * 100);
  return {
    solidWidthPct: lowerPct,
    fadeLeftPct: lowerPct,
    fadeWidthPct: Math.max(0, upperPct - lowerPct),
    upperSec,
  };
});

const zoneCollapseMarker = computed(() => {
  if (!isRaidTabTimeline.value) return null;
  const raid = selectedRaid.value;
  if (!raid.zoneCollapseSec || raid.zoneCollapseSec <= 0) return null;
  return {
    leftPct: clampPct((raid.zoneCollapseSec / TIMELINE_VISIBLE_SPAN_SEC) * 100),
  };
});

const raidEventFadeUntilSec = computed(() => {
  if (!isRaidTabTimeline.value) return 0;
  const previewUpperSec = raidTimePreview.value?.upperSec ?? 0;
  const raid = selectedRaid.value;
  const collapseFadeSec = raid.zoneCollapseSec > 0
    ? raid.zoneCollapseSec + TIMELINE_MIN_SEPARATION_SEC
    : 0;
  return Math.max(previewUpperSec, collapseFadeSec);
});

const visibleEvents = computed(() => {
  uiState.timeMinutes;
  uiState.timelineVersion;
  const gs = getGameState();
  const lib = getGameLib();
  const now = gs.gameTime;
  const end = now + TIMELINE_VISIBLE_SPAN_SEC;
  const fadeUntilSec = raidEventFadeUntilSec.value;
  return gs.timelineEvents
    .filter(entry => !entry.executed && entry.at >= now && entry.at <= end)
    .map(entry => ({
      key: `${entry.eventId}:${entry.at}`,
      event: entry,
      archetype: lib.timeline.archetypes.get(entry.archetypeId)!,
      leftPct: ((entry.at - now) / TIMELINE_VISIBLE_SPAN_SEC) * 100,
      faded: fadeUntilSec > 0 && entry.at <= now + fadeUntilSec,
    }));
});

const dayMarkers = computed(() => {
  uiState.timeMinutes;
  const gs = getGameState();
  const now = gs.gameTime;
  const end = now + TIMELINE_VISIBLE_SPAN_SEC;
  const firstDayStart = Math.floor(now / 86400) * 86400;
  const markers: Array<{ key: string; label: string; leftPct: number }> = [];
  for (let at = firstDayStart; at <= end; at += 86400) {
    if (at <= now) continue;
    const dayNumber = Math.floor(at / 86400);
    markers.push({
      key: `${at}`,
      label: `Day ${dayNumber}`,
      leftPct: ((at - now) / TIMELINE_VISIBLE_SPAN_SEC) * 100,
    });
  }
  return markers;
});
</script>

<style scoped>
.visual-timeline {
  min-width: 180px;
  height: 48px;
  flex: 1 1 auto;
  display: flex;
  align-items: flex-end;
  gap: 0;
  position: relative;
  padding-top: 4px;
  box-sizing: border-box;
  transform: translateY(5px);
}

.visual-timeline-plain {
  align-items: center;
  transform: none;
}

.timeline-time-log {
  flex: 0 0 auto;
  align-self: flex-end;
  transform: translateY(-3px);
  margin-right: 12px;
}

.visual-timeline-plain .timeline-time-log {
  align-self: center;
  transform: none;
  margin-right: 0;
}

.time-metric {
  width: 128px;
  height: 34px;
  padding: 0 10px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.035);
  cursor: default;
}

.time-metric:hover {
  color: #f8fafc;
  background: rgba(34, 211, 238, 0.12);
}

.time-metric-plain {
  background: transparent;
  pointer-events: none;
}

.time-metric-plain:hover {
  color: inherit;
  background: transparent;
}

.time-value {
  display: inline-block;
  min-width: 5ch;
  text-align: center;
  white-space: nowrap;
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  text-decoration-line: underline;
  text-decoration-style: dashed;
  text-decoration-color: rgba(148, 163, 184, 0.7);
  text-underline-offset: 5px;
  text-decoration-thickness: 1px;
}

.time-metric:hover .time-value {
  text-decoration-color: rgba(34, 211, 238, 0.9);
}

.time-metric-plain .time-value {
  text-decoration-line: none;
}

.timeline-now {
  width: 1px;
  height: 40px;
  flex: 0 0 1px;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.now-line {
  width: 2px;
  height: 38px;
  border-radius: 2px;
  background: rgba(248, 250, 252, 0.95);
  box-shadow: 0 0 10px rgba(248, 250, 252, 0.35);
}

.now-label {
  position: absolute;
  top: -14px;
  color: #94a3b8;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.timeline-track {
  min-width: 0;
  height: 40px;
  flex: 1 1 auto;
  position: relative;
  overflow: visible;
}

.track-line {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 2px;
  transform: translateY(-50%);
  border-radius: 2px;
  background: linear-gradient(90deg, rgba(34, 211, 238, 0.58), rgba(148, 163, 184, 0.2));
}

.raid-time-preview {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(50% - 17px);
  height: 34px;
  pointer-events: none;
  z-index: 0;
}

.raid-time-preview-solid,
.raid-time-preview-fade {
  position: absolute;
  top: 0;
  bottom: 0;
}

.raid-time-preview-solid {
  left: 0;
  background: rgba(234, 179, 8, 0.23);
}

.raid-time-preview-fade {
  background: linear-gradient(90deg, rgba(234, 179, 8, 0.23), rgba(234, 179, 8, 0));
}

.zone-collapse-marker {
  position: absolute;
  top: 0;
  width: 1px;
  height: 40px;
  transform: translateX(-50%);
  z-index: 4;
  pointer-events: none;
}

.zone-collapse-line {
  position: absolute;
  left: 0;
  bottom: 12px;
  width: 2px;
  height: 24px;
  background: linear-gradient(0deg, rgba(248, 113, 113, 0.58), rgba(248, 113, 113, 0));
}

.zone-collapse-label {
  position: absolute;
  top: 28px;
  left: 50%;
  transform: translateX(-50%);
  color: #f87171;
  font-size: 9px;
  font-weight: 800;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.day-marker {
  position: absolute;
  top: 0;
  width: 1px;
  height: 40px;
  transform: translateX(-50%);
  z-index: 1;
  pointer-events: none;
}

.day-label {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  color: #94a3b8;
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.day-line {
  position: absolute;
  left: 0;
  top: 4px;
  width: 1px;
  height: 36px;
  background: linear-gradient(180deg, rgba(148, 163, 184, 0.58), rgba(148, 163, 184, 0));
}
</style>
