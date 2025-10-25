<template>
  <div v-if="open && canShow" class="modal-backdrop">
    <div class="modal">
      <header class="modal-header">
        <h3>{{ title }}</h3>
        <div class="available">Price: <strong>{{ price }}</strong> ⧖</div>
      </header>

      <section class="modal-body">
        <div class="legend"><span>Choose a recipe to upgrade:</span></div>

        <!-- Essence modification preview: show before -> after ingredients; omit recipe names -->
        <div v-if="effectType === 'modifyEssences'" class="pairs-grid">
          <label
            v-for="p in pairs"
            :key="p.id"
            class="pair-row"
            :class="{ selected: selectedId === p.id }"
          >
            <input type="radio" name="recipe-upgrade" :value="p.id" v-model="selectedId" />
            <div class="pair-cards">
              <div class="rc">
                <RecipeCard :recipe="p.original" size="compact" :clickable="false" :bordered="false" :highlight-insufficient="false" />
              </div>
              <div class="arrow">→</div>
              <div class="rc rc--modded">
                <RecipeCard :recipe="p.modded" size="compact" :clickable="false" :bordered="false" :highlight-insufficient="false" />
              </div>
            </div>
          </label>
        </div>

        <!-- Quality upgrade preview: show yield % change only -->
        <div v-else class="pairs-grid">
          <label
            v-for="q in qualityRows"
            :key="q.id"
            class="pair-row"
            :class="{ selected: selectedId === q.id }"
          >
            <input type="radio" name="recipe-upgrade" :value="q.id" v-model="selectedId" />
            <div class="quality-cards">
              <div class="rc">
                <RecipeCard :recipe="q" size="compact" :clickable="false" :bordered="false" :highlight-insufficient="false" />
              </div>
              <div class="yield-row">
                <span class="yield-label">Yield</span>
                <span class="yield-from">{{ q.fromPct }}%</span>
                <span class="arrow">→</span>
                <span class="yield-to">{{ q.toPct }}%</span>
              </div>
            </div>
          </label>
        </div>

        <div class="actions">
          <button class="btn" @click="onCancel">Cancel</button>
          <button class="btn primary" :disabled="!selectedId" @click="onConfirm">Upgrade</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { uiState, getGameLib } from '../logic/UIState';
import type { RecipeDefinition } from '../logic/RecipeLib';
import { applyRecipeUpgrade } from '../logic/Recipe';
import type { RecipeUpgradeDefinition } from '../logic/RecipeUpgradeLib';
import { globalInputQueue } from '../logic/Model';
import { CmdPurchaseResearch, CmdUpgradeRecipe } from '../logic/input/InputCommands';
import RecipeCard from './RecipeCard.vue';

const open = computed(() => uiState.recipeUpgradeOpen);
const ctx = computed(() => uiState.recipeUpgradeCtx);
const price = computed(() => Math.max(0, ctx.value?.price || 0));
const title = computed(() => ctx.value?.effect === 'modifyEssences' ? 'Recipe Modification' : 'Recipe Quality Upgrade');
const canShow = computed(() => !!getGameLib() && (uiState.recipes?.length || 0) > 0 && !!ctx.value);
const effectType = computed(() => ctx.value?.effect || 'modifyEssences');

const selectedId = ref<string>('');

function qualityName(id: string): string {
  const lib = getGameLib();
  if (!lib) return id;
  return lib.recipeQualities.get(id)?.name || id;
}

type DisplaySide = {
  id: string;
  name: string;
  qualityId: string;
  essList: Array<{ key: string; value: number }>;
  durationSec: number;
  timeClass?: 'terribly_slow' | 'slow' | 'normal' | 'fast' | 'ultra_fast';
};

type DisplayPair = { id: string; original: DisplaySide; modded: DisplaySide };
type DisplayQuality = { id: string; name: string; qualityId: string; essList: Array<{ key: string; value: number }>; durationSec: number; fromPct: number; toPct: number; timeClass?: 'terribly_slow' | 'slow' | 'normal' | 'fast' | 'ultra_fast' };

function toEssList(ing?: Record<string, number>): Array<{ key: string; value: number }> {
  const o = ing || {};
  const orderedKeys = ['red', 'green', 'blue', 'yellow'];
  const keys = Array.from(new Set([...orderedKeys, ...Object.keys(o)])).filter(k => (o[k] || 0) > 0);
  return keys.map(k => ({ key: k, value: Math.max(0, o[k] || 0) }));
}

function ctxToUpgradeDef(): RecipeUpgradeDefinition | null {
  const c = ctx.value;
  if (!c) return null;
  if (c.effect === 'modifyEssences') {
    return { id: '_tmp', effect: 'modifyEssences', params: c.params } as RecipeUpgradeDefinition;
  }
  return { id: '_tmp', effect: 'increaseQuality' } as RecipeUpgradeDefinition;
}

function normalizeIng(ing?: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, vAny] of Object.entries(ing || {})) {
    const v = Math.max(0, Math.round(vAny || 0));
    if (v > 0) out[k] = v;
  }
  return out;
}

