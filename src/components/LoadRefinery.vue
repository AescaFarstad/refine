<template>
  <div class="panel load-panel">
    <div class="header">
      <div class="left">
        <button class="link" @click="$emit('clear')">← Back</button>
        <span class="title">Load Refinery</span>
      </div>
      <div class="right">
        <span class="recipe">Recipe: {{ recipeId }}</span>
      </div>
    </div>

    <div class="grid-wrap">
      <ItemGrid :items="items" clickable @item-click="onUnpick" />
    </div>

    <div class="ess-progress" v-if="orderedKeys.length">
      <div class="ess-rows">
        <div class="ess-row" v-for="k in orderedKeys" :key="k">
          <div class="ess-row-label">{{ countLabel(k) }}</div>
          <div class="ess-row-track">
            <div
              v-for="(state, i) in essenceStates(k)"
              :key="k + '-' + i"
              class="ess-slot"
              :class="state"
            >
              <span v-if="getEssenceFrame(k) && source" class="ess-icon32" :style="essenceIconStyle(32, k)" />
              <span v-else class="ess-letter32">{{ essenceLetter(k) }}</span>
              <span v-if="state === 'excess'" class="ex-cross" aria-hidden="true">✖</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary below essence bars -->
    <div class="summary" v-if="hasAnyItems">
      <div class="sum-line">Expected credits: <span class="hl">{{ expectedCredits }}</span></div>
      <div class="sum-line">Expected chronotraces: <span class="hl">{{ expectedChrono }}</span></div>

      <div class="yield-line">
        Yield: <span class="hl">{{ totalYieldPct }}%</span>
        <span class="subtle">
          ({{ qualityYieldPct }}% from <span class="hl">{{ qualityName }}</span> recipe quality<template v-if="refineryConditionPct < 100">, {{ refineryConditionPct }}% from refinery condition</template>)
        </span>
      </div>

      <!-- Chance of failure (reserve vertical space even when 0) -->
      <div class="failure-line" :class="{ invisible: !failureChancePct }">
        Chance of failure: <span class="hl">{{ failureChancePct }}% </span>
        <span class="subtle"> (from <span class="hl">{{ qualityName }}</span> recipe quality)</span>
      </div>

      <!-- Waste row: reserve vertical space, hide label entirely when none -->
      <div class="waste-row">
        <template v-if="hasWaste">
          <div>Waste</div>
          <div class="waste-list">
            <template v-for="(qty, k) in wasteByKey" :key="'w-' + k">
              <span class="waste-item">
                <span v-if="getEssenceFrame(k) && source" class="ess-icon16" :style="essenceIconStyle(16, k)" />
                <span v-else class="ess-letter32" style="width:16px;height:16px;font-size:12px;line-height:16px;border-radius:3px;">{{ essenceLetter(k) }}</span>
                {{ qty }}
              </span>
            </template>
          </div>
        </template>
      </div>

      <div class="actions" v-if="helpText">
        <div class="muted">{{ helpText }}</div>
      </div>
    </div>
  </div>
  
</template>

<script setup lang="ts">
import ItemGrid from './ItemGrid.vue';
import { computed, onMounted, ref } from 'vue';
import atlasStorage from '../logic/AtlasStorage';
import itemsData from '../data/items';
import recipesData from '../data/recipes';
import { computeRefinePreview } from '../logic/Refine';
import { Lib } from '../logic/Lib';
import { uiState } from '../logic/UIState';

const props = defineProps<{ recipeId: string; items: Array<{ id: string; quantity: number }> }>();
const emit = defineEmits<{ (e: 'clear'): void; (e: 'unpick-item', id: string): void }>();

function onUnpick(id: string) {
  const it = props.items?.find(x => x.id === id);
  if (!it || (it.quantity || 0) <= 0) return;
  emit('unpick-item', id);
}

// Atlas state for essence icons
const source = ref<HTMLImageElement | null>(atlasStorage.getItemsSource());
const ready = ref<boolean>(atlasStorage.isItemsAtlasLoaded());
onMounted(async () => {
  if (!ready.value) {
    try { await atlasStorage.loadItemsAtlas(); } catch (_e) {/* noop */}
    ready.value = atlasStorage.isItemsAtlasLoaded();
    source.value = atlasStorage.getItemsSource();
  }
});

