import { copy, type Point2 } from './core/math';
import type { GameState, MazeOracleState, MazeResourceSpawn } from './GameState';
import { createMazeTransient } from './GameState';
import type { ResearchLib } from './ResearchLib';
import { axialDistance } from './HexMath';
import { axialToIndex, calculateVisibility, indexToAxial, initResearchCells } from './Research';
import { bfsMazePath } from './MazeBFS';
import type { ReadonlyGameState } from './UIState';
import { createMazeVisionAux } from './createMazeVisionAux';
import { computeMazeVisibilityFromIndex, createMazeVisibilityRuntime } from './MazeVision';
import {
  FREE_MOVE_PANEL_ID,
  SHARDS_REFRESHER_PANEL_ID,
} from './NexusLib';
import {
  applyMazeAntiVoidBonuses,
  applyMazeNexusPanelPurchase,
  applyMazeDoublerBonusesToSpawns,
  applyMazeRefresherBonusOnStep,
  grantMazeIncrementalPickupBonus,
  getMazeNexusPlacementCountsByItem,
  getMazeNexusItemPlacementCells,
  getMazeNexusPlacementAnchorFromHoverCenter,
  getMazeNexusItemPlacementRotationStep,
  getMazeNexusResourcePanelSpawnAtCell,
  hasMazeNexusLimitRadiusConflict,
  isMazeShardRefresherStep,
  refundMazeNexusPanelPurchase,
  resolveMazeRefresherStep,
} from './MazeNexusBonuses';

export {
  getMazeNexusLimitBlockingDisks,
  getMazeNexusItemEffectiveRadius,
  getMazeNexusItemPlacementCells,
  getMazeNexusPlacementAnchorFromHoverCenter,
  getMazeNexusItemPlacementRotationStep,
  getMazeNexusLimitDisks,
  getMazeNexusPlacementAffectedSpawnIndexes,
  getMazeNexusPlacementCentroidUnit,
  getMazeNexusPlacementPreviewResourceSpawn,
} from './MazeNexusBonuses';

const MAZE_ENTRANCE_ARCHETYPE_ID = 'disc_maze_navigation';
const MAZE_NEXUS_ARCHETYPE_ID = 'disc_maze_nexus';
const MAZE_TRANSMUTATION_ROOM_ARCHETYPE_ID = 'transmutation_room';

export function isMazeEntranceCell(gs: ReadonlyGameState, cell: Point2): boolean {
  const idx = axialToIndex(cell.x, cell.y);
  if (idx === -1) return false;
  const researchCell = gs.researchCells[idx]!;
  if (!researchCell.owned) return false;
  if (researchCell.nodeId < 0) return false;
  const node = gs.lib.research.nodes.get(researchCell.nodeId)!;
  if (node.archetypeId !== MAZE_ENTRANCE_ARCHETYPE_ID) return false;
  const cc = node.centerCell ?? node.cells[0];
  return cc != null && cc.x === cell.x && cc.y === cell.y;
}

export function getOwnedMazeEntrances(gs: ReadonlyGameState): Array<Point2> {
  const entrances: Array<Point2> = [];
  for (const node of gs.lib.research.nodes.values()) {
    if (node.archetypeId !== MAZE_ENTRANCE_ARCHETYPE_ID) continue;
    const cc = node.centerCell ?? node.cells[0];
    if (!cc) continue;
    const idx = axialToIndex(cc.x, cc.y);
    if (gs.researchCells[idx]!.owned) {
      entrances.push(copy(cc));
    }
  }
  return entrances;
}

export function isMazeNexusCell(gs: ReadonlyGameState, cell: Point2): boolean {
  const idx = axialToIndex(cell.x, cell.y);
  if (idx === -1) return false;
  const researchCell = gs.researchCells[idx]!;
  if (!researchCell.owned) return false;
  if (researchCell.nodeId < 0) return false;
  const node = gs.lib.research.nodes.get(researchCell.nodeId)!;
  if (node.archetypeId !== MAZE_NEXUS_ARCHETYPE_ID) return false;
  const cc = node.centerCell ?? node.cells[0];
  return cc != null && cc.x === cell.x && cc.y === cell.y;
}

