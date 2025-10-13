<template>
  <div class="recipes-panel">
    <div class="recipes-header"><span class="caption">Select recipe</span></div>
    <div class="recipes-grid">
      <div
        v-for="r in displayRecipes"
        :key="r.id"
        class="recipe-card"
        role="button"
        tabindex="0"
        @click="onSelect(r.id)"
      >
        <div class="rc-title">
          <div class="rc-duration"><span class="duration-badge">{{ formatDurationHM(r.durationSec) }}</span></div>
          <div class="rc-quality">
            <span class="quality-badge">{{ r.qualityDef?.name || r.qualityId }}</span>
            <div class="rc-tooltip" aria-hidden="true">
              <div class="tp-title">{{ r.qualityDef?.name || r.qualityId }}</div>
              <div class="tp-row">
                <span class="tp-label">Yield</span>
                <span class="tp-value">{{ formatYield(r.qualityDef?.yieldMultiplier) }}</span>
              </div>
              <div class="tp-row" v-if="(r.qualityDef?.nothingChancePct ?? 0) > 0">
                <span class="tp-label">Failure</span>
                <span class="tp-value">{{ r.qualityDef?.nothingChancePct }}%</span>
              </div>
              <div class="tp-row" v-if="r.qualityDef && r.qualityDef.effects !== 'all'">
                <span class="tp-label">Effects</span>
                <span class="tp-value">{{ effectScopeLabel(r.qualityDef.effects) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="rc-body">
          <div class="ess-need" v-if="r.essList.length">
            <div class="ess-unit" v-for="e in r.essList" :key="e.key">
              <span v-if="getEssenceFrame(e.key) && source" class="ess-icon48" :style="essenceIconStyle48(e.key)" />
              <span v-else class="ess-letter48">{{ essenceLetter(e.key) }}</span>
              <span class="ess-num48" :class="{ insufficient: isInsufficient(e.key, e.value) }">{{ e.value }}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { uiState } from '../logic/UIState';
import { formatDurationHM } from '../logic/StringUtils';
import recipesData from '../data/recipes';
import qualitiesData from '../data/recipe_qualities';
import itemsData from '../data/items';
import atlasStorage from '../logic/AtlasStorage';
import type { RecipeDefinition } from '../logic/RecipeLib';
import type { RecipeEffectScope } from '../logic/RecipeQualityLib';

const emit = defineEmits<{ (e: 'select-recipe', id: string): void }>();

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

function essenceIconStyle48(k: string): Record<string, string> {
  const f = atlasStorage.getItemsFrame(k);
  if (!source.value || !f) return {} as Record<string, string>;
  const scale = 48 / Math.max(f.w, f.h);
  const atlasW = source.value.naturalWidth;
  const atlasH = source.value.naturalHeight;
  return {
    width: '48px',
    height: '48px',
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

const orderedKeys: string[] = ['red', 'green', 'blue', 'yellow'];

// Player total essences across inventory (simple sum)
const playerEssTotals = computed<Record<string, number>>(() => {
  const totals: Record<string, number> = {};
  for (const it of uiState.items) {
    const def = (itemsData as any)[it.id] as { essence?: Record<string, number> } | undefined;
    const ess = def?.essence || {};
    for (const k of Object.keys(ess)) {
      const v = (ess as any)[k] || 0;
      totals[k] = (totals[k] || 0) + v * Math.max(1, it.quantity || 1);
    }
  }
  return totals;
});

function isInsufficient(k: string, need: number): boolean {
  const have = playerEssTotals.value[k] || 0;
  return have < need;
}

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

// Duration formatting now shared via StringUtils.formatDurationHM

// Build display list from player's recipe ids
type DisplayRecipe = {
  id: string;
  name: string;
  qualityId: string;
  qualityDef: any;
  essList: Array<{ key: string; value: number }>;
  durationSec: number;
};

const displayRecipes = computed<DisplayRecipe[]>(() => {
  const list: DisplayRecipe[] = [];
  const ids = (uiState.recipes || []) as string[];
  for (const id of ids) {
    const rec = (recipesData as any)[id] as Omit<RecipeDefinition, 'id'> | undefined;
    if (!rec) continue;
    const qualityId = (rec as any).quality || 'standard';
    const qd = (qualitiesData as any)[qualityId];
    const ing = (rec as any).ingredients || {};
    const keys = Array.from(new Set([...orderedKeys, ...Object.keys(ing)]));
    const essList = keys
      .map(k => ({ key: k, value: (ing as any)[k] as number | undefined }))
      .filter(x => (x.value || 0) > 0)
      .map(x => ({ key: x.key, value: x.value || 0 }));
    list.push({ id, name: (rec as any).name || id, qualityId, qualityDef: qd, essList, durationSec: (rec as any).duration || 0 });
  }
  return list;
});

function onSelect(id: string) {
  emit('select-recipe', id);
}
</script>

<style scoped>
.recipes-panel { height: 100%; display: flex; flex-direction: column; }
.recipes-header { text-align: center; margin-bottom: 10px; }
.caption {
  display: inline-block;
  font-weight: 900;
  font-size: 28px;
  letter-spacing: -0.02em;
  color: inherit;
}

.recipes-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.recipe-card {
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  background: rgba(255,255,255,0.02);
  box-shadow: inset 0 1px 0 var(--panel-shine);
  padding: 10px 12px;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
}
.recipe-card:hover {
  transform: translateY(-1px);
  background: rgba(255,255,255,0.04);
  box-shadow: inset 0 1px 0 var(--panel-shine), 0 4px 18px rgba(0,0,0,0.25);
}

.rc-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; position: relative; }
.rc-quality { position: relative; }
.quality-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 800;
  background: rgba(79, 209, 197, 0.12);
  border: 1px solid rgba(79, 209, 197, 0.35);
  color: var(--accent-hover);
}

.duration-badge {
  display: inline-block;
  padding: 0;
  border-radius: 0;
  font-size: 16px;
  font-weight: 900;
  background: transparent;
  border: none;
  color: var(--text-secondary);
}

/* Tooltip for quality */
.rc-tooltip {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--panel-border);
  background: linear-gradient(180deg, rgba(20, 28, 40, 0.98), rgba(10, 15, 26, 0.94));
  box-shadow: 0 12px 28px rgba(0,0,0,0.45), inset 0 1px 0 var(--panel-shine);
  min-width: 160px;
  max-width: 260px;
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
.tp-title { font-weight: 800; margin-bottom: 4px; letter-spacing: 0.02em; }
.tp-row { display: flex; align-items: baseline; gap: 6px; font-size: 12px; }
.tp-label { opacity: 0.8; text-transform: uppercase; letter-spacing: 0.06em; }
.tp-value { font-weight: 800; }

.rc-body { display: flex; align-items: center; justify-content: flex-start; }
.ess-need { display: flex; align-items: center; gap: 12px; flex-wrap: nowrap; overflow-x: auto; }
.ess-unit { display: inline-flex; align-items: center; gap: 8px; }
.ess-num48 { font-weight: 900; font-size: 48px; line-height: 48px; letter-spacing: -0.02em; }
.ess-num48.insufficient { color: #e25b5b; }
.ess-icon48 { display: inline-block; width: 48px; height: 48px; }
.ess-letter48 { display: inline-grid; place-items: center; width: 48px; height: 48px; font-weight: 900; font-size: 28px; opacity: 0.9; border-radius: 4px; background: rgba(255,255,255,0.02); }
</style>
