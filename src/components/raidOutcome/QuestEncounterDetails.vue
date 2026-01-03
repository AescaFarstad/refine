<template>
  <div class="note-row">{{ questLine(entry.questId) }}</div>
</template>

<script setup lang="ts">
import type { QuestEncounterLogEntry } from '../../logic/RaidLog';
import { getGameLib } from '../../logic/UIState';

defineProps<{
  entry: QuestEncounterLogEntry;
}>();

function questLine(id?: string): string {
  const lib = getGameLib();
  const q = id ? lib?.quests.get(id) : undefined;
  const s = q?.encounterLine || q?.name || '';
  return s || (id || '');
}
</script>
