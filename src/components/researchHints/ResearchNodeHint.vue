<template>
  <component :is="hintComponent" v-if="hintComponent" :cell="cell" :node="node" :archetype="archetype" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ResearchCell } from '../../logic/GameState';
import type { ResearchArchetype, ResearchNodeInstance, ResearchNodeType } from '../../logic/ResearchLib';
import GearHint from './GearHint.vue';
import ResourceHint from './ResourceHint.vue';
import StatHint from './StatHint.vue';

const props = defineProps<{
  cell: ResearchCell;
  node: ResearchNodeInstance | null;
  archetype: ResearchArchetype | null;
}>();

const nodeType = computed<ResearchNodeType>(() => {
  if (props.cell.blocked) return 'void';
  return props.archetype?.type ?? 'obstacle';
});

const hintComponent = computed(() => {
  switch (nodeType.value) {
    case 'gear':
      return GearHint;
    case 'resource':
      return ResourceHint;
    case 'stat':
      return StatHint;
    default:
      return null;
  }
});
</script>