function getEssenceFrame(k: string) {
  return atlasStorage.getItemsFrame(k);
}

function essenceIconStyle(size: number, k: string): Record<string, string> {
  const f = atlasStorage.getItemsFrame(k);
  if (!source.value || !f) return {} as Record<string, string>;
  const scale = size / Math.max(f.w, f.h);
  const atlasW = source.value.naturalWidth;
  const atlasH = source.value.naturalHeight;
  return {
    width: size + 'px',
    height: size + 'px',
    backgroundImage: `url(${source.value.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${f.x * scale}px -${f.y * scale}px`,
    backgroundSize: `${atlasW * scale}px ${atlasH * scale}px`,
  } as Record<string, string>;
}

function essenceLetter(k: string): string {
  const m: Record<string, string> = { red: 'R', green: 'G', blue: 'B', yellow: 'Y' };
  return m[k] || k[0]?.toUpperCase() || '?';
}

// Requirements from recipe
const requirements = computed<Record<string, number>>(() => {
  const rec = (recipesData as any)[props.recipeId] as { ingredients?: Record<string, number> } | undefined;
  return (rec?.ingredients || {}) as Record<string, number>;
});

// Totals loaded from staged items
const stagedEssences = computed<Record<string, number>>(() => {
  const totals: Record<string, number> = {};
  for (const it of props.items || []) {
    const def = (itemsData as any)[it.id] as { essence?: Record<string, number> } | undefined;
    const ess = def?.essence || {};
    const q = Math.max(1, it.quantity || 1);
    for (const k of Object.keys(ess)) {
      const v = (ess as any)[k] || 0;
      totals[k] = (totals[k] || 0) + v * q;
    }
  }
  return totals;
});

const orderedKeys = computed<string[]>(() => {
  const ord = ['red', 'green', 'blue', 'yellow'];
  const reqKeys = Object.keys(requirements.value).filter(k => (requirements.value[k] || 0) > 0);
  const haveKeys = Object.keys(stagedEssences.value).filter(k => (stagedEssences.value[k] || 0) > 0);
  const keys = Array.from(new Set([...ord, ...reqKeys, ...haveKeys]))
    .filter(k => (requirements.value[k] || 0) > 0 || (stagedEssences.value[k] || 0) > 0);
  return keys;
});

type SlotState = 'filled' | 'missing' | 'excess';
function essenceStates(k: string): SlotState[] {
  const need = Math.max(0, requirements.value[k] || 0);
  const have = Math.max(0, stagedEssences.value[k] || 0);
  const total = Math.max(need, have);
  const states: SlotState[] = [];
  for (let i = 0; i < total; i++) {
    if (i < need) {
      states.push(i < have ? 'filled' : 'missing');
    } else {
      // beyond need but within have
      states.push('excess');
    }
  }
  return states;
}

function countLabel(k: string): string {
  const need = Math.max(0, requirements.value[k] || 0);
  const have = Math.max(0, stagedEssences.value[k] || 0);
  if (need > 0) return `${Math.min(have, need)}/${need}`;
  return `${have}/0`;
}

// --- Summary metrics (via shared Refine.ts) ---
const lib = new Lib();

const selectedRefineryIndex = computed(() => uiState.selectedRefineryIndex);
const hasSelectedRefinery = computed(() => (selectedRefineryIndex.value ?? -1) >= 0);
const refineryConditionPct = computed(() => {
  if (!hasSelectedRefinery.value) return 100; // neutral when none selected
  const r = uiState.refineries[selectedRefineryIndex.value] || { health: 100 };
  return Math.max(0, Math.min(100, Math.round(r.health || 0)));
});

const preview = computed(() => computeRefinePreview(
  lib,
  props.recipeId,
  refineryConditionPct.value,
  stagedEssences.value,
));
const qualityName = computed(() => preview.value.qualityName);
const qualityYieldPct = computed(() => preview.value.qualityYieldPct);
const failureChancePct = computed(() => preview.value.failureChancePct);
const totalYieldPct = computed(() => preview.value.totalYieldPct);
const matchedEssences = computed(() => preview.value.matchedEssences);
const expectedCredits = computed(() => preview.value.expectedCredits);
const expectedChrono = computed(() => preview.value.expectedChrono);

