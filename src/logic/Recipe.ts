import type { RecipeDefinition, TimeClass } from './RecipeLib';
import { computeRecipeDurationSec } from './RecipeLib';
import type { Essence } from './ItemLib';
import type { RecipeUpgradeDefinition } from './RecipeUpgradeLib';
import type { RecipeQualityDefinition } from './RecipeQualityLib';

// Canonical quality order for upgrades (lowest to highest)
const QUALITY_ORDER = [
  'flawed',
  'improvised',
  'crude',
  'patched',
  'standard',
  'enhanced',
  'refined',
  'special',
  'exceptional',
];

export function cloneRecipe(def: RecipeDefinition): RecipeDefinition {
  return {
    id: def.id,
    name: def.name,
    timeClass: (def as any).timeClass as TimeClass,
    duration: computeRecipeDurationSec(def.ingredients, (def as any).timeClass as TimeClass),
    quality: def.quality,
    ingredients: { ...(def.ingredients || {}) },
  };
}

export function applyEssenceDelta(ingredients: Essence, delta: Essence): Essence {
  const out: Essence = { ...(ingredients || {}) };
  const keys = new Set<string>([...Object.keys(ingredients || {}), ...Object.keys(delta || {})]);
  for (const k of keys) {
    const base = (ingredients as any)[k] || 0;
    const d = (delta as any)[k] || 0;
    // Clamp at 0; essences cannot go below 0
    const v = Math.max(0, Math.round(base + d));
    if (v > 0) (out as any)[k] = v; else delete (out as any)[k];
  }
  return out;
}

export function nextQualityId(current: string, qualities: Map<string, RecipeQualityDefinition>): string {
  const cur = (current || '').trim();
  // If unknown, try to keep as-is; otherwise move to the next known step.
  const idx = QUALITY_ORDER.indexOf(cur);
  if (idx === -1) {
    // Try to find a closest match by checking definitions
    if (!qualities.has(cur)) return cur || 'standard';
    return cur; // unknown order but valid id
  }
  const nextIdx = Math.min(QUALITY_ORDER.length - 1, idx + 1);
  return QUALITY_ORDER[nextIdx] || cur;
}

export function applyRecipeUpgrade(
  base: RecipeDefinition,
  up: RecipeUpgradeDefinition,
  qualities: Map<string, RecipeQualityDefinition>,
): RecipeDefinition {
  const res = cloneRecipe(base);
  if (!up) return res;
  switch (up.effect) {
    case 'modifyEssences': {
      const delta = (up.params || {}) as Essence;
      res.ingredients = applyEssenceDelta(res.ingredients, delta);
      // Recompute duration when ingredients change
      res.duration = computeRecipeDurationSec(res.ingredients, (res as any).timeClass as TimeClass);
      break;
    }
    case 'increaseQuality': {
      res.quality = nextQualityId(res.quality || 'standard', qualities);
      // Duration unaffected by quality; keep consistent
      res.duration = computeRecipeDurationSec(res.ingredients, (res as any).timeClass as TimeClass);
      break;
    }
  }
  return res;
}
