<template>
  <div class="resources-details">
    <div class="row" v-if="entry.creditsCollected > 0">
      Collected <b>{{ entry.creditsCollected }} CR</b> in {{ entry.chunksCollected }} crates.
    </div>
    <div class="row" v-else-if="hasAnyFullChunk && !hasBagSpace">
      No free bag space to collect 100-credit crates.
    </div>
    <div class="row" v-else>
      No full 100-credit crates available.
    </div>
    <div class="row">
      Storage: {{ formatCredits(entry.storageBefore) }} / {{ formatCredits(entry.storageCapacity) }}
      → <b>{{ formatCredits(entry.storageAfter) }}</b> / {{ formatCredits(entry.storageCapacity) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ResourcesEncounterLogEntry } from '../../logic/RaidLog';

const props = defineProps<{
  entry: ResourcesEncounterLogEntry;
}>();

const hasAnyFullChunk = computed(() => Math.floor(Math.max(0, props.entry.storageBefore) / 100) > 0);
const hasBagSpace = computed(() => props.entry.volumeBefore < props.entry.bagsCapacity);

function formatCredits(value: number): string {
  return Math.max(0, Math.floor(value)).toString();
}
</script>

<style scoped>
.resources-details {
  display: grid;
  gap: 4px;
}

.row {
  opacity: 0.95;
}
</style>
