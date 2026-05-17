<template>
  <div
    class="timeline-event"
    :class="[`timeline-event-${archetype.sentiment}`, { 'timeline-event-faded': faded }]"
    :style="eventStyle"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <button class="event-marker" type="button" :aria-label="eventLabel">
      <span class="event-border"></span>
      <span v-if="archetype.icon.kind === 'glyph'" class="event-glyph" :style="glyphStyle">{{ archetype.icon.glyph }}</span>
      <span v-else-if="archetype.icon.kind === 'itemImage'" class="event-sprite" :style="spriteStyle"></span>
    </button>

    <div v-if="hovered" class="event-hint" role="tooltip">
      <div class="hint-time">In {{ timeUntil }}</div>
      <div v-if="optionEntries.length === 1" class="single-option">
        <span :style="{ color: optionEntries[0]!.affordable ? '' : '#fca5a5' }">{{ optionEntries[0]!.line }}</span>
        <span v-if="!optionEntries[0]!.affordable" class="unaffordable-note">Not enough resources right now</span>
      </div>
      <div v-else class="hint-options">
        <div class="choice-title">Choose the preferred outcome:</div>
        <label
          v-for="entry in optionEntries"
          :key="entry.idx"
          class="option-radio"
          :class="{ preferred: selectedOptionIndex === entry.idx }"
        >
          <input
            type="radio"
            :name="`timeline-event-${event.eventId}-${event.at}`"
            :checked="selectedOptionIndex === entry.idx"
            @change="chooseOption(entry.idx)"
          >
          <span class="radio-mark"></span>
          <span class="radio-text">
            <span :style="{ color: entry.affordable ? '' : '#fca5a5' }">{{ entry.line }}</span>
            <span v-if="!entry.affordable" class="unaffordable-note">Not enough resources right now</span>
          </span>
        </label>
      </div>
      <div v-if="event.repeat > 0" class="hint-repeat">This event repeats every {{ repeatEvery }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import atlasStorage from '../logic/AtlasStorage';
import { atlasSpriteStyle } from '../logic/AtlasSpriteStyle';
import { formatRewardHintText } from '../logic/RewardHintText';
import { getGameLib, getGameState, uiState, type ReadonlyGameState, type ReadonlyLib } from '../logic/UIState';
import { formatDurationHM } from '../logic/StringUtils';
import { globalInputQueue } from '../logic/Model';
import { CmdSetTimelinePreferredOption } from '../logic/input/InputCommands';
import { getResourceSpec } from '../logic/Resources';

const props = defineProps<{
  event: ReadonlyGameState['timelineEvents'][number];
  archetype: ReadonlyLib['timeline']['archetypes'] extends ReadonlyMap<string, infer V> ? V : never;
  leftPct: number;
  faded?: boolean;
}>();

const hovered = ref(false);
const atlasSource = atlasStorage.getItemsSource();

const eventLabel = computed(() => props.event.eventId);

const selectedResourceColor = computed(() => {
  const optionIndex = selectedOptionIndex.value;
  if (optionIndex < 0) return '';
  const reward = props.archetype.options[optionIndex]!;
  if (reward.kind !== 'resource') return '';
  return getResourceSpec(reward.resource).color;
});

const eventStyle = computed(() => ({
  left: `${props.leftPct}%`,
  '--event-icon-color': selectedResourceColor.value || '#e2e8f0',
}));

const spriteStyle = computed(() => {
  if (props.archetype.icon.kind !== 'itemImage') return {};
  const frame = atlasStorage.getItemsFrame(props.archetype.icon.key)!;
  return {
    ...atlasSpriteStyle(atlasSource, frame, {
      size: 24 * props.archetype.icon.scale,
      mode: 'fit',
      allowUpscale: false,
    }),
    transform: `translate(${props.archetype.icon.offset.x}px, ${props.archetype.icon.offset.y}px)`,
  };
});

const glyphStyle = computed(() => {
  if (props.archetype.icon.kind !== 'glyph') return {};
  return {
    transform: `translate(${props.archetype.icon.offset.x}px, ${props.archetype.icon.offset.y}px) scale(${props.archetype.icon.scale})`,
  };
});

const timeUntil = computed(() => {
  uiState.timeMinutes;
  const now = getGameState().gameTime;
  return formatDurationHM(Math.max(0, props.event.at - now));
});

const repeatEvery = computed(() => formatDurationHM(props.event.repeat));

function optionIsAffordable(idx: number): boolean {
  const reward = props.archetype.options[idx]!;
  if (reward.kind !== 'resource') return true;
  if (reward.amount >= 0) return true;
  return uiState[reward.resource] >= -reward.amount;
}

const optionEntries = computed(() => props.archetype.options.map((reward, idx) => ({
  idx,
  line: formatRewardHintText(reward, getGameLib()),
  affordable: optionIsAffordable(idx),
})));

const preferredOptionIndex = computed(() => {
  uiState.timelineVersion;
  return props.event.preferredOptionIndex;
});

const selectedOptionIndex = computed(() => {
  const preferred = preferredOptionIndex.value;
  if (preferred >= 0) return preferred;
  for (let i = 0; i < props.archetype.options.length; i++) {
    if (optionIsAffordable(i)) return i;
  }
  return -1;
});

function chooseOption(optionIndex: number): void {
  globalInputQueue.push(new CmdSetTimelinePreferredOption({
    eventId: props.event.eventId,
    at: props.event.at,
    optionIndex,
  }));
}
</script>

<style scoped>
.timeline-event {
  position: absolute;
  top: calc(50% + 4px);
  transform: translateY(-50%);
  width: 42px;
  height: 42px;
  z-index: 3;
  --event-bg-strong: rgba(239, 68, 68, 0.3);
  --event-bg-mid: rgba(239, 68, 68, 0.18);
  --event-bg-soft: rgba(239, 68, 68, 0.08);
  --event-line: rgba(248, 113, 113, 0.96);
  --event-line-glow: rgba(248, 113, 113, 0.45);
}

.timeline-event-positive {
  --event-bg-strong: rgba(34, 197, 94, 0.28);
  --event-bg-mid: rgba(34, 197, 94, 0.17);
  --event-bg-soft: rgba(34, 197, 94, 0.08);
  --event-line: rgba(74, 222, 128, 0.96);
  --event-line-glow: rgba(74, 222, 128, 0.45);
}

.event-marker {
  width: 42px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: linear-gradient(90deg, var(--event-bg-strong) 0%, var(--event-bg-mid) 42%, var(--event-bg-soft) 74%, rgba(34, 211, 238, 0) 100%);
  display: grid;
  place-items: center;
  position: relative;
  cursor: default;
}

.timeline-event-faded .event-marker {
  opacity: 0.18;
}

.timeline-event-faded .event-border {
  display: none;
}

.event-border {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 1px;
  border-radius: 3px;
  background: var(--event-line);
  box-shadow: 0 0 8px var(--event-line-glow);
}

.event-sprite,
.event-glyph {
  display: block;
}

.event-glyph {
  color: var(--event-icon-color);
  font-size: 20px;
  font-weight: 800;
  line-height: 1;
}

.event-hint {
  position: absolute;
  left: 0;
  top: calc(100% + 7px);
  width: 260px;
  padding: 8px;
  border: 0;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.96);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
  color: #e2e8f0;
}

