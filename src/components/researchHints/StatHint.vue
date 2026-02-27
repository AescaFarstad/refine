<template>
  <div class="hint-root">
    <div class="hint-body">
      <div v-if="statDescription">Increase {{ statDescription }} by {{ statIncreaseDisplay }}</div>
      <div v-if="statLongDescription" class="stat-desc">{{ statLongDescription }}</div>
      <div v-if="currentValue !== null" class="stat-values">{{ currentValueDisplay }} → <span class="new-value">{{ newValueDisplay }}</span></div>
      <div v-else class="stat-error">Unknown stat</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getGameState } from '../../logic/UIState';
import type { ReadonlyResearchArchetype, ReadonlyResearchCell, ReadonlyResearchNodeInstance } from '../../logic/UIState';

const props = defineProps<{
  cell: ReadonlyResearchCell;
  node: ReadonlyResearchNodeInstance | null;
  archetype: ReadonlyResearchArchetype | null;
}>();

const statInfo: Record<string, { name: string; description: string }> = {
  damage: { name: 'Damage', description: '' },
  health: { name: 'Health', description: '' },
  volume: { name: 'Bag Volume', description: '' },
  baseMaxWeight: { name: 'Max Carry Weight', description: '' },
  researchRevealRadius: { name: 'Research Vision Radius', description: '' },
  skillPoints: { name: 'Skill Points', description: '' },
  strength: { name: 'Strength', description: '' },
  looting: { name: 'Looting', description: '' },
  speed: { name: 'Speed', description: '' },
  chanceToHit: { name: 'Chance to Hit', description: '' },
  chanceToBlock: { name: 'Chance to Block', description: '' },
  armor: { name: 'Armor', description: '' },
  itemBans: { name: 'Max Blocked Items', description: 'Exclude items from possible drops (visit Raid Selection window)' },
  uniqueItemsBonusYield: { name: 'Unique Items Bonus Yield', description: 'Refining yield per unique item ever successfully refined.' },
};

const statReward = computed(() => {
  if (!props.archetype) return null;
  const r = props.archetype.rewards.find(r => r.kind === 'stat');
  return r && r.kind === 'stat' ? r : null;
});

const statId = computed(() => statReward.value?.stat || '');
const statIncrease = computed(() => statReward.value?.value || 0);

function formatStatValue(stat: string, value: number): string {
  if (stat === 'speed') return `${value} km/h`;
  if (stat === 'uniqueItemsBonusYield') return `${value}%`;
  return `${value}`;
}

const statIncreaseDisplay = computed(() => {
  return formatStatValue(statId.value, statIncrease.value);
});

const statDescription = computed(() => {
  const id = statId.value;
  return statInfo[id]?.name || null;
});

const statLongDescription = computed(() => {
  const id = statId.value;
  if (!id) return null;
  const description = statInfo[id]?.description || '';
  return description ? description : null;
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

const currentValueDisplay = computed(() => {
  if (currentValue.value === null) return null;
  return formatStatValue(statId.value, currentValue.value);
});

const newValueDisplay = computed(() => {
  if (newValue.value === null) return null;
  return formatStatValue(statId.value, newValue.value);
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

.stat-desc {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 500;
  opacity: 0.85;
  white-space: normal;
}

.new-value {
  color: rgba(34, 197, 94, 0.95);
}

.stat-error {
  color: rgba(239, 68, 68, 0.85);
  font-size: 13px;
}
</style>
