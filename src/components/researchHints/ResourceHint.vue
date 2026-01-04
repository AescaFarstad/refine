<template>
  <div class="hint-root">
    <div class="hint-body">
      <span v-if="spec">Gives <span class="resource-value" :style="{ color: spec.color }">{{ amount }}{{ spec.glyph }}</span> {{ spec.name }} <span class="resource-desc">({{ spec.description }})</span></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ResearchCell } from '../../logic/GameState';
import type { ResearchArchetype, ResearchNodeInstance } from '../../logic/ResearchLib';
import { getResourceSpecByAnyKey } from '../../logic/Resources';

const props = defineProps<{
  cell: ResearchCell;
  node: ResearchNodeInstance | null;
  archetype: ResearchArchetype | null;
}>();


const resourceKey = computed(() => props.archetype?.resource || '');
const amount = computed(() => props.archetype?.amount || 0);

const spec = computed(() => {
  if (!resourceKey.value) return null;
  return getResourceSpecByAnyKey(resourceKey.value);
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
  font-weight: 600;
  white-space: nowrap;
}

.resource-value {
  font-weight: 700;
}

.resource-desc {
  opacity: 0.9;
}
</style>
