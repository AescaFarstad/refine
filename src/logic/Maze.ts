import { copy, type Point2 } from './core/math';
import type { GameState, MazeResourceSpawn } from './GameState';
import { createMazeTransient } from './GameState';
import type { ResearchLib } from './ResearchLib';
import { axialDistance } from './HexMath';
import { axialToIndex } from './Research';
import { bfsMazePath } from './BFS';
import type { ReadonlyGameState } from './UIState';
import {
  applyMazeDoublerBonusesToSpawns,
  applyMazeRefresherBonusOnStep,
  getMazeNexusItemPlacementCells,
  hasMazeNexusLimitRadiusConflict,
  resolveMazeRefresherStep,
} from './MazeNexusBonuses';

export {
  getMazeNexusLimitBlockingDisks,
  getMazeNexusItemPlacementCells,
  getMazeNexusLimitDisks,
  getMazeNexusPlacementAffectedSpawnIndexes,
  getMazeNexusPlacementCentroidUnit,
} from './MazeNexusBonuses';

const MAZE_ENTRANCE_ARCHETYPE_ID = 'disc_maze_navigation';
const MAZE_NEXUS_ARCHETYPE_ID = 'disc_maze_nexus';

export function isMazeEntranceCell(gs: ReadonlyGameState, cell: Point2): boolean {
  const idx = axialToIndex(cell.x, cell.y);
  if (idx === -1) return false;
  const researchCell = gs.researchCells[idx]!;
  if (!researchCell.owned) return false;
  if (researchCell.nodeId < 0) return false;
  const node = gs.lib.research.nodes.get(researchCell.nodeId)!;
  if (node.archetypeId !== MAZE_ENTRANCE_ARCHETYPE_ID) return false;
  return node.centerCell.x === cell.x && node.centerCell.y === cell.y;
}

