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
        <RecipeCard :recipe="r" :player-ess-totals="playerEssTotals" :clickable="false" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { uiState } from '../logic/UIState';
import { getGameLib } from '../logic/UIState';
import itemsData from '../data/items';
import type { RecipeDefinition } from '../logic/RecipeLib';
import RecipeCard from './RecipeCard.vue';

const emit = defineEmits<{ (e: 'select-recipe', id: string): void }>();

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

// Duration formatting is handled in the child component

// Build display list from player's recipe ids
type DisplayRecipe = {
  id: string;
  name: string;
  qualityId: string;
  qualityDef: any;
  essList: Array<{ key: string; value: number }>;
  durationSec: number;
  timeClass: 'terribly_slow' | 'slow' | 'normal' | 'fast' | 'ultra_fast';
};

const displayRecipes = computed<DisplayRecipe[]>(() => {
  const list: DisplayRecipe[] = [];
  const ids = (uiState.recipes || []) as string[];
  // Depend on recipesVersion so upgrades reflect in grid
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.recipesVersion;
  const lib = getGameLib();
  for (const id of ids) {
    const rec = (lib?.recipes.get(id) as RecipeDefinition | undefined);
    if (!rec) continue;
    const qualityId = (rec as any).quality || 'standard';
    const qd = lib?.recipeQualities.get(qualityId);
    const ing = (rec as any).ingredients || {};
    const keys = Array.from(new Set([...orderedKeys, ...Object.keys(ing)]));
    const essList = keys
      .map(k => ({ key: k, value: (ing as any)[k] as number | undefined }))
      .filter(x => (x.value || 0) > 0)
      .map(x => ({ key: x.key, value: x.value || 0 }));
    list.push({ id, name: (rec as any).name || id, qualityId, qualityDef: qd, essList, durationSec: (rec as any).duration || 0, timeClass: (rec as any).timeClass || 'normal' });
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

</style>
