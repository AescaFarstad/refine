<template>
  <div class="hint-root">
    <div class="hint-body">{{ hintText }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ReadonlyResearchArchetype, ReadonlyResearchCell, ReadonlyResearchNodeInstance } from '../../logic/UIState';

const props = defineProps<{
  cell: ReadonlyResearchCell;
  node: ReadonlyResearchNodeInstance | null;
  archetype: ReadonlyResearchArchetype | null;
}>();

const hintText = computed(() => {
  return props.archetype?.description;
});
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
  font-weight: 500;
  max-width: 340px;
}
</style>
