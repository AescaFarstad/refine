<template>
  <div class="rc-quality">
    <template v-if="showQuality">
      <span class="quality-badge">{{ qualityDisplay }}</span>
    </template>
    <template v-if="showTimeBadge">
      <span class="time-badge">{{ timeClassName }}</span>
    </template>

    <div class="rc-tooltip" aria-hidden="true">
      <div class="tp-row" v-if="timeClassName">
        <span class="tp-label">{{ timeClassName }}:</span>
        <span class="tp-value">{{ minutesPerEssenceText }}</span>
      </div>
      <div class="tp-row">
        <span class="tp-label">Yield</span>
        <span class="tp-value">{{ formatYield(qd?.yieldMultiplier) }}</span>
      </div>
      <div class="tp-row" v-if="failurePct > 0">
        <span class="tp-label">Failure</span>
        <span class="tp-value">{{ failurePct }}%</span>
      </div>
      <div class="tp-row" v-if="qd && qd.effects !== 'all'">
        <span class="tp-label">Effects</span>
        <span class="tp-value">{{ effectScopeLabel(qd.effects) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getGameLib } from '../logic/UIState';
import { REFINE_TIME, REFINE_TIME_NAME } from '../logic/Const';
import type { TimeClass } from '../logic/RecipeLib';
import type { RecipeEffectScope } from '../logic/RecipeQualityLib';

const props = withDefaults(defineProps<{ qualityId: string; timeClass?: TimeClass; showQuality?: boolean; showTimeBadge?: boolean }>(), {
  showQuality: true,
  showTimeBadge: false,
});

const lib = computed(() => getGameLib());
const qd = computed(() => lib.value?.recipeQualities.get(props.qualityId));
const failurePct = computed(() => Math.max(0, Math.round(qd.value?.nothingChancePct || 0)));
const qualityDisplay = computed(() => qd.value?.name || props.qualityId);

const tc = computed<TimeClass | undefined>(() => props.timeClass);
const timeClassName = computed<string | ''>(() => {
  const id = (tc.value || '') as string;
  return (REFINE_TIME_NAME as any)[id] || '';
});
const minutesPerEssenceValue = computed<number>(() => {
  const id = (tc.value || 'normal') as string;
  const v = (REFINE_TIME as any)[id] || 1;
  return Math.round(v * 10) / 10;
});
const minutesPerEssenceText = computed<string>(() => {
  const v = minutesPerEssenceValue.value;
  const s = (Number.isInteger(v) ? v.toString() : v.toString());
  const unit = v === 1 ? 'minute' : 'minutes';
  return `${s} ${unit} per essence`;
});

function formatYield(mult?: number): string {
  const m = Math.max(0, mult || 1);
  return Math.round(m * 100) + '%';
}

function effectScopeLabel(e: RecipeEffectScope): string {
  switch (e) {
    case 'negative_only': return 'Negative only';
    case 'negative_and_speed': return 'Negative + speed';
    case 'positive_only': return 'Positive only';
    case 'all': default: return 'All effects';
  }
}
</script>

<style scoped>
.rc-quality { position: relative; min-width: 0; display: inline-flex; align-items: center; gap: 6px; }
.quality-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 800;
  background: rgba(79, 209, 197, 0.12);
  border: 1px solid rgba(79, 209, 197, 0.35);
  color: var(--accent-hover);
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.time-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 800;
  background: rgba(234, 179, 8, 0.08);
  border: 1px solid rgba(234, 179, 8, 0.25);
  color: #eac96a;
  white-space: nowrap;
}

.rc-tooltip {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--panel-border);
  background: linear-gradient(180deg, rgba(20, 28, 40, 0.98), rgba(10, 15, 26, 0.94));
  box-shadow: 0 12px 28px rgba(0,0,0,0.45), inset 0 1px 0 var(--panel-shine);
  min-width: 220px;
  max-width: 320px;
  pointer-events: none;
  z-index: 999;
  opacity: 0;
  transform: translateY(4px) scale(0.98);
  transition: opacity 120ms ease, transform 140ms ease;
}
.rc-quality:hover .rc-tooltip { opacity: 1; transform: translateY(0) scale(1); }
.rc-tooltip::after {
  content: '';
  position: absolute;
  bottom: 100%;
  right: 10px;
  width: 0; height: 0;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-bottom: 7px solid rgba(10, 15, 26, 0.94);
  filter: drop-shadow(0 1px 0 var(--panel-border));
}
.tp-row { display: flex; align-items: baseline; gap: 6px; font-size: 12px; }
.tp-label { opacity: 0.8; text-transform: uppercase; letter-spacing: 0.06em; }
.tp-value { font-weight: 800; }
</style>
