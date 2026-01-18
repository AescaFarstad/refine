import type { GameState } from './GameState';
import type { DiscoveryId } from './DiscoveryLib';
import { DISCOVERY } from './DiscoveryLib';
import { scanWaferForNewSignatures } from './Signatures';

export function discover(gs: GameState, id: DiscoveryId): boolean {
  if (gs.discoveries[id]) return false;
  gs.discoveries[id] = true;
  gs.discoveryCounter++;

  if (id === DISCOVERY.SIGNATURES || id === DISCOVERY.CYAN_YIELD || id === DISCOVERY.UNIQUE_ITEMS_YIELD) {
    if (!hasDiscovered(gs, DISCOVERY.UI_REFINE_YIELD)) {
      gs.discoveries[DISCOVERY.UI_REFINE_YIELD] = true;
      gs.discoveryCounter++;
    }
  }

  if (id === DISCOVERY.CYAN_YIELD) {
    delete gs.seenEssences['cyan'];
  }

  if (id === DISCOVERY.MAZE_NAVIGATION) {
    delete gs.discoveries[DISCOVERY.TAB_MAZE_VISITED];
    gs.discoveryCounter = 0;
  }

  return true;
}

export function hasDiscovered(gs: GameState, id: DiscoveryId): boolean {
  return gs.discoveries[id] === true;
}

export function ensureShardDiscovery(gs: GameState): void {
  if (hasDiscovered(gs, DISCOVERY.UI_SHARDS)) return;

  if (gs.shardDust > 0 || gs.waferUpgradesPurchased > 0) {
    discover(gs, DISCOVERY.UI_SHARDS);
    return;
  }

  for (const shard of gs.shards) {
    if (shard && shard.resource === 'shards') {
      discover(gs, DISCOVERY.UI_SHARDS);
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

export function ensureSignatureDiscoveryFromWafer(gs: GameState): void {
  const completed = new Set(gs.completedSignatureIds);
  const signatureDefsForLevel = Array.from(gs.lib.signatures.values()).filter(s => s.level === gs.signatureLevel);
  const { newlyCompletedSignatureIds } = scanWaferForNewSignatures(gs.wafer, signatureDefsForLevel, completed);
  if (newlyCompletedSignatureIds.length === 0) return;

  const isFirstDiscovery = discover(gs, DISCOVERY.SIGNATURES);
  if (isFirstDiscovery && newlyCompletedSignatureIds.length > 0) {
    gs.signaturePlacementDiscoveryId = newlyCompletedSignatureIds[0];
  }

  for (const id of newlyCompletedSignatureIds) {
    if (gs.learnedSignatureIds.includes(id)) continue;
    gs.learnedSignatureIds.push(id);
  }
}
