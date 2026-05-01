<template>
  <div v-if="visible" class="maze-transmutation-menu">
    <div class="tm-panel">
      <div class="tm-header">TRANSMUTATION</div>
      <div class="tm-body">
        <div
          v-for="recipe in recipes"
          :key="recipe.id"
          class="tm-recipe"
          :class="{ 'tm-recipe--transmuting': transmutationWaveRuns[recipe.id] !== undefined }"
        >
          <div
            v-if="transmutationWaveRuns[recipe.id] !== undefined"
            :key="transmutationWaveRuns[recipe.id]"
            class="tm-recipe-wave"
            aria-hidden="true"
          />
          <div class="tm-recipe-flow">
            <!-- Gear ingredient slots only (resources are in the button) -->
            <div class="tm-slots">
              <div
                v-for="ingredient in recipe.gearIngredients"
                :key="ingredient.id"
                class="tm-slot"
                :class="{ 'tm-slot--short': ingredient.owned < ingredient.amount }"
              >
                <div class="tm-slot-icon">
                  <div class="tm-slot-sprite" :style="ingredient.spriteStyle" />
                </div>
                <div class="tm-slot-count" :class="{ 'tm-slot-count--short': ingredient.owned < ingredient.amount }">
                  <span class="tm-count-default">{{ ingredient.amount }}</span>
                  <span class="tm-count-hover">{{ ingredient.owned }}&thinsp;/&thinsp;{{ ingredient.amount }}</span>
                </div>
                <div v-if="ingredient.gear" class="tm-hint">
                  <GearStatsHint :gear="ingredient.gear" :showResourceContext="false" noRaidContext />
                </div>
              </div>
            </div>

            <div class="tm-arrow">⟶</div>

            <!-- Result column: name above, slot below -->
            <div class="tm-result-col">
              <div class="tm-recipe-top">
                <span class="tm-recipe-name">{{ recipe.name }}</span>
              </div>
              <div
                class="tm-result-slot"
                :class="{
                  'tm-result-slot--resource': !recipe.resultGearImage,
                  'tm-result-slot--transmuting': transmutationWaveRuns[recipe.id] !== undefined,
                }"
                :style="{ '--result-color': recipe.resultColor }"
              >
                <div v-if="recipe.resultGearImage" class="tm-slot-icon">
                  <div class="tm-slot-sprite" :style="recipe.resultSpriteStyle" />
                </div>
                <div v-else class="tm-slot-icon">
                  <span class="tm-slot-glyph" :style="{ color: recipe.resultColor }">{{ recipe.resultGlyph }}</span>
                </div>
                <div class="tm-result-count" :class="{ 'tm-result-count--hover-only': recipe.resultAmount <= 1 }">
                  <span v-if="recipe.resultAmount > 1" class="tm-count-default">+{{ recipe.resultAmount }}</span>
                  <span class="tm-count-hover">{{ recipe.resultOwned }} /</span>
                </div>
                <div v-if="recipe.resultGear" class="tm-hint">
                  <GearStatsHint :gear="recipe.resultGear" :showResourceContext="false" noRaidContext />
                </div>
                <div v-else-if="recipe.resultResourceSpec" class="tm-hint">
                  <div class="tm-resource-hint">
                    <span>Gives </span>
                    <span class="tm-resource-hint-value" :style="{ color: recipe.resultResourceSpec.color }">{{ recipe.resultAmount }}{{ recipe.resultResourceSpec.glyph }}</span>
                    <span> {{ recipe.resultResourceSpec.name }}</span>
                    <span class="tm-resource-hint-desc"> ({{ recipe.resultResourceSpec.description }})</span>
                  </div>
                </div>
              </div>
            </div>
            <button
              class="tm-craft-btn"
              :class="{ 'tm-craft-btn--disabled': !recipe.canAfford }"
              type="button"
              :disabled="!recipe.canAfford"
              @click="craft(recipe.id)"
            >
              <span class="tm-craft-label">Transmutate</span>
              <span class="tm-craft-price">
                <template v-for="cost in recipe.resourceCosts" :key="cost.key">
                  <span class="tm-craft-cost" :style="{ color: cost.color }">{{ cost.amount }}{{ cost.glyph }}</span>
                </template>
              </span>
            </button>
          </div>
        </div>

      </div>
      <div v-if="ownedItems.length > 0" class="tm-header tm-header--owned">YOU HAVE:</div>
      <div v-if="ownedItems.length > 0" class="tm-owned-panel">
        <div class="tm-owned-items">
          <div
            v-for="item in ownedItems"
            :key="item.id"
            class="tm-owned-item"
            :class="{ 'tm-owned-item--resource': item.kind === 'resource' }"
            :style="item.kind === 'resource' ? { '--owned-color': item.color } : undefined"
          >
            <div class="tm-slot-icon">
              <div v-if="item.kind === 'gear'" class="tm-slot-sprite" :style="item.spriteStyle" />
              <span v-else class="tm-slot-glyph" :style="{ color: item.color }">{{ item.glyph }}</span>
            </div>
            <div class="tm-owned-count">{{ item.owned }}</div>
            <div v-if="item.kind === 'gear'" class="tm-hint">
              <GearStatsHint :gear="item.gear" :showResourceContext="false" noRaidContext />
            </div>
            <div v-else class="tm-hint">
              <div class="tm-resource-hint">
                <span>{{ item.name }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, type CSSProperties } from 'vue';
