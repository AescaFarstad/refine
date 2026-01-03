<template>
  <div class="hint-root">
    <div class="hint-body">
      <span v-if="resourceKey">Gives <span class="resource-value">{{ amount }}{{ glyph }}</span> {{ displayName }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ResearchCell } from '../../logic/GameState';
import type { ResearchArchetype, ResearchNodeInstance } from '../../logic/ResearchLib';
import { getResourceGlyph } from '../../logic/drawResearch';

const props = defineProps<{
  cell: ResearchCell;
  node: ResearchNodeInstance | null;
  archetype: ResearchArchetype | null;
}>();


const resourceDisplayNames: Record<string, string> = {
  credits: 'Credits (Used to purchase gear)',
  chronotraces: 'Chronotraces (Used for research)',
  timeFlux: 'Time Flux (Used for maze traversal',
  shards: 'Shards (Used to upgrade wafer size)',
  skillPoints: 'Skill Point (Used to equip more gear items from a category)',
};

const resourceKey = computed(() => props.archetype?.resource || '');
const amount = computed(() => props.archetype?.amount || 0);

const glyph = computed(() => {
  if (!resourceKey.value) return '';
  return getResourceGlyph(resourceKey.value);
});

const displayName = computed(() => {
  if (!resourceKey.value) return '';
  return resourceDisplayNames[resourceKey.value] || resourceKey.value;
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
  color: rgba(34, 197, 94, 0.95);
  font-weight: 700;
}
</style>