export function getOwnedMazeNexuses(gs: ReadonlyGameState): Array<Point2> {
  const nexuses: Array<Point2> = [];
  for (const node of gs.lib.research.nodes.values()) {
    if (node.archetypeId !== MAZE_NEXUS_ARCHETYPE_ID) continue;
    const cc = node.centerCell ?? node.cells[0];
    if (!cc) continue;
    const idx = axialToIndex(cc.x, cc.y);
    if (gs.researchCells[idx]!.owned) {
      nexuses.push(copy(cc));
    }
  }
  return nexuses;
}

export function isMazeTransmutationCell(gs: ReadonlyGameState, cell: Point2): boolean {
  const idx = axialToIndex(cell.x, cell.y);
  if (idx === -1) return false;
  const researchCell = gs.researchCells[idx]!;
  if (!researchCell.owned) return false;
  if (researchCell.nodeId < 0) return false;
  const node = gs.lib.research.nodes.get(researchCell.nodeId)!;
  if (node.archetypeId !== MAZE_TRANSMUTATION_ROOM_ARCHETYPE_ID) return false;
  const cc = node.centerCell ?? node.cells[0];
  return cc != null && cc.x === cell.x && cc.y === cell.y;
}

export function getOwnedMazeTransmutationRooms(gs: ReadonlyGameState): Array<Point2> {
  const rooms: Array<Point2> = [];
  for (const node of gs.lib.research.nodes.values()) {
    if (node.archetypeId !== MAZE_TRANSMUTATION_ROOM_ARCHETYPE_ID) continue;
    const cc = node.centerCell ?? node.cells[0];
    if (!cc) continue;
    const idx = axialToIndex(cc.x, cc.y);
    if (gs.researchCells[idx]!.owned) {
      rooms.push(copy(cc));
    }
  }
  return rooms;
}

export interface OwnedMazeOracle {
  nodeId: number;
  cells: Point2[];
}

export function getOwnedMazeOracles(gs: ReadonlyGameState): OwnedMazeOracle[] {
  const oracles: OwnedMazeOracle[] = [];
  for (const node of gs.lib.research.nodes.values()) {
    const firstCell = node.cells[0]!;
    const firstIdx = axialToIndex(firstCell.x, firstCell.y);
    if (firstIdx === -1) continue;
    if (gs.researchCells[firstIdx]!.oracleId === '') continue;

    let owned = false;
    for (const cell of node.cells) {
      const idx = axialToIndex(cell.x, cell.y);
      if (idx === -1) continue;
      if (gs.researchCells[idx]!.owned) {
        owned = true;
        break;
      }
    }
    if (!owned) continue;

    oracles.push({
      nodeId: node.nodeId,
      cells: node.cells.map(copy),
    });
  }
  return oracles;
}

export function isMazeOracleCell(gs: ReadonlyGameState, cell: Point2): boolean {
  const idx = axialToIndex(cell.x, cell.y);
  if (idx === -1) return false;
  const researchCell = gs.researchCells[idx]!;
  if (!researchCell.owned) return false;
  if (researchCell.nodeId < 0) return false;
  return researchCell.oracleId !== '';
}

export function getMazeOracleNodeIdAtCell(gs: ReadonlyGameState, cell: Point2): number {
  const idx = axialToIndex(cell.x, cell.y);
  if (idx === -1) return -1;
  const researchCell = gs.researchCells[idx]!;
  if (!researchCell.owned || researchCell.nodeId < 0) return -1;
  if (researchCell.oracleId === '') return -1;
  return researchCell.nodeId;
}

export function syncMazeOracleStates(gs: GameState): void {
  const next: Record<string, MazeOracleState> = {};
  for (const node of gs.lib.research.nodes.values()) {
    const firstCell = node.cells[0]!;
    const firstIdx = axialToIndex(firstCell.x, firstCell.y);
    if (firstIdx === -1) continue;
    if (gs.researchCells[firstIdx]!.oracleId === '') continue;
    const key = String(node.nodeId);
    next[key] = gs.mazeOracleStateByNodeId[key] ?? 'riddling';
  }
  gs.mazeOracleStateByNodeId = next;
}

export function getMazeOracleState(gs: ReadonlyGameState, nodeId: number): MazeOracleState {
  const state = gs.mazeOracleStateByNodeId[String(nodeId)];
  if (!state) {
    throw new Error(`Missing oracle state for node ${nodeId}`);
  }
  return state;
}

