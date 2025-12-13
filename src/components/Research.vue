<template>
  <div class="research-panel">
    <div class="tiers">
      <div v-for="(tier, i) in displayTiers" :key="i" class="tier">
        <div class="tier-caption">Tier {{ i + 1 }}</div>
        <div class="tier-content">
          <!-- Full-width centered band overlay for locked tiers -->
          <div v-if="!uiState.research.includes(tierId(i))" class="tier-band-wrap">
            <div
              class="tier-band"
              :class="{ insufficient: uiState.chronotraces < tierPrice(i) }"
              role="button"
              :tabindex="uiState.chronotraces >= tierPrice(i) ? 0 : -1"
              @click="onTierBandClick(i)"
            >
              <div class="band-title">Unlock tier {{ i + 1 }}</div>
              <div class="band-price">{{ tierPrice(i) }} ⧖</div>
            </div>
          </div>
          <div class="tier-row">
          <template v-for="u in tier" :key="u.key">
            <UpgradeStatCard
              v-if="u.type === 'stat'"
              :label="u.statLabel"
              :purchased="uiState.research.includes(u.id)"
              :price="itemPrice(i)"
              :can-afford="uiState.chronotraces >= itemPrice(i)"
              :locked="!uiState.research.includes(tierId(i))"
              @purchase="purchase(u.id, itemPrice(i))"
            />
            <UpgradeRecipeCard
              v-else-if="u.type === 'recipe_upgrade'"
              :effect="u.upgradeEffect"
              :params="u.params"
              :purchased="uiState.research.includes(u.id)"
              :price="itemPrice(i)"
              :can-afford="uiState.chronotraces >= itemPrice(i)"
              :locked="!uiState.research.includes(tierId(i))"
              @purchase="openUpgradeModal(u.id, u.upgradeEffect, u.params, itemPrice(i))"
            />
            <UpgradeNewRecipeCard
              v-else-if="u.type === 'recipe'"
              :recipe="u.recipe!"
              :purchased="uiState.research.includes(u.id)"
              :price="itemPrice(i)"
              :can-afford="uiState.chronotraces >= itemPrice(i)"
              :locked="!uiState.research.includes(tierId(i))"
              @purchase="purchase(u.id, itemPrice(i))"
            />
            <UpgradeGearCard
              v-else
              :gear-ids="u.gearIds"
              :gear-names="u.gearNames"
              :purchased="uiState.research.includes(u.id)"
              :price="itemPrice(i)"
              :can-afford="uiState.chronotraces >= itemPrice(i)"
              :locked="!uiState.research.includes(tierId(i))"
              @purchase="purchase(u.id, itemPrice(i))"
            />
          </template>
          </div>
        </div>
      </div>
    </div>
  </div>
  <RecipeUpgradeModal />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import researchData from '../data/research';
import upgradesData from '../data/recipe_upgrades';
import recipesData from '../data/recipes';
import qualitiesData from '../data/recipe_qualities';
import gearData from '../data/gear';
import { parseResearchTiers, type ResearchTier } from '../logic/ResearchLib';
import type { RecipeDataDefinition } from '../logic/RecipeLib';
import { computeRecipeDurationSec } from '../logic/RecipeLib';
import { parseGearDefinitions, type RawGearDefinition } from '../logic/GearLib';
import UpgradeStatCard from './UpgradeStatCard.vue';
import UpgradeRecipeCard from './UpgradeRecipeCard.vue';
import UpgradeNewRecipeCard from './UpgradeNewRecipeCard.vue';
import UpgradeGearCard from './UpgradeGearCard.vue';
import UpgradeTier from './UpgradeTier.vue';
import { uiState } from '../logic/UIState';
import { RESEARCH_TIER_PRICE, RESEARCH_TIER_ITEM_PRICE } from '../logic/Const';
import { globalInputQueue } from '../logic/Model';
import { CmdPurchaseResearch } from '../logic/input/InputCommands';
import RecipeUpgradeModal from './RecipeUpgradeModal.vue';

const orderedKeys: string[] = ['red', 'green', 'blue', 'yellow'];

