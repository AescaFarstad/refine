<template>
  <div class="hint-root">
    <div class="hint-body">
      <span v-if="spec">Gives <span class="resource-value" :style="{ color: spec.color }">{{ amount }}{{ spec.glyph }}</span> {{ spec.name }} <span class="resource-desc">({{ spec.description }})</span></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getResourceSpecByAnyKey } from '../../logic/Resources';
import type { ReadonlyResearchArchetype, ReadonlyResearchCell, ReadonlyResearchNodeInstance } from '../../logic/UIState';

const props = defineProps<{
  cell: ReadonlyResearchCell;
  node: ReadonlyResearchNodeInstance | null;
  archetype: ReadonlyResearchArchetype | null;
}>();


const resourceReward = computed(() => {
  if (!props.archetype) return null;
  const r = props.archetype.rewards.find(r => r.kind === 'resource');
  return r && r.kind === 'resource' ? r : null;
});

const resourceKey = computed(() => resourceReward.value?.resource || '');
const amount = computed(() => resourceReward.value?.amount || 0);

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