export function syncMazeResetEntranceCell(gs: GameState) {
  if (isMazeEntranceCell(gs, gs.mazeResetEntranceCell)) return;
  for (const node of gs.lib.research.nodes.values()) {
    if (node.archetypeId !== MAZE_ENTRANCE_ARCHETYPE_ID) continue;
    const cc = node.centerCell ?? node.cells[0];
    if (!cc) continue;
    const idx = axialToIndex(cc.x, cc.y);
    if (gs.researchCells[idx]!.owned) {
      gs.mazeResetEntranceCell = copy(cc);
      return;
    }
  }
}

function rebuildMazeVisibilityState(gs: GameState): void {
  const aux = createMazeVisionAux(gs, gs.maze.version);
  gs.mazeVisibility.aux = aux;
  gs.mazeVisibility.runtime = createMazeVisibilityRuntime(aux);
  gs.mazeVisibility.result = null;
  gs.mazeVisibility.boundaryLoops = null;
}

export function computeMazeCellDerivedData(gs: GameState): void {
  let hasFreeMovePanel = false;
  let hasShardsRefresherPanel = false;
  for (const cell of gs.researchCells) {
    cell.mazeMoveCostMult = 1;
    if (cell.nexusId === FREE_MOVE_PANEL_ID) {
      hasFreeMovePanel = true;
    }
    if (cell.nexusId === SHARDS_REFRESHER_PANEL_ID) {
      hasShardsRefresherPanel = true;
    }
  }
  gs.mazeHasShardsRefresherPanel = hasShardsRefresherPanel;

  if (!hasFreeMovePanel) return;

  const visionRuntime = gs.mazeVisibility.runtime!;

  for (let i = 0; i < gs.researchCells.length; i++) {
    const cell = gs.researchCells[i]!;
    if (!cell.owned || !cell.passable || cell.nexusId !== FREE_MOVE_PANEL_ID) continue;

    const visibility = computeMazeVisibilityFromIndex(visionRuntime, i);
    for (let j = 0; j < visibility.visibleHexes.count; j++) {
      const visibleIdx = visibility.visibleHexes.indices[j]!;
      gs.researchCells[visibleIdx]!.mazeMoveCostMult = 0;
    }
  }
}

export function computeMazeResourceSpawns(gs: GameState, lib: ResearchLib): void {
  syncMazeOracleStates(gs);
  if (applyMazeAntiVoidBonuses(gs)) {
    calculateVisibility(gs, lib);
  }

  rebuildMazeVisibilityState(gs);
  computeMazeCellDerivedData(gs);

  const spawns: MazeResourceSpawn[] = [];
  const origin: Point2 = { x: 0, y: 0 };

  for (const node of lib.nodes.values()) {
    const center = node.centerCell ?? node.cells[0];
    if (!center) continue;
    const idx = axialToIndex(center.x, center.y);
    if (idx === -1) continue;
    const cell = gs.researchCells[idx];
    if (!cell?.owned) continue;

    const archetype = lib.archetypes.get(node.archetypeId);
    if (!archetype) continue;

    let resourceKey: MazeResourceSpawn['resourceKey'] | null = null;

    if (archetype.spawnResource) {
      resourceKey = archetype.spawnResource;
    } else if (archetype.type === 'gear') {
      resourceKey = 'chronotraces';
    } else if (archetype.type === 'stat') {
      resourceKey = 'credits';
    } else if (archetype.type === 'resource') {
      const isShardResource = archetype.rewards.some(
        r => r.kind === 'resource' && r.resource === 'shardDust'
      );
      resourceKey = isShardResource ? 'shardDust' : 'credits';
    }

    if (!resourceKey) continue;

    const amount = (resourceKey === 'zone_crystal' || resourceKey === 'fractal' || resourceKey === 'spice')
      ? 1
      : Math.max(1, axialDistance(center, origin));

    spawns.push({ cell: { x: center.x, y: center.y }, resourceKey, amount });
  }

  for (let i = 0; i < gs.researchCells.length; i++) {
    const cell = gs.researchCells[i]!;
    if (!cell.owned) continue;

    const center = indexToAxial(i);
    const resourceSpawn = getMazeNexusResourcePanelSpawnAtCell(cell.nexusId, center);
    if (!resourceSpawn) continue;
    spawns.push(resourceSpawn);
  }

  applyMazeDoublerBonusesToSpawns(gs, spawns);
  gs.mazeResourceSpawns = spawns;
}

export function resetMazeTransient(gs: GameState): void {
  syncMazeResetEntranceCell(gs);
  const m = createMazeTransient(gs.mazeResetEntranceCell);
  m.version = gs.maze.version + 1;
  gs.maze = m;
}

