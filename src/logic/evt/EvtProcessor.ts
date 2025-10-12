import type { GameState } from '../GameState';
import { QUEST_POINTS, Raid } from '../GameState';
import type { Evt } from './Evt';
import { EvtRaidComplete } from './Evt';
import { computeRaidStats } from '../Raid';
import type { ItemDefinition } from '../ItemLib';

type EvtHandler = (gs: GameState, evt: Evt) => void;
const handlersByName = new Map<string, EvtHandler>();

handlersByName.set('EvtRaidComplete', (gs, evt) => {
  const e = evt as EvtRaidComplete;

  const raidId = gs.raid.id;
  const def = gs.lib.raids.get(raidId)!;

  const stats = computeRaidStats(
    gs,
    def,
    gs.raid.questWeight,
    gs.raid.surviveWeight,
    gs.raid.lootWeight,
    gs.raid.equipment,
  );

  const roll = gs.random.get() * 100;
  const success = roll <= stats.survivalChancePct;

  const outcome = {
    id: raidId,
    questsDone: 0,
    success,
    questDeltaPct: success ? (stats.questDeltaPct || 0) : 0,
    unlockedRaidId: null as string | null,
    looted: [] as { id: string; quantity: number }[],
    discardedByVolume: [] as { id: string; quantity: number }[],
    discardedByLuck: [] as { id: string; quantity: number }[],
  };

  if (success) {
    const raidState = gs.unlockedRaids.find(r => r.id === raidId);
    if (raidState) {
      const gainPoints = Math.max(0, Math.round((stats.questDeltaPct || 0) * QUEST_POINTS / 100));
      let progress = Math.max(0, raidState.questProgress) + gainPoints;
      let done = Math.max(0, raidState.questsDone);
      const doneBefore = done;

      let levelupsGained = 0;
      while (true) {
        const target = Math.round(QUEST_POINTS * Math.pow(2, done));
        if (progress < target) break;
        progress -= target;
        done += 1;
        levelupsGained += 1;
      }

      raidState.questProgress = progress;
      raidState.questsDone = done;

      if (levelupsGained > 0) {
        gs.levelupsAvailable += levelupsGained;
      }

      outcome.questsDone = done;

      // If this raid was completed for the first time (0 -> 1), unlock the next raid
      if (doneBefore === 0 && done >= 1) {
        const ids = Array.from(gs.lib.raids.keys());
        const idx = ids.indexOf(raidId);
        const nextId = (idx >= 0 && idx + 1 < ids.length) ? ids[idx + 1] : null;
        if (nextId) {
          const alreadyUnlocked = gs.unlockedRaids.some(r => r.id === nextId);
          if (!alreadyUnlocked) {
            gs.unlockedRaids.push(new Raid(nextId));
            outcome.unlockedRaidId = nextId;
          }
        }
      }
    }

    const raidDef = def;
    const itemPools = raidDef.items;
    const durationMin = raidDef.durationMin;
    const lootRate = stats.lootRatePct;
    const totalItemValueBudget = lootRate * durationMin;

    // Effective looting skill
    const baseLooting = gs.raid.looting;
    const lootingDifficulty = raidDef.itemDropDifficulty;
    const effLooting = Math.max(10, baseLooting - lootingDifficulty);

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
      const entries: Array<[Cat, number]> = [
        ['common', weights.common],
        ['uncommon', weights.uncommon],
        ['rare', weights.rare],
        ['legendary', weights.legendary],
      ].filter(([, w]) => w > 0);
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

    function addToInventory(id: string, qty: number): void {
      const inv = gs.items;
      const existing = inv.find(x => x.id === id);
      if (existing) existing.quantity += qty;
      else inv.push({ id, quantity: qty });
    }

    // Direct lookup of item defs
    const getItemDef = (id: string): ItemDefinition => gs.lib.items.get(id)!;

    let collectedValue = 0;
    while (collectedValue < totalItemValueBudget) {
      const cat = pickCategory();
      if (!cat) break;
      const pool = itemPools[cat];
      const id = pickFromPool(pool)!;
      const defItem = getItemDef(id);
      const itemVal = sumEssenceValue(defItem);
      collectedValue += itemVal;

      // Loot roll vs effective looting
      const roll = gs.random.get() * 100;
      if (roll < effLooting) {
        // Check bag volume
        const vol = defItem.volume;
        if (vol <= remainingVolume) {
          remainingVolume -= vol;
          pushItem(outcome.looted, id, 1);
          addToInventory(id, 1);
        } else {
          pushItem(outcome.discardedByVolume, id, 1);
        }
      } else {
        pushItem(outcome.discardedByLuck, id, 1);
      }
    }
  }

  gs.lastRaidOutcome = outcome;

  gs.raid.id = '';
  gs.raid.progress = 0;
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