import { RESOURCE_KEYS, getResourceSpec, type ResourceKey, type ResourceSpec } from '../logic/Resources';
import type { GearDefinition } from '../logic/GearLib';
import { getGameLib, uiState } from '../logic/UIState';
import { CmdTransmutate } from '../logic/input/InputCommands';
import { globalInputQueue } from '../logic/Model';
import { getTransmutationEffectivePrice } from '../logic/Transmutation';
import atlasStorage from '../logic/AtlasStorage';
import { atlasSpriteStyle } from '../logic/AtlasSpriteStyle';
import GearStatsHint from './GearStatsHint.vue';

defineProps<{
  visible: boolean;
}>();

const SPRITE_SIZE = 56;
const TRANSMUTATION_WAVE_DURATION_MS = 820;
const OMITTED_OWNED_RESOURCE_KEYS: ResourceKey[] = ['credits', 'chronotraces'];
const transmutationWaveRuns = ref<Record<string, number>>({});
const waveTimeouts = new Map<string, number>();
let nextTransmutationWaveRunId = 0;

interface GearIngredientViewModel {
  id: string;
  name: string;
  amount: number;
  owned: number;
  gear: GearDefinition;
  spriteStyle: CSSProperties | null;
}

interface ResourceCostViewModel {
  key: ResourceKey;
  amount: number;
  glyph: string;
  color: string;
}

type OwnedItemViewModel =
  | {
    id: string;
    kind: 'gear';
    name: string;
    owned: number;
    gear: GearDefinition;
    spriteStyle: CSSProperties | null;
  }
  | {
    id: string;
    kind: 'resource';
    name: string;
    owned: number;
    glyph: string;
    color: string;
  };

interface RecipeViewModel {
  id: string;
  name: string;
  craftedCount: number;
  resultLabel: string;
  resultAmount: number;
  resultColor: string;
  resultGlyph: string;
  resultGearImage: string | null;
  resultSpriteStyle: CSSProperties | null;
  resultGear: GearDefinition | null;
  resultResourceSpec: ResourceSpec | null;
  resultOwned: number;
  gearIngredients: GearIngredientViewModel[];
  resourceCosts: ResourceCostViewModel[];
  canAfford: boolean;
}

function getOwnedResourceAmount(resource: ResourceKey): number {
  if (resource === 'credits') return uiState.credits;
  if (resource === 'chronotraces') return uiState.chronotraces;
  if (resource === 'timeFlux') return uiState.timeFlux;
  if (resource === 'shardDust') return uiState.shardDust;
  return uiState.skillPoints;
}

