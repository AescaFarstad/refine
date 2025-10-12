<template>
  <div class="refine-root">
    <!-- Top row: refineries -->
    <div class="refineries-row">
      <Refinery
        v-for="(r, i) in refineries"
        :key="i"
        :index="i"
        :health="r.health"
        :has-recipe="r.hasRecipe"
        :selected="i === selectedRefinery"
        @select="onSelectRefinery(i)"
      />
    </div>

    <!-- Main area: left 3/4 content, right 1/4 all items -->
    <div class="main-split">
      <div class="left">
        <Recipes v-if="!selectedRecipeId" @select-recipe="onSelectRecipe" />
        <LoadRefinery
          v-else
          :recipe-id="selectedRecipeId"
          :items="stagedItems"
          @unpick-item="onUnpickItem"
          @clear="onClearRecipe"
        />
      </div>
      <div class="right">
        <AllItems :items="availableItems" @pick-item="onPickItem" />
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

const selectedRefinery = ref(0);
const selectedRecipeId = ref('');

const refineries = computed(() => uiState.refineries);

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

function onSelectRefinery(i: number) {
  selectedRefinery.value = i;
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