function rollbackMazeNexusItemPurchase(def: { price: number; priceIncrease: number[] }): number {
  const rolledPriceIncrease = def.priceIncrease.slice();
  for (let i = rolledPriceIncrease.length - 2; i >= 0; i--) {
    rolledPriceIncrease[i]! -= rolledPriceIncrease[i + 1]!;
  }

  const paidPrice = def.price - (rolledPriceIncrease[0] ?? 0);
  def.price = paidPrice;
  def.priceIncrease = rolledPriceIncrease;
  return paidPrice;
}

function rollbackMazeNexusPlacementRotationStep(gs: GameState, itemId: string, count: number): void {
  const def = gs.lib.nexusItems.get(itemId)!;
  if (!def.placableInstanceDescription.rotating) return;

  const currentStep = gs.mazeNexusPlacementRotationSteps[itemId] ?? 0;
  const stepDelta = count % 6;
  const rolledStep = ((currentStep - stepDelta) % 6 + 6) % 6;
  gs.mazeNexusPlacementRotationSteps[itemId] = rolledStep;
}

function resetMazeResearchCellsAfterNexusRefund(gs: GameState): void {
  const ownedIndexes: number[] = [];
  for (let i = 0; i < gs.researchCells.length; i++) {
    if (gs.researchCells[i]!.owned) {
      ownedIndexes.push(i);
    }
  }

  initResearchCells(gs, gs.lib.research);
  for (const cell of gs.researchCells) {
    if (!cell.blocked) {
      cell.owned = false;
    }
  }

  for (const idx of ownedIndexes) {
    const cell = gs.researchCells[idx]!;
    if (!cell.blocked) {
      cell.owned = true;
    }
  }

  let ownedPaidCount = 0;
  for (const cell of gs.researchCells) {
    if (cell.owned && cell.cost > 0) {
      ownedPaidCount++;
    }
  }
  gs.researchOwnedCount = ownedPaidCount;

  calculateVisibility(gs, gs.lib.research);
  syncMazeResetEntranceCell(gs);
}

export function refundAllPlacedMazeNexusItems(gs: GameState): number {
  const placementCountsByItem = getMazeNexusPlacementCountsByItem(gs);
  let refundedTimeFlux = 0;

  for (const [itemId, placementCount] of placementCountsByItem.entries()) {
    const def = gs.lib.nexusItems.get(itemId)!;
    for (let i = 0; i < placementCount; i++) {
      refundedTimeFlux += rollbackMazeNexusItemPurchase(def);
    }
    rollbackMazeNexusPlacementRotationStep(gs, itemId, placementCount);
    refundMazeNexusPanelPurchase(gs, itemId, placementCount);
  }

  gs.timeFlux += refundedTimeFlux;
  gs.mazeNextNexusPlacementId = 1;
  resetMazeResearchCellsAfterNexusRefund(gs);
  computeMazeResourceSpawns(gs, gs.lib.research);

  return refundedTimeFlux;
}

function getMazeNexusPlacementCellFailureReason(gs: ReadonlyGameState, cell: Point2): string {
  const idx = axialToIndex(cell.x, cell.y);
  if (idx === -1) return 'out_of_bounds';
  const researchCell = gs.researchCells[idx]!;
  if (!researchCell.owned) return 'cell_not_owned';
  if (researchCell.nexusId) return 'cell_has_nexus_item';

  const hasResourceSpawn = gs.mazeResourceSpawns.some(
    spawn => spawn.cell.x === cell.x && spawn.cell.y === cell.y,
  );
  if (hasResourceSpawn) return 'cell_has_resource_spawn';

  if (isMazeEntranceCell(gs, cell)) return 'cell_is_maze_entrance';
  if (isMazeNexusCell(gs, cell)) return 'cell_is_maze_nexus_access';
  if (isMazeOracleCell(gs, cell)) return 'cell_has_oracle';
  if (isMazeTransmutationCell(gs, cell)) return 'cell_has_transmutation_room';

  return '';
}

function hasPlacedMazeNexusItem(gs: ReadonlyGameState, itemId: string): boolean {
  for (const researchCell of gs.researchCells) {
    if (researchCell.nexusId === itemId) return true;
  }
  return false;
}

