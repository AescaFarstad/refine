import type { GameState } from './GameState';
import type { DiscoveryId } from './DiscoveryLib';
import { DISCOVERY } from './DiscoveryLib';

export function discover(gs: GameState, id: DiscoveryId): boolean {
  if (gs.discoveries[id]) return false;
  gs.discoveries[id] = true;
  gs.discoveryCounter++;

  if (id === DISCOVERY.SIGNATURES || id === DISCOVERY.CYAN_YIELD) {
    if (!hasDiscovered(gs, DISCOVERY.REFINE_YIELD)) {
      gs.discoveries[DISCOVERY.REFINE_YIELD] = true;
      gs.discoveryCounter++;
    }
  }

  if (id === DISCOVERY.CYAN_YIELD) {
    delete gs.seenEssences['cyan'];
  }

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

export function ensureResearchTabDiscovery(gs: GameState): void {
  if (hasDiscovered(gs, DISCOVERY.TAB_RESEARCH)) return;
  if (gs.chronotraces > 0) {
    discover(gs, DISCOVERY.TAB_RESEARCH);
  }
}

export function ensureMazeTabDiscovery(gs: GameState): void {
  if (hasDiscovered(gs, DISCOVERY.TAB_MAZE)) return;
  if (gs.timeFlux > 0) {
    discover(gs, DISCOVERY.TAB_MAZE);
  }
}

export function ensureRefineTabDiscovery(gs: GameState): void {
  if (hasDiscovered(gs, DISCOVERY.TAB_REFINE)) return;
  // Called externally when a raid completes successfully with looted items
}

export function discoverRefineTab(gs: GameState): void {
  discover(gs, DISCOVERY.TAB_REFINE);
}
