<template>
  <span class="oracle-bonus-display">
    <template v-if="bonus.reward.kind === 'refining_red_essence_resource_bonus'">
      <span class="bonus-number">{{ signed(bonus.reward.amount) }}</span>
      <span class="resource-icon" :style="resourceIconStyle('credits')" title="Credits">{{ resourceGlyph('credits') }}</span>
      <span> per</span>
      <span class="ess-icon" :style="essenceIconStyle('red')" />
    </template>
    <template v-else-if="bonus.reward.kind === 'refining_green_essence_resource_bonus'">
      <span class="bonus-number">{{ signed(bonus.reward.amount) }}</span>
      <span class="resource-icon" :style="resourceIconStyle('timeFlux')" title="Time Flux">{{ resourceGlyph('timeFlux') }}</span>
      <span> per</span>
      <span class="ess-icon" :style="essenceIconStyle('green')" />
    </template>
    <template v-else-if="bonus.reward.kind === 'refining_blue_essence_resource_bonus'">
      <span class="bonus-number">{{ signed(bonus.reward.amount) }}</span>
      <span class="resource-icon" :style="resourceIconStyle('chronotraces')" title="Chronotraces">{{ resourceGlyph('chronotraces') }}</span>
      <span> per</span>
      <span class="ess-icon" :style="essenceIconStyle('blue')" />
    </template>
    <template v-else-if="bonus.reward.kind === 'refining_yellow_neighbor_bonus'">
      <span class="bonus-number">{{ signed(bonus.reward.amount) }}</span>
      <span class="ess-icon" :style="essenceIconStyle('yellow')" />
      <span> adjacency</span>
    </template>
    <template v-else-if="bonus.reward.kind === 'refining_yield_pct_bonus'">
      <span class="bonus-number">{{ signed(bonus.reward.amount) }}%</span>
      <span> refining yield</span>
    </template>
    <template v-else-if="bonus.reward.kind === 'refining_success_chance_bonus'">
      <span class="bonus-number">{{ signed(bonus.reward.amount) }}%</span>
      <span> refining chance</span>
    </template>
    <template v-else-if="bonus.reward.kind === 'refining_speed_pct_bonus'">
      <span class="bonus-number">{{ signed(bonus.reward.amount) }}%</span>
      <span> refining speed</span>
    </template>
    <template v-else-if="bonus.reward.kind === 'stat'">
      <span v-if="bonus.reward.stat === 'waferChargeBonusMult'">
        <span>Charge bonus </span>
        <span class="bonus-number">x{{ bonus.reward.value }}</span>
      </span>
      <span v-else-if="bonus.reward.stat === 'uniqueItemsBonusYield'">
        <span class="bonus-number">{{ bonus.reward.value }}%</span>
        <span> unique item yield</span>
      </span>
      <span v-else>
        <span class="bonus-number">{{ signed(bonus.reward.value) }}</span>
        <span> {{ bonus.reward.stat }}</span>
      </span>
    </template>
    <template v-else>{{ bonus.label }}</template>
  </span>
</template>

<script setup lang="ts">
import type { OracleBonusDefinition } from '../logic/OracleBonusLib';
import atlasStorage from '../logic/AtlasStorage';
import { atlasSpriteStyle } from '../logic/AtlasSpriteStyle';
import { getResourceSpec, type ResourceKey } from '../logic/Resources';

defineProps<{
  bonus: OracleBonusDefinition;
}>();

const atlasSource = atlasStorage.getItemsSource();

function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

function essenceIconStyle(essence: string): Record<string, string> {
  const frame = atlasStorage.getItemsFrame(essence)!;
  return atlasSpriteStyle(atlasSource, frame, { size: 18, mode: 'fixed' });
}

function resourceGlyph(resource: ResourceKey): string {
  return getResourceSpec(resource).glyph;
}

function resourceIconStyle(resource: ResourceKey): Record<string, string> {
  const spec = getResourceSpec(resource);
  return {
    color: spec.color,
    background: spec.bgColor,
  };
}
</script>

<style scoped>
.oracle-bonus-display {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  color: rgba(203, 213, 225, 0.8);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bonus-number {
  color: rgba(255, 255, 255, 0.96);
  font-size: 14px;
  font-weight: 900;
}

.ess-icon {
  display: inline-block;
  flex: 0 0 auto;
  vertical-align: -4px;
}

.resource-icon {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 900;
  line-height: 1;
}
</style>