.event-hint::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: -8px;
  height: 8px;
}

.hint-time {
  font-size: 11px;
  color: #94a3b8;
}

.single-option,
.hint-options {
  margin-top: 8px;
}

.single-option {
  display: grid;
  gap: 3px;
  color: #f8fafc;
  font-size: 12px;
  font-weight: 800;
}

.hint-options {
  display: grid;
  gap: 6px;
}

.choice-title {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 800;
}

.option-radio {
  min-height: 26px;
  display: grid;
  grid-template-columns: 14px 1fr;
  align-items: start;
  gap: 7px;
  color: #cbd5e1;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.option-radio input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.radio-mark {
  width: 12px;
  height: 12px;
  margin-top: 2px;
  border: 1px solid rgba(148, 163, 184, 0.7);
  border-radius: 50%;
  box-sizing: border-box;
  position: relative;
}

.option-radio.preferred .radio-mark {
  border-color: rgba(34, 211, 238, 0.95);
}

.option-radio.preferred .radio-mark::after {
  content: "";
  position: absolute;
  left: 3px;
  top: 3px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(34, 211, 238, 0.95);
}

.option-radio:hover,
.option-radio.preferred {
  color: #f8fafc;
}

.radio-text {
  display: grid;
  gap: 2px;
}

.unaffordable-note {
  color: rgba(248, 113, 113, 0.78);
  font-size: 11px;
  font-weight: 700;
}

.hint-repeat {
  margin-top: 8px;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 700;
}
</style>
