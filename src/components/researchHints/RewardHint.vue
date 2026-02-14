<template>
  <div class="hint-root">
    <div class="hint-body">
      <div class="title">Rewards</div>
      <div v-for="(line, idx) in rewardLines" :key="idx" class="reward-line">
        {{ line }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getGameLib } from '../../logic/UIState';
import { formatRewardsHintText } from '../../logic/RewardHintText';
import type { ReadonlyResearchArchetype, ReadonlyResearchCell, ReadonlyResearchNodeInstance } from '../../logic/UIState';

const props = defineProps<{
  cell: ReadonlyResearchCell;
  node: ReadonlyResearchNodeInstance | null;
  archetype: ReadonlyResearchArchetype | null;
}>();

const rewardLines = computed(() => {
  const rewards = props.archetype!.rewards;
  return formatRewardsHintText(rewards, getGameLib());
});
</script>

<style scoped>
.hint-root {
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.03em;
  min-width: 240px;
}

.hint-body {
  margin-top: 2px;
  font-size: 14px;
  font-weight: 600;
}

.title {
  margin-bottom: 4px;
  font-size: 12px;
  opacity: 0.85;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.reward-line {
  white-space: nowrap;
}
</style>
