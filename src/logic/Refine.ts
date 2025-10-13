import type { Lib } from './Lib';
import type { Essence } from './ItemLib';
import { ESSENCE_CHRONOTRACES, ESSENCE_CREDITS } from './Const';

export interface RefinePreview {
  qualityName: string;
  qualityYieldPct: number; // 0..100
  failureChancePct: number; // 0..100
  refineryConditionPct: number; // 0..100
  totalYieldPct: number; // 0..100
  matchedEssences: number;
  expectedCredits: number;
  expectedChrono: number;
  wasteByKey: Record<string, number>;
}

export function computeLoadedEssencesFromItems(lib: Lib, items: Array<{ id: string; quantity: number }>): Essence {
  const totals: Essence = {};
  for (const it of items || []) {
    const def = lib.items.get(it.id);
    if (!def) continue;
    const ess = def.essence || {};
    const q = Math.max(1, it.quantity || 1);
    for (const k of Object.keys(ess)) {
      const v = (ess as any)[k] || 0;
      (totals as any)[k] = ((totals as any)[k] || 0) + v * q;
    }
  }
  return totals;
}

export function computeRefinePreview(
  lib: Lib,
  recipeId: string,
  refineryHealthPct: number,
  stagedEssences: Record<string, number>,
): RefinePreview {
  const recipe = lib.recipes.get(recipeId);
  const qualityId = recipe?.quality || 'standard';
  const qualityDef = lib.recipeQualities.get(qualityId);
  const qualityName = (qualityDef?.name || qualityId);
  const qualityYieldPct = Math.round(100 * Math.max(0, qualityDef?.yieldMultiplier ?? 1));
  const failureChancePct = Math.max(0, Math.round(qualityDef?.nothingChancePct || 0));
  const refineryConditionPct = Math.max(0, Math.min(100, Math.round(refineryHealthPct || 0)));
  const totalYieldPct = Math.round((qualityYieldPct * refineryConditionPct) / 100);

  // Matched essences: sum over types of min(loaded, required)
  const requirements = (recipe?.ingredients || {}) as Record<string, number>;
  const keys = new Set<string>([...Object.keys(requirements), ...Object.keys(stagedEssences)]);
  let matchedEssences = 0;
  const wasteByKey: Record<string, number> = {};
  for (const k of keys) {
    const need = Math.max(0, requirements[k] || 0);
    const have = Math.max(0, stagedEssences[k] || 0);
    matchedEssences += Math.min(need, have);
    const excess = Math.max(0, have - need);
    if (excess > 0) wasteByKey[k] = excess;
  }

  const expectedCredits = Math.round(matchedEssences * (totalYieldPct / 100) * ESSENCE_CREDITS);
  const expectedChrono = Math.round(matchedEssences * (totalYieldPct / 100) * ESSENCE_CHRONOTRACES);

  return {
    qualityName,
    qualityYieldPct,
    failureChancePct,
    refineryConditionPct,
    totalYieldPct,
    matchedEssences,
    expectedCredits,
    expectedChrono,
    wasteByKey,
  };
}

// For saving only the wasted part: have - need (>= 0)
export function computeOverflowEssences(
  lib: Lib,
  recipeId: string,
  loadedEssences: Essence,
): Essence {
  const recipe = lib.recipes.get(recipeId);
  const req = (recipe?.ingredients || {}) as Record<string, number>;
  const have = loadedEssences as Record<string, number>;
  const out: Essence = {};
  const keys = new Set<string>([...Object.keys(req), ...Object.keys(have)]);
  for (const k of keys) {
    const excess = Math.max(0, (have[k] || 0) - (req[k] || 0));
    if (excess > 0) (out as any)[k] = excess;
  }
  return out;
}
