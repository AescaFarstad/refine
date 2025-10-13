import type { GameState } from '../GameState';
import type { CheatInput } from './CheatCommands';
import { CheatAddRaidItems } from './CheatCommands';

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

  const ids = new Set<string>();
  const items = def.items;
  items.common.forEach(id => ids.add(id));
  items.uncommon.forEach(id => ids.add(id));
  items.rare.forEach(id => ids.add(id));
  items.legendary.forEach(id => ids.add(id));

  function addToInventory(id: string, qty: number): void {
    const inv = gs.items;
    const existing = inv.find(x => x.id === id);
    if (existing) existing.quantity += qty;
    else inv.push({ id, quantity: qty });
  }

  for (const id of ids) {
    addToInventory(id, count);
  }
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