function gearSpriteStyle(imageKey: string): CSSProperties | null {
  const source = atlasStorage.getItemsSource();
  const frame = atlasStorage.getItemsFrame(imageKey);
  if (!source || !frame) return null;
  return atlasSpriteStyle(source, frame, { size: SPRITE_SIZE, mode: 'fit', allowUpscale: false }) as CSSProperties;
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
    const gearIngredients: GearIngredientViewModel[] = [];
    const resourceCosts: ResourceCostViewModel[] = [];
    let canAfford = true;

    for (const [gearId, amount] of Object.entries(effectivePrice.gear)) {
      const gear = lib.gear.get(gearId)!;
      const owned = uiState.countableGear[gearId] ?? 0;
      if (owned < amount) canAfford = false;
      gearIngredients.push({
        id: `gear:${gearId}`,
        name: gear.name,
        amount,
        owned,
        gear,
        spriteStyle: gearSpriteStyle(gear.image),
      });
    }

    for (const resourceKey of RESOURCE_KEYS) {
      const amount = effectivePrice.resources[resourceKey];
      if (amount <= 0) continue;
      const spec = getResourceSpec(resourceKey);
      if (getOwnedResourceAmount(resourceKey) < amount) canAfford = false;
      resourceCosts.push({
        key: resourceKey,
        amount,
        glyph: spec.glyph,
        color: spec.color,
      });
    }

    let resultLabel = '';
    let resultColor = 'rgba(226, 232, 240, 0.95)';
    let resultGlyph = '';
    let resultGearImage: string | null = null;
    let resultSpriteStyle: CSSProperties | null = null;
    let resultGear: GearDefinition | null = null;
    let resultResourceSpec: ResourceSpec | null = null;
    let resultOwned = 0;

    if (recipe.result.kind === 'gear') {
      const rg = lib.gear.get(recipe.result.gearId)!;
      resultLabel = rg.name;
      resultGearImage = rg.image;
      resultSpriteStyle = gearSpriteStyle(rg.image);
      resultGear = rg;
      resultOwned = uiState.countableGear[recipe.result.gearId] ?? 0;
    } else {
      const resultSpec = getResourceSpec(recipe.result.resource);
      resultLabel = resultSpec.name;
      resultColor = resultSpec.color;
      resultGlyph = resultSpec.glyph;
      resultResourceSpec = resultSpec;
      resultOwned = getOwnedResourceAmount(recipe.result.resource);
    }

    return {
      id: recipe.id,
      name: recipe.name,
      craftedCount,
      resultLabel,
      resultAmount: recipe.result.amount,
      resultColor,
      resultGlyph,
      resultGearImage,
      resultSpriteStyle,
      resultGear,
      resultResourceSpec,
      resultOwned,
      gearIngredients,
      resourceCosts,
      canAfford,
    };
  });
});

