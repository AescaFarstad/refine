import type { GameState } from './GameState';
import type { ReadonlyGameState } from './UIState';

export function getItemImageKey(gs: GameState | ReadonlyGameState, itemId: string): string {
  return getItemImageKeyAtDelta(gs, itemId, 0);
}

export function getItemImageKeyAtDelta(gs: GameState | ReadonlyGameState, itemId: string, delta: number): string {
  const def = gs.lib.getItem(itemId);
  if (def.imageArray.length === 1) return def.imageArray[0]!;
  const count = def.imageArray.length;
  const current = gs.itemImageCycleIndexes[itemId] ?? 0;
  return def.imageArray[((current + delta) % count + count) % count]!;
}

export function cycleItemImage(gs: GameState, itemId: string, delta: number): void {
  const def = gs.lib.getItem(itemId);
  const count = def.imageArray.length;
  if (count === 1) return;

  const current = gs.itemImageCycleIndexes[itemId] ?? 0;
  gs.itemImageCycleIndexes[itemId] = ((current + delta) % count + count) % count;
}
