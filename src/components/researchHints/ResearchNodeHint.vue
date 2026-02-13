<template>
  <component :is="hintComponent" v-if="hintComponent" :cell="cell" :node="node" :archetype="archetype" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ResearchCell } from '../../logic/GameState';
import type { ResearchArchetype, ResearchNodeInstance, ResearchNodeType } from '../../logic/ResearchLib';
import DiscoveryHint from './DiscoveryHint.vue';
import GearHint from './GearHint.vue';
import RewardHint from './RewardHint.vue';
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

const hasRefiningRewards = computed(() => {
  if (!props.archetype) return false;
  for (const reward of props.archetype.rewards) {
    if (reward.kind === 'refining_yield_pct_bonus') return true;
    if (reward.kind === 'refining_success_chance_bonus') return true;
    if (reward.kind === 'refining_speed_pct_bonus') return true;
  }
  return false;
});

const hintComponent = computed(() => {
  if (hasRefiningRewards.value) return RewardHint;
  switch (nodeType.value) {
    case 'gear':
      return GearHint;
    case 'resource':
      return ResourceHint;
    case 'stat':
      return StatHint;
    case 'discovery':
      return DiscoveryHint;
    default:
      return null;
  }
});
</script>