export function getMazeNexusPlacementFailureReason(gs: ReadonlyGameState, itemId: string, center: Point2): string {
  const def = gs.lib.nexusItems.get(itemId)!;
  if (def.placedOnce && hasPlacedMazeNexusItem(gs, itemId)) return 'already_placed_once';

  const cells = getMazeNexusItemPlacementCells(gs, itemId, center);
  for (const cell of cells) {
    const reason = getMazeNexusPlacementCellFailureReason(gs, cell);
    if (reason) return `${reason}@${cell.x},${cell.y}`;
  }
  if (hasMazeNexusLimitRadiusConflict(gs, itemId, center)) return 'limit_radius_overlap';
  return '';
}

export function canPlaceMazeNexusItem(gs: ReadonlyGameState, itemId: string, center: Point2): boolean {
  return getMazeNexusPlacementFailureReason(gs, itemId, center) === '';
}

export function applyMazeNexusPlacementAtCell(gs: GameState, itemId: string, placementId: number, cell: Point2): void {
  const idx = axialToIndex(cell.x, cell.y);
  const researchCell = gs.researchCells[idx]!;
  const def = gs.lib.nexusItems.get(itemId)!;
  researchCell.nexusId = itemId;
  researchCell.nexusPlacementId = placementId;
  researchCell.passable = def.placableInstanceDescription.passable;
}

export function placeMazeNexusItem(gs: GameState, itemId: string, center: Point2): boolean {
  if (!gs.mazeNexusAvailableUpgradeIds.includes(itemId)) {
    return false;
  }

  const def = gs.lib.nexusItems.get(itemId)!;
  if (!def.placable) {
    return false;
  }

  if (!isMazeNexusCell(gs, gs.maze.avatarCell)) {
    return false;
  }

  const placementFailure = getMazeNexusPlacementFailureReason(gs, itemId, center);
  if (placementFailure) {
    return false;
  }

  if (gs.timeFlux < def.price) {
    return false;
  }

  gs.timeFlux -= def.price;

  const cells = getMazeNexusItemPlacementCells(gs, itemId, center);
  const placementId = gs.mazeNextNexusPlacementId++;
  for (const cell of cells) {
    applyMazeNexusPlacementAtCell(gs, itemId, placementId, cell);
  }
  applyMazeNexusPanelPurchase(gs, itemId);
  if (def.placableInstanceDescription.rotating) {
    const currentStep = gs.mazeNexusPlacementRotationSteps[itemId] ?? 0;
    gs.mazeNexusPlacementRotationSteps[itemId] = (currentStep + 1) % 6;
  }

  def.price += def.priceIncrease[0] ?? 0;
  for (let i = 0; i < def.priceIncrease.length - 1; i++) {
    def.priceIncrease[i]! += def.priceIncrease[i + 1]!;
  }

  computeMazeResourceSpawns(gs, gs.lib.research);
  return true;
}


function isCellTaken(gs: GameState, cell: Point2): boolean {
  return gs.maze.takenCells.some(t => t.x === cell.x && t.y === cell.y);
}

function collectResourceAtCell(gs: GameState, cell: Point2): void {
  if (isCellTaken(gs, cell)) return;

  const spawn = gs.mazeResourceSpawns.find(s => s.cell.x === cell.x && s.cell.y === cell.y);
  if (spawn) {
    gs.maze.takenCells.push({ x: cell.x, y: cell.y });

    switch (spawn.resourceKey) {
      case 'credits':
        gs.maze.collectedCredits += spawn.amount;
        break;
      case 'chronotraces':
        gs.maze.collectedChronotraces += spawn.amount;
        break;
      case 'shardDust':
        gs.maze.collectedShardDust += spawn.amount;
        break;
      case 'zone_crystal':
        gs.maze.collectedZoneCrystal += spawn.amount;
        break;
      case 'fractal':
        gs.maze.collectedFractal += spawn.amount;
        break;
      case 'spice':
        gs.maze.collectedSpice += spawn.amount;
        break;
    }

    grantMazeIncrementalPickupBonus(gs, spawn.resourceKey);
    if (isMazeShardRefresherStep(gs, cell)) {
      applyMazeRefresherBonusOnStep(gs, cell);
    }
    return;
  }

  // Nexus items: mark as taken when walked over (only button cells)
  const idx = axialToIndex(cell.x, cell.y);
  const nexusId = idx !== -1 ? gs.researchCells[idx]!.nexusId : '';
  if (nexusId) {
    const def = gs.lib.nexusItems.get(nexusId);
    if (def && def.placableInstanceDescription.button) {
      applyMazeRefresherBonusOnStep(gs, cell);
      gs.maze.takenCells.push({ x: cell.x, y: cell.y });
    }
  }
}