// Completion check
const isEssenceComplete = computed(() => {
  for (const [k, needAny] of Object.entries(requirements.value)) {
    const need = Math.max(0, needAny || 0);
    const have = Math.max(0, stagedEssences.value[k] || 0);
    if (have < need) return false;
  }
  return true;
});

// Waste (excess over needed)
const wasteByKey = computed<Record<string, number>>(() => preview.value.wasteByKey);
const hasWaste = computed(() => Object.keys(wasteByKey.value).length > 0);

const helpText = computed(() => {
  if (!isEssenceComplete.value) return 'Add more items to fulfill recipe essence requirements';
  return '';
});

// selection handled in the parent view; keep this focused on loading



// Hide summary when nothing is staged in the grid
const hasAnyItems = computed(() => (props.items || []).some(it => Math.max(0, it.quantity || 0) > 0));
</script>

<style scoped>
.load-panel { height: 100%; display: flex; flex-direction: column; }
.header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
.left { display: flex; align-items: baseline; gap: 10px; }
.title { font-weight: 800; letter-spacing: 0.04em; opacity: 0.95; }
.recipe { font-size: 12px; opacity: 0.8; }
.link { background: none; border: none; color: var(--accent); cursor: pointer; padding: 0; font-weight: 700; }
.grid-wrap { flex: 1; min-height: 0; overflow: auto; }

.ess-progress { margin-top: 10px; }
.ess-rows { display: grid; grid-template-columns: 1fr; gap: 6px; }
.ess-row { display: grid; grid-template-columns: 8ch 1fr; align-items: center; gap: 8px; }
.ess-row-label { font-weight: 800; opacity: 0.9; font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
.ess-row-track { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }

.ess-slot { position: relative; width: 32px; height: 32px; display: grid; place-items: center; opacity: 0.35; overflow: visible; }
.ess-slot.filled { opacity: 1; }
.ess-slot.excess { opacity: 0.35; }
.ex-cross { position: absolute; inset: -2px; display: grid; place-items: center; font-weight: 900; color: rgba(0, 0, 0, 0.95); text-shadow: 0 1px 0 rgba(255,255,255,0.5); pointer-events: none; font-size: 40px; line-height: 32px; }

.ess-icon32 { display: inline-block; width: 32px; height: 32px; filter: drop-shadow(0 1px 0 rgba(0,0,0,0.4)); }
.ess-letter32 { display: inline-grid; place-items: center; width: 32px; height: 32px; font-weight: 900; font-size: 18px; opacity: 0.9; border-radius: 4px; background: rgba(255,255,255,0.04); }

/* Summary */
.summary { margin-top: 12px; display: grid; grid-template-columns: 1fr; gap: 10px; }
.sum-line { display: flex; align-items: baseline; gap: 6px; }
.sum-label { color: inherit; font-weight: 400; }
.hl { color: var(--accent-hover); font-weight: 900; font-variant-numeric: tabular-nums; }
.muted { color: var(--text-secondary); }
.invisible { visibility: hidden; }

.yield-line { font-weight: 400; }
.subtle { color: var(--text-secondary); font-weight: 400; font-size: 12px; }

.waste-row { display: flex; align-items: center; gap: 10px; min-height: 24px; }
.waste-list { display: inline-flex; align-items: center; gap: 8px; }
.ess-icon16 { display: inline-block; width: 16px; height: 16px; vertical-align: middle; }
.waste-item { display: inline-flex; align-items: center; gap: 4px; font-weight: 800; }

.actions { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
.start-btn { padding: 10px 12px; font-weight: 800; letter-spacing: 0.05em; border-radius: 4px; border: 1px solid var(--panel-border); background: rgba(79, 209, 197, 0.14); color: var(--accent); cursor: pointer; }
.start-btn:hover:enabled { background: rgba(79, 209, 197, 0.22); }
.start-btn:disabled { background: rgba(255,255,255,0.04); color: var(--text-secondary); cursor: not-allowed; }
</style>
