import type { GameState } from './GameState';
import type { ReadonlyGameState } from './UIState';
import SeededRandom from './core/SeededRandom';
import { advanceSeed } from './core/mathUtils';

const MAZE_NEXUS_UPGRADE_CHOICE_COUNT = 3;
export const MAZE_NEXUS_NO_UPGRADE_OFFER_SEED = -1;

function hasPlacedMazeNexusItem(gs: ReadonlyGameState, itemId: string): boolean {
  for (const researchCell of gs.researchCells) {
    if (researchCell.nexusId === itemId) return true;
  }
  return false;
}

function canOfferMazeNexusUpgrade(gs: ReadonlyGameState, itemId: string): boolean {
  if (gs.mazeNexusAvailableUpgradeIds.includes(itemId)) return false;
  const def = gs.lib.nexusItems.get(itemId)!;
  if (gs.mazeNexusAvailableUpgradeIds.length < def.minAcquiredUpgradesForOffer) return false;
  if (!def.placedOnce) return true;
  return !hasPlacedMazeNexusItem(gs, itemId);
}

export function getMazeNexusUpgradeOfferPool(gs: ReadonlyGameState): string[] {
  return Array.from(gs.lib.nexusItems.keys()).filter(itemId => canOfferMazeNexusUpgrade(gs, itemId));
}

export function getMazeNexusUpgradeChoicesFromSeed(gs: ReadonlyGameState, seed: number): string[] {
  const pool = getMazeNexusUpgradeOfferPool(gs);
  const random = new SeededRandom(seed);
  random.shuffleInPlace(pool);
  return pool.slice(0, MAZE_NEXUS_UPGRADE_CHOICE_COUNT);
}

export function clearMazeNexusUpgradeOffer(gs: GameState): void {
  gs.mazeNexusUpgradeOfferSeed = MAZE_NEXUS_NO_UPGRADE_OFFER_SEED;
}

export function ensureMazeNexusUpgradeOfferSeed(gs: GameState): number {
  if (gs.mazeNexusUpgradeOfferSeed !== MAZE_NEXUS_NO_UPGRADE_OFFER_SEED) {
    return gs.mazeNexusUpgradeOfferSeed;
  }
  const seed = gs.mazeNexusUpgradeSeedCursor >>> 0;
  gs.mazeNexusUpgradeSeedCursor = advanceSeed(gs.mazeNexusUpgradeSeedCursor);
  gs.mazeNexusUpgradeOfferSeed = seed;
  return seed;
}

export function canChooseMazeNexusUpgrade(gs: ReadonlyGameState): boolean {
  if (gs.mazeNexusUpgradeOpportunityCount <= 0) return false;
  return getMazeNexusUpgradeOfferPool(gs).length > 0;
}

export function prepareMazeNexusUpgradeOffer(gs: GameState): boolean {
  if (!canChooseMazeNexusUpgrade(gs)) return false;
  ensureMazeNexusUpgradeOfferSeed(gs);
  return true;
}

export function selectMazeNexusUpgrade(gs: GameState, nexusItemId: string): boolean {
  if (!canChooseMazeNexusUpgrade(gs)) return false;

  const offerSeed = ensureMazeNexusUpgradeOfferSeed(gs);
  const offered = getMazeNexusUpgradeChoicesFromSeed(gs, offerSeed);
  if (!offered.includes(nexusItemId)) {
    throw new Error(`selectMazeNexusUpgrade: selected id "${nexusItemId}" is not in offered choices`);
  }

  gs.mazeNexusAvailableUpgradeIds.push(nexusItemId);
  gs.mazeNexusUpgradeOpportunityCount--;
  clearMazeNexusUpgradeOffer(gs);
  return true;
}

export function onMazeNexusUpgradePlaced(gs: GameState, nexusItemId: string): boolean {
  if (gs.mazeNexusPlacedUpgradeIds.includes(nexusItemId)) return false;
  gs.mazeNexusPlacedUpgradeIds.push(nexusItemId);
  gs.mazeNexusUpgradeOpportunityCount++;
  return true;
}

export function willPlacementGrantMazeNexusUpgradeOpportunity(gs: ReadonlyGameState, nexusItemId: string): boolean {
  if (gs.mazeNexusPlacedUpgradeIds.includes(nexusItemId)) return false;
  return getMazeNexusUpgradeOfferPool(gs).length > 0;
}

export function grantMazeNexusUpgradeOpportunities(gs: GameState, amount: number): void {
  gs.mazeNexusUpgradeOpportunityCount += amount;
}