// Static gear lookup by id for research display
const gearMap = parseGearDefinitions(gearData as unknown as Record<string, RawGearDefinition>);

// Data source: parse research tiers from data definition
const tiers = computed<ResearchTier[]>(() => parseResearchTiers(researchData));

type DisplayRecipe = {
  id: string;
  name: string;
  qualityId: string;
  qualityDef: any;
  essList: Array<{ key: string; value: number }>;
  durationSec: number;
  timeClass: 'terribly_slow' | 'slow' | 'normal' | 'fast' | 'ultra_fast';
};

type DisplayUpgradeCard =
  | { key: string; id: string; type: 'stat'; statLabel: string }
  | { key: string; id: string; type: 'recipe_upgrade'; upgradeEffect: 'modifyEssences' | 'increaseQuality'; params?: Array<{ key: string; value: number }> }
  | { key: string; id: string; type: 'recipe'; recipe: DisplayRecipe }
  | { key: string; id: string; type: 'gear'; gearIds: string[]; gearNames: string[] };

const displayTiers = computed<DisplayUpgradeCard[][]>(() => {
  const list: DisplayUpgradeCard[][] = [];
  const src = tiers.value || [];
  for (let i = 0; i < src.length; i++) {
    const tier = src[i];
    if (!tier) continue;
    const cards: DisplayUpgradeCard[] = [];
    for (const k of Object.keys(tier)) {
      const node = (tier as any)[k];
	      if (!node) continue;
	      if (node.effect === 'giveStrength' || node.effect === 'giveLooting' || node.effect === 'giveVolume') {
	        const statName = node.effect === 'giveStrength' ? 'Strength' : node.effect === 'giveLooting' ? 'Looting' : 'Volume';
	        const amt = Math.round(node.amount || 0);
	        cards.push({ key: `${i}:${k}`, id: k, type: 'stat', statLabel: `${statName} ${amt > 0 ? '+' : ''}${amt}` });
	      } else if (node.effect === 'recipeUpgrade') {
        const up = (upgradesData as any)[node.upgradeId] as { effect?: string; params?: Record<string, number> } | undefined;
        if (up && up.effect === 'modifyEssences') {
          const params = Object.keys(up.params || {})
            .map(pk => ({ key: pk, value: (up.params as any)[pk] as number }))
            .filter(x => !!x.value);
          cards.push({ key: `${i}:${k}`, id: k, type: 'recipe_upgrade', upgradeEffect: 'modifyEssences', params });
        } else {
          cards.push({ key: `${i}:${k}`, id: k, type: 'recipe_upgrade', upgradeEffect: 'increaseQuality' });
        }
      } else if (node.effect === 'giveRecipe') {
        const rec = (recipesData as any)[node.upgradeId] as RecipeDataDefinition | undefined;
        if (!rec) continue;
        const qualityId = (rec as any).quality || 'standard';
        const qd = (qualitiesData as any)[qualityId];
        const ing = (rec as any).ingredients || {};
        const keys = Array.from(new Set([...orderedKeys, ...Object.keys(ing)]));
        const essList = keys
          .map(ek => ({ key: ek, value: (ing as any)[ek] as number | undefined }))
          .filter(x => (x.value || 0) > 0)
          .map(x => ({ key: x.key, value: x.value || 0 }));
	        const dr: DisplayRecipe = {
	          id: node.upgradeId,
	          name: (rec as any).name || node.upgradeId,
	          qualityId,
	          qualityDef: qd,
          essList,
          durationSec: computeRecipeDurationSec((rec as any).ingredients || {}, (rec as any).timeClass || 'normal'),
          timeClass: (rec as any).timeClass || 'normal',
	        };
	        cards.push({ key: `${i}:${k}`, id: k, type: 'recipe', recipe: dr });
	      } else if (node.effect === 'unlockGear') {
	        const ids: string[] = Array.isArray((node as any).gearIds) ? (node as any).gearIds as string[] : [];
	        const names: string[] = [];
	        for (const rawId of ids) {
	          const gid = (rawId || '').trim();
	          if (!gid) continue;
	          const def = gearMap.get(gid);
	          if (def && def.name) {
	            names.push(def.name);
	          } else {
	            names.push(gid);
	          }
	        }
	        if (names.length) {
	          cards.push({ key: `${i}:${k}`, id: k, type: 'gear', gearIds: ids, gearNames: names });
	        }
	      }
    }
    list[i] = cards;
  }
  return list;
});

