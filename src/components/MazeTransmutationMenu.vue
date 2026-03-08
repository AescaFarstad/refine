<template>
  <div v-if="visible" class="maze-transmutation-menu">
    <div class="transmutation-panel">
      <div class="transmutation-header">TRANSMUTATION</div>
      <div class="transmutation-body">
        <div
          v-for="recipe in recipes"
          :key="recipe.id"
          class="recipe-card"
          :class="{ 'recipe-card-unaffordable': !recipe.canAfford }"
        >
          <div class="recipe-topline">
            <div>
              <div class="recipe-name">{{ recipe.name }}</div>
              <div class="recipe-crafted-count">crafted {{ recipe.craftedCount }}</div>
            </div>
            <div class="recipe-result-block">
              <div class="recipe-result" :style="{ color: recipe.resultColor }">
                +{{ recipe.resultAmount }} {{ recipe.resultLabel }}
              </div>
              <button class="craft-btn" type="button" :disabled="!recipe.canAfford" @click="craft(recipe.id)">
                Craft
              </button>
            </div>
          </div>
          <div class="recipe-costs">
            <div
              v-for="ingredient in recipe.ingredients"
              :key="ingredient.id"
              class="ingredient-chip"
              :class="{ 'ingredient-chip-missing': ingredient.owned < ingredient.amount }"
              :style="{ '--ingredient-accent': ingredient.color }"
            >
              <span class="ingredient-name">{{ ingredient.name }}</span>
              <span class="ingredient-amount">{{ ingredient.amount }}</span>
              <span class="ingredient-owned">have {{ ingredient.owned }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RESOURCE_KEYS, getResourceSpec, type ResourceKey } from '../logic/Resources';
import { getGameLib, uiState } from '../logic/UIState';
import { CmdTransmutate } from '../logic/input/InputCommands';
import { globalInputQueue } from '../logic/Model';
import { getTransmutationEffectivePrice } from '../logic/Transmutation';

defineProps<{
  visible: boolean;
}>();

interface IngredientViewModel {
  id: string;
  name: string;
  amount: number;
  owned: number;
  color: string;
}

interface RecipeViewModel {
  id: string;
  name: string;
  craftedCount: number;
  resultLabel: string;
  resultAmount: number;
  resultColor: string;
  ingredients: IngredientViewModel[];
  canAfford: boolean;
}

function getOwnedResourceAmount(resource: ResourceKey): number {
  if (resource === 'credits') return uiState.credits;
  if (resource === 'chronotraces') return uiState.chronotraces;
  if (resource === 'timeFlux') return uiState.timeFlux;
  if (resource === 'shardDust') return uiState.shardDust;
  return uiState.skillPoints;
}

const recipes = computed<RecipeViewModel[]>(() => {
  uiState.lib;
  uiState.countableGear;
  uiState.credits;
  uiState.chronotraces;
  uiState.timeFlux;
  uiState.shardDust;
  uiState.skillPoints;
  uiState.transmutationCraftCounts;

  const lib = getGameLib();

  return Array.from(lib.transmutations.values()).map((recipe) => {
    const craftedCount = uiState.transmutationCraftCounts[recipe.id] ?? 0;
    const effectivePrice = getTransmutationEffectivePrice(recipe, craftedCount);
    const ingredients: IngredientViewModel[] = [];

    for (const [gearId, amount] of Object.entries(effectivePrice.gear)) {
      const gear = lib.gear.get(gearId)!;
      ingredients.push({
        id: `gear:${gearId}`,
        name: gear.name,
        amount,
        owned: uiState.countableGear[gearId] ?? 0,
        color: 'rgba(226, 232, 240, 0.92)',
      });
    }

    for (const resourceKey of RESOURCE_KEYS) {
      const amount = effectivePrice.resources[resourceKey];
      if (amount <= 0) continue;
      const spec = getResourceSpec(resourceKey);
      ingredients.push({
        id: `resource:${resourceKey}`,
        name: spec.name,
        amount,
        owned: getOwnedResourceAmount(resourceKey),
        color: spec.color,
      });
    }

    let resultLabel = '';
    let resultColor = 'rgba(226, 232, 240, 0.95)';

    if (recipe.result.kind === 'gear') {
      const resultGear = lib.gear.get(recipe.result.gearId)!;
      resultLabel = resultGear.name;
    } else {
      const resultSpec = getResourceSpec(recipe.result.resource);
      resultLabel = resultSpec.name;
      resultColor = resultSpec.color;
    }

    return {
      id: recipe.id,
      name: recipe.name,
      craftedCount,
      resultLabel,
      resultAmount: recipe.result.amount,
      resultColor,
      ingredients,
      canAfford: ingredients.every((ingredient) => ingredient.owned >= ingredient.amount),
    };
  });
});

function craft(transmutationId: string): void {
  globalInputQueue.push(new CmdTransmutate({ transmutationId }));
}
</script>

<style scoped>
.maze-transmutation-menu {
  position: absolute;
  right: 12px;
  top: 12px;
  z-index: 14;
  pointer-events: auto;
}

.transmutation-panel {
  border: none;
  border-radius: 4px;
  background: var(--panel-bg);
  color: rgba(226, 232, 240, 0.95);
  padding: 0;
  min-width: 320px;
}

.transmutation-header {
  font-size: 14px;
  letter-spacing: 0.04em;
  color: rgba(226, 232, 240, 0.95);
  background: var(--panel-bg);
  border-radius: 8px;
  padding: 10px 16px;
  margin-bottom: 6px;
}

.transmutation-body {
  min-height: 120px;
  max-height: min(60vh, 560px);
  overflow-y: auto;
  background: var(--panel-bg);
  border-radius: 8px;
  padding: 8px;
}

.recipe-card {
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 10px;
  padding: 10px 12px;
}

.recipe-card + .recipe-card {
  margin-top: 8px;
}

.recipe-card-unaffordable {
  border-color: rgba(239, 68, 68, 0.3);
}

.recipe-topline {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.recipe-name {
  font-size: 14px;
  font-weight: 700;
  color: rgba(248, 250, 252, 0.96);
}

.recipe-crafted-count {
  margin-top: 2px;
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(148, 163, 184, 0.95);
}

.recipe-result-block {
  display: flex;
  align-items: center;
  gap: 10px;
}

.recipe-result {
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.craft-btn {
  border: 1px solid rgba(96, 165, 250, 0.4);
  border-radius: 999px;
  background: rgba(30, 64, 175, 0.18);
  color: rgba(219, 234, 254, 0.98);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 6px 10px;
  cursor: pointer;
}

.craft-btn:disabled {
  cursor: default;
  opacity: 0.45;
}

.craft-btn:not(:disabled):hover {
  background: rgba(37, 99, 235, 0.28);
}

.recipe-costs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ingredient-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 4px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ingredient-accent) 12%, rgba(15, 23, 42, 0.92));
  border: 1px solid color-mix(in srgb, var(--ingredient-accent) 40%, rgba(148, 163, 184, 0.18));
  color: rgba(226, 232, 240, 0.95);
  font-size: 12px;
}

.ingredient-chip-missing {
  background: rgba(127, 29, 29, 0.34);
  border-color: rgba(248, 113, 113, 0.4);
}

.ingredient-name {
  font-weight: 700;
}

.ingredient-amount {
  color: var(--ingredient-accent);
  font-weight: 700;
}

.ingredient-owned {
  color: rgba(148, 163, 184, 0.95);
}
</style>
