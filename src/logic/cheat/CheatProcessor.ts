import { type GameState, Raid } from '../GameState';
import type { CheatInput } from './CheatCommands';
import { CheatAddRaidItems, CheatUnlockAllGear, CheatAddResources, CheatUnlockAllRaids } from './CheatCommands';
import type { EncounterDef } from '../RaidLib';

type Handler = (gs: GameState, cheat: CheatInput) => void;
const handlersByName = new Map<string, Handler>();

handlersByName.set('CheatAddRaidItems', (gs, cheat) => {
  const c = cheat as CheatAddRaidItems;
  let raidId = c.id;
  let def = gs.lib.raids.get(raidId || '');
  if (!def) {
    const firstId = Array.from(gs.lib.raids.keys())[0];
    if (!firstId) return;
    raidId = firstId;
    def = gs.lib.raids.get(firstId)!;
  }
  const count = Math.max(0, c.count || 0);
  if (count <= 0) return;

  // Collect item ids from the raid definition (items + monster loot), fallback to a sample of all items
  const ids = new Set<string>();
  const raidItems = Array.isArray(def.items) ? def.items : [];
  for (const id of raidItems) {
    ids.add(id);
  }

  // Add any monster loot items referenced by this raid's encounters
  for (const step of def.encounters || []) {
    const enc = step.encounter as EncounterDef;
    if (enc.type === 'FightEncounter' || enc.type === 'MonsterLootEncounter') {
      const monsterId = (enc as any).monsterId as string;
      const monster = gs.lib.monsters.get(monsterId);
      if (monster && monster.lootItemId) {
        ids.add(monster.lootItemId);
      }
    }
  }

  // Fallback: if nothing was collected, take the first 24 item ids from the item library for quick testing
  if (ids.size === 0) {
    const all = Array.from(gs.lib.items.keys());
    for (let i = 0; i < Math.min(24, all.length); i++) ids.add(all[i]);
  }

  function addToInventory(id: string, qty: number): void {
    const essence = gs.lib.getItem(id).essence;
    for (const [k, v] of Object.entries(essence)) {
      if (!v) continue;
      gs.encounteredEssences[k] = true;
    }
    const inv = gs.items;
    const existing = inv.find(x => x.id === id);
    if (existing) existing.quantity += qty;
    else inv.push({ id, quantity: qty });
  }

  for (const id of ids) {
    addToInventory(id, count);
  }
});

handlersByName.set('CheatUnlockAllGear', (gs, cheat) => {
  const allGearIds = Array.from(gs.lib.gear.keys());
  gs.unlockedGear = allGearIds;
});

handlersByName.set('CheatAddResources', (gs, cheat) => {
  const c = cheat as CheatAddResources;
  gs.credits += c.credits;
  gs.chronotraces += c.chronotraces;
  gs.timeFlux += c.timeFlux;
  gs.shardDust += c.shardDust;
  gs.skillPoints += c.skillPoints;
});

handlersByName.set('CheatUnlockAllRaids', (gs, cheat) => {
  const allRaidIds = Array.from(gs.lib.raids.keys());
  gs.unlockedRaids = allRaidIds.map(id => new Raid(id));
});

export function processCheats(gs: GameState): void {
  // Process and clear queued cheats
  while (gs.cheats.length > 0) {
    const cheat = gs.cheats.shift()!;
    const handler = handlersByName.get(cheat.name);
    if (handler) {
      handler(gs, cheat);
    } else {
      // eslint-disable-next-line no-console
      console.warn(`[CheatProcessor] No handler for cheat: ${cheat.name}`);
    }
  }
}