export function getOwnedMazeEntrances(gs: ReadonlyGameState): Array<Point2> {
  const entrances: Array<Point2> = [];
  for (const node of gs.lib.research.nodes.values()) {
    if (node.archetypeId !== MAZE_ENTRANCE_ARCHETYPE_ID) continue;
    const idx = axialToIndex(node.centerCell.x, node.centerCell.y);
    if (gs.researchCells[idx]!.owned) {
      entrances.push(copy(node.centerCell));
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
  return node.centerCell.x === cell.x && node.centerCell.y === cell.y;
}

export function getOwnedMazeNexuses(gs: ReadonlyGameState): Array<Point2> {
  const nexuses: Array<Point2> = [];
  for (const node of gs.lib.research.nodes.values()) {
    if (node.archetypeId !== MAZE_NEXUS_ARCHETYPE_ID) continue;
    const idx = axialToIndex(node.centerCell.x, node.centerCell.y);
    if (gs.researchCells[idx]!.owned) {
      nexuses.push(copy(node.centerCell));
    }
  }
  return nexuses;
}

export function syncMazeResetEntranceCell(gs: GameState) {
  if (isMazeEntranceCell(gs, gs.mazeResetEntranceCell)) return;
  for (const node of gs.lib.research.nodes.values()) {
    if (node.archetypeId !== MAZE_ENTRANCE_ARCHETYPE_ID) continue;
    const idx = axialToIndex(node.centerCell.x, node.centerCell.y);
    if (gs.researchCells[idx]!.owned) {
      gs.mazeResetEntranceCell = copy(node.centerCell);
      return;
    }
  }
}

export function computeMazeResourceSpawns(gs: GameState, lib: ResearchLib): void {
  const spawns: MazeResourceSpawn[] = [];
  const origin: Point2 = { x: 0, y: 0 };

  for (const node of lib.nodes.values()) {
    const center = node.centerCell;
    const idx = axialToIndex(center.x, center.y);
    if (idx === -1) continue;
    const cell = gs.researchCells[idx];
    if (!cell?.owned) continue;

    const archetype = lib.archetypes.get(node.archetypeId);
    if (!archetype) continue;

    let resourceKey: 'credits' | 'chronotraces' | 'shardDust' | null = null;

    if (archetype.type === 'gear') {
      resourceKey = 'chronotraces';
    } else if (archetype.type === 'stat') {
      resourceKey = 'credits';
    } else if (archetype.type === 'resource') {
      const isShardResource = archetype.rewards.some(
        r => r.kind === 'resource' && (r as { resource?: string }).resource === 'shardDust'
      );
      resourceKey = isShardResource ? 'shardDust' : 'credits';
    }

    if (!resourceKey) continue;

    const dist = axialDistance(center, origin);
    const amount = Math.max(1, dist);

    spawns.push({ cell: { x: center.x, y: center.y }, resourceKey, amount });
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

  if (researchCell.nodeId < 0) return '';
  const node = gs.lib.research.nodes.get(researchCell.nodeId)!;
  const isCenterCell = node.centerCell.x === cell.x && node.centerCell.y === cell.y;
  if (!isCenterCell) return '';
  const archetype = gs.lib.research.archetypes.get(node.archetypeId)!;
  if (archetype.type === 'resource') return 'cell_is_resource_node';
  if (archetype.type === 'discovery') return 'cell_is_discovery_node';
  if (archetype.type === 'void') return 'cell_is_void_node';

  return '';
}

function isMazeNexusPlacementCellValid(gs: ReadonlyGameState, cell: Point2): boolean {
  return getMazeNexusPlacementCellFailureReason(gs, cell) === '';
}

export function getMazeNexusPlacementFailureReason(gs: ReadonlyGameState, itemId: string, center: Point2): string {
  const cells = getMazeNexusItemPlacementCells(gs, itemId, center);
  for (const cell of cells) {
    const reason = getMazeNexusPlacementCellFailureReason(gs, cell);
    if (reason) return `${reason}@${cell.x},${cell.y}`;
  }
  if (hasMazeNexusLimitRadiusConflict(gs, itemId, center)) return 'limit_radius_overlap';
  return '';
}

export function canPlaceMazeNexusItem(gs: ReadonlyGameState, itemId: string, center: Point2): boolean {
  const cells = getMazeNexusItemPlacementCells(gs, itemId, center);
  for (const cell of cells) {
    if (!isMazeNexusPlacementCellValid(gs, cell)) return false;
  }
  if (hasMazeNexusLimitRadiusConflict(gs, itemId, center)) return false;
  return true;
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
  if (!isMazeNexusCell(gs, gs.maze.avatarCell)) {
    return false;
  }

  const placementFailure = getMazeNexusPlacementFailureReason(gs, itemId, center);
  if (placementFailure) {
    return false;
  }

  const def = gs.lib.nexusItems.get(itemId)!;
  if (gs.timeFlux < def.price) {
    return false;
  }

  gs.timeFlux -= def.price;

  const cells = getMazeNexusItemPlacementCells(gs, itemId, center);
  const placementId = gs.mazeNextNexusPlacementId++;
  for (const cell of cells) {
    applyMazeNexusPlacementAtCell(gs, itemId, placementId, cell);
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
    }
    return;
  }

  // Nexus items: mark as taken when walked over
  const idx = axialToIndex(cell.x, cell.y);
  if (idx !== -1 && gs.researchCells[idx]!.nexusId) {
    applyMazeRefresherBonusOnStep(gs, cell);
    gs.maze.takenCells.push({ x: cell.x, y: cell.y });
  }
}

function applyMazePayout(gs: GameState): void {
  const m = gs.maze;
  // Calculate excess above previous highest
  const payoutCredits = Math.max(0, m.collectedCredits - gs.mazeHighCredits);
  const payoutChronotraces = Math.max(0, m.collectedChronotraces - gs.mazeHighChronotraces);
  const payoutShardDust = Math.max(0, m.collectedShardDust - gs.mazeHighShardDust);

  // Update persistent highs
  gs.mazeHighCredits = Math.max(gs.mazeHighCredits, m.collectedCredits);
  gs.mazeHighChronotraces = Math.max(gs.mazeHighChronotraces, m.collectedChronotraces);
  gs.mazeHighShardDust = Math.max(gs.mazeHighShardDust, m.collectedShardDust);

  // Apply payouts to actual resources
  gs.credits += payoutCredits;
  gs.chronotraces += payoutChronotraces;
  gs.shardDust += payoutShardDust;
}

export interface MazeMoveResult {
  success: boolean;
  path: Point2[];
  forcedReset: boolean;
  payout: boolean;
  nexusReached: boolean;
}

export interface MazeEnterProjection {
  avatarCell: Point2;
  movementUsed: number;
  takenCells: Point2[];
  resetEntranceCell: Point2;
}

export type MazeMoveSegmentPlan = Point2[];

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
    return;
  }

  const idx = axialToIndex(cell.x, cell.y);
  if (idx !== -1 && gs.researchCells[idx]!.nexusId) {
    const refreshed = resolveMazeRefresherStep(gs, cell, projection.takenCells);
    for (const refresh of refreshed) {
      removeProjectionTakenCell(projection, refresh.spawnCell);
    }
    projection.takenCells.push(copy(cell));
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

  if (result.cost === 0) {
    return { success: true, forcedReset: false, payout: false, nexusReached: false };
  }

  if (result.cost !== 1) {
    return { success: false, forcedReset: false, payout: false, nexusReached: false };
  }

  const remainingPool = gs.timeFlux - projection.movementUsed;
  if (remainingPool <= 0) {
    resetProjectionTransient(projection);
    return { success: true, forcedReset: true, payout: false, nexusReached: false };
  }

  projection.movementUsed += 1;
  collectProjectionResourceAtCell(gs, projection, target);
  projection.avatarCell = copy(target);

  return { success: true, forcedReset: false, payout: false, nexusReached: isMazeNexusCell(gs, target) };
}

export interface MazeMoveProjectionResult {
  success: boolean;
  path: Point2[];
  forcedReset: boolean;
  payout: boolean;
  nexusReached: boolean;
}

export function projectMazeMoveTo(
  gs: ReadonlyGameState,
  projection: MazeEnterProjection,
  target: Point2,
): MazeMoveProjectionResult {
  const result = bfsMazePath(gs, projection.avatarCell, target);
  if (!result.reachable) {
    return { success: false, path: [], forcedReset: false, payout: false, nexusReached: false };
  }

  if (result.cost === 0) {
    return { success: true, path: [], forcedReset: false, payout: false, nexusReached: false };
  }

  for (const stepCell of result.path) {
    const stepResult = projectMazeEnterCell(gs, projection, stepCell);
    if (!stepResult.success) {
      return { success: false, path: [], forcedReset: false, payout: false, nexusReached: false };
    }
    if (stepResult.forcedReset) {
      return { success: true, path: [], forcedReset: true, payout: false, nexusReached: false };
    }
  }

  const isEntrance = isMazeEntranceCell(gs, target);
  if (isEntrance) {
    projection.resetEntranceCell = copy(target);
    resetProjectionTransient(projection);
    return { success: true, path: result.path, forcedReset: false, payout: true, nexusReached: false };
  }

  const isNexus = isMazeNexusCell(gs, target);
  return { success: true, path: result.path, forcedReset: false, payout: false, nexusReached: isNexus };
}

function isMazeBonusCell(gs: ReadonlyGameState, projection: MazeEnterProjection, cell: Point2): boolean {
  if (isProjectionCellTaken(projection, cell)) return false;
  const idx = axialToIndex(cell.x, cell.y);
  return idx !== -1 && !!gs.researchCells[idx]!.nexusId;
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
  if (!result.reachable || result.cost === 0) return plan;

  let currentPath: Point2[] = [];
  for (let i = 0; i < result.path.length; i++) {
    const stepCell = copy(result.path[i]!);
    const stopOnResource = isFreshResourceCell(gs, projection, stepCell);
    const stopOnBonus = isMazeBonusCell(gs, projection, stepCell);
    const stepResult = projectMazeEnterCell(gs, projection, stepCell);
    if (!stepResult.success) break;

    if (stepResult.forcedReset) {
      if (currentPath.length > 0) {
        plan.push(copy(currentPath[currentPath.length - 1]!));
        currentPath = [];
      }
      plan.push(copy(stepCell));
      break;
    }

    currentPath.push(stepCell);
    const isLast = i === result.path.length - 1;
    if (!stopOnResource && !stopOnBonus && !stepResult.payout && !stepResult.nexusReached && !isLast) continue;

    plan.push(copy(currentPath[currentPath.length - 1]!));
    currentPath = [];
  }

  return plan;
}

export function handleMazeMoveTo(gs: GameState, target: Point2): MazeMoveResult {
  syncMazeResetEntranceCell(gs);
  const result = bfsMazePath(gs, gs.maze.avatarCell, target);

  if (!result.reachable) {
    return { success: false, path: [], forcedReset: false, payout: false, nexusReached: false };
  }

  if (result.cost === 0) {
    return { success: true, path: [], forcedReset: false, payout: false, nexusReached: false };
  }

  const remainingPool = gs.timeFlux - gs.maze.movementUsed;

  if (result.cost > remainingPool) {
    resetMazeTransient(gs);
    return { success: true, path: result.path, forcedReset: true, payout: false, nexusReached: false };
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
    return { success: true, path: result.path, forcedReset: false, payout: true, nexusReached: false };
  }

  const isNexus = isMazeNexusCell(gs, target);
  return { success: true, path: result.path, forcedReset: false, payout: false, nexusReached: isNexus };
}
