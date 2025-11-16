import type { GameState } from '../GameState';
import type { Evt } from './Evt';
import { EvtRaidComplete, EvtRefineryDone } from './Evt';
// Stage 1: legacy raid handling removed. No computeRaidStats or loot logic.
import { computeRefinePreview } from '../Refine';
import { RefineryOutcome } from '../GameState';

type EvtHandler = (gs: GameState, evt: Evt) => void;
const handlersByName = new Map<string, EvtHandler>();

handlersByName.set('EvtRaidComplete', (gs, evt) => {
  // Stage 1: No-op outcome to clear active raid; no rewards, no progress.
  const raidId = gs.raid.id;
  const outcome = {
    id: raidId,
    questsDone: 0,
    success: false,
    questDeltaPct: 0,
    unlockedRaidId: null as string | null,
    looted: [] as { id: string; quantity: number }[],
    discardedByVolume: [] as { id: string; quantity: number }[],
    discardedByLuck: [] as { id: string; quantity: number }[],
  };

  gs.lastRaidOutcome = outcome;
  gs.raid.id = '';
});

handlersByName.set('EvtRefineryDone', (gs, evt) => {
  if (!gs.loadedRecipe) return;
  const recipeId = gs.loadedRecipe;
  const recipe = gs.lib.recipes.get(recipeId)!;
  const health = 100; // single refinery, full condition
  const preview = computeRefinePreview(gs.lib, recipeId, health, recipe.ingredients as Record<string, number>);
  const successChance = Math.max(0, 100 - (preview.failureChancePct || 0));
  const roll = gs.random.get() * 100;
  const success = roll <= successChance;

  const outcome = new RefineryOutcome();
  outcome.recipeId = recipeId;
  outcome.success = success;
  if (success) {
    gs.credits += preview.expectedCredits;
    gs.chronotraces += preview.expectedChrono;
    gs.timeFlux = Math.max(0, (gs.timeFlux || 0) + preview.expectedFlux);
    outcome.creditsGained = preview.expectedCredits;
    outcome.chronotracesGained = preview.expectedChrono;
    outcome.timeFluxGained = preview.expectedFlux;
  }

  gs.lastRefineryOutcome = outcome;

  gs.loadedRecipe = '';
  gs.recipeStartedAt = 0;
  gs.overflowEssences = {};
});

export function processEvt(gs: GameState, evt: Evt): void {
  const handler = handlersByName.get(evt.name);
  if (handler) {
    handler(gs, evt);
  }
  else {
    throw new Error(`No handler for event: ${evt.name}`);
  }
}


/* reference of looting probabilities

    let remainingVolume = gs.raid.volume;

    type Cat = 'common' | 'uncommon' | 'rare' | 'legendary';
    const poolSizes: Record<Cat, number> = {
      common: itemPools.common.length,
      uncommon: itemPools.uncommon.length,
      rare: itemPools.rare.length,
      legendary: itemPools.legendary.length,
    };
    const weights: Record<Cat, number> = {
      common: poolSizes.common > 0 ? 200 : 0,
      uncommon: poolSizes.uncommon > 0 ? 50 + effLooting / 2 : 0,
      rare: poolSizes.rare > 0 ? 20 + effLooting / 5 : 0,
      legendary: poolSizes.legendary > 0 ? effLooting / 10 : 0,
    };

    function sumEssenceValue(def: ItemDefinition): number {
      let s = 0;
      for (const k of Object.keys(def.essence)) {
        s += (def.essence as any)[k] || 0;
      }
      return s * 10;
    }

    function pickCategory(): Cat | null {
      const entries = ([
        ['common', weights.common],
        ['uncommon', weights.uncommon],
        ['rare', weights.rare],
        ['legendary', weights.legendary],
      ] as Array<[Cat, number]>).filter(([, w]) => w > 0);
      if (entries.length === 0) return null;
      const total = entries.reduce((a, [, w]) => a + w, 0);
      let r = gs.random.get() * total;
      for (const [c, w] of entries) {
        if (r < w) return c;
        r -= w;
      }
      return entries[entries.length - 1][0];
    }

    function pickFromPool(ids: string[]): string | null {
      const idx = Math.floor(gs.random.get() * ids.length);
      return ids[idx];
    }

    function pushItem(arr: { id: string; quantity: number }[], id: string, qty = 1): void {
      const existing = arr.find(x => x.id === id);
      if (existing) existing.quantity += qty;
      else arr.push({ id, quantity: qty });
    }
      */
