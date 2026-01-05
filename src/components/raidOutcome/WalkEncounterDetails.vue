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
</script>

<style scoped>
.speed-reduced {
  color: var(--text-secondary, #888);
  font-size: 0.9em;
}
</style>
