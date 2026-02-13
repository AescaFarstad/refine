<template>
  <div>
    <div v-if="blocked" class="blocked-warning">No spare slots in this category</div>
    <div v-if="blocked" class="blocked-warning">(Use ◌ skill points to unlock more slots)</div>
    <div class="hint-row" v-for="(row, i) in hintRows" :key="i">
      <span class="hint-label">{{ row.label }}</span>
      <span class="hint-value"><span :style="row.color ? { color: row.color } : undefined">{{ row.value }}</span>{{ row.suffix }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { GearDefinition } from '../logic/GearLib';
import { formatDurationHM } from '../logic/StringUtils';
import { getResourceSpec } from '../logic/Resources';
import { getGameState, uiState } from '../logic/UIState';

const creditsSpec = getResourceSpec('credits');

const props = defineProps<{
  gear: GearDefinition;
  blocked?: boolean;
}>();

function fmtSigned(n: number, suffix = ''): string {
  if (n > 0) return `+${n}${suffix}`;
  if (n < 0) return `${n}${suffix}`;
  return `0${suffix}`;
}

const hintRows = computed((): Array<{ label: string; value: string; color?: string; suffix?: string }> => {
  const g = props.gear;
  const rows: Array<{ label: string; value: string; color?: string; suffix?: string }> = [];

  if (g.damage) rows.push({ label: 'Damage', value: `${fmtSigned(g.damage)}` });
  if (g.speedPercent) rows.push({ label: 'Walking speed', value: `${fmtSigned(g.speedPercent, '%')}` });
  if (g.speedFlat) rows.push({ label: 'Flat speed bonus', value: `${fmtSigned(g.speedFlat, ' km/h')}` });
  if (g.walkMultiplier !== 1) rows.push({ label: 'Walk distance', value: `×${g.walkMultiplier}` });
  if (g.walkDelta !== 0) rows.push({ label: 'Walk distance', value: `${fmtSigned(g.walkDelta)} km` });
  if (g.chanceToHit) rows.push({ label: 'Hit chance', value: `${fmtSigned(g.chanceToHit, '%')}` });
  if (g.regenPerKm) rows.push({ label: 'Regen', value: `${fmtSigned(g.regenPerKm)} hp/km${g.regenPerKm < 0 ? ' (loss)' : ''}` });
  if (g.regenAfterCombat) rows.push({ label: 'Regen after combat', value: `${fmtSigned(g.regenAfterCombat)} hp${g.regenAfterCombat < 0 ? ' (loss)' : ''}` });
  if (g.regenPer10Minutes) rows.push({ label: 'Regen per 10 min', value: `${fmtSigned(g.regenPer10Minutes)} hp${g.regenPer10Minutes < 0 ? ' (loss)' : ''}` });

  if (g.prepTimeMin) rows.push({ label: 'Prep time', value: `${g.prepTimeMin} min` });

  if (g.hp) rows.push({ label: 'HP', value: `${fmtSigned(g.hp)}${g.hp < 0 ? ' (loss)' : ''}` });
  if (g.hpMult !== 1) rows.push({ label: 'HP multiplier', value: `×${g.hpMult}` });
  if (g.chanceToBlock) rows.push({ label: 'Block chance', value: `${fmtSigned(g.chanceToBlock, '%')}` });
  if (g.attackSkipCount) rows.push({ label: 'Attack skips', value: `${fmtSigned(g.attackSkipCount)}` });
  if (g.reflectOnHitPct) rows.push({ label: 'Reflect on hit', value: `${fmtSigned(g.reflectOnHitPct, '%')}` });
  if (g.reflectOnBlockPct) rows.push({ label: 'Reflect on block', value: `${fmtSigned(g.reflectOnBlockPct, '%')}` });
  if (g.stunChance) rows.push({ label: 'Stun chance', value: `${fmtSigned(g.stunChance, '%')}` });

  if (g.lootChance) rows.push({ label: 'Loot chance', value: `${fmtSigned(g.lootChance, '%')}` });
  if (g.rarityBuff) rows.push({ label: 'Loot rarity', value: `${fmtSigned(g.rarityBuff, '')}` });
  if (g.biopsyChance) rows.push({ label: 'Remains harvest chance', value: `${fmtSigned(g.biopsyChance, '%')}` });
  if (g.maxWeight) rows.push({ label: 'Max weight', value: `${fmtSigned(g.maxWeight)}` });
  if (g.volume) rows.push({ label: 'Volume', value: `${fmtSigned(g.volume)}` });
  if (g.zoneBoost) rows.push({ label: 'Zone stability', value: `+${formatDurationHM(g.zoneBoost)} (permanent)` });
  if (g.priceChange) rows.push({ label: 'Price change', value: `${fmtSigned(g.priceChange)}${creditsSpec.glyph}`, color: creditsSpec.color, suffix: ' for each usage in the raid' });
  if (g.reimbursed) rows.push({ label: `Reimbursement: `, value: `${g.reimbursed}%` });
  // Perk
  if (g.perk) rows.push({ label: 'Perk', value: g.perk });

  if (g.stunChance) {
    uiState.raidKey; // reactive dependency: recompute when loadout changes
    const gs = getGameState();
    const loadout = gs.loadouts[gs.raid.id] ?? [];
    const equipped = loadout.includes(g.id);
    const total = equipped
      ? gs.raid.stunChance
      : 100 - (100 - gs.raid.stunChance) * (100 - g.stunChance) / 100;
    if (total !== g.stunChance) {
      rows.push({ label: 'Total stun chance', value: `${Math.round(total)}%` });
    }
  }

  // Description
  if (g.description) rows.push({ label: '', value: g.description });
  return rows;
});
</script>

<style scoped>

.blocked-warning {
  color: #f87171;
  font-weight: 900;
  font-size: 14px;
  margin-bottom: 6px;
  white-space: nowrap;
}

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
  white-space: pre-line;
}
</style>
