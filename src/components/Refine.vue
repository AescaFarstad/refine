<template>
  <div class="refine-root">

    <!-- Main area: left 3/4 content, right 1/4 all items -->
    <div class="main-split">
      <div class="left">
        <LoadRefinery
          v-if="selectedRecipeId"
          :recipe-id="selectedRecipeId"
          :items="stagedItems"
          @unpick-item="onUnpickItem"
          @clear="onClearRecipe"
        />
        <Recipes v-else-if="!allRefineriesLoaded" @select-recipe="onSelectRecipe" />
      </div>
      <div class="right">
        <AllItems :items="availableItems" :required-essences="selectedIngredients" @pick-item="onPickItem" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { uiState } from '../logic/UIState';
import Refinery from './Refinery.vue';
import Recipes from './Recipes.vue';
import LoadRefinery from './LoadRefinery.vue';
import AllItems from './AllItems.vue';
import { getGameLib } from '../logic/UIState';
import itemsData from '../data/items';
// start is now triggered from LoadRefinery component

const selectedRefinery = computed<number>({
  get: () => uiState.selectedRefineryIndex,
  set: (v: number) => { uiState.selectedRefineryIndex = v; },
});
const selectedRecipeId = ref('');

const refineries = computed(() => uiState.refineries);
const allRefineriesLoaded = computed(() => refineries.value.length > 0 && refineries.value.every(r => r.hasRecipe));

// UI-only staged items to load into the refinery
const stagedById = ref<Record<string, number>>({});

const stagedItems = computed(() => {
  const out: Array<{ id: string; quantity: number }> = [];
  for (const [id, qty] of Object.entries(stagedById.value)) {
    const q = Math.max(0, qty || 0);
    if (q > 0) out.push({ id, quantity: q });
  }
  return out;
});

// Available items list for the right panel subtracting staged quantities
const availableItems = computed(() => {
  const res: Array<{ id: string; quantity: number }> = [];
  for (const it of uiState.items) {
    const staged = stagedById.value[it.id] || 0;
    const q = Math.max(0, (it.quantity || 0) - staged);
    if (q > 0) res.push({ id: it.id, quantity: q });
  }
  return res;
});

// Ingredients of the currently selected recipe (for dimming in AllItems)
const selectedIngredients = computed<Record<string, number>>(() => {
  const id = selectedRecipeId.value;
  if (!id) return {};
  // Depend on recipesVersion so upgrades update the panel
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.recipesVersion;
  const lib = getGameLib();
  const rec = lib?.recipes.get(id);
  return ((rec?.ingredients || {}) as Record<string, number>);
});

// Compute essence totals for staged items
const stagedEssences = computed<Record<string, number>>(() => {
  const totals: Record<string, number> = {};
  for (const it of stagedItems.value) {
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

const isEssenceComplete = computed(() => {
  const req = selectedIngredients.value || {};
  const have = stagedEssences.value || {};
  const keys = Object.keys(req);
  if (!keys.length) return false;
  for (const k of keys) {
    const need = Math.max(0, (req as any)[k] || 0);
    const got = Math.max(0, (have as any)[k] || 0);
    if (got < need) return false;
  }
  return true;
});

function onSelectRefinery(i: number) {
  const r = refineries.value[i];
  if (!r) return;
  // Otherwise, toggle selection
  selectedRefinery.value = (selectedRefinery.value === i) ? -1 : i;
}
function onSelectRecipe(id: string) {
  selectedRecipeId.value = id;
}

function onClearRecipe() {
  selectedRecipeId.value = '';
  stagedById.value = {};
}

function onPickItem(id: string) {
  // Only allow pick when a recipe is selected
  if (!selectedRecipeId.value) return;
  // Check availability
  const available = (uiState.items.find(x => x.id === id)?.quantity || 0) - (stagedById.value[id] || 0);
  if (available <= 0) return;
  stagedById.value = { ...stagedById.value, [id]: (stagedById.value[id] || 0) + 1 };
}

function onUnpickItem(id: string) {
  const cur = stagedById.value[id] || 0;
  if (cur <= 0) return;
  const next = { ...stagedById.value, [id]: cur - 1 } as Record<string, number>;
  if (next[id] <= 0) delete next[id];
  stagedById.value = next;
}
</script>

<style scoped>
.refine-root { display: flex; flex-direction: column; gap: 16px; }

.refineries-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.main-split {
  display: grid;
  grid-template-columns: 3fr 1fr; /* 3/4 left, 1/4 right */
  gap: 16px;
  min-height: 420px;
}

.left, .right { min-height: 300px; }
.left { display: block; }
.right { display: block; }

@media (max-width: 960px) {
  .main-split { grid-template-columns: 1fr; }
}
</style>
