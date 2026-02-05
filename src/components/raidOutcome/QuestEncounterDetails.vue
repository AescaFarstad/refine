<template>
  <div class="note-row">{{ questLine(entry.questId) }}</div>
  <div class="note-row time-regen" v-if="hasTimeRegen">
    Regenerated {{ timeRegenAmount }} hp: {{ entry.timeRegenHpBefore }} → <b>{{ entry.timeRegenHpAfter }}</b> over the last {{ formatDuration(entry.timeRegenDurationSec) }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { QuestEncounterLogEntry } from '../../logic/RaidLog';
import { getGameLib } from '../../logic/UIState';

const props = defineProps<{
  entry: QuestEncounterLogEntry;
}>();

function questLine(id?: string): string {
  const lib = getGameLib();
  const q = id ? lib?.quests.get(id) : undefined;
  const s = q?.encounterLine || q?.name || '';
  return s || (id || '');
}

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
.time-regen { margin-top: 8px; }
</style>
