<template>
  <div class="prep-details">
    <div class="row" v-if="tacticList">
      <span class="label">Tactics</span>
      <span class="value">{{ tacticList }}</span>
    </div>
    <div class="row" v-if="damageDelta !== 0">
      <span class="label">Damage</span>
      <span class="value">{{ signed(damageDelta) }}</span>
    </div>
    <div class="row" v-if="hpDelta !== 0">
      <span class="label">HP</span>
      <span class="value">{{ signed(hpDelta) }}</span>
    </div>
    <div class="row" v-if="blockDelta !== 0">
      <span class="label">Block</span>
      <span class="value">{{ signed(blockDelta, '%') }}</span>
    </div>
    <div class="row time-regen" v-if="hasTimeRegen">
      <span class="value" style="grid-column: 1 / -1">Regenerated {{ timeRegenAmount }} hp: {{ entry.timeRegenHpBefore }} → <b>{{ entry.timeRegenHpAfter }}</b> over the last {{ formatDuration(entry.timeRegenDurationSec) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { PreparationEncounterLogEntry } from '../../logic/RaidLog';

const props = defineProps<{
  entry: PreparationEncounterLogEntry;
}>();

const entry = computed(() => props.entry as any);

function signed(n: number, suffix = ''): string {
  const v = Math.trunc(Number(n) || 0);
  if (v > 0) return `+${v}${suffix}`;
  if (v < 0) return `${v}${suffix}`;
  return `0${suffix}`;
}

const tacticList = computed(() => {
  const arr = Array.isArray(entry.value?.tacticNames) ? entry.value.tacticNames : [];
  return arr.filter(Boolean).join(', ');
});

const damageDelta = computed(() => Math.trunc((entry.value?.damageAfter || 0) - (entry.value?.damageBefore || 0)));
const hpDelta = computed(() => Math.trunc((entry.value?.maxHpAfter || 0) - (entry.value?.maxHpBefore || 0)));
const blockDelta = computed(() => Math.trunc((entry.value?.blockChanceAfter || 0) - (entry.value?.blockChanceBefore || 0)));

const hasTimeRegen = computed(() => (entry.value?.timeRegenHpAfter || 0) > (entry.value?.timeRegenHpBefore || 0));
const timeRegenAmount = computed(() => (entry.value?.timeRegenHpAfter || 0) - (entry.value?.timeRegenHpBefore || 0));

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  if (m < 1) return `${sec} seconds`;
  if (m === 1) return '1 minute';
  return `${m} minutes`;
}
</script>

<style scoped>
.prep-details { display: grid; gap: 2px; }
.row { display: grid; grid-template-columns: max-content 1fr; gap: 6px 10px; align-items: baseline; }
.label { color: var(--text-secondary); font-size: 12px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; }
.value { color: var(--text-primary); font-weight: 800; font-size: 13px; }
.time-regen { margin-top: 8px; }
</style>