const ownedItems = computed<OwnedItemViewModel[]>(() => {
  const items: OwnedItemViewModel[] = [];
  const seen = new Set<string>();

  for (const recipe of recipes.value) {
    for (const ingredient of recipe.gearIngredients) {
      if (seen.has(ingredient.id)) continue;
      seen.add(ingredient.id);
      items.push({
        id: ingredient.id,
        kind: 'gear',
        name: ingredient.name,
        owned: ingredient.owned,
        gear: ingredient.gear,
        spriteStyle: ingredient.spriteStyle,
      });
    }

    for (const cost of recipe.resourceCosts) {
      if (OMITTED_OWNED_RESOURCE_KEYS.includes(cost.key)) continue;
      const id = `resource:${cost.key}`;
      if (seen.has(id)) continue;
      seen.add(id);
      items.push({
        id,
        kind: 'resource',
        name: getResourceSpec(cost.key).name,
        owned: getOwnedResourceAmount(cost.key),
        glyph: cost.glyph,
        color: cost.color,
      });
    }

    if (recipe.resultGear) {
      const id = `gear:${recipe.resultGear.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      items.push({
        id,
        kind: 'gear',
        name: recipe.resultGear.name,
        owned: recipe.resultOwned,
        gear: recipe.resultGear,
        spriteStyle: recipe.resultSpriteStyle,
      });
      continue;
    }

    if (recipe.resultResourceSpec) {
      if (OMITTED_OWNED_RESOURCE_KEYS.includes(recipe.resultResourceSpec.key)) continue;
      const id = `resource:${recipe.resultResourceSpec.key}`;
      if (seen.has(id)) continue;
      seen.add(id);
      items.push({
        id,
        kind: 'resource',
        name: recipe.resultResourceSpec.name,
        owned: recipe.resultOwned,
        glyph: recipe.resultResourceSpec.glyph,
        color: recipe.resultResourceSpec.color,
      });
    }
  }

  return items;
});

function triggerTransmutationWave(transmutationId: string): void {
  const existingTimeout = waveTimeouts.get(transmutationId);
  if (existingTimeout !== undefined) window.clearTimeout(existingTimeout);

  const runId = ++nextTransmutationWaveRunId;
  transmutationWaveRuns.value = {
    ...transmutationWaveRuns.value,
    [transmutationId]: runId,
  };

  const timeoutId = window.setTimeout(() => {
    if (transmutationWaveRuns.value[transmutationId] !== runId) return;
    const { [transmutationId]: _, ...remainingRuns } = transmutationWaveRuns.value;
    transmutationWaveRuns.value = remainingRuns;
    waveTimeouts.delete(transmutationId);
  }, TRANSMUTATION_WAVE_DURATION_MS);

  waveTimeouts.set(transmutationId, timeoutId);
}

function craft(transmutationId: string): void {
  triggerTransmutationWave(transmutationId);
  globalInputQueue.push(new CmdTransmutate({ transmutationId }));
}

onBeforeUnmount(() => {
  for (const timeoutId of waveTimeouts.values()) window.clearTimeout(timeoutId);
  waveTimeouts.clear();
});
</script>

<style scoped>
.maze-transmutation-menu {
  position: absolute;
  right: 12px;
  top: 12px;
  z-index: 14;
  pointer-events: auto;
}

.tm-panel {
  border: none;
  border-radius: 4px;
  color: rgba(226, 232, 240, 0.95);
  padding: 0;
  width: max-content;
}

.tm-header {
  font-size: 14px;
  letter-spacing: 0.04em;
  color: rgba(226, 232, 240, 0.95);
  background: var(--panel-bg);
  border-radius: 8px;
  padding: 10px 16px;
  margin-bottom: 6px;
}

.tm-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Recipe card */
.tm-recipe {
  position: relative;
  isolation: isolate;
  background: var(--panel-bg);
  border-radius: 8px;
  padding: 30px 16px 14px;
  transition: background 0.15s, box-shadow 0.15s ease;
}

.tm-recipe:hover {
  background: rgba(255, 255, 255, 0.08);
}

.tm-recipe--transmuting {
  box-shadow: 0 0 0 1px rgba(103, 232, 249, 0.18), 0 0 18px rgba(45, 212, 191, 0.18);
}

.tm-recipe-wave {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.tm-recipe-wave::before {
  content: '';
  position: absolute;
  inset: -18% -12%;
  background:
    linear-gradient(
      102deg,
      transparent 0%,
      rgba(56, 189, 248, 0.06) 24%,
      rgba(45, 212, 191, 0.28) 40%,
      rgba(244, 244, 245, 0.74) 50%,
      rgba(74, 222, 128, 0.3) 60%,
      rgba(56, 189, 248, 0.08) 76%,
      transparent 100%
    );
  filter: blur(6px);
  transform: translateX(-125%);
  animation: tm-transmutation-wave var(--tm-wave-duration, 820ms) cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
}

.tm-recipe-wave::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 18% 50%, rgba(191, 219, 254, 0.16), transparent 22%),
    radial-gradient(circle at 36% 50%, rgba(153, 246, 228, 0.12), transparent 28%),
    radial-gradient(circle at 54% 50%, rgba(255, 255, 255, 0.08), transparent 22%);
  opacity: 0;
  transform: translateX(-32%);
  animation: tm-transmutation-ripple var(--tm-wave-duration, 820ms) ease-out forwards;
}

/* Flow: ingredients → result */
.tm-recipe-flow {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  gap: 14px;
}

.tm-slots {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* Individual ingredient slot */
.tm-slot {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
}

.tm-slot--short {
  background: rgba(239, 68, 68, 0.14);
}

/* Shared icon container */
.tm-slot-icon {
  width: 76px;
  height: 76px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tm-slot-sprite {
  flex-shrink: 0;
  image-rendering: auto;
}

.tm-slot-glyph {
  font-size: 34px;
  line-height: 1;
}

/* Corner count badge — required amount only */
.tm-slot-count {
  position: absolute;
  top: 0;
  right: 0;
  padding: 2px 5px;
  border-bottom-left-radius: 6px;
  border-top-right-radius: 4px;
  background: rgba(96, 165, 250, 0.45);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  white-space: nowrap;
}

.tm-slot-count--short {
  background: rgba(239, 68, 68, 0.5);
  color: #fca5a5;
}

/* Gear stats hint tooltip — display toggle like GearItem, shown to the left */
.tm-hint {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  display: none;
  background: var(--hint-bg, rgba(10, 14, 20, 0.95));
  border: 1px solid var(--hint-border, rgba(148, 163, 184, 0.25));
  border-radius: 4px;
  padding: 4px 10px;
  min-width: 120px;
  width: max-content;
  max-width: 75vw;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.04em;
  z-index: 3000;
  pointer-events: none;
}

.tm-hint::after {
  content: '';
  position: absolute;
  bottom: calc(100% - 5px);
  left: 50%;
  width: 10px;
  height: 10px;
  background: var(--hint-bg, rgba(10, 14, 20, 0.95));
  border-left: 1px solid var(--hint-border, rgba(148, 163, 184, 0.25));
  border-top: 1px solid var(--hint-border, rgba(148, 163, 184, 0.25));
  transform: translateX(-50%) rotate(45deg);
}

.tm-slot:hover .tm-hint,
.tm-result-slot:hover .tm-hint {
  display: block;
}

/* Show owned counts on hover */
.tm-count-hover { display: none; }
.tm-slot:hover .tm-count-default { display: none; }
.tm-slot:hover .tm-count-hover { display: inline; }
.tm-result-count--hover-only { display: none; }
.tm-result-slot:hover .tm-result-count--hover-only { display: block; }
.tm-result-slot:hover .tm-count-default { display: none; }
.tm-result-slot:hover .tm-count-hover { display: inline; }

/* Arrow — vertically centered relative to the slot icons */
.tm-arrow {
  flex-shrink: 0;
  height: 76px;
  display: flex;
  align-items: center;
  font-size: 32px;
  font-weight: 900;
  color: rgba(148, 163, 184, 0.5);
  line-height: 1;
}

/* Result column: name on top, slot below */
.tm-result-col {
  position: relative;
}

.tm-recipe-top {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding-bottom: 4px;
  white-space: nowrap;
}

.tm-recipe-name {
  font-size: 14px;
  font-weight: 700;
  color: rgba(248, 250, 252, 0.96);
  white-space: nowrap;
}

.tm-recipe-count {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: rgba(148, 163, 184, 0.6);
}

/* Result slot */
.tm-result-slot {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-radius: 4px;
  background: color-mix(in srgb, var(--result-color) 10%, rgba(255, 255, 255, 0.08));
  transform-origin: center;
}

.tm-result-slot--resource {
  background: none;
}

.tm-result-slot--transmuting {
  animation: tm-result-pop 360ms ease-out 100ms;
}

/* Result corner count badge — hidden by default when no default content, shown on hover */
.tm-result-count {
  position: absolute;
  top: 0;
  right: 0;
  padding: 2px 5px;
  border-bottom-left-radius: 6px;
  border-top-right-radius: 4px;
  background: rgba(96, 165, 250, 0.45);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  white-space: nowrap;
}

/* Transmutate button — two-row layout, matches slot height */
.tm-craft-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 76px;
  margin-left: 10px;
  gap: 7px;
  padding: 0 14px;
  border: 1px solid rgba(34, 197, 94, 0.5);
  border-radius: 4px;
  background: rgba(34, 197, 94, 0.32);
  color: #86efac;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}

.tm-craft-btn:hover {
  background: rgba(34, 197, 94, 0.45);
}

.tm-craft-btn--disabled {
  cursor: default;
  opacity: 0.55;
  background: rgba(34, 197, 94, 0.10);
  border-color: rgba(34, 197, 94, 0.22);
}

.tm-craft-btn--disabled:hover {
  background: rgba(34, 197, 94, 0.10);
}

.tm-craft-label {
  line-height: 1;
}

.tm-craft-price {
  display: flex;
  align-items: center;
  gap: 6px;
  line-height: 1;
  font-size: 19px;
}

.tm-craft-cost {
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

/* Resource hint (for non-gear results) */
.tm-resource-hint {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.tm-resource-hint-value {
  font-weight: 700;
}

.tm-resource-hint-desc {
  opacity: 0.9;
}

.tm-header--owned {
  margin-top: 6px;
}

.tm-owned-panel {
  background: var(--panel-bg);
  border-radius: 8px;
  padding: 14px 16px;
}

.tm-owned-items {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tm-owned-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
}

.tm-owned-item--resource {
  background: color-mix(in srgb, var(--owned-color) 10%, rgba(255, 255, 255, 0.08));
}

.tm-owned-count {
  position: absolute;
  top: 0;
  right: 0;
  padding: 2px 5px;
  border-bottom-left-radius: 6px;
  border-top-right-radius: 4px;
  background: rgba(96, 165, 250, 0.45);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  white-space: nowrap;
}

@keyframes tm-transmutation-wave {
  0% {
    transform: translateX(-125%);
  }

  100% {
    transform: translateX(125%);
  }
}

@keyframes tm-transmutation-ripple {
  0% {
    opacity: 0;
    transform: translateX(-32%);
  }

  18% {
    opacity: 0.18;
  }

  56% {
    opacity: 0.28;
  }

  100% {
    opacity: 0;
    transform: translateX(20%);
  }
}

@keyframes tm-result-pop {
  0% {
    transform: scale(1);
    filter: brightness(1);
  }

  45% {
    transform: scale(1.12);
    filter: brightness(1.18);
  }

  100% {
    transform: scale(1);
    filter: brightness(1);
  }
}
</style>
