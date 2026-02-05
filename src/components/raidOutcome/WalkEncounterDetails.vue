<template>
  <div class="walk-row speed-row">
    Speed: <b>{{ entry.speedKmH.toFixed(2) }} km/h</b>
    <span v-if="speedReduced" class="speed-reduced">
      (down from {{ entry.maxSpeedKmH.toFixed(2) }} because health is {{ entry.hpBefore }}/{{ entry.maxHp }})
    </span>
  </div>
  <div class="walk-row" v-if="entry.hpAfter > entry.hpBefore">
    Regenerated health: {{ entry.hpBefore }} -> <b>{{ entry.hpAfter }}</b>
  </div>
  <div class="walk-row time-regen" v-if="hasTimeRegen">
    Regenerated {{ timeRegenAmount }} hp: {{ entry.timeRegenHpBefore }} → <b>{{ entry.timeRegenHpAfter }}</b> over the last {{ formatDuration(entry.timeRegenDurationSec) }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { WalkEncounterLogEntry } from '../../logic/RaidLog';

const props = defineProps<{
  entry: WalkEncounterLogEntry;
}>();

const speedReduced = computed(() => {
  // Speed is reduced if current speed is less than max speed and painkiller isn't active
  return !props.entry.hasPainkiller && props.entry.speedKmH < props.entry.maxSpeedKmH - 0.01;
});

const hasTimeRegen = computed(() => (props.entry.timeRegenHpAfter || 0) > (props.entry.timeRegenHpBefore || 0));
const timeRegenAmount = computed(() => (props.entry.timeRegenHpAfter || 0) - (props.entry.timeRegenHpBefore || 0));

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  if (m < 1) return `${sec} seconds`;
  if (m === 1) return '1 minute';
  return `${m} minutes`;
}
</script>

<style scoped>
.speed-reduced {
  color: var(--text-secondary, #888);
  font-size: 0.9em;
}
.time-regen { margin-top: 8px; }
</style>
