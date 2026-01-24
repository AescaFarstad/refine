<template>
  <div class="hint-root">
    <div class="hint-body">
      <div v-if="gear">
        <div class="unlock-text">Unlock gear: <span class="gear-name">{{ gear.name }}</span></div>
        <div class="gear-info">Type: {{ categoryName }}<span v-if="isNewCategory" class="new-category">First of this type!</span></div>
        <div class="gear-info">Price: <span class="price" :style="{ color: creditsSpec.color }">{{ gear.price }}{{ creditsSpec.glyph }}</span></div>
        <div class="gear-info">Weight: {{ gear.weight }}</div>
        <GearStatsHint :gear="gear" class="gear-stats" />
      </div>
      <div v-else class="gear-error">Unknown gear</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ResearchCell } from '../../logic/GameState';
import type { ResearchArchetype, ResearchNodeInstance } from '../../logic/ResearchLib';
import { getGameState, uiState } from '../../logic/UIState';
import GearStatsHint from '../GearStatsHint.vue';
import { getResourceSpec } from '../../logic/Resources';

const props = defineProps<{
  cell: ResearchCell;
  node: ResearchNodeInstance | null;
  archetype: ResearchArchetype | null;
}>();

const creditsSpec = getResourceSpec('credits');

const gearId = computed(() => {
  if (!props.archetype) return '';
  const reward = props.archetype.rewards.find(r => r.kind === 'unlock_gear');
  return reward && reward.kind === 'unlock_gear' ? reward.gearId : '';
});

const gear = computed(() => {
  if (!gearId.value) return null;
  const gs = getGameState();
  return gs.lib.gear.get(gearId.value) || null;
});

const categoryName = computed(() => {
  if (!gear.value) return '';
  const gs = getGameState();
  const category = gs.lib.gearCategories.get(gear.value.category);
  return category?.name || gear.value.category;
});

const isNewCategory = computed(() => {
  if (!gear.value) return false;
  return !uiState.unlockedGearCategories.includes(gear.value.category);
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
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.unlock-text {
  margin-bottom: 6px;
  font-size: 14px;
}

.gear-name {
  color: rgba(34, 197, 94, 0.95);
  font-weight: 700;
}

.gear-info {
  margin-top: 3px;
  font-size: 13px;
  font-weight: 500;
  opacity: 0.9;
}

.price {
  font-weight: 600;
}

.gear-error {
  color: rgba(239, 68, 68, 0.85);
  font-size: 13px;
}

.gear-stats {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.new-category {
  color: rgba(251, 191, 36, 0.95);
  font-weight: 700;
  margin-left: 1em;
}
</style>
