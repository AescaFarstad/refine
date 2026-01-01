<template>
  <div class="hint-root">
    <div class="hint-title">Stat</div>
    <div class="hint-body">
      TODO: render stat hint
      <span v-if="statText">({{ statText }})</span>
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

const statText = computed(() => {
  const stat = props.archetype?.stat || '';
  const value = props.archetype?.value || 0;
  if (!stat) return '';
  return value ? `${stat} +${value}` : stat;
});
</script>

<style scoped>
.hint-root {
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.hint-title {
  font-size: 12px;
  opacity: 0.85;
  text-transform: uppercase;
  letter-spacing: 0.09em;
}

.hint-body {
  margin-top: 2px;
  font-size: 14px;
  font-weight: 600;
}
</style>

