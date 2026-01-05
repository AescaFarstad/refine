import type { GameState } from './GameState';
import type { DiscoveryId } from './DiscoveryLib';
import { DISCOVERY } from './DiscoveryLib';

export function discover(gs: GameState, id: DiscoveryId): boolean {
  if (gs.discoveries[id]) return false;
  gs.discoveries[id] = true;
  gs.discoveryCounter++;
  return true;
}

export function hasDiscovered(gs: GameState, id: DiscoveryId): boolean {
  return gs.discoveries[id] === true;
}

export function ensureShardDiscovery(gs: GameState): void {
  if (hasDiscovered(gs, DISCOVERY.SHARDS)) return;

  if (gs.shardDust > 0 || gs.waferUpgradesPurchased > 0) {
    discover(gs, DISCOVERY.SHARDS);
    return;
  }

  for (const shard of gs.shards) {
    if (shard && shard.resource === 'shards') {
      discover(gs, DISCOVERY.SHARDS);
      return;
    }
  }
}