// Purchasing helpers
function tierId(i: number): string { return `tier_${i}`; }
function tierPrice(i: number): number { const idx = Math.max(0, Math.min(i, RESEARCH_TIER_PRICE.length - 1)); return RESEARCH_TIER_PRICE[idx] || 0; }
function itemPrice(i: number): number { const idx = Math.max(0, Math.min(i, RESEARCH_TIER_ITEM_PRICE.length - 1)); return RESEARCH_TIER_ITEM_PRICE[idx] || 0; }

function purchase(id: string, price: number): void {
  if (!id) return;
  globalInputQueue.push(new CmdPurchaseResearch({ id, price }));
}

function openUpgradeModal(
  researchId: string,
  effect: 'modifyEssences' | 'increaseQuality',
  params: Array<{ key: string; value: number }> | undefined,
  price: number,
): void {
  if (!researchId) return;
  const paramRecord: Record<string, number> | undefined = params && params.length
    ? params.reduce((acc, p) => { acc[p.key] = p.value; return acc; }, {} as Record<string, number>)
    : undefined;
  uiState.recipeUpgradeCtx = { researchId, price, effect, params: paramRecord };
  uiState.recipeUpgradeOpen = true;
}

function onTierBandClick(i: number): void {
  const canAfford = uiState.chronotraces >= tierPrice(i);
  if (!canAfford) return;
  purchase(tierId(i), tierPrice(i));
}
</script>

<style scoped>
.research-panel, .research-panel *, .research-panel :deep(*) { box-sizing: border-box; }
.research-panel { display: flex; flex-direction: column; }

 .tiers { display: flex; flex-direction: column; gap: 16px; align-items: flex-start; container-type: inline-size; width: 100%; }
 .tier { position: relative; border-radius: 6px; padding: 12px; background: rgba(255,255,255,0.02); box-shadow: inset 0 1px 0 var(--panel-shine); width: 100%; }
 
 /* Snap tier width to fit exact number of cards (Card 320px + Gap 12px + Padding 24px) -> 332n + 12 */
 @container (min-width: 348px) { .tier { max-width: 344px; } }
 @container (min-width: 680px) { .tier { max-width: 676px; } }
 @container (min-width: 1012px) { .tier { max-width: 1008px; } }
 @container (min-width: 1344px) { .tier { max-width: 1340px; } }
 @container (min-width: 1676px) { .tier { max-width: 1672px; } }
 @container (min-width: 2008px) { .tier { max-width: 2004px; } }
 .tier-caption { font-weight: 900; font-size: 22px; letter-spacing: 0.02em; margin-bottom: 8px; color: var(--accent-hover); }
 .tier-content { position: relative; }
 .tier-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: stretch; }
 /* Overlay band across the tier block when locked */
 .tier-band-wrap { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 50; pointer-events: none; }
 .tier-band { pointer-events: auto; width: 100%; min-height: 80px; border-radius: 0; background: var(--bg-2-op); box-shadow: inset 0 1px 0 var(--panel-shine); padding: 20px 16px; display: flex; align-items: center; justify-content: center; gap: 16px; cursor: pointer; }
 .band-title { font-weight: 900; font-size: 20px; letter-spacing: 0.01em; text-align: center; }
 .band-price { font-weight: 900; font-size: 20px; padding: 2px 10px 4px 10px; border-radius: 6px; background: rgba(0,0,0,0.25); color: #9ae6b4; }
 .tier-band.insufficient { border-color: #f87171; color: #fca5a5; cursor: not-allowed; }
 .tier-band.insufficient .band-price { color: #f87171; }
</style>
