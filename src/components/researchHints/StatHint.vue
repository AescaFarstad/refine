<template>
  <div class="hint-root">
    <div class="hint-body">
      <div v-if="statDescription">Increase {{ statDescription }} by {{ statIncrease }}</div>
      <div v-if="currentValue !== null" class="stat-values">{{ currentValue }} → <span class="new-value">{{ newValue }}</span></div>
      <div v-else class="stat-error">Unknown stat</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ResearchCell } from '../../logic/GameState';
import type { ResearchArchetype, ResearchNodeInstance } from '../../logic/ResearchLib';
import { getGameState } from '../../logic/UIState';

const props = defineProps<{
  cell: ResearchCell;
  node: ResearchNodeInstance | null;
  archetype: ResearchArchetype | null;
}>();

const statDescriptions: Record<string, string> = {
  damage: 'Damage',
  health: 'Health',
  volume: 'Bags Volume',
  baseMaxWeight: 'Max Carry Weight',
  researchRevealRadius: 'Research Vision Radius',
  skillPoints: 'Skill Points',
  strength: 'Strength',
  looting: 'Looting',
  speed: 'Speed',
  chanceToHit: 'Chance to Hit',
  chanceToBlock: 'Chance to Block',
};

const statReward = computed(() => {
  if (!props.archetype) return null;
  const r = props.archetype.rewards.find(r => r.kind === 'stat');
  return r && r.kind === 'stat' ? r : null;
});

const statId = computed(() => statReward.value?.stat || '');
const statIncrease = computed(() => statReward.value?.value || 0);

const statDescription = computed(() => {
  const id = statId.value;
  return statDescriptions[id] || null;
});

const currentValue = computed(() => {
  const id = statId.value;
  if (!id) return null;

  const gs = getGameState();
  // Access the stat value from GameState
  const value = (gs as any)[id];
  return typeof value === 'number' ? value : null;
});

const newValue = computed(() => {
  if (currentValue.value === null) return null;
  return currentValue.value + statIncrease.value;
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
  white-space: nowrap;
}

.stat-values {
  margin-top: 4px;
  font-size: 15px;
  font-weight: 700;
}

.new-value {
  color: rgba(34, 197, 94, 0.95);
}

.stat-error {
  color: rgba(239, 68, 68, 0.85);
  font-size: 13px;
}
</style>