function applyMazePayout(gs: GameState): void {
  const m = gs.maze;
  // Calculate excess above previous highest
  const payoutCredits = Math.max(0, m.collectedCredits - gs.mazeHighCredits);
  const payoutChronotraces = Math.max(0, m.collectedChronotraces - gs.mazeHighChronotraces);
  const payoutShardDust = Math.max(0, m.collectedShardDust - gs.mazeHighShardDust);
  const payoutZoneCrystal = Math.max(0, m.collectedZoneCrystal - gs.mazeHighZoneCrystal);
  const payoutFractal = Math.max(0, m.collectedFractal - gs.mazeHighFractal);
  const payoutSpice = Math.max(0, m.collectedSpice - gs.mazeHighSpice);

  // Update persistent highs
  gs.mazeHighCredits = Math.max(gs.mazeHighCredits, m.collectedCredits);
  gs.mazeHighChronotraces = Math.max(gs.mazeHighChronotraces, m.collectedChronotraces);
  gs.mazeHighShardDust = Math.max(gs.mazeHighShardDust, m.collectedShardDust);
  gs.mazeHighZoneCrystal = Math.max(gs.mazeHighZoneCrystal, m.collectedZoneCrystal);
  gs.mazeHighFractal = Math.max(gs.mazeHighFractal, m.collectedFractal);
  gs.mazeHighSpice = Math.max(gs.mazeHighSpice, m.collectedSpice);

  // Apply payouts to actual resources
  gs.credits += payoutCredits;
  gs.chronotraces += payoutChronotraces;
  gs.shardDust += payoutShardDust;
  if (payoutZoneCrystal > 0) {
    gs.countableGear.zone_crystal = (gs.countableGear.zone_crystal || 0) + payoutZoneCrystal;
    if (!gs.unlockedGear.includes('zone_crystal')) {
      gs.unlockedGear.push('zone_crystal');
    }
  }
  if (payoutFractal > 0) {
    gs.countableGear.fractal = (gs.countableGear.fractal || 0) + payoutFractal;
    if (!gs.unlockedGear.includes('fractal')) {
      gs.unlockedGear.push('fractal');
    }
  }
  if (payoutSpice > 0) {
    gs.countableGear.spice = (gs.countableGear.spice || 0) + payoutSpice;
    if (!gs.unlockedGear.includes('spice')) {
      gs.unlockedGear.push('spice');
    }
  }
}

export interface MazeMoveResult {
  success: boolean;
  path: Point2[];
  forcedReset: boolean;
  payout: boolean;
  nexusReached: boolean;
  transmutationReached: boolean;
  oracleReached: boolean;
  oracleNodeId: number;
}

export interface MazeEnterProjection {
  avatarCell: Point2;
  movementUsed: number;
  takenCells: Point2[];
  resetEntranceCell: Point2;
}

export interface MazePlannedMoveSegment {
  path: Point2[];
  target: Point2;
}

export type MazeMoveSegmentPlan = MazePlannedMoveSegment[];

export interface MazeEnterProjectionResult {
  success: boolean;
  forcedReset: boolean;
  payout: boolean;
  nexusReached: boolean;
}

function sameCell(a: Point2, b: Point2): boolean {
  return a.x === b.x && a.y === b.y;
}

function isProjectionCellTaken(projection: MazeEnterProjection, cell: Point2): boolean {
  for (const taken of projection.takenCells) {
    if (sameCell(taken, cell)) return true;
  }
  return false;
}

function removeProjectionTakenCell(projection: MazeEnterProjection, cell: Point2): void {
  for (let i = projection.takenCells.length - 1; i >= 0; i--) {
    if (sameCell(projection.takenCells[i]!, cell)) {
      projection.takenCells.splice(i, 1);
    }
  }
}

