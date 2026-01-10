<template>
  <div class="hint-root">
    <div class="hint-body">
      <div class="unlock-text">Unlock: <span class="disc-name">{{ title }}</span></div>
      <div v-if="description" class="disc-desc">{{ description }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ResearchCell } from '../../logic/GameState';
import type { ResearchArchetype, ResearchNodeInstance } from '../../logic/ResearchLib';

const props = defineProps<{
  cell: ResearchCell;
  node: ResearchNodeInstance | null;
  archetype: ResearchArchetype | null;
}>();

const title = computed(() => props.archetype!.title);
const description = computed(() => props.archetype!.description);
</script>

<style scoped>
.hint-root {
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.03em;
  min-width: 220px;
}

.hint-body {
  margin-top: 2px;
  font-size: 14px;
  font-weight: 600;
}

.unlock-text {
  white-space: nowrap;
}

.disc-name {
  color: rgba(34, 197, 94, 0.95);
  font-weight: 700;
}

.disc-desc {
  margin-top: 6px;
  font-size: 13px;
  font-weight: 500;
  opacity: 0.9;
  max-width: 320px;
}
</style>
