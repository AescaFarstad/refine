<template>
  <div v-if="hintRows.length > 0">
    <div class="hint-row" v-for="(row, i) in hintRows" :key="i">
      <span class="hint-label">{{ row.label }}</span>
      <span class="hint-value">{{ row.value }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { GearDefinition } from '../logic/GearLib';

const props = defineProps<{
  gear: GearDefinition;
}>();

function fmtSigned(n: number, suffix = ''): string {
  if (n > 0) return `+${n}${suffix}`;
  if (n < 0) return `${n}${suffix}`;
  return `0${suffix}`;
}

const hintRows = computed((): Array<{ label: string; value: string }> => {
  const g = props.gear;
  const rows: Array<{ label: string; value: string }> = [];

  if (g.speedPercent) rows.push({ label: 'Speed', value: `${fmtSigned(g.speedPercent, '%')}` });
  if (g.speedFlat) rows.push({ label: 'Speed (flat)', value: `${fmtSigned(g.speedFlat)}` });
  if (g.regenPerKm) rows.push({ label: 'Regen', value: `${fmtSigned(g.regenPerKm)} hp/km` });
  if (g.regenAfterEncounter) rows.push({ label: 'Regen/encounter', value: `${fmtSigned(g.regenAfterEncounter)} hp` });

  if (g.hp) rows.push({ label: 'HP', value: `${fmtSigned(g.hp)}` });
  if (g.damage) rows.push({ label: 'Damage', value: `${fmtSigned(g.damage)}` });
  if (g.chanceToHit) rows.push({ label: 'Hit chance', value: `${fmtSigned(g.chanceToHit, '%')}` });
  if (g.chanceToBlock) rows.push({ label: 'Block chance', value: `${fmtSigned(g.chanceToBlock, '%')}` });
  if (g.reflectOnHitPct) rows.push({ label: 'Reflect on hit', value: `${fmtSigned(g.reflectOnHitPct, '%')}` });
  if (g.reflectOnBlockPct) rows.push({ label: 'Reflect on block', value: `${fmtSigned(g.reflectOnBlockPct, '%')}` });

  if (g.lootChance) rows.push({ label: 'Loot chance', value: `${fmtSigned(g.lootChance, '%')}` });
  if (g.biopsyChance) rows.push({ label: 'Remains harvest', value: `${fmtSigned(g.biopsyChance, '%')}` });
  if (g.maxWeight) rows.push({ label: 'Max weight', value: `${fmtSigned(g.maxWeight)}` });
  if (g.volume) rows.push({ label: 'Volume', value: `${fmtSigned(g.volume)}` });
  // Perk
  if (g.perk) rows.push({ label: 'Perk', value: g.perk });
  return rows;
});
</script>

<style scoped>

.hint-row {
  white-space: nowrap;
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 8px;
  align-items: baseline;
  margin: 2px 0;
}

.hint-label {
  color: var(--text-secondary);
  font-size: 13px;
  letter-spacing: 0.06em;
  font-weight: 800;
}

.hint-value {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 800;
}
</style>
