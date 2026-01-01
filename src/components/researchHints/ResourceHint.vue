<template>
  <div class="hint-root">
    <div class="hint-title">Resource</div>
    <div class="hint-body">
      TODO: render resource hint
      <span v-if="resourceText">({{ resourceText }})</span>
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

const resourceText = computed(() => {
  const resource = props.archetype?.resource || '';
  const amount = props.archetype?.amount || 0;
  if (!resource) return '';
  return amount > 0 ? `${amount} ${resource}` : resource;
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

