<template>
  <component :is="hintComponent" v-if="hintComponent" :cell="cell" :node="node" :archetype="archetype" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ResearchNodeType } from '../../logic/ResearchLib';
import type { ReadonlyResearchArchetype, ReadonlyResearchCell, ReadonlyResearchNodeInstance } from '../../logic/UIState';
import DiscoveryHint from './DiscoveryHint.vue';
import GearHint from './GearHint.vue';
import ObstacleHint from './ObstacleHint.vue';
import RefiningHint from './RefiningHint.vue';
import ResourceHint from './ResourceHint.vue';
import StatHint from './StatHint.vue';

const props = defineProps<{
  cell: ReadonlyResearchCell;
  node: ReadonlyResearchNodeInstance | null;
  archetype: ReadonlyResearchArchetype | null;
}>();

const nodeType = computed<ResearchNodeType>(() => {
  if (props.cell.blocked) return 'void';
  return props.archetype?.type ?? 'obstacle';
});

const hasRefiningRewards = computed(() => {
  if (!props.archetype) return false;
  for (const reward of props.archetype.rewards) {
    if (reward.kind === 'refining_yield_pct_bonus') return true;
    if (reward.kind === 'refining_success_chance_bonus') return true;
    if (reward.kind === 'refining_speed_pct_bonus') return true;
    if (reward.kind === 'refining_red_essence_resource_bonus') return true;
    if (reward.kind === 'refining_green_essence_resource_bonus') return true;
    if (reward.kind === 'refining_blue_essence_resource_bonus') return true;
    if (reward.kind === 'refining_yellow_neighbor_bonus') return true;
  }
  return false;
});

const hintComponent = computed(() => {
  if (hasRefiningRewards.value) return RefiningHint;
  switch (nodeType.value) {
    case 'gear':
      return GearHint;
    case 'resource':
      return ResourceHint;
    case 'stat':
      return StatHint;
    case 'discovery':
    case 'refining':
      return DiscoveryHint;
    case 'obstacle':
      return ObstacleHint;
    default:
      return null;
  }
});
</script>
