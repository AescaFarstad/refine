<template>
  <div class="walk-row" v-if="entry.hpAfter > entry.hpBefore">
    Regenerated health: {{ entry.hpBefore }} -> <b>{{ entry.hpAfter }}</b>
  </div>
</template>

<script setup lang="ts">
import type { WalkEncounterLogEntry } from '../../logic/RaidLog';

defineProps<{
  entry: WalkEncounterLogEntry;
}>();
</script>
