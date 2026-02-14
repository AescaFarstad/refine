<template>
  <div class="sig-hint" role="tooltip" aria-hidden="true">
    <div class="hint-row">
      <span class="hint-label">Name:</span>
      <span class="hint-value name-value">{{ displayName }}</span>
    </div>
    <div v-if="refiningYieldBonus !== 0" class="hint-row">
      <span class="hint-label">Refining yield:</span>
      <span class="hint-value">{{ fmtSignedPct(refiningYieldBonus) }}</span>
    </div>
    <div v-if="refiningSuccessBonus !== 0" class="hint-row">
      <span class="hint-label">Refining success:</span>
      <span class="hint-value">{{ fmtSignedPct(refiningSuccessBonus) }}</span>
    </div>
    <div v-if="refiningSpeedBonus !== 0" class="hint-row">
      <span class="hint-label">Refining speed:</span>
      <span class="hint-value">{{ fmtSignedPct(refiningSpeedBonus) }}</span>
    </div>
    <div v-for="(line, idx) in otherRewardLines" :key="idx" class="hint-row">
      <span class="hint-label">Reward:</span>
      <span class="hint-value">{{ line }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ReadonlySignatureDefinition } from '../logic/SignatureLib';
import { getGameLib } from '../logic/UIState';
import { formatRewardHintText } from '../logic/RewardHintText';

const props = defineProps<{
  signature: ReadonlySignatureDefinition;
  completed: boolean;
}>();

const displayName = computed(() => (props.completed ? props.signature.name : '???'));

const refiningYieldBonus = computed(() => {
  let total = 0;
  for (const reward of props.signature.rewards) {
    if (reward.kind === 'refining_yield_pct_bonus') total += reward.amount;
  }
  return total;
});

const refiningSuccessBonus = computed(() => {
  let total = 0;
  for (const reward of props.signature.rewards) {
    if (reward.kind === 'refining_success_chance_bonus') total += reward.amount;
  }
  return total;
});

const refiningSpeedBonus = computed(() => {
  let total = 0;
  for (const reward of props.signature.rewards) {
    if (reward.kind === 'refining_speed_pct_bonus') total += reward.amount;
  }
  return total;
});

const otherRewardLines = computed(() => {
  const out: string[] = [];
  for (const reward of props.signature.rewards) {
    if (reward.kind === 'refining_yield_pct_bonus') continue;
    if (reward.kind === 'refining_success_chance_bonus') continue;
    if (reward.kind === 'refining_speed_pct_bonus') continue;
    out.push(formatRewardHintText(reward, getGameLib()));
  }
  return out;
});

function fmtSignedPct(n: number): string {
  if (n > 0) return `+${n}%`;
  if (n < 0) return `${n}%`;
  return '0%';
}
</script>

<style scoped>
.sig-hint {
  min-width: 240px;
  max-width: 360px;
  padding: 4px 10px;
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.7);
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: rgba(226, 232, 240, 0.95);
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
}

.name-value {
  color: rgba(34, 197, 94, 0.95);
}
</style>