function collectProjectionResourceAtCell(gs: ReadonlyGameState, projection: MazeEnterProjection, cell: Point2): void {
  if (isProjectionCellTaken(projection, cell)) return;

  const spawn = gs.mazeResourceSpawns.find(s => s.cell.x === cell.x && s.cell.y === cell.y);
  if (spawn) {
    projection.takenCells.push(copy(cell));
    if (isMazeShardRefresherStep(gs, cell)) {
      const refreshed = resolveMazeRefresherStep(gs, cell, projection.takenCells);
      for (const refresh of refreshed) {
        removeProjectionTakenCell(projection, refresh.spawnCell);
      }
    }
    return;
  }

  const idx = axialToIndex(cell.x, cell.y);
  const nexusId = idx !== -1 ? gs.researchCells[idx]!.nexusId : '';
  if (nexusId) {
    const def = gs.lib.nexusItems.get(nexusId);
    if (def && def.placableInstanceDescription.button) {
      const refreshed = resolveMazeRefresherStep(gs, cell, projection.takenCells);
      for (const refresh of refreshed) {
        removeProjectionTakenCell(projection, refresh.spawnCell);
      }
      projection.takenCells.push(copy(cell));
    }
  }
}

function resetProjectionTransient(projection: MazeEnterProjection): void {
  projection.avatarCell = copy(projection.resetEntranceCell);
  projection.movementUsed = 0;
  projection.takenCells = [];
}

function cloneMazeEnterProjection(projection: MazeEnterProjection): MazeEnterProjection {
  return {
    avatarCell: copy(projection.avatarCell),
    movementUsed: projection.movementUsed,
    takenCells: projection.takenCells.map(copy),
    resetEntranceCell: copy(projection.resetEntranceCell),
  };
}

export function createMazeEnterProjection(gs: ReadonlyGameState): MazeEnterProjection {
  return {
    avatarCell: copy(gs.maze.avatarCell),
    movementUsed: gs.maze.movementUsed,
    takenCells: gs.maze.takenCells.map(copy),
    resetEntranceCell: copy(gs.mazeResetEntranceCell),
  };
}

export function projectMazeEnterCell(
  gs: ReadonlyGameState,
  projection: MazeEnterProjection,
  target: Point2,
): MazeEnterProjectionResult {
  const result = bfsMazePath(gs, projection.avatarCell, target);
  if (!result.reachable) {
    return { success: false, forcedReset: false, payout: false, nexusReached: false };
  }

  if (result.path.length === 0) {
    return { success: true, forcedReset: false, payout: false, nexusReached: false };
  }

  if (result.path.length !== 1) {
    return { success: false, forcedReset: false, payout: false, nexusReached: false };
  }

  const stepCost = result.cost;
  if (stepCost > 0) {
    const remainingPool = gs.timeFlux - projection.movementUsed;
    if (remainingPool < stepCost) {
      resetProjectionTransient(projection);
      return { success: true, forcedReset: true, payout: false, nexusReached: false };
    }
  }

  projection.movementUsed += stepCost;
  collectProjectionResourceAtCell(gs, projection, target);
  projection.avatarCell = copy(target);

  return { success: true, forcedReset: false, payout: false, nexusReached: isMazeNexusCell(gs, target) };
}

function finalizeProjectedMove(gs: ReadonlyGameState, projection: MazeEnterProjection, target: Point2): void {
  if (!isMazeEntranceCell(gs, target)) return;
  projection.resetEntranceCell = copy(target);
  resetProjectionTransient(projection);
}

export function applyPlannedMazeMoveSegment(
  gs: ReadonlyGameState,
  projection: MazeEnterProjection,
  segment: MazePlannedMoveSegment,
): void {
  const { path, target } = segment;
  if (path.length === 0) {
    const stepResult = projectMazeEnterCell(gs, projection, target);
    if (!stepResult.success || !stepResult.forcedReset) {
      throw new Error('applyPlannedMazeMoveSegment: empty segment did not force reset');
    }
    return;
  }

  const finalPathCell = path[path.length - 1]!;
  if (!sameCell(finalPathCell, target)) throw new Error('applyPlannedMazeMoveSegment: path target mismatch');

  for (const stepCell of path) {
    const stepResult = projectMazeEnterCell(gs, projection, stepCell);
    if (!stepResult.success) throw new Error('applyPlannedMazeMoveSegment: failed to project step');
    if (stepResult.forcedReset) {
      throw new Error('applyPlannedMazeMoveSegment: non-empty segment forced reset');
    }
  }

  finalizeProjectedMove(gs, projection, target);
}

function isMazeBonusCell(gs: ReadonlyGameState, projection: MazeEnterProjection, cell: Point2): boolean {
  if (isProjectionCellTaken(projection, cell)) return false;
  const idx = axialToIndex(cell.x, cell.y);
  if (idx === -1) return false;
  const nexusId = gs.researchCells[idx]!.nexusId;
  if (!nexusId) return false;
  const def = gs.lib.nexusItems.get(nexusId);
  return !!def && def.placableInstanceDescription.button;
}