const pairs = computed<DisplayPair[]>(() => {
  const res: DisplayPair[] = [];
  const lib = getGameLib();
  const upgrade = ctxToUpgradeDef();
  if (!lib || !upgrade) return res;
  const ids = (uiState.recipes || []) as string[];
  for (const id of ids) {
    const base = lib.recipes.get(id) as RecipeDefinition | undefined;
    if (!base) continue;
    const modded = applyRecipeUpgrade(base, upgrade, lib.recipeQualities);
    // Filter out unchanged results (no ingredient or quality change)
    const a = normalizeIng((base.ingredients as any) || {});
    const b = normalizeIng((modded.ingredients as any) || {});
    const sameQuality = (base.quality || 'standard') === (modded.quality || 'standard');
    const sameIngredients = JSON.stringify(a) === JSON.stringify(b);
    if (sameQuality && sameIngredients) continue;
    res.push({
      id,
      original: { id, name: base.name || id, qualityId: base.quality || 'standard', essList: toEssList(base.ingredients as any), durationSec: (base as any).duration || 0, timeClass: (base as any).timeClass || 'normal' },
      modded: { id, name: modded.name || id, qualityId: modded.quality || 'standard', essList: toEssList(modded.ingredients as any), durationSec: (modded as any).duration || (base as any).duration || 0, timeClass: (modded as any).timeClass || (base as any).timeClass || 'normal' },
    });
  }
  return res;
});

const qualityRows = computed<DisplayQuality[]>(() => {
  const out: DisplayQuality[] = [];
  const lib = getGameLib();
  if (!lib) return out;
  const ids = (uiState.recipes || []) as string[];
  for (const id of ids) {
    const base = lib.recipes.get(id) as RecipeDefinition | undefined;
    if (!base) continue;
    const qFrom = base.quality || 'standard';
    // emulate one-step quality upgrade
    const qEntry = lib.recipeQualities.get(qFrom);
    const fromPct = Math.round(100 * Math.max(0, qEntry?.yieldMultiplier ?? 1));
    // next quality according to Recipe.nextQualityId
    // Reuse applyRecipeUpgrade by simulating increaseQuality
    const modded = applyRecipeUpgrade(base, { id: '_tmp', effect: 'increaseQuality' }, lib.recipeQualities);
    const qTo = modded.quality || qFrom;
    if (qTo === qFrom) continue; // no change, skip
    const qToEntry = lib.recipeQualities.get(qTo);
    const toPct = Math.round(100 * Math.max(0, qToEntry?.yieldMultiplier ?? 1));
    out.push({ id, name: base.name || id, qualityId: qFrom, essList: toEssList((base.ingredients as any) || {}), durationSec: (base as any).duration || 0, fromPct, toPct, timeClass: (base as any).timeClass || 'normal' });
  }
  return out;
});

function onCancel() {
  uiState.recipeUpgradeOpen = false;
  uiState.recipeUpgradeCtx = null;
  selectedId.value = '';
}

function onConfirm() {
  const c = ctx.value;
  const rid = selectedId.value;
  if (!c || !rid) return;
  // First purchase research, then apply upgrade
  globalInputQueue.push(new CmdPurchaseResearch({ id: c.researchId, price: c.price }));
  globalInputQueue.push(new CmdUpgradeRecipe({ researchId: c.researchId, recipeId: rid }));
  onCancel();
}

</script>

<style scoped>
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: grid; place-items: center; z-index: 10000; }
.modal { width: min(780px, 96vw); max-height: 92vh; overflow: auto; background: linear-gradient(180deg, rgba(20, 28, 40, 0.98), rgba(10, 15, 26, 0.94)); border: 1px solid var(--panel-border); border-radius: 6px; box-shadow: 0 24px 64px rgba(0,0,0,0.7), inset 0 1px 0 var(--panel-shine); padding: 16px; }
.modal-header { display: flex; align-items: baseline; justify-content: space-between; }
.modal-header h3 { margin: 0; font-size: 18px; letter-spacing: 0.02em; }
.available { color: var(--text-secondary); }
.legend { margin: 8px 0 12px; opacity: 0.9; font-weight: 700; }

.pairs-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
.pair-row { display: grid; align-items: center; grid-template-columns: 24px 1fr; gap: 8px; border: 1px solid var(--panel-border); border-radius: 6px; padding: 8px; background: rgba(255,255,255,0.02); }
.pair-row.selected { border-color: var(--accent-hover); box-shadow: 0 0 0 2px rgba(79,209,197,0.15) inset; }
.pair-cards { display: grid; grid-template-columns: 1fr 32px 1fr; gap: 12px; align-items: center; }
.arrow { text-align: center; font-weight: 900; font-size: 20px; color: var(--text-secondary); }

.rc { border: 1px solid var(--panel-border); border-radius: 6px; padding: 8px; width: 320px; max-width: 320px; }
.rc-title { display: flex; align-items: baseline; justify-content: space-between; }
.rc-name { font-weight: 800; letter-spacing: 0.02em; }
.quality-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-weight: 800; background: rgba(79, 209, 197, 0.12); border: 1px solid rgba(79, 209, 197, 0.35); color: var(--accent-hover); }
.rc-body { display: flex; align-items: center; gap: 12px; }
.ess-need { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ess-unit { display: inline-flex; align-items: center; gap: 6px; }
/* recipe content is provided by RecipeCard (compact, borderless) */

/* Quality row styling */
.yield-row { display: inline-flex; align-items: center; gap: 10px; font-weight: 900; letter-spacing: 0.02em; }
.yield-label { opacity: 0.85; font-weight: 800; margin-right: 6px; }
.yield-from { color: var(--text-secondary); }
.yield-to { color: var(--accent-hover); }

/* Layout for quality upgrade cards */
.quality-cards { display: grid; grid-template-columns: auto auto; gap: 8px; align-items: center; }

.actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 12px; }
.btn { padding: 8px 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; border-radius: 4px; border: 1px solid var(--panel-border); cursor: pointer; }
.btn.primary { background: rgba(79, 209, 197, 0.14); color: var(--accent); }
.btn.primary:disabled { opacity: 0.5; cursor: default; }
</style>