function isFreshResourceCell(gs: ReadonlyGameState, projection: MazeEnterProjection, cell: Point2): boolean {
  if (isProjectionCellTaken(projection, cell)) return false;
  return gs.mazeResourceSpawns.some(spawn => spawn.cell.x === cell.x && spawn.cell.y === cell.y);
}

export function planMazeMoveSegments(
  gs: ReadonlyGameState,
  projectionStart: MazeEnterProjection,
  target: Point2,
): MazeMoveSegmentPlan {
  const plan: MazeMoveSegmentPlan = [];
  const projection = cloneMazeEnterProjection(projectionStart);
  const result = bfsMazePath(gs, projection.avatarCell, target);
  if (!result.reachable || result.path.length === 0) return plan;

  let currentPath: Point2[] = [];
  for (let i = 0; i < result.path.length; i++) {
    const stepCell = copy(result.path[i]!);
    const stopOnResource = isFreshResourceCell(gs, projection, stepCell);
    const stopOnBonus = isMazeBonusCell(gs, projection, stepCell);
    const stepResult = projectMazeEnterCell(gs, projection, stepCell);
    if (!stepResult.success) {
      throw new Error('planMazeMoveSegments: failed to project planned step');
    }

    if (stepResult.forcedReset) {
      if (currentPath.length > 0) {
        const previousTarget = copy(currentPath[currentPath.length - 1]!);
        plan.push({
          path: currentPath.map(copy),
          target: previousTarget,
        });
        currentPath = [];
      }
      plan.push({
        path: [],
        target: copy(stepCell),
      });
      break;
    }

    currentPath.push(stepCell);
    const isLast = i === result.path.length - 1;
    if (!stopOnResource && !stopOnBonus && !stepResult.payout && !isLast) continue;

    plan.push({
      path: currentPath.map(copy),
      target: copy(currentPath[currentPath.length - 1]!),
    });
    currentPath = [];
  }

  return plan;
}

export function handleMazeMoveTo(gs: GameState, target: Point2): MazeMoveResult {
  syncMazeResetEntranceCell(gs);
  const result = bfsMazePath(gs, gs.maze.avatarCell, target);

  if (!result.reachable) {
    return {
      success: false,
      path: [],
      forcedReset: false,
      payout: false,
      nexusReached: false,
      transmutationReached: false,
      oracleReached: false,
      oracleNodeId: -1,
    };
  }

  if (result.path.length === 0) {
    return {
      success: true,
      path: [],
      forcedReset: false,
      payout: false,
      nexusReached: false,
      transmutationReached: false,
      oracleReached: false,
      oracleNodeId: -1,
    };
  }

  const remainingPool = gs.timeFlux - gs.maze.movementUsed;

  if (result.cost > remainingPool) {
    resetMazeTransient(gs);
    return {
      success: true,
      path: result.path,
      forcedReset: true,
      payout: false,
      nexusReached: false,
      transmutationReached: false,
      oracleReached: false,
      oracleNodeId: -1,
    };
  }

  gs.maze.movementUsed += result.cost;

  for (const cell of result.path) {
    collectResourceAtCell(gs, cell);
  }

  gs.maze.avatarCell = { x: target.x, y: target.y };

  const isEntrance = isMazeEntranceCell(gs, target);
  if (isEntrance) {
    gs.mazeResetEntranceCell = copy(target);
    gs.mazeHighMovementUsed = Math.max(gs.mazeHighMovementUsed, gs.maze.movementUsed);
    applyMazePayout(gs);
    resetMazeTransient(gs);
    return {
      success: true,
      path: result.path,
      forcedReset: false,
      payout: true,
      nexusReached: false,
      transmutationReached: false,
      oracleReached: false,
      oracleNodeId: -1,
    };
  }

  const isNexus = isMazeNexusCell(gs, target);
  const isTransmutation = isMazeTransmutationCell(gs, target);
  const oracleNodeId = getMazeOracleNodeIdAtCell(gs, target);
  const oracleReached = oracleNodeId >= 0;
  return {
    success: true,
    path: result.path,
    forcedReset: false,
    payout: false,
    nexusReached: isNexus,
    transmutationReached: isTransmutation,
    oracleReached,
    oracleNodeId,
  };
}
